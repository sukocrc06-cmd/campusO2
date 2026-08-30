-- CampusO Vol 1-11 devamı 2: Kampüs Duvarı görsel/özellik geliştirmeleri
-- Çoklu görsel (galeri), çoklu emoji reaksiyonu, gönderi kaydetme (bookmark)
-- ve kullanıcı etiketleme (@mention) bildirimi için gerekli şema değişiklikleri.

begin;

-- 1) Çoklu görsel -------------------------------------------------------
-- Eski tekil gorsel_url kolonu geriye dönük uyumluluk için duruyor;
-- yeni paylaşımlar gorsel_urls dizisine yazılacak.

alter table public.gonderiler
  add column if not exists gorsel_urls text[] not null default '{}';

-- 2) Çoklu emoji reaksiyonu ----------------------------------------------
-- gonderi_begenileri tablosuna tepki tipini ekliyoruz; PK (gonderi_id, kullanici_id)
-- olduğu için bir kullanıcının bir gönderiye tek tepkisi olur, tipini değiştirebilir.

alter table public.gonderi_begenileri
  add column if not exists tip text not null default 'begeni';

alter table public.gonderi_begenileri drop constraint if exists gonderi_begenileri_tip_check;
alter table public.gonderi_begenileri
  add constraint gonderi_begenileri_tip_check
  check (tip in ('begeni', 'alkis', 'kahkaha', 'sasirma', 'uzucu'));

-- Reaksiyon değiştirme "upsert" (insert ... on conflict do update) ile
-- yapıldığı için ayrıca bir update politikası gerekiyor.
drop policy if exists gonderi_begenileri_update on public.gonderi_begenileri;
create policy gonderi_begenileri_update on public.gonderi_begenileri
  for update using (kullanici_id = auth.uid())
  with check (kullanici_id = auth.uid());

-- 3) Gönderi kaydetme (bookmark) -----------------------------------------

create table if not exists public.gonderi_kaydedilenler (
  gonderi_id uuid not null references public.gonderiler(id) on delete cascade,
  kullanici_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (gonderi_id, kullanici_id)
);

alter table public.gonderi_kaydedilenler enable row level security;

drop policy if exists gonderi_kaydedilenler_select on public.gonderi_kaydedilenler;
create policy gonderi_kaydedilenler_select on public.gonderi_kaydedilenler
  for select using (kullanici_id = auth.uid());

drop policy if exists gonderi_kaydedilenler_insert on public.gonderi_kaydedilenler;
create policy gonderi_kaydedilenler_insert on public.gonderi_kaydedilenler
  for insert with check (
    kullanici_id = auth.uid()
    and public.campuso_current_role() = 'student'
  );

drop policy if exists gonderi_kaydedilenler_delete on public.gonderi_kaydedilenler;
create policy gonderi_kaydedilenler_delete on public.gonderi_kaydedilenler
  for delete using (kullanici_id = auth.uid());

-- 4) Kullanıcı etiketleme (@mention) bildirimi ----------------------------
-- Bildirim tiplerine 'etiket' ekleniyor; etiketleme istemci tarafında
-- seçilen kullanıcı id'leriyle doğrudan bildirim satırı olarak yazılıyor.

alter table public.kampus_duvari_bildirimleri drop constraint if exists kampus_duvari_bildirimleri_tip_check;
alter table public.kampus_duvari_bildirimleri
  add constraint kampus_duvari_bildirimleri_tip_check
  check (tip in ('yorum', 'duyuru', 'etiket'));

drop policy if exists kampus_duvari_bildirimleri_insert on public.kampus_duvari_bildirimleri;
create policy kampus_duvari_bildirimleri_insert on public.kampus_duvari_bildirimleri
  for insert with check (
    tip = 'etiket'
    and olusturan_id = auth.uid()
    and public.campuso_current_role() = 'student'
  );

-- Etiketleme için öğrenci arama (mention autocomplete). Sadece isim ve
-- avatar döner, e-posta gibi hassas alanlar dönmez.

create or replace function public.campuso_profil_ara(p_sorgu text, p_limit int default 6)
returns table (id uuid, full_name text, avatar_url text, bolum text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.full_name, p.avatar_url, p.bolum
  from public.profiles p
  where p.role = 'student'
    and p.id <> auth.uid()
    and p.full_name ilike '%' || coalesce(p_sorgu, '') || '%'
  order by p.full_name asc
  limit greatest(1, least(p_limit, 20));
$$;

commit;
