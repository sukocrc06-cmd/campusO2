-- CampusO Vol 1-4: Akademik Teşvik Hesaplama Robotu
-- Akademisyenlerin kendi teşvik puan hesaplamalarını kaydetmelerini,
-- yöneticinin ise tüm kayıtları görüntülemesini sağlayan tablo ve RLS kuralları.
-- public.campuso_current_role() fonksiyonu önceki güvenlik migration'ında tanımlıdır.

begin;

create table if not exists public.tesvik_hesaplamalari (
  id uuid primary key default gen_random_uuid(),
  academician_id uuid not null references auth.users(id) on delete cascade,
  yil text not null,
  kategoriler jsonb not null default '{}'::jsonb,
  toplam_puan numeric not null default 0,
  kategori_sayisi integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tesvik_hesaplamalari_academician_idx on public.tesvik_hesaplamalari(academician_id);
create index if not exists tesvik_hesaplamalari_yil_idx on public.tesvik_hesaplamalari(yil);

alter table public.tesvik_hesaplamalari enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tesvik_hesaplamalari'
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end;
$$;

create policy tesvik_select_own_or_admin
on public.tesvik_hesaplamalari for select to authenticated
using (academician_id = auth.uid() or public.campuso_current_role() = 'admin');

create policy tesvik_insert_own_academician
on public.tesvik_hesaplamalari for insert to authenticated
with check (academician_id = auth.uid() and public.campuso_current_role() = 'academician');

create policy tesvik_update_own_academician
on public.tesvik_hesaplamalari for update to authenticated
using (academician_id = auth.uid() and public.campuso_current_role() = 'academician')
with check (academician_id = auth.uid() and public.campuso_current_role() = 'academician');

create policy tesvik_delete_own_academician
on public.tesvik_hesaplamalari for delete to authenticated
using (academician_id = auth.uid() and public.campuso_current_role() = 'academician');

create or replace function public.campuso_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists campuso_tesvik_touch_updated_at on public.tesvik_hesaplamalari;
create trigger campuso_tesvik_touch_updated_at
  before update on public.tesvik_hesaplamalari
  for each row execute function public.campuso_touch_updated_at();

commit;
