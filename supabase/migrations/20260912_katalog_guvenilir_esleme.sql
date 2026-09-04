-- CampusO Vol 1-8 devamı: ders_icerikleri kataloğunu (AYBÜ'nün resmi Bologna
-- sitesinden çekilen, öğretim üyesi bilgisi dahil ders kataloğu) GÜVENİLİR
-- üçüncü bir eşleşme kaynağı olarak devreye sokuyoruz.
--
-- 20260910 migration'ı ile isim eşleşmesini admin onayına düşürmüştük (haklı
-- bir güvenlik nedeniyle: herkes profilindeki adını değiştirebiliyordu).
-- Ama bunun bir yan etkisi oldu: yeni ders_programi satırları artık isimle
-- OTOMATİK bağlanmıyor, admin her birini tek tek onaylamadan akademisyen_id
-- boş kalıyor — bu da Yoklama modülünü (akademisyen_id şart koşuyor) kilitliyor.
--
-- Çözüm: ders_icerikleri, kullanıcıların DEĞİŞTİREMEYECEĞİ, AYBÜ'nün resmi
-- sitesinden admin tarafından çekilen bir katalog. Bu yüzden e-posta kadar
-- güvenilir kabul edilebilir: bir ders_programi satırının (bölüm, ders kodu)
-- ikilisi, katalogdaki AYNI (bölüm, ders kodu) için kayıtlı "dersi_veren" ile
-- normalize edilmiş isim olarak eşleşiyorsa, akademisyen_id OTOMATİK ve
-- ONAY GEREKMEDEN bağlanır — tıpkı e-posta eşleşmesi gibi.
--
-- Bu migration ayrıca: (a) hâlihazırda onay bekleyen ama katalogla doğrulanan
-- öneri kayıtlarını otomatik onaylar, (b) hâlâ hiçbir hesaba bağlanmamış
-- ders_programi satırlarını katalogla eşleştirmeyi dener. Böylece "akademisyen
-- kayıt olduğunda/ders programı yüklendiğinde adına tanımlı TÜM dersler
-- otomatik gelsin" hedefine, güvenlik açığı açmadan ulaşılmış olur.

begin;

alter table public.ders_programi
  drop constraint if exists ders_programi_eslesme_kaynagi_check;
alter table public.ders_programi
  add constraint ders_programi_eslesme_kaynagi_check
  check (eslesme_kaynagi in ('yok', 'email', 'katalog', 'admin_onay', 'admin_manuel'));

-- Bir ders_programi satırının (bölüm, ders kodu) ikilisi, resmi katalogda
-- (ders_icerikleri) kayıtlı öğretim üyesiyle normalize edilmiş isim olarak
-- eşleşen bir akademisyen var mı? Varsa id'sini döndürür.
create or replace function public.campuso_katalog_esleme(p_bolum text, p_ders_kodu text)
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
  order by (di.bolum = p_bolum) desc
  limit 1
$$;

-- BEFORE trigger: e-postadan sonra artık katalog eşleşmesini de dener
-- (ikisi de güvenilir kaynak, otomatik bağlar — admin onayı gerekmez).
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
    v_eslesen_id := public.campuso_katalog_esleme(new.bolum, new.ders_kodu);
    if v_eslesen_id is not null then
      new.akademisyen_id := v_eslesen_id;
      new.eslesme_kaynagi := 'katalog';
    end if;
  end if;

  return new;
end;
$$;

-- profiles: e-posta ve katalog eşleşmesi artık İKİSİ de otomatik ve
-- güvenilir; sadece SERBEST isim benzerliği (kataloğun doğrulamadığı)
-- admin onayına düşmeye devam eder.
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
    -- Katalogla doğrulanan eşleşmeler: otomatik ve güvenilir.
    update public.ders_programi d
      set akademisyen_id = new.id, eslesme_kaynagi = 'katalog'
    where d.akademisyen_id is null and not coalesce(d.akademisyen_id_manuel, false)
      and d.ders_kodu is not null
      and exists (
        select 1 from public.ders_icerikleri di
        where di.ders_kodu = d.ders_kodu
          and (di.bolum = d.bolum or d.bolum is null)
          and di.dersi_veren is not null and di.dersi_veren <> 'Yok'
          and public.campuso_ad_eslesiyor_mu(public.campuso_normalize_ad(new.full_name), public.campuso_normalize_ad(di.dersi_veren))
      );

    -- Katalogla doğrulanamayan, sadece serbest metin isim benzerliği olanlar:
    -- admin onay kuyruğuna öneri olarak düşer (değişmez, güvenlik gerekçesi
    -- 20260910'daki gibi geçerliliğini koruyor).
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

-- Katalog, ders_icerikleri'ye SONRADAN eklenir/güncellenirse (yeni dönem
-- yüklenirse), o kataloga göre daha önce eşleşememiş ders_programi
-- satırlarını yeniden dener.
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
    and public.campuso_ad_eslesiyor_mu(public.campuso_normalize_ad(p.full_name), public.campuso_normalize_ad(new.dersi_veren));
  return new;
end;
$$;

drop trigger if exists ders_icerikleri_katalog_geri_doldur on public.ders_icerikleri;
create trigger ders_icerikleri_katalog_geri_doldur
  after insert or update of dersi_veren, ders_kodu, bolum on public.ders_icerikleri
  for each row execute function public.campuso_katalog_geri_doldur();

-- Tek seferlik geri dolgu 1: hâlâ hiçbir hesaba bağlanmamış ders_programi
-- satırlarını, resmi katalogla ŞİMDİ eşleştir (örn. Ali İhsan Çetin'in yeni
-- ders programı yüklendiğinde bu adım onu otomatik bağlar).
update public.ders_programi d
set akademisyen_id = m.akademisyen_id, eslesme_kaynagi = 'katalog'
from (
  select d2.id as ders_id, public.campuso_katalog_esleme(d2.bolum, d2.ders_kodu) as akademisyen_id
  from public.ders_programi d2
  where d2.akademisyen_id is null and not coalesce(d2.akademisyen_id_manuel, false) and d2.ders_kodu is not null
) m
where d.id = m.ders_id and m.akademisyen_id is not null;

-- Tek seferlik geri dolgu 2: onay bekleyen öneriler arasında katalogla da
-- doğrulananları otomatik onayla (admin'in elle tıklamasına gerek kalmadan).
with dogrulanan as (
  select o.id as oneri_id, o.ders_id, o.onerilen_akademisyen_id
  from public.akademisyen_eslesme_onerileri o
  join public.ders_programi d on d.id = o.ders_id
  where o.durum = 'bekliyor'
    and d.ders_kodu is not null
    and public.campuso_katalog_esleme(d.bolum, d.ders_kodu) = o.onerilen_akademisyen_id
)
update public.ders_programi d
set akademisyen_id = dg.onerilen_akademisyen_id, eslesme_kaynagi = 'katalog'
from dogrulanan dg
where d.id = dg.ders_id and d.akademisyen_id is null and not coalesce(d.akademisyen_id_manuel, false);

with dogrulanan as (
  select o.id as oneri_id, o.ders_id, o.onerilen_akademisyen_id
  from public.akademisyen_eslesme_onerileri o
  join public.ders_programi d on d.id = o.ders_id
  where o.durum = 'bekliyor'
    and d.ders_kodu is not null
    and public.campuso_katalog_esleme(d.bolum, d.ders_kodu) = o.onerilen_akademisyen_id
)
update public.akademisyen_eslesme_onerileri o
set durum = 'onaylandi', karar_zamani = now()
from dogrulanan dg
where o.id = dg.oneri_id;

commit;
