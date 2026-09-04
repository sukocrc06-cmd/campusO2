-- CampusO Vol 1-8 devamı: AYBÜ İşletme Fakültesi ders içerikleri kataloğu — PARÇA 1/5 (şema).
-- Kaynak: obs.aybu.edu.tr Bologna Bilgi Paketi (resmi AYBÜ sitesi), 2026-09-04 çekildi.
-- ÖNCE bu parçayı çalıştır, sonra sırayla PARÇA 2, 3, 4, 5'i çalıştır.

begin;

create table if not exists public.ders_icerikleri (
  id uuid primary key default gen_random_uuid(),
  bolum text not null,
  yariyil int not null,
  sinif int not null,
  ders_kodu text not null,
  ders_adi text not null,
  t_u_l text,
  tur text,
  akts text,
  dil text,
  duzey text,
  ogretim_sekli text,
  amac text,
  icerik text,
  on_kosul text,
  dersi_veren text,
  ogrenme_ciktilari text,
  haftalik_konular jsonb not null default '[]'::jsonb,
  kaynak_donem text not null default '2026-2027 Güz (AYBÜ Bologna Bilgi Paketi)',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bolum, ders_kodu, yariyil)
);

create index if not exists ders_icerikleri_bolum_sinif_idx on public.ders_icerikleri(bolum, sinif);
create index if not exists ders_icerikleri_ders_kodu_idx on public.ders_icerikleri(ders_kodu);

drop trigger if exists campuso_ders_icerikleri_touch_trg on public.ders_icerikleri;
create trigger campuso_ders_icerikleri_touch_trg
  before update on public.ders_icerikleri
  for each row execute function public.campuso_touch_updated_at();

alter table public.ders_icerikleri enable row level security;

drop policy if exists ders_icerikleri_select on public.ders_icerikleri;
create policy ders_icerikleri_select on public.ders_icerikleri
  for select using (auth.uid() is not null);

drop policy if exists ders_icerikleri_write on public.ders_icerikleri;
create policy ders_icerikleri_write on public.ders_icerikleri
  for all using (public.campuso_current_role() = 'admin')
  with check (public.campuso_current_role() = 'admin');

commit;
