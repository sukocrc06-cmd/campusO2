-- CampusO production security baseline for Supabase-backed identity and internships.
-- Run after the existing profiles, invitations and stajlar tables are present.

begin;

create or replace function public.campuso_current_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when lower(coalesce(auth.jwt() ->> 'email', '')) = 'suko.crc06@gmail.com' then 'admin'
    else coalesce(
      (select p.role from public.profiles p where p.id = auth.uid()),
      'student'
    )
  end;
$$;

revoke all on function public.campuso_current_role() from public;
grant execute on function public.campuso_current_role() to authenticated;

create or replace function public.campuso_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_token text := coalesce(new.raw_user_meta_data ->> 'invitation_token', '');
  assigned_role text := 'student';
  invitation_id public.invitations.id%type;
begin
  if lower(coalesce(new.email, '')) = 'suko.crc06@gmail.com' then
    assigned_role := 'admin';
  elsif requested_token <> '' then
    select i.id
      into invitation_id
    from public.invitations i
    where i.token = requested_token
      and lower(i.email) = lower(new.email)
      and i.role = 'academician'
      and i.used_at is null
      and i.expires_at > now()
    for update;

    if invitation_id is null then
      raise exception 'Davet geçersiz, kullanılmış veya süresi dolmuş.';
    end if;

    assigned_role := 'academician';
    update public.invitations
      set used_at = now()
    where id = invitation_id;
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    lower(new.email),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    assigned_role
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    role = excluded.role;

  return new;
end;
$$;

drop trigger if exists campuso_on_auth_user_created on auth.users;
create trigger campuso_on_auth_user_created
  after insert on auth.users
  for each row execute function public.campuso_handle_new_user();

create or replace function public.campuso_get_invitation(invite_token text)
returns table(email text, role text, expires_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.email::text, i.role::text, i.expires_at
  from public.invitations i
  where i.token = invite_token
    and i.used_at is null
    and i.expires_at > now()
  limit 1;
$$;

revoke all on function public.campuso_get_invitation(text) from public;
grant execute on function public.campuso_get_invitation(text) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.stajlar enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'invitations', 'stajlar')
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

create policy profiles_select_self_or_admin
on public.profiles for select to authenticated
using (id = auth.uid() or public.campuso_current_role() = 'admin');

create policy profiles_insert_student_self
on public.profiles for insert to authenticated
with check (
  id = auth.uid()
  and role = 'student'
  and lower(email) = lower(auth.jwt() ->> 'email')
);

create policy profiles_update_self_without_role_change
on public.profiles for update to authenticated
using (id = auth.uid() or public.campuso_current_role() = 'admin')
with check (
  public.campuso_current_role() = 'admin'
  or (id = auth.uid() and role = public.campuso_current_role())
);

create policy invitations_admin_all
on public.invitations for all to authenticated
using (public.campuso_current_role() = 'admin')
with check (public.campuso_current_role() = 'admin');

create policy stajlar_student_select_own
on public.stajlar for select to authenticated
using (
  student_id = auth.uid()
  or public.campuso_current_role() in ('academician', 'admin')
);

create policy stajlar_student_insert_own
on public.stajlar for insert to authenticated
with check (
  student_id = auth.uid()
  and onay_durumu = 'beklemede'
  and public.campuso_current_role() = 'student'
);

create policy stajlar_staff_update
on public.stajlar for update to authenticated
using (public.campuso_current_role() in ('academician', 'admin'))
with check (public.campuso_current_role() in ('academician', 'admin'));

create or replace function public.campuso_enforce_staj_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.campuso_current_role();
begin
  if (to_jsonb(new) - 'onay_durumu' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'onay_durumu' - 'updated_at') then
    raise exception 'Onay işleminde başvuru içeriği değiştirilemez.';
  end if;

  if actor_role = 'academician' then
    if old.onay_durumu = 'yonetici_onayladi'
       or new.onay_durumu not in ('akademisyen_onayladi', 'reddedildi') then
      raise exception 'Akademisyen için geçersiz staj durum geçişi.';
    end if;
  elsif actor_role = 'admin' then
    if old.onay_durumu <> 'akademisyen_onayladi'
       or new.onay_durumu <> 'yonetici_onayladi' then
      raise exception 'Yönetici yalnız akademisyen onaylı başvuruyu sonuçlandırabilir.';
    end if;
  else
    raise exception 'Bu staj başvurusunu güncelleme yetkiniz yok.';
  end if;

  return new;
end;
$$;

drop trigger if exists campuso_staj_transition_guard on public.stajlar;
create trigger campuso_staj_transition_guard
  before update on public.stajlar
  for each row execute function public.campuso_enforce_staj_transition();

commit;
