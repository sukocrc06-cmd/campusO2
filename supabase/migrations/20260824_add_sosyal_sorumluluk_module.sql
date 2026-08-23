-- CampusO Vol 1-5: Sosyal Sorumluluk Durumu
-- Öğrencilerin sosyal sorumluluk faaliyeti (proje, gönüllülük, etkinlik) kayıtlarını
-- oluşturup takip etmelerini, akademisyenin onaylamasını/reddetmesini ve yöneticinin
-- tüm kampüs genelinde durumu görüntülemesini sağlayan tablo ve RLS kuralları.
-- public.campuso_current_role() fonksiyonu önceki güvenlik migration'ında tanımlıdır.

begin;

create table if not exists public.sosyal_sorumluluk_kayitlari (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  baslik text not null,
  aciklama text,
  kurum_kulup text,
  baslangic_tarihi date,
  bitis_tarihi date,
  saat numeric not null default 0,
  kanit_notu text,
  onay_durumu text not null default 'beklemede',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sosyal_sorumluluk_onay_durumu_check
    check (onay_durumu in ('beklemede', 'onaylandi', 'reddedildi'))
);

create index if not exists sosyal_sorumluluk_student_idx on public.sosyal_sorumluluk_kayitlari(student_id);
create index if not exists sosyal_sorumluluk_durum_idx on public.sosyal_sorumluluk_kayitlari(onay_durumu);

alter table public.sosyal_sorumluluk_kayitlari enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sosyal_sorumluluk_kayitlari'
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

create policy sosyal_sorumluluk_select_own_or_staff
on public.sosyal_sorumluluk_kayitlari for select to authenticated
using (
  student_id = auth.uid()
  or public.campuso_current_role() in ('academician', 'admin')
);

create policy sosyal_sorumluluk_insert_own_student
on public.sosyal_sorumluluk_kayitlari for insert to authenticated
with check (
  student_id = auth.uid()
  and onay_durumu = 'beklemede'
  and public.campuso_current_role() = 'student'
);

create policy sosyal_sorumluluk_delete_own_pending
on public.sosyal_sorumluluk_kayitlari for delete to authenticated
using (
  student_id = auth.uid()
  and onay_durumu = 'beklemede'
  and public.campuso_current_role() = 'student'
);

create policy sosyal_sorumluluk_staff_update
on public.sosyal_sorumluluk_kayitlari for update to authenticated
using (public.campuso_current_role() in ('academician', 'admin'))
with check (public.campuso_current_role() in ('academician', 'admin'));

create or replace function public.campuso_enforce_sosyal_sorumluluk_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (to_jsonb(new) - 'onay_durumu' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'onay_durumu' - 'updated_at') then
    raise exception 'Onay işleminde başvuru içeriği değiştirilemez.';
  end if;

  if old.onay_durumu <> 'beklemede' then
    raise exception 'Bu kayıt zaten sonuçlandırılmış.';
  end if;

  if new.onay_durumu not in ('onaylandi', 'reddedildi') then
    raise exception 'Geçersiz durum geçişi.';
  end if;

  return new;
end;
$$;

drop trigger if exists campuso_sosyal_sorumluluk_transition_guard on public.sosyal_sorumluluk_kayitlari;
create trigger campuso_sosyal_sorumluluk_transition_guard
  before update on public.sosyal_sorumluluk_kayitlari
  for each row execute function public.campuso_enforce_sosyal_sorumluluk_transition();

drop trigger if exists campuso_sosyal_sorumluluk_touch_updated_at on public.sosyal_sorumluluk_kayitlari;
create trigger campuso_sosyal_sorumluluk_touch_updated_at
  before update on public.sosyal_sorumluluk_kayitlari
  for each row execute function public.campuso_touch_updated_at();

commit;
