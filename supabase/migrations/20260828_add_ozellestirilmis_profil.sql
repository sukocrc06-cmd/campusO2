-- CampusO Vol 1-10: Özelleştirilmiş Profil
-- profiles tablosuna kişiselleştirme alanları eklenir (fotoğraf, hero rengi,
-- bölüm, sınıf, numara, kısa biyografi). Tam profil satırı hâlâ yalnız
-- sahibi + admin tarafından görülebilir (20260808 taban politikası
-- değişmedi); herkese açık "profil kartı" görünümü ise SECURITY DEFINER
-- fonksiyonlarla yalnızca güvenli/genel alanları (e-posta ve numara hariç)
-- dışa veriyor — böylece e-posta adresleri kampüs geneline açılmıyor.

begin;

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists hero_renk text not null default 'mavi',
  add column if not exists bolum text,
  add column if not exists sinif text,
  add column if not exists numara text,
  add column if not exists bio text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_hero_renk_check'
  ) then
    alter table public.profiles
      add constraint profiles_hero_renk_check
      check (hero_renk in ('mavi', 'lacivert', 'yesil', 'turuncu', 'mor', 'gri'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_bio_length_check'
  ) then
    alter table public.profiles
      add constraint profiles_bio_length_check
      check (bio is null or char_length(bio) <= 280);
  end if;
end;
$$;

-- Herkese açık profil kartı: yalnız güvenli/genel alanlar (e-posta yok).
create or replace function public.campuso_get_profil(p_user_id uuid)
returns table (
  id uuid,
  full_name text,
  role text,
  avatar_url text,
  hero_renk text,
  bolum text,
  sinif text,
  bio text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.role, p.avatar_url, p.hero_renk, p.bolum, p.sinif, p.bio
  from public.profiles p
  where p.id = p_user_id;
$$;

revoke all on function public.campuso_get_profil(uuid) from public;
grant execute on function public.campuso_get_profil(uuid) to authenticated;

-- Aynı kart verisini toplu almak için (ör. bir liste ekranında).
create or replace function public.campuso_get_profiller(p_user_ids uuid[])
returns table (
  id uuid,
  full_name text,
  role text,
  avatar_url text,
  hero_renk text,
  bolum text,
  sinif text,
  bio text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.role, p.avatar_url, p.hero_renk, p.bolum, p.sinif, p.bio
  from public.profiles p
  where p.id = any(p_user_ids);
$$;

revoke all on function public.campuso_get_profiller(uuid[]) from public;
grant execute on function public.campuso_get_profiller(uuid[]) to authenticated;

-- Basit isimle arama (kampüs profilleri sayfası için) — yine yalnız genel alanlar.
create or replace function public.campuso_profil_ara(p_arama text)
returns table (
  id uuid,
  full_name text,
  role text,
  avatar_url text,
  hero_renk text,
  bolum text,
  sinif text,
  bio text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.role, p.avatar_url, p.hero_renk, p.bolum, p.sinif, p.bio
  from public.profiles p
  where p.full_name ilike '%' || p_arama || '%'
  order by p.full_name
  limit 30;
$$;

revoke all on function public.campuso_profil_ara(text) from public;
grant execute on function public.campuso_profil_ara(text) to authenticated;

-- Profil fotoğrafı için Storage bucket'ı. Yol kuralı: <kullanici_id>/dosya_adi

insert into storage.buckets (id, name, public)
values ('profil-fotograflari', 'profil-fotograflari', true)
on conflict (id) do nothing;

drop policy if exists profil_foto_public_select on storage.objects;
create policy profil_foto_public_select on storage.objects
  for select using (bucket_id = 'profil-fotograflari');

drop policy if exists profil_foto_owner_insert on storage.objects;
create policy profil_foto_owner_insert on storage.objects
  for insert with check (
    bucket_id = 'profil-fotograflari'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.campuso_current_role() = 'admin'
    )
  );

drop policy if exists profil_foto_owner_update on storage.objects;
create policy profil_foto_owner_update on storage.objects
  for update using (
    bucket_id = 'profil-fotograflari'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.campuso_current_role() = 'admin'
    )
  );

drop policy if exists profil_foto_owner_delete on storage.objects;
create policy profil_foto_owner_delete on storage.objects
  for delete using (
    bucket_id = 'profil-fotograflari'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.campuso_current_role() = 'admin'
    )
  );

commit;
