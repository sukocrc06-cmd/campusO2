-- CampusO Vol 1: QR Kodla Ders Yoklaması — Yoklama Takibi'ne (yoklama_oturumlari /
-- yoklama_kayitlari) TAM ENTEGRASYON.
--
-- Önceden var olan "Acadex Vol 1" QR prototipi tamamen ayrı bir Neon Postgres
-- veritabanına (campuso_courses/campuso_attendance_sessions/...) yazıyordu ve
-- akademisyenin kendi elle yazdığı "ders grubu" kavramına dayanıyordu — admin
-- panelindeki ders_programi/akademisyen_id ile hiçbir bağlantısı yoktu ve
-- Yoklama Takibi'nin (20260902_yoklama_takibi.sql) tamamen dışında ikinci bir
-- yoklama geçmişi oluşturuyordu.
--
-- Bu migration QR yoklamasını TEK bir sisteme, mevcut Yoklama Takibi'ne
-- taşır: QR ile alınan yoklama da elle alınanla AYNI yoklama_oturumlari /
-- yoklama_kayitlari satırlarına yazılır. Böylece:
--   * Ders listesi ders_programi'den (akademisyen_id) gelir — admin panelinde
--     akademisyene tanımlı ne kadar ders varsa QR oluşturma ekranında listelenir.
--   * Admin ve akademisyenin zaten kullandığı Yoklama Takibi panelleri, QR ile
--     alınan yoklamaları da otomatik gösterir — ekstra admin kodu gerekmez.
--   * Devam yüzdesi tek yerden (devamYuzdesiHesapla) hesaplanır.
--
-- Güvenlik: QR token'ı AYRI bir tabloda (yoklama_qr_oturumlari) tutulur ve bu
-- tabloya öğrenciler için HİÇBİR select politikası yoktur — öğrenci token'a
-- yalnızca aşağıdaki campuso_qr_yoklama_kaydet() SECURITY DEFINER fonksiyonu
-- üzerinden, ekranda hiç düz metin olarak göstermeden ulaşabilir. Bu, akademisyen
-- ekranında QR'ın altında okunabilir bir kod GÖSTERİLMEMESİYLE birlikte, o kodun
-- API üzerinden de sızdırılamamasını sağlar.
--
-- Yoklama, öğrencinin QR oturumu oluşturulduğu anda tohumlanan roster'daki
-- (bölüm/sınıf eşleşmesi + override) bir satırı olması şartına bağlıdır — yani
-- yalnızca o derse kayıtlı görünen öğrenciler QR okutarak yoklamaya girebilir.

begin;

