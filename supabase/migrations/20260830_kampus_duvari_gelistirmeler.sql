-- CampusO Vol 1-11 devamı: Kampüs Duvarı geliştirmeleri
-- Beğeni, hashtag/bölüm filtresi (bolum kolonu), yorum bildirimi,
-- admin sabitlenmiş duyuru, gönderi/yorum düzenleme, anahtar kelime
-- otomatik filtresi (onay_bekliyor), tekrar şikayet edilen kullanıcıyı
-- susturma (mute) ve basit spam/rate-limit koruması.

begin;

-- 1) Yeni kolonlar -----------------------------------------------------

alter table public.gonderiler
  add column if not exists bolum text,
  add column if not exists sabitlenmis boolean not null default false,
  add column if not exists onay_bekliyor boolean not null default false,
  add column if not exists updated_at timestamptz;

alter table public.yorumlar
  add column if not exists onay_bekliyor boolean not null default false,
  add column if not exists updated_at timestamptz;

create index if not exists gonderiler_sabitlenmis_idx on public.gonderiler(sabitlenmis desc, created_at desc);
create index if not exists gonderiler_bolum_idx on public.gonderiler(bolum);

-- 2) Beğeniler -----------------------------------------------------------

create table if not exists public.gonderi_begenileri (
  gonderi_id uuid not null references public.gonderiler(id) on delete cascade,
  kullanici_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (gonderi_id, kullanici_id)
);

create table if not exists public.yorum_begenileri (
  yorum_id uuid not null references public.yorumlar(id) on delete cascade,
  kullanici_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (yorum_id, kullanici_id)
);

alter table public.gonderi_begenileri enable row level security;
alter table public.yorum_begenileri enable row level security;

drop policy if exists gonderi_begenileri_select on public.gonderi_begenileri;
create policy gonderi_begenileri_select on public.gonderi_begenileri
  for select using (public.campuso_current_role() in ('student', 'admin'));

drop policy if exists gonderi_begenileri_insert on public.gonderi_begenileri;
create policy gonderi_begenileri_insert on public.gonderi_begenileri
  for insert with check (
    kullanici_id = auth.uid()
    and public.campuso_current_role() = 'student'
  );

drop policy if exists gonderi_begenileri_delete on public.gonderi_begenileri;
create policy gonderi_begenileri_delete on public.gonderi_begenileri
  for delete using (kullanici_id = auth.uid());

drop policy if exists yorum_begenileri_select on public.yorum_begenileri;
create policy yorum_begenileri_select on public.yorum_begenileri
  for select using (public.campuso_current_role() in ('student', 'admin'));

drop policy if exists yorum_begenileri_insert on public.yorum_begenileri;
create policy yorum_begenileri_insert on public.yorum_begenileri
  for insert with check (
    kullanici_id = auth.uid()
    and public.campuso_current_role() = 'student'
  );

drop policy if exists yorum_begenileri_delete on public.yorum_begenileri;
create policy yorum_begenileri_delete on public.yorum_begenileri
  for delete using (kullanici_id = auth.uid());

-- 3) Susturmalar (mute) ---------------------------------------------------

create table if not exists public.kampus_duvari_susturmalar (
  id uuid primary key default gen_random_uuid(),
  kullanici_id uuid not null references auth.users(id) on delete cascade,
  sebep text,
  bitis timestamptz not null,
  olusturan_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists kampus_duvari_susturmalar_kullanici_idx on public.kampus_duvari_susturmalar(kullanici_id, bitis desc);

alter table public.kampus_duvari_susturmalar enable row level security;

drop policy if exists kampus_duvari_susturmalar_all on public.kampus_duvari_susturmalar;
create policy kampus_duvari_susturmalar_all on public.kampus_duvari_susturmalar
  for all using (public.campuso_current_role() = 'admin')
  with check (public.campuso_current_role() = 'admin');

create or replace function public.campuso_susturulmus_mu(p_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.kampus_duvari_susturmalar
    where kullanici_id = p_user and bitis > now()
  );
$$;

create or replace function public.campuso_susturma_bitisi(p_user uuid)
returns timestamptz
language sql
security definer
set search_path = public
stable
as $$
  select max(bitis) from public.kampus_duvari_susturmalar
  where kullanici_id = p_user and bitis > now();
$$;

-- 4) Yasaklı kelimeler ------------------------------------------------

create table if not exists public.kampus_duvari_yasakli_kelimeler (
  id uuid primary key default gen_random_uuid(),
  kelime text not null unique,
  created_at timestamptz not null default now()
);

alter table public.kampus_duvari_yasakli_kelimeler enable row level security;

drop policy if exists kampus_duvari_yasakli_kelimeler_all on public.kampus_duvari_yasakli_kelimeler;
create policy kampus_duvari_yasakli_kelimeler_all on public.kampus_duvari_yasakli_kelimeler
  for all using (public.campuso_current_role() = 'admin')
  with check (public.campuso_current_role() = 'admin');

create or replace function public.campuso_icerik_yasakli_mi(p_icerik text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.kampus_duvari_yasakli_kelimeler k
    where p_icerik ilike '%' || k.kelime || '%'
  );
$$;

-- 5) Bildirimler ----------------------------------------------------------

