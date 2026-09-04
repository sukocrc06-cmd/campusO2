-- CampusO Vol 1-8 devamı: Öğrenci Ders Kayıt Sistemi.
--
-- BULUNAN İHTİYAÇ: öğrenci paneli, öğrencinin bölüm/sınıfına ait TÜM resmi
-- ders programını (ve sınav takvimini) otomatik gösteriyordu — öğrenci hiçbir
-- şey seçmeden. Kullanıcının isteği: öğrenci CampusO'ya kayıt olduktan sonra
-- ders/sınav takvimi BOŞ başlamalı; öğrenci bu dönem aldığı dersleri kendisi
-- (ders_programi satırlarından, section/hoca bazında) seçerek eklemeli. Bir
-- öğrenci bir derse kayıt olduğunda o dersin akademisyenine bildirim gitmeli
-- ve o öğrenci artık akademisyenin QR/Yoklama Takibi roster'ında görünmeli.
--
-- TASARIM: mevcut QR/Yoklama Takibi mimarisi zaten "roster" kavramını
-- yoklama_ogrenci_override tablosuyla (elle ekle/çıkar) çözmüştü — bu
-- migration roster'ın VARSAYILAN kaynağını "bölüm/sınıf eşleşmesi"nden
-- "gerçek ders kaydı"na (ders_kayitlari) çeviriyor; override mekanizması
-- (akademisyenin elle ekleme/çıkarma yetkisi) aynen korunuyor. Böylece
-- campuso_qr_yoklama_baslat, yoklama_kayitlari, yoklama_oturumlari,
-- rosterBirlestir/ekstraDahilEdilenler gibi hiçbir mevcut altyapı atılmıyor
-- — yalnızca "varsayılan roster" sorgusunun kaynağı değişiyor.

begin;

-- 1) Öğrencinin bu dönem aldığı dersler — her satır TEK bir ders_programi
--    satırına (yani belirli bir bölüm/şube + hoca kombinasyonuna) bağlanır,
--    çünkü aynı ders kodu farklı bölümlerde farklı hocalar tarafından
--    verilebiliyor (bkz. BUS201 örneği) — öğrenci doğru şubeyi seçmiş olur.
create table if not exists public.ders_kayitlari (
  id uuid primary key default gen_random_uuid(),
  ogrenci_id uuid not null references auth.users(id) on delete cascade,
  ders_programi_id uuid not null references public.ders_programi(id) on delete cascade,
  donem text not null,
  created_at timestamptz not null default now(),
  unique (ogrenci_id, ders_programi_id)
);

create index if not exists ders_kayitlari_ogrenci_idx on public.ders_kayitlari(ogrenci_id);
create index if not exists ders_kayitlari_ders_idx on public.ders_kayitlari(ders_programi_id);

alter table public.ders_kayitlari enable row level security;

drop policy if exists ders_kayitlari_select on public.ders_kayitlari;
create policy ders_kayitlari_select on public.ders_kayitlari
  for select using (
    ogrenci_id = auth.uid()
    or public.campuso_current_role() = 'admin'
    or public.campuso_ders_akademisyeni_mi(ders_programi_id)
  );

-- Öğrenci yalnızca KENDİ hesabına, öğrenci rolündeyken ders ekleyebilir.
drop policy if exists ders_kayitlari_insert on public.ders_kayitlari;
create policy ders_kayitlari_insert on public.ders_kayitlari
  for insert with check (
    ogrenci_id = auth.uid() and public.campuso_current_role() = 'student'
  );

-- Öğrenci kendi kaydını silebilir (dersten çıkma); admin de düzenleyebilir.
drop policy if exists ders_kayitlari_delete on public.ders_kayitlari;
create policy ders_kayitlari_delete on public.ders_kayitlari
  for delete using (
    ogrenci_id = auth.uid() or public.campuso_current_role() = 'admin'
  );

-- 2) Akademisyene "bir öğrenci dersine kayıt oldu" bildirimi — mevcut
--    kampus_duvari_bildirimleri tablosunu (aynı bell/okundu mekanizması)
--    yeni bir "ders_kaydi" tipiyle genişleterek kullanıyoruz.
do $$
declare v_con text;
begin
  select conname into v_con from pg_constraint
    where conrelid = 'public.kampus_duvari_bildirimleri'::regclass
      and contype = 'c' and pg_get_constraintdef(oid) ilike '%tip%';
  if v_con is not null then
    execute format('alter table public.kampus_duvari_bildirimleri drop constraint %I', v_con);
  end if;
