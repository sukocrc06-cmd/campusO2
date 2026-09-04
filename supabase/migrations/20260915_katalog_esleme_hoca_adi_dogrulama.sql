-- CampusO Vol 1-8 devamı: Katalog eşleşmesi artık ders_programi satırının
-- KENDİ hoca_adi metniyle DOĞRULANMADAN akademisyen_id atamıyor.
--
-- BULUNAN HATA: campuso_katalog_esleme(bolum, ders_kodu) SADECE
-- (bölüm, ders kodu) ikilisine bakıp ders_icerikleri kataloğundaki
-- "dersi_veren" alanına göre eşleşiyordu — o SATIRDA yazan hoca_adi'na hiç
-- bakmıyordu. Bu, aynı ders kodunun aynı bölümde farklı dönemlerde (veya
-- aynı dönemde paralel şubelerde) FARKLI hocalar tarafından verildiği
-- durumlarda yanlış eşleşmeye yol açıyordu — örnek (kullanıcının bulduğu
-- gerçek hata): 2026-2027 güz programında BUS201 "Statistics for Business I"
-- İşletme+Uluslararası Ticaret bölümlerinde Ali İhsan ÇETİN, Finans ve
-- Bankacılık+Yönetim Bilişim Sistemleri bölümlerinde İklim Gedik BALAY
-- tarafından veriliyor (ders programı satırlarının hoca_adi alanı bunu
-- doğru gösteriyor) — ama katalog eşlemesi ikisini de aynı kişiye (kataloğun
-- o bölüm+ders kodu için kayıtlı tuttuğu hocaya) bağlamış olabiliyordu.
--
-- ÇÖZÜM: campuso_katalog_esleme'ye üçüncü bir parametre (p_hoca_adi)
-- eklendi. Bu parametre doluysa, katalogdaki adayın normalize edilmiş adı
-- p_hoca_adi ile de eşleşmek ZORUNDA — aksi halde eşleşme reddedilir (satır
-- akademisyen_id boş kalır, admin panelinden elle/onaylı atanması gerekir).
-- Böylece katalog artık sadece "satırda yazan hocayla TUTARLI" olduğu
-- durumda otomatik bağlanıyor; satırın kendi hoca_adi'yla ÇELİŞEN bir
-- kataloğa asla otomatik güvenmiyor.
--
-- Ayrıca zaten yanlış bağlanmış olabilecek mevcut satırlar (eslesme_kaynagi
-- = 'katalog' olan tüm satırlar) bu düzeltilmiş fonksiyonla YENİDEN
-- doğrulanıyor: artık uyuşmuyorsa bağlantı kaldırılıyor ve satırın kendi
-- hoca_adi'na göre bir admin-onay önerisi oluşturuluyor (20260910'daki
-- güvenlik modeliyle tutarlı — sadece serbest isim benzerliği admin onayına
-- düşer).

begin;

create or replace function public.campuso_katalog_esleme(p_bolum text, p_ders_kodu text, p_hoca_adi text default null)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.ders_icerikleri di
  join public.profiles p on p.role = 'academician'
    and public.campuso_ad_eslesiyor_mu(
      public.campuso_normalize_ad(p.full_name),
      public.campuso_normalize_ad(di.dersi_veren)
    )
  where di.ders_kodu = p_ders_kodu
    and (p_bolum is null or di.bolum = p_bolum)
    and di.dersi_veren is not null and di.dersi_veren <> 'Yok'
    -- YENİ: satırda (o dönemin ders programında) yazan hoca_adi doluysa,
    -- katalogdaki aday MUTLAKA bu isimle de eşleşmeli — aksi halde bu,
    -- kataloğun o SPESİFİK şube/dönem için güncel/doğru olmadığı anlamına
    -- gelir ve otomatik bağlanmamalıdır.
    and (
      p_hoca_adi is null or trim(p_hoca_adi) = ''
      or public.campuso_ad_eslesiyor_mu(public.campuso_normalize_ad(p.full_name), public.campuso_normalize_ad(p_hoca_adi))
    )
  order by (di.bolum = p_bolum) desc
  limit 1
$$;

-- BEFORE trigger: katalog eşlemesine artık satırın kendi hoca_adi'sını da veriyoruz.
create or replace function public.campuso_ders_akademisyen_esle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_eslesen_id uuid;
begin
  if coalesce(new.akademisyen_id_manuel, false) or new.akademisyen_id is not null then
    return new;
  end if;

  if new.hoca_email is not null and trim(new.hoca_email) <> '' then
    select p.id into v_eslesen_id from public.profiles p
      where p.role = 'academician' and lower(trim(p.email)) = lower(trim(new.hoca_email))
      limit 1;
    if v_eslesen_id is not null then
      new.akademisyen_id := v_eslesen_id;
      new.eslesme_kaynagi := 'email';
      return new;
    end if;
  end if;

  if new.ders_kodu is not null and trim(new.ders_kodu) <> '' then
    v_eslesen_id := public.campuso_katalog_esleme(new.bolum, new.ders_kodu, new.hoca_adi);
    if v_eslesen_id is not null then
      new.akademisyen_id := v_eslesen_id;
      new.eslesme_kaynagi := 'katalog';
    end if;
  end if;

  return new;
