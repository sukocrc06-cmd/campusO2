// CampusO Vol 1-8 devamı: Kişisel Takvim yardımcıları.
// Türe göre renk paleti ve ay ızgarası (Pazartesi başlangıçlı) üretimi.

export const TAKVIM_TURLERI = {
  ders: { label: "Ders", color: "#175cd3", bg: "#e6f0ff" },
  sinav: { label: "Sınav", color: "#c0273c", bg: "#ffe9ec" },
  proje: { label: "Proje", color: "#7c3aed", bg: "#f1e9ff" },
  sunum: { label: "Sunum", color: "#0b8f5c", bg: "#e3faf0" },
  diger: { label: "Diğer", color: "#c65d1f", bg: "#fff2e6" },
};

export const AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
export const GUN_KISALTMALARI = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function pad2(n) { return n < 10 ? `0${n}` : `${n}`; }

export function tarihIso(yil, ay, gun) {
  return `${yil}-${pad2(ay + 1)}-${pad2(gun)}`;
}

export function bugunIso() {
  const d = new Date();
  return tarihIso(d.getFullYear(), d.getMonth(), d.getDate());
}

// Verilen yıl/ay (0-indeksli ay) için Pazartesi başlangıçlı hafta hafta ızgara üretir.
export function ayIzgarasiUret(yil, ay) {
  const ilkGun = new Date(yil, ay, 1);
  const sonGun = new Date(yil, ay + 1, 0);
  const ilkGunHaftaIndeksi = (ilkGun.getDay() + 6) % 7; // Pazartesi = 0
  const toplamGun = sonGun.getDate();

  const hucreler = [];
  for (let i = 0; i < ilkGunHaftaIndeksi; i++) hucreler.push(null);
  for (let gun = 1; gun <= toplamGun; gun++) hucreler.push(gun);
  while (hucreler.length % 7 !== 0) hucreler.push(null);

  const haftalar = [];
  for (let i = 0; i < hucreler.length; i += 7) haftalar.push(hucreler.slice(i, i + 7));
  return haftalar;
}