end $$;

alter table public.kampus_duvari_bildirimleri
  add constraint kampus_duvari_bildirimleri_tip_check check (tip in ('yorum', 'duyuru', 'etiket', 'ders_kaydi'));

alter table public.kampus_duvari_bildirimleri
  add column if not exists ders_programi_id uuid references public.ders_programi(id) on delete cascade;

create or replace function public.campuso_ders_kayit_bildirim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_akademisyen_id uuid;
begin
  select akademisyen_id into v_akademisyen_id
  from public.ders_programi where id = new.ders_programi_id;

  if v_akademisyen_id is not null then
    insert into public.kampus_duvari_bildirimleri (kullanici_id, tip, olusturan_id, ders_programi_id)
    values (v_akademisyen_id, 'ders_kaydi', new.ogrenci_id, new.ders_programi_id);
  end if;

  return new;
end;
$$;

drop trigger if exists campuso_ders_kayit_bildirim_trg on public.ders_kayitlari;
create trigger campuso_ders_kayit_bildirim_trg
  after insert on public.ders_kayitlari
  for each row execute function public.campuso_ders_kayit_bildirim();

-- 3) Bir dersin roster'ı artık GERÇEK kayıt üzerinden — bölüm/sınıf eşleşen
--    campuso_ogrenci_listesi'nin (bölüm/sınıf bazlı, elle yoklama panelinde
--    kullanılıyordu) yerini alan, tek bir ders_programi satırına kayıtlı
--    öğrencileri dönen fonksiyon.
create or replace function public.campuso_ders_kayitli_ogrenciler(p_ders_id uuid)
returns table(id uuid, full_name text, avatar_url text, hero_renk text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not (public.campuso_ders_akademisyeni_mi(p_ders_id) or public.campuso_current_role() = 'admin') then
    raise exception 'Bu listeye erişim yetkiniz yok.';
  end if;
  return query
    select p.id, p.full_name, p.avatar_url, p.hero_renk
    from public.ders_kayitlari dk
    join public.profiles p on p.id = dk.ogrenci_id and p.role = 'student'
    where dk.ders_programi_id = p_ders_id
    order by p.full_name;
end;
$$;

-- 4) QR yoklama roster tohumlaması: bölüm/sınıf yerine artık ders_kayitlari
--    kaynak alınıyor (override mekanizması aynen korunuyor).
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

  -- Roster'ı tohumla: GERÇEK ders kaydı + override(dahil=true), override(dahil=false) hariç.
  insert into public.yoklama_kayitlari (oturum_id, ogrenci_id, durum)
  select v_oturum_id, dk.ogrenci_id, 'yok'
  from public.ders_kayitlari dk
  where dk.ders_programi_id = p_ders_id
    and not exists (
      select 1 from public.yoklama_ogrenci_override o
      where o.ders_programi_id = p_ders_id and o.ogrenci_id = dk.ogrenci_id and o.dahil = false
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

-- 5) QR okutma reddi mesajı artık "bölüm/sınıf" değil "ders kaydı" diline
--    göre güncellendi (davranış aynı: roster'da satırı yoksa reddedilir).
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

  select dp.* into v_ders
  from public.ders_programi dp
  join public.yoklama_oturumlari yko on yko.ders_programi_id = dp.id
  where yko.id = v_oturum.oturum_id;

  select yk.* into v_kayit
  from public.yoklama_kayitlari yk
  where yk.oturum_id = v_oturum.oturum_id and yk.ogrenci_id = v_uid;

  if not found then
    return query select false, 'Bu derse kayıtlı görünmüyorsun. Önce öğrenci panelinden Ders Kayıt sayfasından bu dersi seçmen gerekiyor (ya da akademisyeninin seni Yoklama Takibi panelinden elle eklemesi gerekiyor).', v_ders.ders_kodu, v_ders.ders_adi, v_ders.bolum, null::text;
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
