// CampusO Vol 1-6: Öğrenci Kulüpleri İşlemleri
// Kulüp kategorileri ve üyelik durum sözlüğü.

export const KULUP_KATEGORILERI = [
  "Teknoloji",
  "Girişimcilik",
  "Sanat",
  "Spor",
  "Kültür",
  "Bilim",
  "Sosyal Sorumluluk",
  "Diğer",
];

export const KULUP_UYELIK_DURUM = {
  beklemede: { label: "Beklemede", color: "#ffb13b", bg: "#fff8eb" },
  aktif: { label: "Aktif Üye", color: "#22b879", bg: "#effbf6" },
  reddedildi: { label: "Reddedildi", color: "#ef5c63", bg: "#fff4f0" },
  ayrildi: { label: "Ayrıldı", color: "#5b6b85", bg: "#f5f8fc" },
};
