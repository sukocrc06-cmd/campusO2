-- Kampüs Yaşamı > Kampüs Hizmetleri modülü (AYRINTILI TASARIM.docx 3.4:
-- ATM'ler, Market/Kırtasiye, Spor Salonu, Medikal Servis, Cami, Kargo
-- Noktaları). AYBÜ'nün resmi kaynaklarında (aybu.edu.tr/sks, aybu.edu.tr/
-- spor, aybu.edu.tr/yapiisleri) bu hizmetlerin bir kısmı (ATM konumu,
-- market/kırtasiye işletmecisi, revir/medikal servis, cami/mescit, PTT-
-- kargo noktası) somut olarak yayınlanmamış — kampüs hâlâ gelişiyor
-- (Öğrenci Yaşam Merkezi 2026-2027'de tamamlanacak). Bu yüzden Ulaşım/
-- Kampüs Haritası/Sanal Tur'daki gibi admin panelinden elle girilen bir
-- tablo kuruluyor; sadece doğrulanmış bilgilerle (Spor Salonu, Yemekhane/
-- SKS) başlangıç verisi ekleniyor, geri kalan kategoriler admin panelinden
-- gerçek bilgiyle zamanla doldurulacak. Kampüs Haritası'ndaki bina ile
-- opsiyonel konum bağlantısı (bina_id) kurulabiliyor ki bir hizmetin
-- haritadaki karşılığı gösterilebilsin.
create table if not exists public.kampus_hizmetleri (
  id uuid primary key default gen_random_uuid(),
  baslik text not null check (char_length(baslik) between 2 and 120),
  kategori text not null default 'diger' check (kategori in ('atm', 'market', 'spor', 'medikal', 'cami', 'kargo', 'yemekhane', 'diger')),
  aciklama text check (char_length(aciklama) <= 500),
  konum_metni text check (char_length(konum_metni) <= 200),
  bina_id uuid references public.kampus_binalar(id) on delete set null,
  calisma_saatleri text check (char_length(calisma_saatleri) <= 120),
  iletisim text check (char_length(iletisim) <= 200),
  aktif boolean not null default true,
  sira integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.kampus_hizmetleri enable row level security;

create policy "kampus_hizmetleri_herkes_okur" on public.kampus_hizmetleri
  for select using (true);

create policy "kampus_hizmetleri_admin_yazar" on public.kampus_hizmetleri
  for all using (public.campuso_current_role() = 'admin')
  with check (public.campuso_current_role() = 'admin');

create or replace function public.kampus_hizmetleri_updated_at_guncelle()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists kampus_hizmetleri_updated_at_trg on public.kampus_hizmetleri;
create trigger kampus_hizmetleri_updated_at_trg
  before update on public.kampus_hizmetleri
  for each row execute function public.kampus_hizmetleri_updated_at_guncelle();

-- Yalnızca AYBÜ'nün resmi sayfalarından doğrulanan bilgilerle ilk kayıtlar.
insert into public.kampus_hizmetleri (baslik, kategori, aciklama, konum_metni, calisma_saatleri, iletisim, sira)
values
  (
    'Spor Salonu — Fitness ve Halı Saha',
    'spor',
    'Esenboğa Külliyesi''nde fitness salonu ve halı saha bulunuyor. Kullanım için Halkbank hesabına ödeme yapıp ilgili birime başvurulması gerekiyor. 2026 yılında ayrı bir Spor Salonu binası hizmete girmesi planlanıyor.',
    'Esenboğa Külliyesi Spor Merkezi',
    '08:00 – 16:30',
    '0312 906 11 95 (Erhan TAŞ)',
    0
  ),
  (
    'Yemekhane / Kantin',
    'yemekhane',
    'Sağlık, Kültür ve Spor Daire Başkanlığı (SKS) tarafından işletiliyor. Vejetaryen ve glütensiz menü alternatifleri de sunuluyor. Güncel yemek menüsü SKS''nin resmi sayfasında paylaşılıyor.',
    'Esenboğa Külliyesi',
    null,
    'sksdb@aybu.edu.tr · 0312 906 10 00',
    1
  ),
  (
    'Psikolojik Danışma ve Rehberlik (PDR)',
    'diger',
    'SKS bünyesinde öğrencilere yönelik psikolojik danışmanlık hizmeti veriliyor. Randevu, PDR''nin online randevu sistemi üzerinden alınıyor.',
    null,
    null,
    'sksdb@aybu.edu.tr · 0312 906 10 00',
    2
  );
