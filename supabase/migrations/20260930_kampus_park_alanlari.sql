-- Kampüs Yaşamı > Park Alanları modülü (AYRINTILI TASARIM.docx 3.5: Otopark
-- doluluk göstergesi, park noktası detayları). AYBÜ'nün resmi kaynaklarında
-- (aybu.edu.tr/yapiisleri/Esenboğa-Külliyesi) yalnızca kampüs genelinde
-- "606 araçlık açık otopark" olduğu bilgisi var — sensörlü/akıllı bir
-- otopark sistemi olduğuna dair hiçbir kaynak yok (Kampüs Hizmetleri
-- modülündeki araştırmayla aynı sonuç). Bu yüzden doluluk oranı gerçek
-- sensör verisi yerine ÖĞRENCİ BİLDİRİMLİ CANLI TAHMİN ile kuruluyor:
-- kullanıcılar "Boş / Orta / Dolu" bildiriyor, sayfa son ~90 dakikalık
-- bildirimlerin zaman-ağırlıklı ortalamasını gösteriyor — hiçbir zaman
-- "kesin doluluk" diye sunulmuyor, her zaman "X dk önce bildirildi"
-- şeffaflığıyla gösteriliyor. Park noktalarının konum/kapasite bilgisi
-- (kampus_binalar'daki gibi) admin panelinden (/admin/park-alanlari) elle
-- giriliyor ve Kampüs Haritası'nda da ayrı bir işaretçi tipi olarak
-- gösteriliyor.
create table if not exists public.kampus_park_alanlari (
  id uuid primary key default gen_random_uuid(),
  ad text not null check (char_length(ad) between 2 and 120),
  aciklama text check (char_length(aciklama) <= 400),
  lat double precision not null,
  lng double precision not null,
  kapasite integer check (kapasite is null or kapasite >= 0),
  engelli_kontenjan integer not null default 0 check (engelli_kontenjan >= 0),
  aktif boolean not null default true,
  sira integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.kampus_park_alanlari enable row level security;

create policy "kampus_park_alanlari_herkes_okur" on public.kampus_park_alanlari
  for select using (true);

create policy "kampus_park_alanlari_admin_yazar" on public.kampus_park_alanlari
  for all using (public.campuso_current_role() = 'admin')
  with check (public.campuso_current_role() = 'admin');

create or replace function public.kampus_park_alanlari_updated_at_guncelle()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists kampus_park_alanlari_updated_at_trg on public.kampus_park_alanlari;
create trigger kampus_park_alanlari_updated_at_trg
  before update on public.kampus_park_alanlari
  for each row execute function public.kampus_park_alanlari_updated_at_guncelle();

-- Öğrenci bildirimli doluluk raporları — her satır tek bir kullanıcının tek
-- anlık bildirimi, immutable (update/delete yok, admin moderasyonu hariç).
-- Sunucu tarafında bir hız sınırlama (rate limit) yok; istemci tarafında
-- (localStorage ile) kullanıcı başına birkaç dakikalık yumuşak bir bekleme
-- uygulanıyor — v1 için kabul edilebilir bir basitleştirme.
create table if not exists public.kampus_park_bildirimleri (
  id uuid primary key default gen_random_uuid(),
  park_id uuid not null references public.kampus_park_alanlari(id) on delete cascade,
  kullanici_id uuid references auth.users(id) on delete set null,
  durum text not null check (durum in ('bos', 'orta', 'dolu')),
  created_at timestamptz not null default now()
);

create index if not exists kampus_park_bildirimleri_park_zaman_idx
  on public.kampus_park_bildirimleri (park_id, created_at desc);

alter table public.kampus_park_bildirimleri enable row level security;

-- ders_programi'ndaki "auth.uid() IS NOT NULL" deseniyle aynı: sadece
-- oturum açmış (öğrenci/akademisyen/admin) kullanıcılar bildirimleri
-- okuyup gönderebiliyor.
create policy "kampus_park_bildirimleri_giris_yapan_okur" on public.kampus_park_bildirimleri
  for select using (auth.uid() is not null);

create policy "kampus_park_bildirimleri_kullanici_ekler" on public.kampus_park_bildirimleri
  for insert with check (auth.uid() = kullanici_id);

create policy "kampus_park_bildirimleri_admin_siler" on public.kampus_park_bildirimleri
  for delete using (public.campuso_current_role() = 'admin');

-- Yalnızca doğrulanmış bilgiyle (Yapı İşleri sayfasındaki toplam kapasite)
-- tek bir başlangıç kaydı — admin panelinden gerçek park noktalarına göre
-- bölünüp çoğaltılacak.
insert into public.kampus_park_alanlari (ad, aciklama, lat, lng, kapasite, sira)
values (
  'Esenboğa Külliyesi — Açık Otopark',
  'Kampüs genelindeki açık otopark alanı. Toplam kapasite AYBÜ Yapı İşleri''nin resmi sayfasından alınmıştır; ayrı park noktaları admin panelinden eklenecek.',
  40.1328489,
  32.9440116,
  606,
  0
);
