-- Sosyal Etkileşim & Topluluklar > 7.4 Etkinlik Planlama
-- (AYRINTILI TASARIM.docx: Halı saha ilanı, Grup çalışma ilanı, Film gecesi
-- ilanı, Ücretli/ücretsiz seçenek, Konum/detay ayarlama).
--
-- Tasarım kararları (kullanıcıyla AskUserQuestion ile netleştirildi):
--  - İlanı HER ÖĞRENCİ serbestçe açabilir, onay beklenmez (kampüs panosu
--    mantığı) — Kulüpler modülünün aksine burada bir "danışman/yönetici"
--    kavramı yok, sadece ilan sahibi kendi ilanını düzenler/iptal eder.
--  - Katılım: herkes tek tıkla "İlgileniyorum" diyebilir; ilan sahibi
--    isterse bir kontenjan sayısı girer (örn. halı saha için 10 kişi),
--    kontenjan doluysa yeni katılım engellenir. Kontenjan boşsa sınırsız.

begin;

-- 1) İlanlar ----------------------------------------------------------------

create table if not exists public.etkinlik_ilanlari (
  id uuid primary key default gen_random_uuid(),
  olusturan_id uuid not null references auth.users(id) on delete cascade,
  tur text not null check (tur in ('hali_saha', 'grup_calisma', 'film_gecesi', 'diger')),
  baslik text not null,
  aciklama text,
  zaman timestamptz,
  konum text,
  ucretli boolean not null default false,
  ucret_tutari numeric(10,2),
  kontenjan integer check (kontenjan is null or kontenjan > 0),
  durum text not null default 'acik' check (durum in ('acik', 'iptal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists etkinlik_ilanlari_olusturan_idx on public.etkinlik_ilanlari(olusturan_id);
create index if not exists etkinlik_ilanlari_tur_idx on public.etkinlik_ilanlari(tur);
create index if not exists etkinlik_ilanlari_zaman_idx on public.etkinlik_ilanlari(zaman);

drop trigger if exists etkinlik_ilanlari_touch_trg on public.etkinlik_ilanlari;
create trigger etkinlik_ilanlari_touch_trg
  before update on public.etkinlik_ilanlari
  for each row execute function public.campuso_touch_updated_at();

-- 2) Katılımcılar -------------------------------------------------------------

create table if not exists public.etkinlik_katilimcilari (
  id uuid primary key default gen_random_uuid(),
  ilan_id uuid not null references public.etkinlik_ilanlari(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (ilan_id, student_id)
);

create index if not exists etkinlik_katilimcilari_ilan_idx on public.etkinlik_katilimcilari(ilan_id);
create index if not exists etkinlik_katilimcilari_student_idx on public.etkinlik_katilimcilari(student_id);

-- Kontenjan doluysa yeni katılımı reddet (yarış durumlarına karşı DB
-- seviyesinde, sadece istemci tarafı sayıma güvenmemek için).
create or replace function public.campuso_enforce_etkinlik_katilim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kontenjan integer;
  v_durum text;
  v_dolu integer;
begin
  select kontenjan, durum into v_kontenjan, v_durum from public.etkinlik_ilanlari where id = NEW.ilan_id;

  if v_durum is null then
    raise exception 'İlan bulunamadı.';
  end if;
  if v_durum <> 'acik' then
    raise exception 'Bu ilan artık aktif değil.';
  end if;

  if v_kontenjan is not null then
    select count(*) into v_dolu from public.etkinlik_katilimcilari where ilan_id = NEW.ilan_id;
    if v_dolu >= v_kontenjan then
      raise exception 'Kontenjan dolu.';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists campuso_etkinlik_katilim_trg on public.etkinlik_katilimcilari;
create trigger campuso_etkinlik_katilim_trg
  before insert on public.etkinlik_katilimcilari
  for each row execute function public.campuso_enforce_etkinlik_katilim();

-- 3) RLS ----------------------------------------------------------------------

alter table public.etkinlik_ilanlari enable row level security;
alter table public.etkinlik_katilimcilari enable row level security;

drop policy if exists etkinlik_ilanlari_select on public.etkinlik_ilanlari;
create policy etkinlik_ilanlari_select on public.etkinlik_ilanlari
  for select using (auth.uid() is not null);

drop policy if exists etkinlik_ilanlari_insert on public.etkinlik_ilanlari;
create policy etkinlik_ilanlari_insert on public.etkinlik_ilanlari
  for insert with check (olusturan_id = auth.uid());

drop policy if exists etkinlik_ilanlari_update on public.etkinlik_ilanlari;
create policy etkinlik_ilanlari_update on public.etkinlik_ilanlari
  for update using (olusturan_id = auth.uid() or public.campuso_current_role() = 'admin');

drop policy if exists etkinlik_ilanlari_delete on public.etkinlik_ilanlari;
create policy etkinlik_ilanlari_delete on public.etkinlik_ilanlari
  for delete using (olusturan_id = auth.uid() or public.campuso_current_role() = 'admin');

drop policy if exists etkinlik_katilimcilari_select on public.etkinlik_katilimcilari;
create policy etkinlik_katilimcilari_select on public.etkinlik_katilimcilari
  for select using (auth.uid() is not null);

drop policy if exists etkinlik_katilimcilari_insert on public.etkinlik_katilimcilari;
create policy etkinlik_katilimcilari_insert on public.etkinlik_katilimcilari
  for insert with check (student_id = auth.uid());

drop policy if exists etkinlik_katilimcilari_delete on public.etkinlik_katilimcilari;
create policy etkinlik_katilimcilari_delete on public.etkinlik_katilimcilari
  for delete using (student_id = auth.uid() or public.campuso_current_role() = 'admin');

-- 4) Katılımcı profillerini (ad/soyad) çekmek için yardımcı RPC ---------------
-- (Kulüpler modülündeki campuso_kulup_kurulu ile aynı desen: RLS altında
-- profiles tablosuna tek tek join yapmak yerine tek bir güvenli fonksiyon.)

create or replace function public.campuso_etkinlik_katilimcilari(p_ilan_id uuid)
returns table (student_id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select k.student_id, p.full_name
  from public.etkinlik_katilimcilari k
  join public.profiles p on p.id = k.student_id
  where k.ilan_id = p_ilan_id
  order by k.created_at asc;
$$;

commit;
