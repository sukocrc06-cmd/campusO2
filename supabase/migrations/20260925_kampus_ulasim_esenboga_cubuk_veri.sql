-- Kampüs Yaşamı > Ulaşım için gerçek AYBÜ verisi. Kaynaklar: aybu.edu.tr'nin
-- resmi "Yerleşkelerimize Ulaşım" belgesi (Esenboğa Havalimanı, AŞTİ, YHT Gar
-- güzergahları) ve @aybu_sks Instagram hesabının "Aybü Ulaşım Rehberi" ile
-- "Çubuk Yerleşkesine Gidiş Güzergahı" paylaşımları — kullanıcı ekran
-- görüntüsü olarak paylaştı, elle bu migration'a işlendi (bkz. sohbet).
-- Her "durak" burada aslında bir güzergah adımı: ad = o noktanın adı,
-- hat_no = o noktadan bir SONRAKİ adıma binilecek otobüs/metro hattı (varış
-- noktasında boş). Bu jsonb yapı şeması değiştirmeden (kampus_ulasim_hatlari
-- tablosu zaten esnek) genişletildi.

insert into public.kampus_ulasim_hatlari (ad, tip, aciklama, duraklar, notlar, sira) values
(
  'Esenboğa Havalimanı → AYBÜ Esenboğa Külliyesi',
  'ego',
  'Havalimanından toplu taşımayla kampüse ulaşım.',
  '[
    {"ad": "Esenboğa Havalimanı Çıkışı", "hat_no": "Havaş / Belko / 442", "saatler": []},
    {"ad": "Kızılay 15 Temmuz Milli İrade Meydanı", "hat_no": "Metro (OSB-Törekent yönü)", "saatler": []},
    {"ad": "Sıhhiye (41517 nolu durak)", "hat_no": "472", "saatler": []},
    {"ad": "AYBÜ Esenboğa Külliyesi", "hat_no": null, "saatler": []}
  ]'::jsonb,
  'Alternatif: 12470 veya 14253 nolu duraklardan 486 ya da 477 numaralı EGO otobüsüyle; ya da 12504 nolu duraktan 474 Ekspres hattıyla da son durak AYBÜ Esenboğa Külliyesi''ne inilebilir.',
  1
),
(
  'AŞTİ → AYBÜ Esenboğa Külliyesi',
  'ego',
  'AŞTİ''den toplu taşımayla kampüse ulaşım.',
  '[
    {"ad": "AŞTİ (tüp geçit)", "hat_no": "Ankaray", "saatler": []},
    {"ad": "Kızılay 15 Temmuz Milli İrade Meydanı", "hat_no": null, "saatler": []},
    {"ad": "Sıhhiye (41517 nolu durak)", "hat_no": "472", "saatler": []},
    {"ad": "AYBÜ Esenboğa Külliyesi", "hat_no": null, "saatler": []}
  ]'::jsonb,
  'Alternatif: Ankaray ile Kızılay, Sıhhiye ya da Ulus duraklarının herhangi birinde inip 491, 486, 474 veya 472 numaralı EGO otobüslerinden biriyle de kampüse ulaşılabilir. Ayrıca 12470/14253 duraklarından 486/477, ya da 12504 duraktan 474 Ekspres.',
  2
),
(
  'YHT Gar → AYBÜ Esenboğa Külliyesi',
  'ego',
  'Yüksek Hızlı Tren Garı''ndan toplu taşımayla kampüse ulaşım.',
  '[
    {"ad": "YHT Gar Çıkışı", "hat_no": "Metro", "saatler": []},
    {"ad": "Kızılay 15 Temmuz Milli İrade Meydanı", "hat_no": "Metro (OSB-Törekent yönü)", "saatler": []},
    {"ad": "Sıhhiye (41517 nolu durak)", "hat_no": "472", "saatler": []},
    {"ad": "AYBÜ Esenboğa Külliyesi", "hat_no": null, "saatler": []}
  ]'::jsonb,
  'Alternatif: 12470/14253 duraklarından 486/477 numaralı EGO otobüsleri, ya da 12504 duraktan 474 Ekspres hattı.',
  3
),
(
  'Sıhhiye - Çubuk Yerleşkesi Ring Hattı',
  'ring',
  '487 numaralı EGO ring hattı ile Çubuk Yerleşkesi''ne ulaşım.',
  '[
    {"ad": "Sıhhiye (Ana Durak, Adliye Önü)", "hat_no": "487", "saatler": []},
    {"ad": "Ulus", "hat_no": null, "saatler": []},
    {"ad": "Dışkapı", "hat_no": null, "saatler": []},
    {"ad": "Hasköy", "hat_no": null, "saatler": []},
    {"ad": "Pursaklar", "hat_no": null, "saatler": []},
    {"ad": "Çubuk Yerleşkesi", "hat_no": null, "saatler": []}
  ]'::jsonb,
  '487 numaralı EGO hattı, sefer sıklığı ortalama 15-20 dakika.',
  4
);
