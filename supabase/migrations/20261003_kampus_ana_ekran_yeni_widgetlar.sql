-- Ana Ekran Yönetimi widget galerisine 4 yeni, gerçek veriden beslenen
-- widget ekleniyor (kullanıcı isteği: "widget ne koyabiliriz" — Bugünün
-- Dersleri, Yaklaşan Sınav, Yemek Menüsü (Bugün), Kampüs Duvarı Önizleme).
-- Bunlar mevcut 3 widget'ın (bitki/takvim/hizli) aksine ders_kayitlari +
-- ders_programi + sinav_takvimi + yemek_menusu + gonderiler tablolarını
-- OKUYOR, kendi tablosunu gerektirmiyor — burada sadece
-- kampus_ana_ekran_tercihleri.widget_id CHECK constraint'i genişletiliyor.
--
-- Var olan kullanıcıların ana sayfası bu migration'la DEĞİŞMEZ: yeni
-- widget'lar varsayılan olarak GİZLİ kabul edilir (app tarafında,
-- kullanıcının hiç kaydı olmayan id'ler "gizli" listesine düşüyor) — widget
-- galerisinde ("+ Widget Ekle") görünür, isteyen ekler.
alter table public.kampus_ana_ekran_tercihleri
  drop constraint if exists kampus_ana_ekran_tercihleri_widget_id_check;

alter table public.kampus_ana_ekran_tercihleri
  add constraint kampus_ana_ekran_tercihleri_widget_id_check
  check (widget_id in ('bitki', 'takvim', 'hizli', 'gunun_dersleri', 'yaklasan_sinav', 'yemek_bugun', 'duvar_onizleme'));
