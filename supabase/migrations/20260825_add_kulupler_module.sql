-- CampusO Vol 1-6: Öğrenci Kulüpleri İşlemleri
-- Kulüp kaydı + üyelik başvuru/onay akışı + danışmanın öğrenciye
-- kulüp yönetim yetkisi devredebilmesi (logo, site linki, üye onayı).
-- Ön koşul: 20260808_secure_roles_and_staj_workflow.sql (campuso_current_role())
-- ve 20260823_add_tesvik_hesaplama_module.sql (campuso_touch_updated_at())
-- bu projede daha önce çalıştırılmış olmalı.

begin;

-- 1) Tablolar -----------------------------------------------------------

create table if not exists public.kulupler (
  id uuid primary key default gen_random_uuid(),
  ad text not null,
  aciklama text,
  kategori text,
  logo_url text,
  website_url text,
  danisman_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kulupler_danisman_id_idx on public.kulupler(danisman_id);
create index if not exists kulupler_kategori_idx on public.kulupler(kategori);

create table if not exists public.kulup_uyelikleri (
  id uuid primary key default gen_random_uuid(),
  kulup_id uuid not null references public.kulupler(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  rol text not null default 'uye' check (rol in ('uye', 'yonetici')),
  durum text not null default 'beklemede' check (durum in ('beklemede', 'aktif', 'reddedildi', 'ayrildi')),
  motivasyon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kulup_id, student_id)
);

create index if not exists kulup_uyelikleri_kulup_id_idx on public.kulup_uyelikleri(kulup_id);
create index if not exists kulup_uyelikleri_student_id_idx on public.kulup_uyelikleri(student_id);
create index if not exists kulup_uyelikleri_durum_idx on public.kulup_uyelikleri(durum);

-- 2) Yardımcı fonksiyon: bu kullanıcı bu kulübü yönetiyor mu? ------------
-- (danışman kendisi, ya da danışmanın "yonetici" yetkisi verdiği aktif öğrenci, ya da admin)

create or replace function public.campuso_kulup_yetkilisi_mi(p_kulup_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.campuso_current_role() = 'admin'
    or exists (
      select 1 from public.kulupler k
      where k.id = p_kulup_id and k.danisman_id = auth.uid()
    )
    or exists (
      select 1 from public.kulup_uyelikleri m
      where m.kulup_id = p_kulup_id
        and m.student_id = auth.uid()
        and m.rol = 'yonetici'
        and m.durum = 'aktif'
    );
$$;

-- 3) İçerik/geçiş koruması tetikleyicileri --------------------------------

create or replace function public.campuso_enforce_kulupler_islem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.campuso_current_role();
begin
  if TG_OP = 'INSERT' then
    if v_role <> 'admin' and NEW.danisman_id is distinct from auth.uid() then
      raise exception 'Bir kulüp oluştururken danışman olarak yalnızca kendinizi atayabilirsiniz.';
    end if;
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    if v_role <> 'admin' and NEW.danisman_id is distinct from OLD.danisman_id then
      raise exception 'Kulüp danışmanını yalnızca yönetici (admin) değiştirebilir.';
    end if;
    return NEW;
  end if;

  return NEW;
end;
$$;

drop trigger if exists campuso_kulupler_islem_trg on public.kulupler;
create trigger campuso_kulupler_islem_trg
  before insert or update on public.kulupler
  for each row execute function public.campuso_enforce_kulupler_islem();

drop trigger if exists campuso_kulupler_touch_trg on public.kulupler;
create trigger campuso_kulupler_touch_trg
  before update on public.kulupler
  for each row execute function public.campuso_touch_updated_at();

create or replace function public.campuso_enforce_kulup_uyelik_islem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.campuso_current_role();
  v_danisman uuid;
  v_is_manager boolean;
begin
  select danisman_id into v_danisman from public.kulupler where id = coalesce(NEW.kulup_id, OLD.kulup_id);

  if TG_OP = 'INSERT' then
    v_is_manager := public.campuso_kulup_yetkilisi_mi(NEW.kulup_id);
    if NEW.rol = 'yonetici' and v_role <> 'admin' and (v_danisman is null or auth.uid() <> v_danisman) then
      raise exception 'Yönetici yetkisi yalnızca kulüp danışmanı veya admin tarafından verilebilir.';
    end if;
    if NEW.student_id = auth.uid() and not v_is_manager and v_role <> 'admin' then
      if NEW.rol <> 'uye' or NEW.durum <> 'beklemede' then
        raise exception 'Kendi başvurunuzu yalnızca "beklemede" durumunda ve "uye" rolüyle oluşturabilirsiniz.';
      end if;
    end if;
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    if NEW.kulup_id <> OLD.kulup_id or NEW.student_id <> OLD.student_id then
      raise exception 'Üyelik kaydında kulüp veya öğrenci bilgisi değiştirilemez.';
    end if;

    if v_role = 'admin' then
      return NEW;
    end if;

    v_is_manager := public.campuso_kulup_yetkilisi_mi(OLD.kulup_id);

    if v_is_manager then
      if NEW.rol is distinct from OLD.rol and (v_danisman is null or auth.uid() <> v_danisman) then
        raise exception 'Yalnızca kulüp danışmanı yönetici rolü atayabilir veya kaldırabilir.';
      end if;
      if NEW.motivasyon is distinct from OLD.motivasyon then
        raise exception 'Başvuru içeriği değiştirilemez.';
      end if;
      if not (
        (OLD.durum = 'beklemede' and NEW.durum in ('aktif', 'reddedildi'))
        or (OLD.durum = 'aktif' and NEW.durum = 'ayrildi')
        or (NEW.durum = OLD.durum)
      ) then
        raise exception 'Geçersiz üyelik durumu geçişi.';
      end if;
      return NEW;
    end if;

    if auth.uid() <> OLD.student_id then
      raise exception 'Bu üyelik kaydını değiştirme yetkiniz yok.';
    end if;
    if NEW.rol is distinct from OLD.rol then
      raise exception 'Kendi rolünüzü değiştiremezsiniz.';
    end if;
    if NEW.motivasyon is distinct from OLD.motivasyon then
      raise exception 'Başvuru içeriği değiştirilemez.';
    end if;
    if not (OLD.durum = 'aktif' and NEW.durum = 'ayrildi') then
      raise exception 'Yalnızca aktif bir üyelikten ayrılabilirsiniz.';
    end if;
    return NEW;
  end if;

  return NEW;
