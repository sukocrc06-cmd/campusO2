-- CampusO Vol 1-11 devamı 6: Yasaklı kelime listesini genişletme
-- Otomatik metin filtresine daha fazla Türkçe küfür/argo kalıbı ve
-- İngilizce küfür/argo kelimeleri ekleniyor. Liste admin panelinden
-- (Kampüs Duvarı > Yasaklı Kelimeler, artık şifreyle korunuyor) her
-- zaman büyütülüp küçültülebilir; buradakiler yalnızca ek bir başlangıç
-- seti.

begin;

insert into public.kampus_duvari_yasakli_kelimeler (kelime) values
  -- ek Türkçe küfür/argo
  ('sikik'), ('sikko'), ('sikeceğim'), ('sikerler'), ('yarrağı'),
  ('götveren'), ('götlek'), ('ibnelik'), ('kevaşe'), ('fahişe'),
  ('orospu çocuğu'), ('namussuz'), ('it oğlu it'), ('şerefsizlik'),
  ('yavşaklık'), ('sürtüklük'), ('kancıklık'), ('piçlik'), ('ipnelik'),
  ('amına koyayım'), ('amına koyim'), ('ananı sikerim'), ('babanı sikeyim'),
  ('anasını sikeyim'), ('avradını'), ('avradını sikeyim'), ('göt oğlanı'),
  -- İngilizce küfür/argo
  ('fuck'), ('fucking'), ('fucker'), ('motherfucker'), ('shit'),
  ('bullshit'), ('bitch'), ('asshole'), ('bastard'), ('slut'), ('whore'),
  ('cunt'), ('dick'), ('pussy'), ('faggot'), ('retard'), ('cock'), ('twat'),
  ('nigger'), ('nigga')
on conflict (kelime) do nothing;

commit;
