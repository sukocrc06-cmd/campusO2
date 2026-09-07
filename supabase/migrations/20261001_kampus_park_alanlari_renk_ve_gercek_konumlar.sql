-- Park Alanları modülüne iki iyileştirme:
--
-- 1) Her park alanı artık kendi rengini taşıyabiliyor (renk sütunu, hex).
--    Admin panelinden renk seçilmezse harita/kart görünümü sabit turkuaz
--    renge geri düşüyor (uygulama tarafında fallback) — burada sadece
--    seed verisine gerçek, birbirinden ayrışan renkler atıyoruz.
--
-- 2) Kampüs çevresinde OpenStreetMap'in kendi verisinde ("amenity=parking"
--    olarak etiketlenmiş) tam olarak 4 ayrı gerçek otopark alanı bulunduğu
--    görüldü — OSM'in resmi API'sinden (api.openstreetmap.org/api/0.6/way/
--    <id>/full) her birinin gerçek çokgen köşe noktaları çekilip merkez
--    (centroid) koordinatı hesaplandı; hiçbir koordinat tahmin edilmedi.
--    OSM verisi ODbL lisansıyla serbestçe kullanılabilir (bu uygulama zaten
--    OSM kutucuklarını temel harita olarak kullanıyor). Tek parça, kapasitesi
--    bilinmeyen "Esenboğa Külliyesi — Açık Otopark" placeholder'ı bu 4 gerçek
--    konumla değiştiriliyor; toplam kapasite (606) artık tek noktaya değil
--    gerçek 4 alana dağıldığı için per-alan kapasite bilinmiyor (null) —
--    admin panelinden gerçek sayılar netleşince eklenebilir.
--    Kaynak way id'leri: 1083509636, 1083509637, 1083509639, 1083509640
--    (© OpenStreetMap katkıda bulunanlar, ODbL).
alter table public.kampus_park_alanlari
  add column if not exists renk text check (renk is null or renk ~ '^#[0-9a-fA-F]{6}$');

delete from public.kampus_park_alanlari where ad = 'Esenboğa Külliyesi — Açık Otopark';

insert into public.kampus_park_alanlari (ad, aciklama, lat, lng, renk, sira)
values
  (
    'Kuzey Otoparkı — Batı',
    'Ana giriş yolunun batısında, kampüs kuzey ucundaki açık otopark. Konum OpenStreetMap verisinden alınmıştır (© OSM katkıda bulunanlar).',
    40.1351706,
    32.9419894,
    '#5b9dff',
    0
  ),
  (
    'Kuzey Otoparkı — Doğu',
    'Ana giriş yolunun doğusunda, kampüs kuzey ucundaki açık otopark. Konum OpenStreetMap verisinden alınmıştır (© OSM katkıda bulunanlar).',
    40.1351138,
    32.9441979,
    '#f472b6',
    1
  ),
  (
    'Güney Otoparkı (Durak Yakını)',
    'Kampüs binalarının güneyinde, servis/ring durağına yakın uzun otopark alanı. Konum OpenStreetMap verisinden alınmıştır (© OSM katkıda bulunanlar).',
    40.1325193,
    32.9434670,
    '#ffbf5a',
    2
  ),
  (
    'Güney-Doğu Otoparkı',
    'Kampüs binalarının güney-doğusundaki açık otopark alanı. Konum OpenStreetMap verisinden alınmıştır (© OSM katkıda bulunanlar).',
    40.1322225,
    32.9447443,
    '#34d399',
    3
  );
