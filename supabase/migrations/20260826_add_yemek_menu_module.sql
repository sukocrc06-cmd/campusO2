-- CampusO Vol 1-7: Yemek Menüsü Entegrasyonu
-- AYBÜ SKS sitesinden (https://aybu.edu.tr/sks/tr/sayfa/6265) otomatik
-- çekilen haftalık yemek menüsünü saklar. Yazma işlemleri sunucu tarafında
-- (Supabase service role ile) yapılır; bu tablo RLS'de yalnızca okumaya açıktır.

begin;

create table if not exists public.yemek_menusu (
  id uuid primary key default gen_random_uuid(),
  tarih date not null,
  gun_adi text not null,
  yemekler jsonb not null default '[]'::jsonb,
  kaynak text not null default 'otomatik' check (kaynak in ('otomatik', 'manuel')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tarih)
);

create index if not exists yemek_menusu_tarih_idx on public.yemek_menusu(tarih);

create table if not exists public.yemek_menu_sync_loglari (
  id uuid primary key default gen_random_uuid(),
  calisma_zamani timestamptz not null default now(),
  basarili boolean not null,
  bulunan_gun_sayisi int not null default 0,
  mesaj text,
  created_at timestamptz not null default now()
);

create index if not exists yemek_menu_sync_loglari_zaman_idx on public.yemek_menu_sync_loglari(calisma_zamani desc);

drop trigger if exists campuso_yemek_menusu_touch_trg on public.yemek_menusu;
create trigger campuso_yemek_menusu_touch_trg
  before update on public.yemek_menusu
  for each row execute function public.campuso_touch_updated_at();

alter table public.yemek_menusu enable row level security;
alter table public.yemek_menu_sync_loglari enable row level security;

drop policy if exists yemek_menusu_select on public.yemek_menusu;
create policy yemek_menusu_select on public.yemek_menusu
  for select using (auth.uid() is not null);

drop policy if exists yemek_menusu_write on public.yemek_menusu;
create policy yemek_menusu_write on public.yemek_menusu
  for all using (public.campuso_current_role() = 'admin')
  with check (public.campuso_current_role() = 'admin');

drop policy if exists yemek_menu_sync_loglari_select on public.yemek_menu_sync_loglari;
create policy yemek_menu_sync_loglari_select on public.yemek_menu_sync_loglari
  for select using (public.campuso_current_role() = 'admin');

-- Not: Otomatik senkronizasyon rotası (app/api/yemek-menu-sync) bu iki tabloya
-- Supabase SERVICE ROLE anahtarıyla yazar; bu nedenle normal kullanıcı/admin
-- oturumu için ayrıca "insert" politikası tanımlanmadı (yukarıdaki "write"
-- politikası, admin panelinden elle düzenleme ihtiyacı doğarsa diye eklendi).

commit;
