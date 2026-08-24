// CampusO Vol 1-10: Özelleştirilmiş Profil
// Hero (kapak) alanı için hazır renk paleti — kullanıcı bunlardan birini seçer.

export const HERO_PALETI = {
  mavi: { label: "Mavi", gradient: "linear-gradient(135deg, #0e4bae, #175cd3)" },
  lacivert: { label: "Lacivert", gradient: "linear-gradient(135deg, #0b2545, #13315c)" },
  yesil: { label: "Yeşil", gradient: "linear-gradient(135deg, #0b5c42, #22b879)" },
  turuncu: { label: "Turuncu", gradient: "linear-gradient(135deg, #c65d1f, #ffb13b)" },
  mor: { label: "Mor", gradient: "linear-gradient(135deg, #4c1d95, #8b5cf6)" },
  gri: { label: "Gri", gradient: "linear-gradient(135deg, #334155, #64748b)" },
};

export const HERO_ANAHTARLARI = Object.keys(HERO_PALETI);

export function heroGradient(key) {
  return HERO_PALETI[key]?.gradient || HERO_PALETI.mavi.gradient;
}

export const SINIF_SECENEKLERI = ["Hazırlık", "1", "2", "3", "4", "Yüksek Lisans", "Doktora"];

export const ROL_ETIKET = {
  student: "Öğrenci",
  academician: "Akademisyen",
  admin: "Yönetici",
};
