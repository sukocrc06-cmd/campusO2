-- CampusO Vol 1-8: Sınav ve Ders Takvimi Entegrasyonu
-- Ders programı ve sınav takvimi verisi admin tarafından Excel içe aktarma
-- veya elle giriş ile doldurulur (OBS'ye otomatik/kimlik bilgili bağlantı yok —
-- güvenlik nedeniyle bilinçli olarak bu yaklaşım tercih edilmedi).

begin;

create table if not exists public.ders_programi (
  id uuid primary key default gen_random_uuid(),
  bolum text not null,
  sinif text not null,
  ders_kodu text,
  ders_adi text not null,
  gun text not null check (gun in ('Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar')),
  baslangic_saat text not null,
  bitis_saat text not null,
  derslik text,
  hoca_adi text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ders_programi_bolum_sinif_idx on public.ders_programi(bolum, sinif);
create index if not exists ders_programi_gun_idx on public.ders_programi(gun);

create table if not exists public.sinav_takvimi (
  id uuid primary key default gen_random_uuid(),
  bolum text not null,
  sinif text not null,
  ders_kodu text,
  ders_adi text not null,
  sinav_turu text not null check (sinav_turu in ('Vize', 'Final', 'Bütünleme')),
  tarih date not null,
  saat text not null,
  derslik text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sinav_takvimi_bolum_sinif_idx on public.sinav_takvimi(bolum, sinif);
create index if not exists sinav_takvimi_tarih_idx on public.sinav_takvimi(tarih);

drop trigger if exists campuso_ders_programi_touch_trg on public.ders_programi;
create trigger campuso_ders_programi_touch_trg
  before update on public.ders_programi
  for each row execute function public.campuso_touch_updated_at();

drop trigger if exists campuso_sinav_takvimi_touch_trg on public.sinav_takvimi;
create trigger campuso_sinav_takvimi_touch_trg
  before update on public.sinav_takvimi
  for each row execute function public.campuso_touch_updated_at();

alter table public.ders_programi enable row level security;
alter table public.sinav_takvimi enable row level security;

drop policy if exists ders_programi_select on public.ders_programi;
create policy ders_programi_select on public.ders_programi
  for select using (auth.uid() is not null);

drop policy if exists ders_programi_write on public.ders_programi;
create policy ders_programi_write on public.ders_programi
  for all using (public.campuso_current_role() = 'admin')
  with check (public.campuso_current_role() = 'admin');

drop policy if exists sinav_takvimi_select on public.sinav_takvimi;
create policy sinav_takvimi_select on public.sinav_takvimi
  for select using (auth.uid() is not null);

drop policy if exists sinav_takvimi_write on public.sinav_takvimi;
create policy sinav_takvimi_write on public.sinav_takvimi
  for all using (public.campuso_current_role() = 'admin')
  with check (public.campuso_current_role() = 'admin');

commit;
