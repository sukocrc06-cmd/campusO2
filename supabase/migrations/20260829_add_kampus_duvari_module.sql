-- CampusO Vol 1-11: Uygulama İçi Mesajlaşma (Kampüs Duvarı)
-- Gerçek zamanlı özel mesajlaşma değil; öğrencilerin ortak bir akışta
-- gönderi paylaşıp birbirinin gönderisine yorum yaptığı bir "gönderi + yorum"
-- yapısı. Şimdilik yalnız öğrenciler paylaşabilir/yorum yapabilir
-- (akademisyenler ileride eklenecek); admin her zaman görebilir ve
-- moderasyon için gönderi/yorum silebilir.

begin;

create table if not exists public.gonderiler (
  id uuid primary key default gen_random_uuid(),
  yazar_id uuid not null references auth.users(id) on delete cascade,
  icerik text not null check (char_length(icerik) between 1 and 2000),
  gorsel_url text,
  created_at timestamptz not null default now()
);

create index if not exists gonderiler_created_at_idx on public.gonderiler(created_at desc);
create index if not exists gonderiler_yazar_id_idx on public.gonderiler(yazar_id);

create table if not exists public.yorumlar (
  id uuid primary key default gen_random_uuid(),
  gonderi_id uuid not null references public.gonderiler(id) on delete cascade,
  yazar_id uuid not null references auth.users(id) on delete cascade,
  icerik text not null check (char_length(icerik) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists yorumlar_gonderi_id_idx on public.yorumlar(gonderi_id);
create index if not exists yorumlar_created_at_idx on public.yorumlar(created_at);

create table if not exists public.kampus_duvari_sikayetleri (
  id uuid primary key default gen_random_uuid(),
  hedef_tip text not null check (hedef_tip in ('gonderi', 'yorum')),
  hedef_id uuid not null,
  bildiren_id uuid not null references auth.users(id) on delete cascade,
  sebep text,
  created_at timestamptz not null default now()
);

create index if not exists kampus_duvari_sikayetleri_created_at_idx on public.kampus_duvari_sikayetleri(created_at desc);

alter table public.gonderiler enable row level security;
alter table public.yorumlar enable row level security;
alter table public.kampus_duvari_sikayetleri enable row level security;

drop policy if exists gonderiler_select on public.gonderiler;
create policy gonderiler_select on public.gonderiler
  for select using (public.campuso_current_role() in ('student', 'admin'));

drop policy if exists gonderiler_insert on public.gonderiler;
create policy gonderiler_insert on public.gonderiler
  for insert with check (yazar_id = auth.uid() and public.campuso_current_role() = 'student');

drop policy if exists gonderiler_delete on public.gonderiler;
create policy gonderiler_delete on public.gonderiler
  for delete using (yazar_id = auth.uid() or public.campuso_current_role() = 'admin');

drop policy if exists yorumlar_select on public.yorumlar;
create policy yorumlar_select on public.yorumlar
  for select using (public.campuso_current_role() in ('student', 'admin'));

drop policy if exists yorumlar_insert on public.yorumlar;
create policy yorumlar_insert on public.yorumlar
  for insert with check (yazar_id = auth.uid() and public.campuso_current_role() = 'student');

drop policy if exists yorumlar_delete on public.yorumlar;
create policy yorumlar_delete on public.yorumlar
  for delete using (yazar_id = auth.uid() or public.campuso_current_role() = 'admin');

drop policy if exists kampus_duvari_sikayetleri_insert on public.kampus_duvari_sikayetleri;
create policy kampus_duvari_sikayetleri_insert on public.kampus_duvari_sikayetleri
  for insert with check (bildiren_id = auth.uid() and public.campuso_current_role() = 'student');

drop policy if exists kampus_duvari_sikayetleri_select on public.kampus_duvari_sikayetleri;
create policy kampus_duvari_sikayetleri_select on public.kampus_duvari_sikayetleri
  for select using (public.campuso_current_role() = 'admin');

drop policy if exists kampus_duvari_sikayetleri_delete on public.kampus_duvari_sikayetleri;
create policy kampus_duvari_sikayetleri_delete on public.kampus_duvari_sikayetleri
  for delete using (public.campuso_current_role() = 'admin');

-- Gönderi görseli için Storage bucket'ı. Yol kuralı: <kullanici_id>/dosya_adi

insert into storage.buckets (id, name, public)
values ('gonderi-gorselleri', 'gonderi-gorselleri', true)
on conflict (id) do nothing;

drop policy if exists gonderi_gorseli_public_select on storage.objects;
create policy gonderi_gorseli_public_select on storage.objects
  for select using (bucket_id = 'gonderi-gorselleri');

drop policy if exists gonderi_gorseli_owner_insert on storage.objects;
create policy gonderi_gorseli_owner_insert on storage.objects
  for insert with check (
    bucket_id = 'gonderi-gorselleri'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.campuso_current_role() = 'admin'
    )
  );

drop policy if exists gonderi_gorseli_owner_delete on storage.objects;
create policy gonderi_gorseli_owner_delete on storage.objects
  for delete using (
    bucket_id = 'gonderi-gorselleri'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.campuso_current_role() = 'admin'
    )
  );

commit;