end;
$$;

-- profiles geri-doldur: katalog dalı artık d.hoca_adi ile de tutarlılık arıyor.
create or replace function public.campuso_profil_ders_geri_doldur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role <> 'academician' then
    return new;
  end if;

  if new.email is not null and trim(new.email) <> '' then
    update public.ders_programi d
      set akademisyen_id = new.id, eslesme_kaynagi = 'email'
    where d.akademisyen_id is null and not coalesce(d.akademisyen_id_manuel, false)
      and d.hoca_email is not null and lower(trim(d.hoca_email)) = lower(trim(new.email));
  end if;

  if new.full_name is not null and trim(new.full_name) <> '' then
    -- Katalogla doğrulanan eşleşmeler: otomatik ve güvenilir — AMA satırın
    -- kendi hoca_adi'sı doluysa o da bu isimle uyuşmalı.
    update public.ders_programi d
      set akademisyen_id = new.id, eslesme_kaynagi = 'katalog'
    where d.akademisyen_id is null and not coalesce(d.akademisyen_id_manuel, false)
      and d.ders_kodu is not null
      and (
        d.hoca_adi is null or trim(d.hoca_adi) = ''
        or public.campuso_ad_eslesiyor_mu(public.campuso_normalize_ad(d.hoca_adi), public.campuso_normalize_ad(new.full_name))
      )
      and exists (
        select 1 from public.ders_icerikleri di
        where di.ders_kodu = d.ders_kodu
          and (di.bolum = d.bolum or d.bolum is null)
          and di.dersi_veren is not null and di.dersi_veren <> 'Yok'
          and public.campuso_ad_eslesiyor_mu(public.campuso_normalize_ad(new.full_name), public.campuso_normalize_ad(di.dersi_veren))
      );

    -- Katalogla doğrulanamayan, sadece serbest metin isim benzerliği olanlar:
    -- admin onay kuyruğuna öneri olarak düşer (değişmez).
    insert into public.akademisyen_eslesme_onerileri (ders_id, onerilen_akademisyen_id)
    select d.id, new.id from public.ders_programi d
      where d.akademisyen_id is null and not coalesce(d.akademisyen_id_manuel, false)
        and d.hoca_adi is not null
        and public.campuso_ad_eslesiyor_mu(public.campuso_normalize_ad(d.hoca_adi), public.campuso_normalize_ad(new.full_name))
    on conflict (ders_id) do nothing;
  end if;

  return new;
end;
$$;

-- ders_icerikleri geri-doldur: katalog SONRADAN eklenirse/güncellenirse de
-- artık satırın kendi hoca_adi'sıyla tutarlılık şartı aranıyor.
create or replace function public.campuso_katalog_geri_doldur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.dersi_veren is null or new.dersi_veren = 'Yok' or trim(new.dersi_veren) = '' then
    return new;
  end if;
  update public.ders_programi d
    set akademisyen_id = p.id, eslesme_kaynagi = 'katalog'
  from public.profiles p
  where d.akademisyen_id is null and not coalesce(d.akademisyen_id_manuel, false)
    and d.ders_kodu = new.ders_kodu and (d.bolum = new.bolum or d.bolum is null)
    and p.role = 'academician'
    and public.campuso_ad_eslesiyor_mu(public.campuso_normalize_ad(p.full_name), public.campuso_normalize_ad(new.dersi_veren))
    and (
      d.hoca_adi is null or trim(d.hoca_adi) = ''
      or public.campuso_ad_eslesiyor_mu(public.campuso_normalize_ad(d.hoca_adi), public.campuso_normalize_ad(new.dersi_veren))
    );
  return new;
end;
$$;

