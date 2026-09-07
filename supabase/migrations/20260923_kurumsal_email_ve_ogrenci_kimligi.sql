-- Modül 2 (Öğrenci Kimliği ve Giriş) — 2.1 Hesap Yönetimi ve 2.2 Profil.
--
-- 2.1: "Kurumsal e-posta ile giriş" artık admin panelinden yönetilen bir
-- izinli e-posta uzantısı (domain) listesiyle uygulanıyor. Kısıtlama SADECE
-- öğrencinin kendi kendine /signup üzerinden kayıt olma anında uygulanır
-- (SignUpClient.jsx, auth.signUp options.data.role = 'student' gönderiyor);
-- akademisyen davetleri ve admin tarafından oluşturulan hesaplar bu
-- kontrolden etkilenmez. İzinli domain listesi boşsa (admin henüz hiç
-- domain eklememişse) kısıtlama uygulanmaz — mevcut davranış (herkes kayıt
-- olabilir) korunur, böylece bu migration tek başına hiçbir mevcut kaydı
-- bozmaz.
--
-- 2.2: Profildeki "sanal öğrenci kimliği" kartı için öğrenci no alanı
-- eklendi. Kimlik kartındaki QR kod istemci tarafında (qrcode paketiyle)
-- üretiliyor — ek bir DB alanına ihtiyaç yok, profil id'si zaten benzersiz.

create table if not exists public.izinli_email_domainleri (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique check (domain = lower(domain) and domain !~ '[@\s]' and char_length(domain) between 3 and 120),
  aciklama text check (char_length(aciklama) <= 200),
  created_at timestamptz not null default now()
);

alter table public.izinli_email_domainleri enable row level security;

drop policy if exists "izinli_domain_herkes_okur" on public.izinli_email_domainleri;
create policy "izinli_domain_herkes_okur"
  on public.izinli_email_domainleri for select
  using (true);

drop policy if exists "izinli_domain_admin_yazar" on public.izinli_email_domainleri;
create policy "izinli_domain_admin_yazar"
  on public.izinli_email_domainleri for all
  using (public.campuso_current_role() = 'admin')
  with check (public.campuso_current_role() = 'admin');

-- Öğrenci no — resmi bir doğrulama/kilit sistemi şimdilik yok, öğrenci
-- profilinden kendisi girip düzenleyebiliyor (diğer profil alanları gibi).
alter table public.profiles add column if not exists ogrenci_no text check (char_length(ogrenci_no) <= 30);

-- Telefon numarası — 2.1'deki "Telefon doğrulaması" maddesi için altyapı.
-- Gerçek SMS/OTP servisi (Twilio vb. ücretli, ya da WhatsApp Cloud API kurulumu
-- gerektiriyor) şu an bağlanmadığı için telefon_dogrulandi her zaman false
-- kalır ve arayüzde "Doğrula" butonu yapım aşaması olarak gösterilir; ileride
-- gerçek bir sağlayıcı bağlanınca bu alan kullanılmaya başlanabilir.
alter table public.profiles add column if not exists telefon text check (char_length(telefon) <= 20);
alter table public.profiles add column if not exists telefon_dogrulandi boolean not null default false;

create or replace function public.campuso_ogrenci_email_domain_kontrol()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain text;
  v_liste_dolu boolean;
begin
  if (new.raw_user_meta_data ->> 'role') is distinct from 'student' then
    return new;
  end if;

  select exists(select 1 from public.izinli_email_domainleri) into v_liste_dolu;
  if not v_liste_dolu then
    return new;
  end if;

  v_domain := lower(split_part(new.email, '@', 2));
  if not exists (select 1 from public.izinli_email_domainleri d where d.domain = v_domain) then
    raise exception 'Bu e-posta uzantısıyla kayıt olunamaz. Kurumsal e-posta adresinizi kullanın.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists campuso_ogrenci_email_domain_kontrol_trg on auth.users;
create trigger campuso_ogrenci_email_domain_kontrol_trg
  before insert on auth.users
  for each row
  execute function public.campuso_ogrenci_email_domain_kontrol();
