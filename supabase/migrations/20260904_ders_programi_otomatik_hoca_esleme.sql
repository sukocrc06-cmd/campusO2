-- CampusO Vol 1-8 devamı: Ders programı satırlarını akademisyen hesaplarına
-- OTOMATIK ve KALICI şekilde eşleştirme.
--
-- Sorun: ders_programi.akademisyen_id şu ana kadar yalnızca admin panelinde
-- Excel/manuel ekleme YAPILDIĞI ANDA, ve yalnızca "Öğretim Üyesi" hücresinin
-- profiles.full_name ile TAM BİREBİR (unvansız) eşleşmesi halinde dolduruluyordu.
-- Gerçek ders programlarında hoca adı hep unvanla birlikte yazılır
-- ("Dr.Öğr.Üyesi Ali İhsan ÇETİN" gibi), bu da tam eşleşmeyi neredeyse hiç
-- tutturamıyordu; üstelik akademisyen hesabı ders programı yüklendikten
-- SONRA açılırsa hiçbir otomatik eşleşme tetiklenmiyordu.
--
-- Bu migration iki yönlü, veritabanı seviyesinde çalışan bir otomatik eşleme
-- kurar (hangi ekrandan veri girilirse girilsin çalışır):
--   1) ders_programi'ye yeni bir satır eklendiğinde/güncellendiğinde: hoca_adi
--      unvanlardan arındırılıp normalize edilir, eşleşen bir akademisyen
--      profili varsa akademisyen_id otomatik dolar.
--   2) Bir kullanıcı akademisyen rolü alıp/adını girdiğinde (yeni kayıt,
--      admin daveti, rol değişikliği — hepsi): daha önce hiçbir hesaba
--      bağlanamamış ders_programi satırları arasında adıyla eşleşenler
--      otomatik olarak bu yeni hesaba bağlanır.
-- Böylece "tabloda ismi geçen ama henüz kayıt olmamış" bir hoca sisteme
-- kaydolduğu an, geçmişte yüklenmiş bütün dersleri otomatik kendi hesabına
-- işlenmiş olur — elle hiçbir şey yapmaya gerek kalmaz.

begin;

-- 0) Admin, Yoklama Yönetimi ekranından bir dersin hocasını ELLE atar ya da
--    bilerek boşa alırsa, bu tercih otomatik eşlemeler tarafından ezilmemeli.
--    Bu yüzden "elle karar verildi mi" bilgisini ayrı bir bayrakta tutuyoruz.
alter table public.ders_programi add column if not exists akademisyen_id_manuel boolean not null default false;

-- 1) İsim normalize edici: küçük harfe çevirir, Türkçe harfleri sadeleştirir,
--    yaygın akademik unvanları ("Prof.Dr.", "Doç.Dr.", "Dr.Öğr.Üyesi",
--    "Öğr.Gör.Dr.", "Arş.Gör.Dr.", "Öğr.Gör.", "Arş.Gör.", "Dr.") ve noktalama
--    işaretlerini temizler, fazla boşlukları tek boşluğa indirger.
create or replace function public.campuso_normalize_ad(p_ad text)
returns text
language sql
immutable
as $$
  -- Not: Türkçe harfler önce translate() ile sadeleştiriliyor (translate 1-1
  -- karakter eşlemesi yapar, sunucu "locale"ından bağımsız çalışır), ASCII
  -- harfler için küçültme (lower) ondan SONRA uygulanıyor — Postgres
  -- sunucusunun locale ayarı Ç/Ö/Ü/Ş/Ğ/İ gibi harfleri lower() ile doğru
  -- küçültmeyebilir, bu yüzden sıralama önemli.
  select trim(
    regexp_replace(
      regexp_replace(
        lower(
          translate(
            coalesce(p_ad, ''),
            'ıİüÜöÖçÇşŞğĞ',
            'iiuuooccssgg'
          )
        ),
        '\y(prof|doc|dr|ogr|uyesi|gor|ars)\y\.?',
        '',
        'gi'
      ),
      '\s+', ' ', 'g'
    )
  )