-- İKİNCİ (ve asıl kritik) HATA: 20260909 migration'ında akademisyenin
-- SADECE kendi dersinin gün/saatini değiştirebilmesi için eklenen
-- `campuso_ders_akademisyen_sadece_gun_saat` BEFORE UPDATE tetikleyicisi,
-- admin OLMAYAN her UPDATE'te akademisyen_id'yi eski değerine sıfırlıyordu
-- — ama bu "admin değil" kontrolü, gerçek bir kullanıcı oturumu olmayan
-- (auth.uid() NULL olan) durumları da "admin değil" sayıyordu. SQL
-- Editor'dan çalıştırılan migration'lar (ör. 20260912'nin toplu geri-dolgu
-- UPDATE'leri, ders_icerikleri'ye yeni katalog satırı eklendiğinde tetiklenen
-- campuso_katalog_geri_doldur) TAM OLARAK bu duruma düşüyor: gerçek bir
-- kullanıcı oturumu yok, dolayısıyla campuso_current_role() 'admin' dönmüyor
-- ve tetikleyici akademisyen_id'ye yapılan atamayı SESSİZCE İPTAL EDİYORDU
-- — üstelik eslesme_kaynagi alanı bu korumaya dahil olmadığından o
-- "katalog" olarak GÜNCELLENMİŞ GÖRÜNÜYORDU, akademisyen_id ise boş
-- kalıyordu. Bu, hem 20260912'nin hem 20260914 sonrası devreye giren
-- katalog geri-doldurmasının GERÇEKTE HİÇ ÇALIŞMAMIŞ olabileceği anlamına
-- geliyor — sadece "etiket" güncellenmiş, gerçek bağlantı kurulmamış olabilir.
--
-- ÇÖZÜM: koruma sadece GERÇEK bir kullanıcı oturumundan (auth.uid() dolu)
-- gelen, admin olmayan UPDATE'leri kilitlemeli. auth.uid() NULL ise (SQL
-- Editor/migration/sistem bağlamı) bu, tanım gereği kötü niyetli bir öğrenci/
-- akademisyen tarayıcı oturumu OLAMAZ (onlar her zaman giriş yapmış haldedir,
-- auth.uid() dolu gelir) — bu yüzden bu durumda kilit güvenle atlanabilir.
create or replace function public.campuso_ders_akademisyen_sadece_gun_saat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- admin her alanı değiştirebilir; gerçek bir kullanıcı oturumu yoksa
  -- (migration/sistem bağlamı) da kilit uygulanmaz — dokunma.
  if public.campuso_current_role() = 'admin' or auth.uid() is null then
    return new;
  end if;

  -- admin olmayan biri (akademisyenin kendisi) sadece kendi dersini,
  -- sadece gün/başlangıç/bitiş saati alanlarında güncelleyebilir; başka her
  -- alan eski değerine sabitlenir, akademisyen_id ise hiç değiştirilemez.
  new.bolum := old.bolum;
  new.sinif := old.sinif;
  new.ders_kodu := old.ders_kodu;
  new.ders_adi := old.ders_adi;
  new.derslik := old.derslik;
  new.hoca_adi := old.hoca_adi;
  new.akademisyen_id := old.akademisyen_id;
  new.akademisyen_id_manuel := old.akademisyen_id_manuel;
  return new;
end;
$$;

-- ONARIM 1: hâlihazırda eslesme_kaynagi = 'katalog' olan (ve elle
-- atanmamış) TÜM satırları düzeltilmiş 3 parametreli fonksiyonla yeniden
-- doğrula. Artık uyuşmayanların (satırın kendi hoca_adi'sıyla çelişenlerin)
-- akademisyen_id'sini temizle.
update public.ders_programi d
set akademisyen_id = null, eslesme_kaynagi = 'yok'
where d.eslesme_kaynagi = 'katalog'
  and not coalesce(d.akademisyen_id_manuel, false)
  and public.campuso_katalog_esleme(d.bolum, d.ders_kodu, d.hoca_adi) is distinct from d.akademisyen_id;

-- ONARIM 2: az önce boşa düşen (veya daha önce hiç eşleşmemiş) satırlar
-- için, kendi hoca_adi'sına göre doğru katalog eşleşmesini şimdi dene.
update public.ders_programi d
set akademisyen_id = m.akademisyen_id, eslesme_kaynagi = 'katalog'
from (
  select d2.id as ders_id, public.campuso_katalog_esleme(d2.bolum, d2.ders_kodu, d2.hoca_adi) as akademisyen_id
  from public.ders_programi d2
  where d2.akademisyen_id is null and not coalesce(d2.akademisyen_id_manuel, false) and d2.ders_kodu is not null
) m
where d.id = m.ders_id and m.akademisyen_id is not null;

-- ONARIM 3: katalogla doğrulanamayan ama satırın hoca_adi'sı bir
-- akademisyen hesabının adıyla eşleşen satırlar için (örn. İklim Gedik
-- Balay'ın BUS201 güz şubeleri) admin onay kuyruğuna öneri düş —
-- 20260910'daki güvenlik modeliyle tutarlı, admin tek tıkla onaylayabilir.
insert into public.akademisyen_eslesme_onerileri (ders_id, onerilen_akademisyen_id)
select d.id, p.id
from public.ders_programi d
join public.profiles p on p.role = 'academician'
  and public.campuso_ad_eslesiyor_mu(public.campuso_normalize_ad(p.full_name), public.campuso_normalize_ad(d.hoca_adi))
where d.akademisyen_id is null and not coalesce(d.akademisyen_id_manuel, false)
  and d.hoca_adi is not null and trim(d.hoca_adi) <> ''
on conflict (ders_id) do nothing;

commit;
