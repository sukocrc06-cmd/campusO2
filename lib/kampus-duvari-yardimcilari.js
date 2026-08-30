// CampusO Vol 1-11 devamı: Kampüs Duvarı için paylaşılan yardımcılar.

// Türkçe karakterleri de kapsayan basit hashtag ayıklayıcı (#kulup, #bilgisayarmuh gibi).
const HASHTAG_REGEX = /#[\p{L}\p{N}_]+/gu;

export function hashtagleriAyikla(metin) {
  if (!metin) return [];
  const bulunanlar = metin.match(HASHTAG_REGEX) || [];
  return Array.from(new Set(bulunanlar.map((h) => h.toLowerCase())));
}

export const SUSTURMA_SURELERI = [
  { label: "1 gün", saat: 24 },
  { label: "3 gün", saat: 72 },
  { label: "7 gün", saat: 168 },
  { label: "30 gün", saat: 720 },
];

export function susturmaBitisTarihi(saat) {
  return new Date(Date.now() + saat * 60 * 60 * 1000).toISOString();
}

// Çoklu emoji reaksiyonu seçenekleri (Vol 1-11 devamı 2).
export const REAKSIYONLAR = [
  { tip: "begeni", emoji: "❤️", label: "Beğendim" },
  { tip: "alkis", emoji: "👏", label: "Alkış" },
  { tip: "kahkaha", emoji: "😂", label: "Komik" },
  { tip: "sasirma", emoji: "😮", label: "Şaşırdım" },
  { tip: "uzucu", emoji: "😢", label: "Üzücü" },
];

export function reaksiyonEmoji(tip) {
  return REAKSIYONLAR.find((r) => r.tip === tip)?.emoji || "❤️";
}

// "@Ad Soyad" biçimindeki etiketleri metinden ayıklayıp tıklanabilir hale
// getirmek için kullanılan basit parçalayıcı. `bilinenIsimler`, mention
// autocomplete sırasında seçilmiş isimlerin kümesidir (Set<string>).
export function metniParcala(metin, bilinenIsimler) {
  if (!metin) return [];
  if (!bilinenIsimler || bilinenIsimler.size === 0) return [{ tip: "metin", icerik: metin }];
  const parcalar = [];
  const isimler = Array.from(bilinenIsimler).sort((a, b) => b.length - a.length);
  const regex = new RegExp("@(" + isimler.map((i) => i.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "g");
  let sonIndex = 0;
  let eslesme;
  while ((eslesme = regex.exec(metin))) {
    if (eslesme.index > sonIndex) parcalar.push({ tip: "metin", icerik: metin.slice(sonIndex, eslesme.index) });
    parcalar.push({ tip: "etiket", icerik: "@" + eslesme[1] });
    sonIndex = eslesme.index + eslesme[0].length;
  }
  if (sonIndex < metin.length) parcalar.push({ tip: "metin", icerik: metin.slice(sonIndex) });
  return parcalar.length ? parcalar : [{ tip: "metin", icerik: metin }];
}