create table if not exists public.kampus_duvari_bildirimleri (
  id uuid primary key default gen_random_uuid(),
  kullanici_id uuid not null references auth.users(id) on delete cascade,
  tip text not null check (tip in ('yorum', 'duyuru')),
  gonderi_id uuid references public.gonderiler(id) on delete cascade,
  yorum_id uuid references public.yorumlar(id) on delete cascade,
  olusturan_id uuid references auth.users(id),
  okundu boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists kampus_duvari_bildirimleri_kullanici_idx on public.kampus_duvari_bildirimleri(kullanici_id, created_at desc);

alter table public.kampus_duvari_bildirimleri enable row level security;

drop policy if exists kampus_duvari_bildirimleri_select on public.kampus_duvari_bildirimleri;
create policy kampus_duvari_bildirimleri_select on public.kampus_duvari_bildirimleri
  for select using (kullanici_id = auth.uid());

drop policy if exists kampus_duvari_bildirimleri_update on public.kampus_duvari_bildirimleri;
create policy kampus_duvari_bildirimleri_update on public.kampus_duvari_bildirimleri
  for update using (kullanici_id = auth.uid()) with check (kullanici_id = auth.uid());

-- 6) Gönderi ekleme öncesi/sonrası tetikleyiciler --------------------------

create or replace function public.campuso_gonderi_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.campuso_susturulmus_mu(new.yazar_id) then
    raise exception 'Paylaşım yapma yetkiniz geçici olarak kısıtlandı.';
  end if;

  if (select count(*) from public.gonderiler where yazar_id = new.yazar_id and created_at > now() - interval '2 minutes') >= 3 then
    raise exception 'Çok hızlı paylaşım yapıyorsunuz, birkaç dakika bekleyip tekrar deneyin.';
  end if;

  new.onay_bekliyor := public.campuso_icerik_yasakli_mi(new.icerik);
  new.bolum := (select bolum from public.profiles where id = new.yazar_id);
  return new;
end;
$$;

drop trigger if exists campuso_gonderi_before_insert_trg on public.gonderiler;
create trigger campuso_gonderi_before_insert_trg
  before insert on public.gonderiler
  for each row execute function public.campuso_gonderi_before_insert();

create or replace function public.campuso_gonderi_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if public.campuso_current_role() <> 'admin' then
    new.sabitlenmis := old.sabitlenmis;
    new.onay_bekliyor := old.onay_bekliyor;
    new.yazar_id := old.yazar_id;
    new.bolum := old.bolum;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists campuso_gonderi_before_update_trg on public.gonderiler;
create trigger campuso_gonderi_before_update_trg
  before update on public.gonderiler
  for each row execute function public.campuso_gonderi_before_update();

drop policy if exists gonderiler_update on public.gonderiler;
create policy gonderiler_update on public.gonderiler
  for update using (yazar_id = auth.uid() or public.campuso_current_role() = 'admin')
  with check (yazar_id = auth.uid() or public.campuso_current_role() = 'admin');

-- Herkese açık gönderi görünürlüğü: onay bekleyenleri sahibi/admin dışında gizle
drop policy if exists gonderiler_select on public.gonderiler;
create policy gonderiler_select on public.gonderiler
  for select using (
    public.campuso_current_role() in ('student', 'admin')
    and (onay_bekliyor = false or yazar_id = auth.uid() or public.campuso_current_role() = 'admin')
  );

-- 7) Yorum ekleme öncesi/sonrası tetikleyiciler -----------------------

create or replace function public.campuso_yorum_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.campuso_susturulmus_mu(new.yazar_id) then
    raise exception 'Yorum yapma yetkiniz geçici olarak kısıtlandı.';
  end if;

  if (select count(*) from public.yorumlar where yazar_id = new.yazar_id and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'Çok hızlı yorum yapıyorsunuz, biraz yavaşlayın.';
  end if;

  new.onay_bekliyor := public.campuso_icerik_yasakli_mi(new.icerik);
  return new;
end;
$$;

drop trigger if exists campuso_yorum_before_insert_trg on public.yorumlar;
create trigger campuso_yorum_before_insert_trg
  before insert on public.yorumlar
  for each row execute function public.campuso_yorum_before_insert();

create or replace function public.campuso_yorum_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gonderi_sahibi uuid;
begin
  select yazar_id into v_gonderi_sahibi from public.gonderiler where id = new.gonderi_id;
  if v_gonderi_sahibi is not null and v_gonderi_sahibi <> new.yazar_id and new.onay_bekliyor = false then
    insert into public.kampus_duvari_bildirimleri (kullanici_id, tip, gonderi_id, yorum_id, olusturan_id)
    values (v_gonderi_sahibi, 'yorum', new.gonderi_id, new.id, new.yazar_id);
  end if;
  return new;
end;
$$;

drop trigger if exists campuso_yorum_after_insert_trg on public.yorumlar;
create trigger campuso_yorum_after_insert_trg
  after insert on public.yorumlar
  for each row execute function public.campuso_yorum_after_insert();

create or replace function public.campuso_yorum_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if public.campuso_current_role() <> 'admin' then
    new.onay_bekliyor := old.onay_bekliyor;
    new.yazar_id := old.yazar_id;
    new.gonderi_id := old.gonderi_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists campuso_yorum_before_update_trg on public.yorumlar;
create trigger campuso_yorum_before_update_trg
  before update on public.yorumlar
  for each row execute function public.campuso_yorum_before_update();

drop policy if exists yorumlar_update on public.yorumlar;
create policy yorumlar_update on public.yorumlar
  for update using (yazar_id = auth.uid() or public.campuso_current_role() = 'admin')
  with check (yazar_id = auth.uid() or public.campuso_current_role() = 'admin');

drop policy if exists yorumlar_select on public.yorumlar;
create policy yorumlar_select on public.yorumlar
  for select using (
    public.campuso_current_role() in ('student', 'admin')
    and (onay_bekliyor = false or yazar_id = auth.uid() or public.campuso_current_role() = 'admin')
  );

commit;
