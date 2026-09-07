-- Kampüs Yaşamı > Kampüs Haritası modülü (AYRINTILI TASARIM.docx 3.3).
-- Genel görünüm gerçek koordinatlarla (OpenStreetMap + Leaflet, ücretsiz,
-- API key gerekmez) çiziliyor — Ulaşım modülündeki "gerçek veri, ücretsiz
-- servis" yaklaşımının devamı. AYBÜ'nün resmi sitesinde (yapiisleri
-- sayfası) kampüs merkez koordinatı var (40.1328489, 32.9440116) ama tek
-- tek bina koordinatları/oda listesi otomatik çekilebilecek bir kaynak
-- değil — bu yüzden Ulaşım'daki gibi admin panelinden elle giriliyor.
-- Bina içi gösterim v1'de görsel kat planı değil, kat bazlı basit bir
-- mekan (sınıf/laboratuvar/ofis) listesi (mekanlar jsonb) — iç mekan
-- navigasyonu bilinçli olarak kapsam dışı bırakıldı (gerçek pathfinding
-- için koridor/kapı grafiği ve gerçek ölçekli plan gerekir).
create table if not exists public.kampus_binalar (
  id uuid primary key default gen_random_uuid(),
  ad text not null check (char_length(ad) between 2 and 120),
  tip text not null default 'egitim' check (tip in ('egitim', 'laboratuvar', 'idari', 'sosyal', 'spor', 'yurt', 'diger')),
  aciklama text check (char_length(aciklama) <= 400),
  lat double precision not null,
  lng double precision not null,
  -- [{ "kat": "Zemin Kat", "ad": "B203", "tip": "sinif", "aciklama": "60 kişilik" }, ...]
  mekanlar jsonb not null default '[]'::jsonb,
  aktif boolean not null default true,
  sira integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.kampus_binalar enable row level security;

create policy "kampus_binalar_herkes_okur" on public.kampus_binalar
  for select using (true);

create policy "kampus_binalar_admin_yazar" on public.kampus_binalar
  for all using (public.campuso_current_role() = 'admin')
  with check (public.campuso_current_role() = 'admin');

create or replace function public.kampus_binalar_updated_at_guncelle()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists kampus_binalar_updated_at_trg on public.kampus_binalar;
create trigger kampus_binalar_updated_at_trg
  before update on public.kampus_binalar
  for each row execute function public.kampus_binalar_updated_at_guncelle();

-- Kampüsün resmi merkezi koordinatıyla (bkz. aybu.edu.tr/yapiisleri) ilk
-- kayıt: genel giriş/idari blok — admin panelinden gerçek bina bazında
-- koordinatlarla güncellenip çoğaltılacak.
insert into public.kampus_binalar (ad, tip, aciklama, lat, lng, mekanlar, sira)
values (
  'AYBÜ Esenboğa Külliyesi — Ana Giriş',
  'idari',
  'Kampüsün ana giriş ve idari blok bölgesi. Diğer binalar admin panelinden eklenecek.',
  40.1328489,
  32.9440116,
  '[]'::jsonb,
  0
);