end;
$$;

drop trigger if exists campuso_kulup_uyelik_islem_trg on public.kulup_uyelikleri;
create trigger campuso_kulup_uyelik_islem_trg
  before insert or update on public.kulup_uyelikleri
  for each row execute function public.campuso_enforce_kulup_uyelik_islem();

drop trigger if exists campuso_kulup_uyelik_touch_trg on public.kulup_uyelikleri;
create trigger campuso_kulup_uyelik_touch_trg
  before update on public.kulup_uyelikleri
  for each row execute function public.campuso_touch_updated_at();

-- 4) RLS -------------------------------------------------------------------

alter table public.kulupler enable row level security;
alter table public.kulup_uyelikleri enable row level security;

drop policy if exists kulupler_select on public.kulupler;
create policy kulupler_select on public.kulupler
  for select using (auth.uid() is not null);

drop policy if exists kulupler_insert on public.kulupler;
create policy kulupler_insert on public.kulupler
  for insert with check (public.campuso_current_role() in ('admin', 'academician'));

drop policy if exists kulupler_update on public.kulupler;
create policy kulupler_update on public.kulupler
  for update using (
    public.campuso_current_role() = 'admin'
    or danisman_id = auth.uid()
    or public.campuso_kulup_yetkilisi_mi(id)
  );

drop policy if exists kulupler_delete on public.kulupler;
create policy kulupler_delete on public.kulupler
  for delete using (public.campuso_current_role() = 'admin');

drop policy if exists kulup_uyelikleri_select on public.kulup_uyelikleri;
create policy kulup_uyelikleri_select on public.kulup_uyelikleri
  for select using (
    student_id = auth.uid()
    or public.campuso_kulup_yetkilisi_mi(kulup_id)
  );

drop policy if exists kulup_uyelikleri_insert on public.kulup_uyelikleri;
create policy kulup_uyelikleri_insert on public.kulup_uyelikleri
  for insert with check (
    (student_id = auth.uid() and rol = 'uye' and durum = 'beklemede')
    or public.campuso_kulup_yetkilisi_mi(kulup_id)
  );

drop policy if exists kulup_uyelikleri_update on public.kulup_uyelikleri;
create policy kulup_uyelikleri_update on public.kulup_uyelikleri
  for update using (
    student_id = auth.uid()
    or public.campuso_kulup_yetkilisi_mi(kulup_id)
  );

drop policy if exists kulup_uyelikleri_delete on public.kulup_uyelikleri;
create policy kulup_uyelikleri_delete on public.kulup_uyelikleri
  for delete using (
    (student_id = auth.uid() and durum = 'beklemede')
    or public.campuso_kulup_yetkilisi_mi(kulup_id)
  );

-- 5) Kulüp logosu için Storage bucket'ı --------------------------------------
-- Dosya yolu kuralı: <kulup_id>/<dosya_adı> (örn. 3fae.../logo.png)

insert into storage.buckets (id, name, public)
values ('kulup-logolari', 'kulup-logolari', true)
on conflict (id) do nothing;

drop policy if exists kulup_logo_public_select on storage.objects;
create policy kulup_logo_public_select on storage.objects
  for select using (bucket_id = 'kulup-logolari');

drop policy if exists kulup_logo_manager_insert on storage.objects;
create policy kulup_logo_manager_insert on storage.objects
  for insert with check (
    bucket_id = 'kulup-logolari'
    and (
      public.campuso_current_role() = 'admin'
      or public.campuso_kulup_yetkilisi_mi((storage.foldername(name))[1]::uuid)
    )
  );

drop policy if exists kulup_logo_manager_update on storage.objects;
create policy kulup_logo_manager_update on storage.objects
  for update using (
    bucket_id = 'kulup-logolari'
    and (
      public.campuso_current_role() = 'admin'
      or public.campuso_kulup_yetkilisi_mi((storage.foldername(name))[1]::uuid)
    )
  );

drop policy if exists kulup_logo_manager_delete on storage.objects;
create policy kulup_logo_manager_delete on storage.objects
  for delete using (
    bucket_id = 'kulup-logolari'
    and (
      public.campuso_current_role() = 'admin'
      or public.campuso_kulup_yetkilisi_mi((storage.foldername(name))[1]::uuid)
    )
  );

commit;
