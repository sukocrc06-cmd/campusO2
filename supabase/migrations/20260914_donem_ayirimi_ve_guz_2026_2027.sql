-- CampusO Vol 1-8 devamı: Ders programına GÜZ / BAHAR dönem ayrımı ve
-- AYBÜ İşletme Fakültesi 2026-2027 GÜZ dönemi resmi ders programının
-- (kullanıcının paylaştığı "ACADEMIC YEAR 2026-2027 FALL SEMESTER COURSE
-- SCHEDULE" PDF'i) içe aktarılması.
--
-- Sorun: ders_programi tablosunda güz/bahar ayrımı hiç yoktu — daha önce
-- girilmiş ~163 satırlık veri (20260903 migration) aslında 2025-2026 güz VE
-- bahar dönemlerinin karışımıydı. Bu da örn. Ali İhsan Çetin hocanın güz
-- döneminde verdiği "Computing for Finance", "Statistics for Business I",
-- "Credit Analysis and Allocation" gibi derslerin hiç görünmemesine yol
-- açıyordu (o dersler sistemde hiç yoktu, "bahar" karışımında yer alan
-- başka dersleri (örn. Statistics for Business II) görüyordu).
--
-- Çözüm:
--   1) ders_programi ve sinav_takvimi'ne 'guz'/'bahar' değerli bir `donem`
--      sütunu eklendi. Mevcut tüm satırlar (önceden girilmiş karışık veri)
--      BİLİNÇLİ olarak 'bahar' değeriyle etiketlendi — kullanıcının isteği
--      "bahar dönemi olduğu gibi kalabilir" idi, dokunulmadı.
--   2) Yeni bir `aktif_donem` tekil-satır ayar tablosu eklendi: admin panelinden
--      "Güz" / "Bahar" arasında tek tıkla geçiş yapılabilir; öğrenci/akademisyen
--      tarafındaki ders programı, yoklama ve QR yoklama ekranları HER ZAMAN bu
--      aktif dönemin derslerini gösterir — admin panelinde dönem değiştirmek
--      tüm sisteme otomatik yansır.
--   3) PDF'teki 2026-2027 güz dönemi ders programı `donem='guz'` olarak içe
--      aktarıldı (105 satır — her ortak/çok bölümlü ders, ilgili bölüm sayısı
--      kadar satıra bölünerek; bölüm PDF'teki oda sütunundaki (BUS/FB/ITB/MIS)
--      kısaltmalarından, sınıf ise ders kodundaki basamak sayısından
--      (1xx=1.sınıf...4xx=4.sınıf) türetildi). Hoca-hesap eşlemesi zaten var
--      olan otomatik isim eşleme tetikleyicisi (campuso_ders_akademisyen_esle)
--      sayesinde bu satırlar eklenirken otomatik çalışır.
--   4) Aktif dönem şu an 'guz' olarak ayarlandı (bugünün tarihi 2026-2027
--      güz dönemine denk geliyor); admin istediği an bahar'a geri alabilir.

begin;

alter table public.ders_programi
  add column if not exists donem text not null default 'bahar' check (donem in ('guz', 'bahar'));

alter table public.sinav_takvimi
  add column if not exists donem text not null default 'bahar' check (donem in ('guz', 'bahar'));

create index if not exists ders_programi_donem_idx on public.ders_programi(donem);
create index if not exists sinav_takvimi_donem_idx on public.sinav_takvimi(donem);

