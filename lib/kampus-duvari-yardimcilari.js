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
