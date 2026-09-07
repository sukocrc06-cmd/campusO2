-- Kampüs Yaşamı > Ulaşım modülü (AYRINTILI TASARIM.docx 3.2).
-- AYBÜ'nün resmi sitesinde ring/servis saatleri için otomatik senkronize
-- edilebilecek yapılandırılmış bir kaynak (yemek menüsündeki SKS sayfası
-- gibi) bulunmuyor — bu yüzden veri admin panelinden elle girilip
-- güncelleniyor. izinli_email_domainleri ile aynı RLS deseni kullanılıyor:
-- herkes okuyabilir (öğrenci girişi olmadan da görülebilecek genel bilgi),
-- sadece admin yazabilir.
create table if not exists public.kampus_ulasim_hatlari (
  id uuid primary key default gen_random_uuid(),
  ad text not null check (char_length(ad) between 2 and 120),
  tip text not null default 'ring' check (tip in ('ring', 'servis', 'ego', 'diger')),
  aciklama text check (char_length(aciklama) <= 300),
  -- [{ "ad": "Kızılay", "saatler": ["07:30", "08:15"] }, ...]
  duraklar jsonb not null default '[]'::jsonb,
  notlar text check (char_length(notlar) <= 500),
  aktif boolean not null default true,
  sira integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.kampus_ulasim_hatlari enable row level security;

create policy "kampus_ulasim_herkes_okur" on public.kampus_ulasim_hatlari
  for select using (true);

create policy "kampus_ulasim_admin_yazar" on public.kampus_ulasim_hatlari
  for all using (public.campuso_current_role() = 'admin')
  with check (public.campuso_current_role() = 'admin');

-- updated_at otomatik güncellensin diye küçük bir tetikleyici.
create or replace function public.kampus_ulasim_updated_at_guncelle()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists kampus_ulasim_updated_at_trg on public.kampus_ulasim_hatlari;
create trigger kampus_ulasim_updated_at_trg
  before update on public.kampus_ulasim_hatlari
  for each row execute function public.kampus_ulasim_updated_at_guncelle();
