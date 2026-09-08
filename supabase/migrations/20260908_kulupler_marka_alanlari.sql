-- Sosyal Etkileşim & Topluluklar > 7.1 Üniversite Resmî Kulüpleri:
-- kart/sayfa tasarımının kulübe özgü bir kimlik taşıması istendi
-- ("kulüplerin renklerine göre sayfalar o renge bürünse", "sosyal medya/
-- iletişim/öne çıkan etkinlik varsa gösterse"). Bunun için kulupler
-- tablosuna küçük, opsiyonel alanlar ekleniyor — hiçbiri NOT NULL değil,
-- dolayısıyla var olan kulüpler etkilenmez ve boş bırakılırsa uygulama
-- otomatik olarak kategori rengine / hiçbir ek bilgi göstermemeye döner.
--
-- renk: kulüp yöneticisinin elle seçtiği hex renk (#rrggbb). Boşsa
-- istemci tarafında yüklenen logodan otomatik çıkarılan renk kaydedilir
-- (bkz. app/student/kulupler/page.jsx handleLogoUpload); o da yoksa
-- kategoriye göre sabit renk paleti kullanılır — üç kademeli bir "yedek
-- zinciri", hiçbir aşamada veri eksikliği kullanıcıya hata olarak yansımaz.
--
-- 7.4 Etkinlik Planlama ayrı ve daha kapsamlı bir modül olacağı için burada
-- tam bir etkinlik takvimi YOK — sadece kulübün dilerse kart üzerinde
-- rozet gibi gösterebileceği TEK "öne çıkan etkinlik" (başlık + tarih).
alter table public.kulupler
  add column if not exists renk text,
  add column if not exists sosyal_medya_url text,
  add column if not exists iletisim_email text,
  add column if not exists one_cikan_etkinlik_baslik text,
  add column if not exists one_cikan_etkinlik_tarihi date;

-- Basit format koruması: renk girildiyse gerçekten #rrggbb veya #rgb olsun.
alter table public.kulupler
  drop constraint if exists kulupler_renk_format_check;
alter table public.kulupler
  add constraint kulupler_renk_format_check
  check (renk is null or renk ~* '^#([0-9a-f]{3}|[0-9a-f]{6})$');

-- RLS: mevcut "kulupler_update" politikası (danışman / kulüp yetkilisi /
-- admin) tüm sütunları kapsıyor, bu yeni alanlar için ek bir politika
-- gerekmiyor — sadece var olan güncelleme yetkisinin kapsamı genişliyor.
