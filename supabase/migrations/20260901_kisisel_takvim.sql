-- CampusO Vol 1-8 devamı: Kişisel Takvim
-- Öğrencinin/akademisyenin kendi ekleyip kendi gördüğü, tarih bazlı,
-- türe göre renklendirilmiş etkinlik takvimi (ders, sınav, proje,
-- sunum, diğer). Admin verisinden bağımsız, tamamen kişiseldir.

begin;

create table if not exists public.kisisel_takvim_etkinlikleri (
  id uuid primary key default gen_random_uuid(),
  kullanici_id uuid not null references auth.users(id) on delete cascade,
  tarih date not null,
  tur text not null check (tur in ('ders', 'sinav', 'proje', 'sunum', 'diger')),
  baslik text not null check (char_length(baslik) between 1 and 140),
  saat text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kisisel_takvim_etkinlikleri_kullanici_tarih_idx on public.kisisel_takvim_etkinlikleri(kullanici_id, tarih);

drop trigger if exists campuso_kisisel_takvim_touch_trg on public.kisisel_takvim_etkinlikleri;
create trigger campuso_kisisel_takvim_touch_trg
  before update on public.kisisel_takvim_etkinlikleri
  for each row execute function public.campuso_touch_updated_at();

alter table public.kisisel_takvim_etkinlikleri enable row level security;

drop policy if exists kisisel_takvim_etkinlikleri_all on public.kisisel_takvim_etkinlikleri;
create policy kisisel_takvim_etkinlikleri_all on public.kisisel_takvim_etkinlikleri
  for all using (kullanici_id = auth.uid())
  with check (kullanici_id = auth.uid());

commit;
