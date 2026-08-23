// CampusO Vol 1-4: Akademik Teşvik Hesaplama Robotu
// Bu dosya, YÖK Akademik Teşvik Ödeneği Yönetmeliği'nin BASİTLEŞTİRİLMİŞ bir
// modelini içerir. Puanlar gerçek yönetmelikteki tam tabloyu birebir yansıtmaz;
// akademisyene yaklaşık bir öngörü vermek için tasarlanmıştır. Resmî başvuru
// için üniversitenin ilan ettiği güncel puan cetveli esas alınmalıdır.

export const TESVIK_CATEGORIES = [
  { key: "makale_sci", label: "SCI-E / SSCI / AHCI Makale", unit: "adet", point: 60 },
  { key: "makale_diger", label: "Diğer İndeksli Makale", unit: "adet", point: 40 },
  { key: "bildiri_uluslararasi", label: "Uluslararası Bildiri", unit: "adet", point: 20 },
  { key: "bildiri_ulusal", label: "Ulusal Bildiri", unit: "adet", point: 10 },
  { key: "kitap", label: "Kitap (Yazarlık)", unit: "adet", point: 90 },
  { key: "kitap_bolumu", label: "Kitap Bölümü", unit: "adet", point: 30 },
  { key: "atif", label: "Atıf (SCI-E / SSCI / AHCI)", unit: "adet", point: 3 },
  { key: "proje_uluslararasi", label: "Uluslararası / TÜBİTAK Proje", unit: "adet", point: 80 },
  { key: "proje_ulusal", label: "Ulusal / BAP Proje", unit: "adet", point: 40 },
  { key: "patent", label: "Patent / Faydalı Model", unit: "adet", point: 100 },
  { key: "sanat_tasarim", label: "Sanal / Sanat / Tasarım Eseri", unit: "adet", point: 50 },
  { key: "odul", label: "Bilimsel Ödül", unit: "adet", point: 60 },
  { key: "editorluk", label: "Editörlük / Hakemlik", unit: "adet", point: 15 },
];

// Basitleştirilmiş uygunluk eşiği: gerçek yönetmelikteki asgari puan ve alan
// çeşitliliği kuralları farklıdır; burada yaklaşık bir gösterge sunulur.
export const TESVIK_MIN_TOTAL = 100;
export const TESVIK_MIN_CATEGORY_COUNT = 2;

export function emptyTesvikCounts() {
  return Object.fromEntries(TESVIK_CATEGORIES.map((category) => [category.key, 0]));
}

export function calculateTesvik(counts) {
  const rows = TESVIK_CATEGORIES.map((category) => {
    const count = Math.max(0, Number(counts?.[category.key]) || 0);
    return { ...category, count, subtotal: count * category.point };
  });
  const totalPoints = rows.reduce((sum, row) => sum + row.subtotal, 0);
  const categoryCount = rows.filter((row) => row.count > 0).length;
  const eligible = totalPoints >= TESVIK_MIN_TOTAL && categoryCount >= TESVIK_MIN_CATEGORY_COUNT;
  return { rows, totalPoints, categoryCount, eligible };
}