$$;

-- 2) İki isim (unvansız/normalize edilmiş) birbiriyle eşleşiyor mu?
--    Önce tam eşleşme aranır; yoksa (çok kısa/genel isimlerde yanlış
--    eşleşmeyi azaltmak için en az 6 karakter şartıyla) birbirini içerip
--    içermediğine bakılır — öğrenci tarafındaki hocaEslesiyorMu ile aynı
--    mantık, sadece veritabanı tarafında da kalıcı hale getiriliyor.
create or replace function public.campuso_ad_eslesiyor_mu(p_ad1 text, p_ad2 text)
returns boolean
language sql
immutable
as $$
  select
    p_ad1 is not null and p_ad2 is not null and p_ad1 <> '' and p_ad2 <> ''
    and (
      p_ad1 = p_ad2
      or (length(p_ad1) >= 6 and position(p_ad1 in p_ad2) > 0)
      or (length(p_ad2) >= 6 and position(p_ad2 in p_ad1) > 0)
    )
$$;

-- 3) ders_programi'ye satır eklenirken/güncellenirken hoca_adi'na göre
--    akademisyen_id'yi otomatik doldur (zaten elle atanmışsa dokunma).
create or replace function public.campuso_ders_akademisyen_esle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm_hoca text;
  v_eslesen_id uuid;
begin
  if not coalesce(new.akademisyen_id_manuel, false) and new.akademisyen_id is null and new.hoca_adi is not null and trim(new.hoca_adi) <> '' then
    v_norm_hoca := public.campuso_normalize_ad(new.hoca_adi);

    select p.id into v_eslesen_id
    from public.profiles p
    where p.role = 'academician'
      and public.campuso_ad_eslesiyor_mu(public.campuso_normalize_ad(p.full_name), v_norm_hoca)
    order by (public.campuso_normalize_ad(p.full_name) = v_norm_hoca) desc, p.full_name
    limit 1;

    if v_eslesen_id is not null then
      new.akademisyen_id := v_eslesen_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ders_programi_akademisyen_esle on public.ders_programi;
create trigger ders_programi_akademisyen_esle
  before insert or update on public.ders_programi
  for each row execute function public.campuso_ders_akademisyen_esle();

-- 4) Bir profil akademisyen rolü alıp/adını güncellediğinde, o ana kadar
--    hiçbir hesaba bağlanmamış ders_programi satırlarını (adı eşleşenleri)
--    otomatik olarak bu hesaba bağla.
create or replace function public.campuso_profil_ders_geri_doldur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'academician' and new.full_name is not null and trim(new.full_name) <> '' then
    update public.ders_programi d
    set akademisyen_id = new.id
    where d.akademisyen_id is null
      and not coalesce(d.akademisyen_id_manuel, false)
      and d.hoca_adi is not null
      and public.campuso_ad_eslesiyor_mu(public.campuso_normalize_ad(d.hoca_adi), public.campuso_normalize_ad(new.full_name));
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_ders_geri_doldur on public.profiles;
create trigger profiles_ders_geri_doldur
  after insert or update of role, full_name on public.profiles
  for each row execute function public.campuso_profil_ders_geri_doldur();

-- 5) Tek seferlik geri dolgu: migration'dan önce eklenmiş, hâlâ hesaba
--    bağlanmamış ders_programi satırlarını mevcut akademisyen profilleriyle
--    şimdi eşleştir (örn. Ali İhsan Çetin gibi zaten kayıtlı hocalar için).
update public.ders_programi d
set akademisyen_id = p.id
from public.profiles p
where d.akademisyen_id is null
  and not coalesce(d.akademisyen_id_manuel, false)
  and d.hoca_adi is not null
  and p.role = 'academician'
  and public.campuso_ad_eslesiyor_mu(public.campuso_normalize_ad(d.hoca_adi), public.campuso_normalize_ad(p.full_name));

commit;
