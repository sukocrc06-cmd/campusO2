-- Kampüs Yaşamı > Sanal Tur modülü (AYRINTILI TASARIM.docx 3.7).
-- AYBÜ'nün resmi sanal turu (aybu.edu.tr/sanaltur) 360° panorama fotoğrafları
-- kullanıyor ama bunlar telifli — kopyalayamayız, ve elimizde kendi 360°
-- çekimimiz yok. Bu yüzden Ulaşım/Kampüs Haritası'ndaki gibi "altyapıyı biz
-- kurarız, gerçek görselleri admin zamanla yükler" yaklaşımını sürdürüyoruz.
-- Her durak birden çok fotoğraf taşıyabilir; her fotoğraf "normal" (kaydırmalı
-- galeri) ya da "panorama" (360°, Pannellum ile — ücretsiz/açık kaynak,
-- API key gerekmez) olarak işaretlenir. Admin elindeki sıradan fotoğraflarla
-- hemen başlayabilir; ileride telefonla 360° çekim eklenince o durak otomatik
-- olarak panorama moduna geçer. Duraklar Kampüs Haritası'ndaki bir binaya
-- opsiyonel olarak bağlanabilir (bina_id) — açık alanlar (gölet, spor sahası
-- gibi) için bina zorunlu değil.
begin;

create table if not exists public.kampus_sanal_tur_duraklari (
  id uuid primary key default gen_random_uuid(),
  baslik text not null check (char_length(baslik) between 2 and 120),
  kategori text not null default 'diger' check (kategori in ('sinif', 'kutuphane', 'aktivite', 'laboratuvar', 'yol', 'disalan', 'diger')),
  aciklama text check (char_length(aciklama) <= 400),
  bina_id uuid references public.kampus_binalar(id) on delete set null,
  -- [{ "url": "...", "tip": "normal" | "panorama", "baslik": "..." }, ...]
  fotograflar jsonb not null default '[]'::jsonb,
  aktif boolean not null default true,
  sira integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.kampus_sanal_tur_duraklari enable row level security;

drop policy if exists kampus_sanal_tur_herkes_okur on public.kampus_sanal_tur_duraklari;
create policy kampus_sanal_tur_herkes_okur on public.kampus_sanal_tur_duraklari
  for select using (true);

drop policy if exists kampus_sanal_tur_admin_yazar on public.kampus_sanal_tur_duraklari;
create policy kampus_sanal_tur_admin_yazar on public.kampus_sanal_tur_duraklari
  for all using (public.campuso_current_role() = 'admin')
  with check (public.campuso_current_role() = 'admin');

create or replace function public.kampus_sanal_tur_updated_at_guncelle()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists kampus_sanal_tur_updated_at_trg on public.kampus_sanal_tur_duraklari;
create trigger kampus_sanal_tur_updated_at_trg
  before update on public.kampus_sanal_tur_duraklari
  for each row execute function public.kampus_sanal_tur_updated_at_guncelle();

-- Sanal tur fotoğrafları için Storage bucket'ı — sadece admin yazar.
-- Yol kuralı: <durak_id>/<dosya_adı> (kulüp logosu deseniyle aynı).

insert into storage.buckets (id, name, public)
values ('sanal-tur-fotograflari', 'sanal-tur-fotograflari', true)
on conflict (id) do nothing;

drop policy if exists sanal_tur_foto_public_select on storage.objects;
create policy sanal_tur_foto_public_select on storage.objects
  for select using (bucket_id = 'sanal-tur-fotograflari');

drop policy if exists sanal_tur_foto_admin_insert on storage.objects;
create policy sanal_tur_foto_admin_insert on storage.objects
  for insert with check (
    bucket_id = 'sanal-tur-fotograflari'
    and public.campuso_current_role() = 'admin'
  );

drop policy if exists sanal_tur_foto_admin_update on storage.objects;
create policy sanal_tur_foto_admin_update on storage.objects
  for update using (
    bucket_id = 'sanal-tur-fotograflari'
    and public.campuso_current_role() = 'admin'
  );

drop policy if exists sanal_tur_foto_admin_delete on storage.objects;
create policy sanal_tur_foto_admin_delete on storage.objects
  for delete using (
    bucket_id = 'sanal-tur-fotograflari'
    and public.campuso_current_role() = 'admin'
  );

commit;
