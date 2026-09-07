-- Kampüs Yaşamı > Ulaşım — iki iyileştirme:
-- 1) notlar metninde gömülü alternatif hat numaraları (ör. "486 ya da 477
--    numaralı EGO otobüsüyle de ulaşılabilir") öğrenciler tarafından paragrafı
--    okumadan atlanabiliyordu. Bu numaraları ayrı, yapılandırılmış bir jsonb
--    diziye taşıyoruz ki sayfada küçük rozetler olarak, metni okumaya gerek
--    kalmadan gösterilebilsin. notlar alanı serbest metin/ek bağlam olarak
--    kalmaya devam ediyor.
-- 2) Öğrencilerin çoğunlukla tercih ettiği, az duraklı/aktarmasız "474
--    Ekspres" güzergahı (Kızılay - Sıhhiye - Dışkapı - Pursaklar - AYBÜ)
--    eklendi ve "one_cikan" (öne çıkan/en hızlı) olarak işaretlendi — sayfada
--    bu kart nabız gibi hafifçe yanıp sönerek öne çıkarılıyor, diğer kartlar
--    değişmeden kalıyor.

alter table public.kampus_ulasim_hatlari
  add column if not exists alternatif_hatlar jsonb not null default '[]'::jsonb;

alter table public.kampus_ulasim_hatlari
  add column if not exists one_cikan boolean not null default false;

update public.kampus_ulasim_hatlari
  set alternatif_hatlar = '["486", "477", "474 Ekspres"]'::jsonb
  where ad = 'Esenboğa Havalimanı → AYBÜ Esenboğa Külliyesi';

update public.kampus_ulasim_hatlari
  set alternatif_hatlar = '["491", "486", "472", "477", "474 Ekspres"]'::jsonb
  where ad = 'AŞTİ → AYBÜ Esenboğa Külliyesi';

update public.kampus_ulasim_hatlari
  set alternatif_hatlar = '["486", "477", "474 Ekspres"]'::jsonb
  where ad = 'YHT Gar → AYBÜ Esenboğa Külliyesi';

insert into public.kampus_ulasim_hatlari (ad, tip, aciklama, duraklar, notlar, alternatif_hatlar, one_cikan, sira)
values (
  '474 Ekspres (Kızılay → AYBÜ)',
  'ego',
  'Az durak, aktarmasız — çoğu öğrencinin tercih ettiği en hızlı güzergah.',
  '[
    {"ad": "Kızılay 15 Temmuz Milli İrade Meydanı", "hat_no": "474 Ekspres", "saatler": []},
    {"ad": "Sıhhiye (41517 nolu durak)", "hat_no": "474 Ekspres", "saatler": []},
    {"ad": "Dışkapı", "hat_no": "474 Ekspres", "saatler": []},
    {"ad": "Pursaklar", "hat_no": "474 Ekspres", "saatler": []},
    {"ad": "AYBÜ Esenboğa Külliyesi", "hat_no": null, "saatler": []}
  ]'::jsonb,
  'Tek hatla (474 Ekspres) doğrudan kampüse ulaşılır, aktarma gerekmez.',
  '[]'::jsonb,
  true,
  0
);
