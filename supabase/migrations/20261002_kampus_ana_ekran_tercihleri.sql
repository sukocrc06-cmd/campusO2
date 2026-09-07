-- Kişiselleştirme > Ana Ekran Yönetimi (AYRINTILI TASARIM.docx 4.1: widget
-- ekleme/çıkarma, sürükle-bırak düzenleme). Diğer admin-yönetimli tablolardan
-- farklı olarak bu tamamen KULLANICIYA ÖZEL bir tercih tablosu — her öğrenci
-- kendi ana sayfa widget sırasını/görünürlüğünü kaydeder, sadece kendi
-- satırlarını okuyup yazabilir (ders_programi/park_bildirimleri'ndeki
-- "auth.uid() = kullanici_id" deseniyle aynı, ama select de sahibiyle
-- sınırlı — bu veri başka bir öğrenciyi ilgilendirmiyor).
--
-- widget_id şu an sadece ana sayfada gerçekten var olan 3 widget'la
-- sınırlandırıldı (bitki, takvim, hizli) — ileride yeni bir widget eklenirse
-- CHECK constraint'i genişletmek gerekecek (bkz. kampus_park_alanlari.renk
-- eklenirken izlenen ALTER TABLE deseni).
create table if not exists public.kampus_ana_ekran_tercihleri (
  id uuid primary key default gen_random_uuid(),
  kullanici_id uuid not null references auth.users(id) on delete cascade,
  widget_id text not null check (widget_id in ('bitki', 'takvim', 'hizli')),
  sira integer not null default 0,
  gorunur boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (kullanici_id, widget_id)
);

create index if not exists kampus_ana_ekran_tercihleri_kullanici_idx
  on public.kampus_ana_ekran_tercihleri (kullanici_id);

alter table public.kampus_ana_ekran_tercihleri enable row level security;

create policy "kampus_ana_ekran_tercihleri_sahibi_okur" on public.kampus_ana_ekran_tercihleri
  for select using (auth.uid() = kullanici_id);

create policy "kampus_ana_ekran_tercihleri_sahibi_ekler" on public.kampus_ana_ekran_tercihleri
  for insert with check (auth.uid() = kullanici_id);

create policy "kampus_ana_ekran_tercihleri_sahibi_gunceller" on public.kampus_ana_ekran_tercihleri
  for update using (auth.uid() = kullanici_id) with check (auth.uid() = kullanici_id);

create policy "kampus_ana_ekran_tercihleri_sahibi_siler" on public.kampus_ana_ekran_tercihleri
  for delete using (auth.uid() = kullanici_id);

create or replace function public.kampus_ana_ekran_tercihleri_updated_at_guncelle()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists kampus_ana_ekran_tercihleri_updated_at_trg on public.kampus_ana_ekran_tercihleri;
create trigger kampus_ana_ekran_tercihleri_updated_at_trg
  before update on public.kampus_ana_ekran_tercihleri
  for each row execute function public.kampus_ana_ekran_tercihleri_updated_at_guncelle();