create table if not exists public.aktif_donem (
  id boolean primary key default true check (id),
  donem text not null default 'bahar' check (donem in ('guz', 'bahar')),
  guncelleyen_id uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.aktif_donem enable row level security;

drop policy if exists aktif_donem_select on public.aktif_donem;
create policy aktif_donem_select on public.aktif_donem
  for select using (auth.uid() is not null);

drop policy if exists aktif_donem_write on public.aktif_donem;
create policy aktif_donem_write on public.aktif_donem
  for all using (public.campuso_current_role() = 'admin')
  with check (public.campuso_current_role() = 'admin');

drop trigger if exists campuso_aktif_donem_touch_trg on public.aktif_donem;
create trigger campuso_aktif_donem_touch_trg
  before update on public.aktif_donem
  for each row execute function public.campuso_touch_updated_at();

insert into public.aktif_donem (id, donem) values (true, 'guz')
on conflict (id) do update set donem = excluded.donem, updated_at = now();

-- 2026-2027 Güz dönemi resmi ders programı (AYBÜ İşletme Fakültesi).
-- baslangic_saat/bitis_saat "HH:MM" biçiminde metin (tablo tanımıyla tutarlı).
insert into public.ders_programi
  (bolum, sinif, ders_kodu, ders_adi, gun, baslangic_saat, bitis_saat, derslik, hoca_adi, donem)
values
('Finans ve Bankacılık', '3', 'BF315', 'Islamic Finance', 'Pazartesi', '09:00', '12:00', 'B209', 'Prof.Dr. Cem Korkut', 'guz'),
('Finans ve Bankacılık', '4', 'BF407', 'Digital Finance', 'Pazartesi', '09:00', '12:00', 'B211', 'Prof.Dr. Yüksel Akay Ünvan', 'guz'),
('Finans ve Bankacılık', '1', 'BUS107', 'Introduction to Business', 'Pazartesi', '09:00', '12:00', 'B202', 'Doç.Dr. Semih Ceyhan', 'guz'),
('Yönetim Bilişim Sistemleri', '1', 'BUS107', 'Introduction to Business', 'Pazartesi', '09:00', '12:00', 'B202', 'Doç.Dr. Semih Ceyhan', 'guz'),
('İşletme', '3', 'BUS303', 'Leadership and Managerial Skills', 'Pazartesi', '09:00', '12:00', 'B210', 'Doç.Dr. Hande Özgen', 'guz'),
('İşletme', '1', 'ITB101', 'Introduction to Economics I', 'Pazartesi', '09:00', '12:00', 'B201', 'Doç.Dr. Merve Karacaer', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '1', 'ITB101', 'Introduction to Economics I', 'Pazartesi', '09:00', '12:00', 'B201', 'Doç.Dr. Merve Karacaer', 'guz'),
('İşletme', '2', 'ITB207', 'International Business', 'Pazartesi', '09:00', '12:00', 'B217', 'Doç.Dr. Bilge Canbaloğlu', 'guz'),
('Finans ve Bankacılık', '2', 'ITB207', 'International Business', 'Pazartesi', '09:00', '12:00', 'B217', 'Doç.Dr. Bilge Canbaloğlu', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '4', 'ITB435', 'Global Leadership', 'Pazartesi', '09:00', '12:00', 'B207', 'Doç.Dr. Hakan Dulkadiroğlu', 'guz'),
('Yönetim Bilişim Sistemleri', '2', 'MIS213', 'E-Business', 'Pazartesi', '09:00', '12:00', 'B237', 'Dr.Öğr.Üyesi Musab Talha Akpınar', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '2', 'MIS213', 'E-Business', 'Pazartesi', '09:00', '12:00', 'B237', 'Dr.Öğr.Üyesi Musab Talha Akpınar', 'guz'),
('Yönetim Bilişim Sistemleri', '3', 'MIS303', 'Software Development', 'Pazartesi', '09:00', '12:00', 'B205', 'Prof.Dr. Ömür Akdemir', 'guz'),
('Finans ve Bankacılık', '3', 'BF305', 'Financial Statement Analysis', 'Pazartesi', '13:00', '15:50', 'B217', 'Prof.Dr. Yüksel Akay Ünvan', 'guz'),
('İşletme', '3', 'BF307', 'Corporate Finance', 'Pazartesi', '13:00', '15:50', 'B210', 'Doç.Dr. Merve Karacaer', 'guz'),
('İşletme', '1', 'BUS107', 'Introduction to Business', 'Pazartesi', '13:00', '15:50', 'B202', 'Doç.Dr. Semih Ceyhan', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '1', 'BUS107', 'Introduction to Business', 'Pazartesi', '13:00', '15:50', 'B202', 'Doç.Dr. Semih Ceyhan', 'guz'),
('İşletme', '4', 'BUS403', 'Innovation and Entrepreneurship', 'Pazartesi', '13:00', '15:50', 'B205', 'Prof.Dr. Özge Gökbulut Özdemir', 'guz'),
('Finans ve Bankacılık', '1', 'ITB101', 'Introduction to Economics I', 'Pazartesi', '13:00', '15:50', 'B201', 'Prof.Dr. Cem Korkut', 'guz'),
('Yönetim Bilişim Sistemleri', '1', 'ITB101', 'Introduction to Economics I', 'Pazartesi', '13:00', '15:50', 'B201', 'Prof.Dr. Cem Korkut', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '2', 'ITB207', 'International Business', 'Pazartesi', '13:00', '15:50', 'B211', 'Doç.Dr. Hakan Dulkadiroğlu', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '4', 'ITB437', 'Business Analysis and Valuation', 'Pazartesi', '13:00', '15:50', 'B209', 'Doç.Dr. Bilge Canbaloğlu', 'guz'),
('İşletme', '2', 'MIS213', 'E-Business', 'Pazartesi', '13:00', '15:50', 'B237', 'Dr.Öğr.Üyesi Musab Talha Akpınar', 'guz'),
('Finans ve Bankacılık', '2', 'MIS213', 'E-Business', 'Pazartesi', '13:00', '15:50', 'B237', 'Dr.Öğr.Üyesi Musab Talha Akpınar', 'guz'),
('Yönetim Bilişim Sistemleri', '2', 'MIS215', 'Computer Programming II', 'Pazartesi', '13:00', '15:50', 'BZ LAB', 'Prof.Dr. Ömür Akdemir', 'guz'),
('Finans ve Bankacılık', '3', 'BF309', 'Real Estate Finance', 'Salı', '09:00', '12:00', 'B209', 'Prof.Dr. Nildağ Başak Ceylan', 'guz'),
('İşletme', '1', 'BUS105', 'Accounting I', 'Salı', '09:00', '12:00', 'B201', 'Doç.Dr. Kürşad Çavuşoğlu', 'guz'),
('Finans ve Bankacılık', '1', 'BUS105', 'Accounting I', 'Salı', '09:00', '12:00', 'B201', 'Doç.Dr. Kürşad Çavuşoğlu', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '1', 'BUS109', 'Fundamentals of Law', 'Salı', '09:00', '12:00', 'B202', 'Arş.Gör.Dr. Hatice Cemre Akyılmaz', 'guz'),
('İşletme', '2', 'BUS203', 'Business Law', 'Salı', '09:00', '12:00', 'B217', 'Öğr.Gör.Dr. Bihter Kaytaz Eker', 'guz'),
('Finans ve Bankacılık', '2', 'BUS203', 'Business Law', 'Salı', '09:00', '12:00', 'B217', 'Öğr.Gör.Dr. Bihter Kaytaz Eker', 'guz'),
('İşletme', '4', 'BUS421', 'Project Management', 'Salı', '09:00', '12:00', 'B211', 'Dr.Öğr.Üyesi Sedat İlgaz Günay', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '3', 'ITB331', 'Integrated Marketing Communicaton in International Trade', 'Salı', '09:00', '12:00', 'B210', 'Doç.Dr. Ali Aycı', 'guz'),
('Yönetim Bilişim Sistemleri', '3', 'MIS321', 'Operations Management', 'Salı', '09:00', '12:00', 'B212', 'Doç.Dr. Vildan Ateş', 'guz'),
('Finans ve Bankacılık', '3', 'BF307', 'Corporate Finance', 'Salı', '13:00', '15:50', 'B237', 'Prof.Dr. Ayhan Kapusuzoğlu', 'guz'),
('Finans ve Bankacılık', '4', 'BF401', 'International Finance', 'Salı', '13:00', '15:50', 'B217', 'Prof.Dr. Nildağ Başak Ceylan', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '4', 'BF401', 'International Finance', 'Salı', '13:00', '15:50', 'B217', 'Prof.Dr. Nildağ Başak Ceylan', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '1', 'BUS105', 'Accounting I', 'Salı', '13:00', '15:50', 'B201', 'Doç.Dr. Kürşad Çavuşoğlu', 'guz'),
('Yönetim Bilişim Sistemleri', '1', 'BUS105', 'Accounting I', 'Salı', '13:00', '15:50', 'B201', 'Doç.Dr. Kürşad Çavuşoğlu', 'guz'),
('İşletme', '1', 'BUS109', 'Fundamentals of Law', 'Salı', '13:00', '15:50', 'B202', 'Arş.Gör.Dr. Hatice Cemre Akyılmaz', 'guz'),
('Finans ve Bankacılık', '1', 'BUS109', 'Fundamentals of Law', 'Salı', '13:00', '15:50', 'B202', 'Arş.Gör.Dr. Hatice Cemre Akyılmaz', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '2', 'BUS203', 'Business Law', 'Salı', '13:00', '15:50', 'B212', 'Öğr.Gör.Dr. Bihter Kaytaz Eker', 'guz'),
('İşletme', '3', 'BUS317', 'Teamwork and Group Dynamics', 'Salı', '13:00', '15:50', 'B211', 'Dr.Öğr.Üyesi Sedat İlgaz Günay', 'guz'),
('İşletme', '4', 'BUS431', 'Career Management', 'Salı', '13:00', '15:50', 'B205', 'Dr.Öğr.Üyesi İsmail Çağrı Doğan', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '3', 'ITB323', 'International Marketing Strategy', 'Salı', '13:00', '15:50', 'B210', 'Doç.Dr. Ali Aycı', 'guz'),
('Yönetim Bilişim Sistemleri', '3', 'MIS307', 'Information System Analysis and Design', 'Salı', '13:00', '15:50', 'B220', 'Doç.Dr. Vildan Ateş', 'guz'),
('İşletme', '1', 'TİT101', 'History of Turkish Revolution I', 'Salı', '17:00', '19:00', NULL, 'Dr.Öğr.Üyesi Hamit Karasu', 'guz'),
('Finans ve Bankacılık', '1', 'TİT101', 'History of Turkish Revolution I', 'Salı', '17:00', '19:00', NULL, 'Dr.Öğr.Üyesi Hamit Karasu', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '1', 'TİT101', 'History of Turkish Revolution I', 'Salı', '19:00', '21:00', NULL, 'Dr.Öğr.Üyesi Hamit Karasu', 'guz'),
('Yönetim Bilişim Sistemleri', '1', 'TİT101', 'History of Turkish Revolution I', 'Salı', '19:00', '21:00', NULL, 'Dr.Öğr.Üyesi Hamit Karasu', 'guz'),
('Finans ve Bankacılık', '3', 'BF303', 'Computing for Finance', 'Çarşamba', '09:00', '12:00', 'B210', 'Dr.Öğr.Üyesi Ali İhsan Çetin', 'guz'),
('Finans ve Bankacılık', '2', 'BUS201', 'Statistics for Business I', 'Çarşamba', '09:00', '12:00', 'B202', 'Doç.Dr. İklim Gedik Balay', 'guz'),
('Yönetim Bilişim Sistemleri', '2', 'BUS201', 'Statistics for Business I', 'Çarşamba', '09:00', '12:00', 'B202', 'Doç.Dr. İklim Gedik Balay', 'guz'),
('İşletme', '3', 'BUS331', 'Human Resource Planning and Development', 'Çarşamba', '09:00', '12:00', 'B217', 'Dr.Öğr.Üyesi Safa Arslan', 'guz'),
('İşletme', '4', 'BUS435', 'Consumer Behavior', 'Çarşamba', '09:00', '12:00', 'B212', 'Dr.Öğr.Üyesi Mustafa Ünsalan', 'guz'),
('İşletme', '1', 'ENG153', 'Translation I', 'Çarşamba', '09:00', '12:00', 'B207', 'Öğr.Gör.Dr. Yasemen Özfındık Kotik', 'guz'),
('Finans ve Bankacılık', '1', 'ENG153', 'Translation I', 'Çarşamba', '09:00', '12:00', 'B207', 'Öğr.Gör.Dr. Yasemen Özfındık Kotik', 'guz'),
('Yönetim Bilişim Sistemleri', '3', 'MIS305', 'Operating Systems', 'Çarşamba', '09:00', '12:00', 'B211', 'Dr.Öğr.Üyesi Mazlum Özçağdavul', 'guz'),
('Finans ve Bankacılık', '3', 'BF301', 'Econometrics I', 'Çarşamba', '13:00', '15:50', 'B237', 'Doç.Dr. İklim Gedik Balay', 'guz'),
('İşletme', '2', 'BUS201', 'Statistics for Business I', 'Çarşamba', '13:00', '15:50', 'B202', 'Dr.Öğr.Üyesi Ali İhsan Çetin', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '2', 'BUS201', 'Statistics for Business I', 'Çarşamba', '13:00', '15:50', 'B202', 'Dr.Öğr.Üyesi Ali İhsan Çetin', 'guz'),
('İşletme', '3', 'BUS329', 'Marketing Management and Strategy', 'Çarşamba', '13:00', '15:50', 'B212', 'Dr.Öğr.Üyesi Mustafa Ünsalan', 'guz'),
('İşletme', '4', 'BUS423', 'Business in SMEs', 'Çarşamba', '13:00', '15:50', 'B211', 'Dr.Öğr.Üyesi Safa Arslan', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '1', 'ENG153', 'Translation I', 'Çarşamba', '13:00', '15:50', 'B207', 'Öğr.Gör.Dr. Yasemen Özfındık Kotik', 'guz'),
('Yönetim Bilişim Sistemleri', '1', 'ENG153', 'Translation I', 'Çarşamba', '13:00', '15:50', 'B207', 'Öğr.Gör.Dr. Yasemen Özfındık Kotik', 'guz'),
('Yönetim Bilişim Sistemleri', '4', 'MIS488', 'Digital Forensics', 'Çarşamba', '13:00', '15:50', 'B209', 'Dr.Öğr.Üyesi Mazlum Özçağdavul', 'guz'),
('İşletme', '1', 'TDL101', 'Turkish Language I', 'Çarşamba', '17:00', '19:00', NULL, 'Dr.Öğr.Üyesi Ceren Selvi', 'guz'),
('Finans ve Bankacılık', '1', 'TDL101', 'Turkish Language I', 'Çarşamba', '17:00', '19:00', NULL, 'Dr.Öğr.Üyesi Ceren Selvi', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '1', 'TDL101', 'Turkish Language I', 'Çarşamba', '19:00', '21:00', NULL, 'Dr.Öğr.Üyesi Ceren Selvi', 'guz'),
('Yönetim Bilişim Sistemleri', '1', 'TDL101', 'Turkish Language I', 'Çarşamba', '19:00', '21:00', NULL, 'Dr.Öğr.Üyesi Ceren Selvi', 'guz'),
('Finans ve Bankacılık', '4', 'BF409', 'Credit Analysis and Allocation', 'Perşembe', '09:00', '12:00', 'B209', 'Dr.Öğr.Üyesi Ali İhsan Çetin', 'guz'),
('İşletme', '4', 'BUS409', 'Data Science for Business', 'Perşembe', '09:00', '12:00', 'B220', 'Prof.Dr. Rafet Aktaş', 'guz'),
('Finans ve Bankacılık', '2', 'ENG201', 'Academic English III', 'Perşembe', '09:00', '12:00', 'B217', 'Öğr.Gör.Dr. Yasemen Özfındık Kotik', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '2', 'ENG201', 'Academic English III', 'Perşembe', '09:00', '12:00', 'B217', 'Öğr.Gör.Dr. Yasemen Özfındık Kotik', 'guz'),
('İşletme', '1', 'ENG101', 'Academic English I', 'Perşembe', '09:00', '12:00', 'B237', 'Öğr.Gör.Dr. Sibel Eylenen Özcan', 'guz'),
('Yönetim Bilişim Sistemleri', '1', 'ENG101', 'Academic English I', 'Perşembe', '09:00', '12:00', 'B237', 'Öğr.Gör.Dr. Sibel Eylenen Özcan', 'guz'),
('İşletme', '2', 'BUS211', 'History of Science and Technology', 'Perşembe', '09:00', '12:00', 'B202', 'Dr.Öğr.Üyesi Murat Ulubay', 'guz'),
('Yönetim Bilişim Sistemleri', '2', 'BUS211', 'History of Science and Technology', 'Perşembe', '09:00', '12:00', 'B202', 'Dr.Öğr.Üyesi Murat Ulubay', 'guz'),
('İşletme', '4', 'BUS437', 'Negotiation and Conflict Management', 'Perşembe', '09:00', '12:00', 'B210', 'Öğr.Gör.Dr. İlay Hicret Öztürk Kayalak', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '3', 'ITB313', 'Global Entrepreneurship and Trade', 'Perşembe', '09:00', '12:00', 'B212', 'Doç.Dr. Haroon Muzaffar', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '4', 'ITB407', 'International Organizations', 'Perşembe', '09:00', '12:00', 'B207', 'Dr.Öğr.Üyesi Melek Mutioğlu Özkesen', 'guz'),
('Yönetim Bilişim Sistemleri', '4', 'MIS402', 'Business Intelligence and Data Mining', 'Perşembe', '09:00', '12:00', 'B211', 'Doç.Dr. Keziban Seçkin Codal', 'guz'),
('Finans ve Bankacılık', '4', 'BF415', 'Managerial Economics', 'Perşembe', '13:00', '15:50', 'B210', 'Prof.Dr. Cem Korkut', 'guz'),
('İşletme', '2', 'ENG201', 'Academic English III', 'Perşembe', '13:00', '15:50', 'B237', 'Öğr.Gör.Dr. Sibel Eylenen Özcan', 'guz'),
('Yönetim Bilişim Sistemleri', '2', 'ENG201', 'Academic English III', 'Perşembe', '13:00', '15:50', 'B237', 'Öğr.Gör.Dr. Sibel Eylenen Özcan', 'guz'),
('Finans ve Bankacılık', '1', 'ENG101', 'Academic English I', 'Perşembe', '13:00', '15:50', 'B217', 'Öğr.Gör.Dr. Yasemen Özfındık Kotik', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '1', 'ENG101', 'Academic English I', 'Perşembe', '13:00', '15:50', 'B217', 'Öğr.Gör.Dr. Yasemen Özfındık Kotik', 'guz'),
('Finans ve Bankacılık', '2', 'BUS211', 'History of Science and Technology', 'Perşembe', '13:00', '15:50', 'B202', 'Dr.Öğr.Üyesi Murat Ulubay', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '2', 'BUS211', 'History of Science and Technology', 'Perşembe', '13:00', '15:50', 'B202', 'Dr.Öğr.Üyesi Murat Ulubay', 'guz'),
('İşletme', '3', 'BUS315', 'Business Communication', 'Perşembe', '13:00', '15:50', 'B211', 'Öğr.Gör.Dr. İlay Hicret Öztürk Kayalak', 'guz'),
('İşletme', '4', 'BUS429', 'Sustainable Value Chain Management', 'Perşembe', '13:00', '15:50', 'B209', 'Doç.Dr. Haroon Muzaffar', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '3', 'ITB325', 'Contemporary Debates in International Trade', 'Perşembe', '13:00', '15:50', 'B212', 'Dr.Öğr.Üyesi Melek Mutioğlu Özkesen', 'guz'),
('Yönetim Bilişim Sistemleri', '3', 'MIS310', 'Probability', 'Perşembe', '13:00', '15:50', 'B220', 'Doç.Dr. Keziban Seçkin Codal', 'guz'),
('İşletme', '1', 'BUS103', 'Calculus for Business I', 'Cuma', '09:00', '12:00', 'B201', 'Doç.Dr. İklim Gedik Balay', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '1', 'BUS103', 'Calculus for Business I', 'Cuma', '09:00', '12:00', 'B201', 'Doç.Dr. İklim Gedik Balay', 'guz'),
('Yönetim Bilişim Sistemleri', '1', 'MIS105', 'Introduction to Algorithms and Programming', 'Cuma', '09:00', '12:00', 'B205', 'Prof.Dr. Hüseyin Demirel', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '4', 'ITB413', 'Applied Data Analysis I', 'Cuma', '09:00', '12:00', 'BZ LAB', 'Doç.Dr. Seda Ekmen Özçelik', 'guz'),
('Yönetim Bilişim Sistemleri', '4', 'MIS425', 'Technology and Society', 'Cuma', '09:00', '12:00', 'B211', 'Prof.Dr. Derya Fındık Yılmaz', 'guz'),
('İşletme', '3', 'BUS301', 'Strategic Management', 'Cuma', '13:00', '15:50', 'B217', 'Prof.Dr. Hasan Engin Şener', 'guz'),
('İşletme', '4', 'BUS401', 'Business Ethics and Corporate Social Responsibility', 'Cuma', '13:00', '15:50', 'B212', 'Prof.Dr. Kerim Özcan', 'guz'),
('Finans ve Bankacılık', '1', 'BUS103', 'Calculus for Business I', 'Cuma', '13:00', '15:50', 'B201', 'Doç.Dr. İklim Gedik Balay', 'guz'),
('Yönetim Bilişim Sistemleri', '1', 'BUS103', 'Calculus for Business I', 'Cuma', '13:00', '15:50', 'B201', 'Doç.Dr. İklim Gedik Balay', 'guz'),
('Yönetim Bilişim Sistemleri', '2', 'MIS217', 'Fundamentals of Information Technologies', 'Cuma', '13:00', '15:50', 'B210', 'Prof.Dr. Hüseyin Demirel', 'guz'),
('Uluslararası Ticaret ve İşletmecilik', '3', 'ITB311', 'International Economics I', 'Cuma', '13:00', '15:50', 'B211', 'Doç.Dr. Seda Ekmen Özçelik', 'guz'),
('Yönetim Bilişim Sistemleri', '4', 'MIS406', 'Introduction to Social Network Analysis', 'Cuma', '13:00', '15:50', 'BZ LAB', 'Prof.Dr. Derya Fındık Yılmaz', 'guz')
;

commit;