-- ÖNEMLİ DÜZELTME (bu QR özelliğinden bağımsız, 20260902_yoklama_takibi.sql'den
-- kalma önceden var olan bir hata): yoklama_oturumlari_select politikası
-- yoklama_kayitlari'na, yoklama_kayitlari_select/write politikaları da
-- yoklama_oturumlari'na İÇİÇE (inline exists alt sorgusu olarak) referans
-- veriyordu. Postgres, RLS politikalarını birbirinin içine yeniden yazarken
-- bu karşılıklı referansı bir döngü olarak tespit ediyor ve gerçek bir
-- öğrenci/akademisyen bu tabloları normal (anon key + kullanıcı oturumu,
-- yani RLS'in gerçekten uygulandığı) şekilde sorguladığında
-- "infinite recursion detected in policy" hatasıyla karşılaşıyordu — bu,
-- örneğin /student/yoklamalarim sayfasını gerçek kullanıcı için kırıyordu.
-- Yerel Postgres'te aynen üretilip doğrulandı. Çözüm: karşılıklı exists
-- alt sorgularını SECURITY DEFINER fonksiyon çağrılarına çeviriyoruz — bir
-- fonksiyon çağrısı planlayıcı için "kara kutu"dur, RLS yeniden yazımına
-- iç içe dahil edilmez, bu yüzden döngü oluşmaz (campuso_ders_akademisyeni_mi
-- zaten aynı prensiple ders_programi'ye erişiyor).

create or replace function public.campuso_yoklama_oturum_akademisyeni_mi(p_oturum_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.yoklama_oturumlari yo
    where yo.id = p_oturum_id and public.campuso_ders_akademisyeni_mi(yo.ders_programi_id)
  );
$$;

create or replace function public.campuso_ogrenci_oturumda_mi(p_oturum_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.yoklama_kayitlari yk
    where yk.oturum_id = p_oturum_id and yk.ogrenci_id = auth.uid()
  );
$$;

drop policy if exists yoklama_kayitlari_select on public.yoklama_kayitlari;
create policy yoklama_kayitlari_select on public.yoklama_kayitlari
  for select using (
    ogrenci_id = auth.uid()
    or public.campuso_current_role() = 'admin'
    or public.campuso_yoklama_oturum_akademisyeni_mi(oturum_id)
  );

drop policy if exists yoklama_kayitlari_write on public.yoklama_kayitlari;
create policy yoklama_kayitlari_write on public.yoklama_kayitlari
  for all using (
    public.campuso_current_role() = 'admin'
    or public.campuso_yoklama_oturum_akademisyeni_mi(oturum_id)
  )
  with check (
    public.campuso_current_role() = 'admin'
    or public.campuso_yoklama_oturum_akademisyeni_mi(oturum_id)
  );

drop policy if exists yoklama_oturumlari_select on public.yoklama_oturumlari;
create policy yoklama_oturumlari_select on public.yoklama_oturumlari
  for select using (
    public.campuso_ders_akademisyeni_mi(ders_programi_id)
    or public.campuso_current_role() = 'admin'
    or public.campuso_ogrenci_oturumda_mi(id)
  );

create table if not exists public.yoklama_qr_oturumlari (
  oturum_id uuid primary key references public.yoklama_oturumlari(id) on delete cascade,
  token text not null,
  gecerlilik_bitis timestamptz not null,
  baslatan_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists yoklama_qr_oturumlari_token_idx on public.yoklama_qr_oturumlari(token);

alter table public.yoklama_qr_oturumlari enable row level security;

-- Yalnızca dersin akademisyeni veya admin bu satırı görebilir/yönetebilir
-- (aktif QR'ın süresini/token'ını okuyup ekranda göstermek için). Öğrenciler
-- için KASITLI OLARAK hiçbir select politikası yok.
drop policy if exists yoklama_qr_oturumlari_akademisyen on public.yoklama_qr_oturumlari;
create policy yoklama_qr_oturumlari_akademisyen on public.yoklama_qr_oturumlari
  for all using (
    public.campuso_current_role() = 'admin'
    or public.campuso_yoklama_oturum_akademisyeni_mi(oturum_id)
  )
  with check (
    public.campuso_current_role() = 'admin'
    or public.campuso_yoklama_oturum_akademisyeni_mi(oturum_id)
  );

-- Akademisyen (veya admin) kendi dersi için bugüne ait bir QR yoklama oturumu
-- başlatır/yeniler. Roster'ı 'yok' olarak tohumlar ki devam yüzdesi hesabı
-- elle yoklamayla tutarlı kalsın (QR okutma yalnızca kendi satırını 'var'a
-- yükseltir). Aynı gün için tekrar çağrılırsa token'ı YENİLER — böylece eski
-- bir QR görüntüsü (örn. fotoğrafı paylaşılmış olsa bile) anında geçersiz olur.
create or replace function public.campuso_qr_yoklama_baslat(p_ders_id uuid, p_sure_dk integer default 3)
returns table(qr_oturum_id uuid, token text, gecerlilik_bitis timestamptz, ders_kodu text, ders_adi text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ders record;
  v_oturum_id uuid;
  v_token text;
  v_bitis timestamptz;
  v_sure integer := greatest(1, least(10, coalesce(p_sure_dk, 3)));
begin
  if not (public.campuso_ders_akademisyeni_mi(p_ders_id) or public.campuso_current_role() = 'admin') then
    raise exception 'Bu ders için yoklama başlatma yetkiniz yok.';
  end if;

  select * into v_ders from public.ders_programi where id = p_ders_id;
  if not found then
    raise exception 'Ders bulunamadı.';
  end if;

  v_token := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_bitis := now() + (v_sure || ' minutes')::interval;

  insert into public.yoklama_oturumlari (ders_programi_id, tarih, olusturan_id)
  values (p_ders_id, current_date, auth.uid())
  on conflict (ders_programi_id, tarih) do update set updated_at = now()
  returning id into v_oturum_id;

  insert into public.yoklama_qr_oturumlari (oturum_id, token, gecerlilik_bitis, baslatan_id)
  values (v_oturum_id, v_token, v_bitis, auth.uid())
  on conflict (oturum_id) do update
    set token = excluded.token, gecerlilik_bitis = excluded.gecerlilik_bitis, baslatan_id = excluded.baslatan_id, created_at = now();

  -- Roster'ı tohumla: bölüm/sınıf varsayılanı + override(dahil=true), override(dahil=false) hariç.
  insert into public.yoklama_kayitlari (oturum_id, ogrenci_id, durum)
  select v_oturum_id, p.id, 'yok'
  from public.profiles p
  where p.role = 'student' and p.bolum = v_ders.bolum and p.sinif = v_ders.sinif
    and not exists (
      select 1 from public.yoklama_ogrenci_override o
      where o.ders_programi_id = p_ders_id and o.ogrenci_id = p.id and o.dahil = false
    )
  on conflict (oturum_id, ogrenci_id) do nothing;

  insert into public.yoklama_kayitlari (oturum_id, ogrenci_id, durum)
  select v_oturum_id, o.ogrenci_id, 'yok'
  from public.yoklama_ogrenci_override o
  where o.ders_programi_id = p_ders_id and o.dahil = true
  on conflict (oturum_id, ogrenci_id) do nothing;

  return query select v_oturum_id, v_token, v_bitis, v_ders.ders_kodu, v_ders.ders_adi;
end;
$$;

-- Öğrenci QR'ı okuttuğunda çağrılır. Token'ı doğrular, süresini kontrol eder,
-- öğrencinin bu dersin roster'ında (yoklama_kayitlari'nda önceden tohumlanmış
-- bir satırı) olup olmadığını kontrol eder ve yalnızca o zaman 'var' yapar.
-- Kısa ders içeriği özetini (ders_icerikleri kataloğundan) de döndürür ki
-- öğrenci ekranındaki başarı pop-up'ında gösterilebilsin.
create or replace function public.campuso_qr_yoklama_kaydet(p_token text)
returns table(basarili boolean, mesaj text, ders_kodu text, ders_adi text, bolum text, icerik_ozet text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_oturum record;
  v_ders record;
  v_kayit record;
  v_icerik text;
begin
  if v_uid is null or public.campuso_current_role() <> 'student' then
    return query select false, 'Bu işlem yalnızca öğrenci hesaplarıyla yapılabilir.', null::text, null::text, null::text, null::text;
    return;
  end if;

  select yo.* into v_oturum
  from public.yoklama_qr_oturumlari yo
  where yo.token = upper(trim(coalesce(p_token, '')))
  limit 1;

  if not found or v_oturum.gecerlilik_bitis <= now() then
    return query select false, 'Bu QR kodun süresi dolmuş veya geçersiz. Akademisyenden yeni bir QR istemelisin.', null::text, null::text, null::text, null::text;
    return;
  end if;

  -- yoklama_qr_oturumlari.oturum_id = yoklama_oturumlari.id; dersi oturum üzerinden bul.
  select dp.* into v_ders
  from public.ders_programi dp
  join public.yoklama_oturumlari yko on yko.ders_programi_id = dp.id
  where yko.id = v_oturum.oturum_id;

  select yk.* into v_kayit
  from public.yoklama_kayitlari yk
  where yk.oturum_id = v_oturum.oturum_id and yk.ogrenci_id = v_uid;

  if not found then
    return query select false, 'Bu ders bölüm/sınıfına kayıtlı görünmüyorsun. Akademisyeninin seni Yoklama Takibi panelinden elle eklemesi gerekiyor.', v_ders.ders_kodu, v_ders.ders_adi, v_ders.bolum, null::text;
    return;
  end if;

  if v_kayit.durum = 'yok' then
    update public.yoklama_kayitlari set durum = 'var' where id = v_kayit.id;
  end if;

  select left(coalesce(nullif(di.icerik, ''), nullif(di.amac, ''), ''), 220) into v_icerik
  from public.ders_icerikleri di
  where di.ders_kodu = v_ders.ders_kodu and (v_ders.bolum is null or di.bolum = v_ders.bolum)
  order by (di.bolum = v_ders.bolum) desc
  limit 1;

  return query select true, 'Derse başarıyla katılım sağladınız, devamsızlıklarınıza Yoklama Takibi''nden bakabilirsiniz.', v_ders.ders_kodu, v_ders.ders_adi, v_ders.bolum, v_icerik;
end;
$$;

commit;
