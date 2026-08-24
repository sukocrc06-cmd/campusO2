-- CampusO Vol 1-8 devamı: Özelleştirilmiş Ders ve Sınav Takvimi
-- AYBÜ'nün kendi OBS sistemi (obs.aybu.edu.tr / abs.aybu.edu.tr) öğrenci
-- girişi gerektiren özel bir sistem olduğundan (ve bir öğrencinin gerçek
-- OBS şifresini saklayıp otomatik giriş yapmak güvenlik/KVKK açısından
-- riskli olduğundan) buraya kimlik bilgili bağlanmıyoruz; onun yerine
-- admin tarafından girilen veriyi kişiye özel hale getiren bir katman
-- ekliyoruz: kişisel not, dersi/sınavı gizleme, sınav çakışma tespiti,
-- akademisyen için "derslerim" otomatik filtresi.

begin;

alter table public.sinav_takvimi
  add column if not exists hoca_adi text;

create table if not exists public.ders_sinav_kisisel (
  id uuid primary key default gen_random_uuid(),
  kullanici_id uuid not null references auth.users(id) on delete cascade,
  hedef_tip text not null check (hedef_tip in ('ders', 'sinav')),
  hedef_id uuid not null,
  gizli boolean not null default false,
  not_metni text check (char_length(not_metni) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kullanici_id, hedef_tip, hedef_id)
);

create index if not exists ders_sinav_kisisel_kullanici_idx on public.ders_sinav_kisisel(kullanici_id);

drop trigger if exists campuso_ders_sinav_kisisel_touch_trg on public.ders_sinav_kisisel;
create trigger campuso_ders_sinav_kisisel_touch_trg
  before update on public.ders_sinav_kisisel
  for each row execute function public.campuso_touch_updated_at();

alter table public.ders_sinav_kisisel enable row level security;

drop policy if exists ders_sinav_kisisel_all on public.ders_sinav_kisisel;
create policy ders_sinav_kisisel_all on public.ders_sinav_kisisel
  for all using (kullanici_id = auth.uid())
  with check (kullanici_id = auth.uid());

commit;
