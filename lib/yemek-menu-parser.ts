// CampusO Vol 1-7: Yemek Menüsü Entegrasyonu
// AYBÜ SKS sayfasının HTML kaynağını satır satır metne çevirip haftalık
// menüyü (gün, yemek adı, kalori) ayıklayan bağımsız (dış kütüphanesiz) ayrıştırıcı.
// Not: AYBÜ'nün resmi bir API'si yok; bu ayrıştırıcı sayfanın bugünkü HTML
// yapısına göre yazıldı. Site tasarımı değişirse burada güncelleme gerekebilir —
// bu yüzden her çalıştırma sonucu yemek_menu_sync_loglari tablosuna kaydedilir.

export type YemekOgesi = {
  kategori: string | null;
  ad: string;
  kalori: number | null;
};

export type GunMenusu = {
  gun_adi: string;
  tarih: string; // YYYY-MM-DD
  yemekler: YemekOgesi[];
};

const GUNLER = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

const KATEGORI_BASLIKLARI = [
  "Çorba",
  "Ana Yemek",
  "Ara Sıcak",
  "Yardımcı Yemek",
  "Tatlı",
  "Meyve",
  "Salata",
  "Ekmek",
  "Pilav",
  "Makarna",
];

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  nbsp: " ",
  "#39": "'",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&(\w+);/g, (match, name) => ENTITY_MAP[name] ?? match);
}

function htmlToLines(html: string): string[] {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const withBreaks = withoutNoise.replace(
    /<\/(li|p|div|tr|h[1-6]|section|article|td)>|<br\s*\/?>/gi,
    "\n",
  );
  const textOnly = withBreaks.replace(/<[^>]+>/g, "\n");
  const decoded = decodeEntities(textOnly);
  return decoded
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function findGunIndex(line: string): number {
  const upperLine = line.toLocaleUpperCase("tr-TR");
  for (let i = 0; i < GUNLER.length; i++) {
    const gun = GUNLER[i];
    const upperGun = gun.toLocaleUpperCase("tr-TR");
    if (upperLine === upperGun || upperLine.startsWith(upperGun + " ") || upperLine.startsWith(upperGun + ":")) {
      return i;
    }
  }
  return -1;
}

function isKategoriBasligi(line: string): string | null {
  const norm = line.toLocaleUpperCase("tr-TR").replace(/[:.]+$/, "").trim();
  for (const kategori of KATEGORI_BASLIKLARI) {
    if (norm === kategori.toLocaleUpperCase("tr-TR")) return kategori;
  }
  return null;
}

function extractYemekFromLine(line: string): YemekOgesi | null {
  const match = /^(.{2,80}?)\s*[-–(]?\s*(\d{2,4})\s*kcal\)?\.?$/i.exec(line);
  if (!match) return null;
  const ad = match[1].replace(/[-–,;.]+$/, "").trim();
  const kalori = parseInt(match[2], 10);
  if (!ad || ad.length < 2) return null;
  return { kategori: null, ad, kalori: Number.isFinite(kalori) ? kalori : null };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toIsoDate(gun: number, ay: number, yil: number): string {
  return `${yil}-${pad2(ay)}-${pad2(gun)}`;
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/**
 * AYBÜ SKS sayfasının HTML kaynağından haftalık yemek menüsünü ayıklar.
 * `referenceIso` (YYYY-MM-DD), birden çok hafta listelenmişse en yakın
 * (bugüne en yakın) haftayı seçmek için kullanılır.
 */
export function parseAybuMenu(html: string, referenceIso: string): GunMenusu[] {
  const lines = htmlToLines(html);

  const dateRangePattern = /(\d{2})\.(\d{2})\.(\d{4})\s*-\s*(\d{2})\.(\d{2})\.(\d{4})/;
  const haftaBaslangiclari: { lineIndex: number; iso: string }[] = [];
  lines.forEach((line, idx) => {
    const m = dateRangePattern.exec(line);
    if (m) {
      const iso = toIsoDate(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
      haftaBaslangiclari.push({ lineIndex: idx, iso });
    }
  });

  let secilenHafta = haftaBaslangiclari[0];
  if (haftaBaslangiclari.length > 1) {
    let enYakinFark = Infinity;
    for (const hafta of haftaBaslangiclari) {
      const fark = Math.abs(new Date(hafta.iso).getTime() - new Date(referenceIso).getTime());
      if (fark < enYakinFark) {
        enYakinFark = fark;
        secilenHafta = hafta;
      }
    }
  }

  const aramaBaslangici = secilenHafta ? secilenHafta.lineIndex : 0;
  const aramaBitisi = (() => {
    if (!secilenHafta) return lines.length;
    const sonrakiHafta = haftaBaslangiclari.find((h) => h.lineIndex > secilenHafta.lineIndex);
    return sonrakiHafta ? sonrakiHafta.lineIndex : lines.length;
  })();

  const bolum = lines.slice(aramaBaslangici, aramaBitisi);

  const gunler: GunMenusu[] = [];
  let mevcutGun: GunMenusu | null = null;
  let mevcutKategori: string | null = null;

  for (const line of bolum) {
    const gunIndex = findGunIndex(line);
    if (gunIndex !== -1 && gunIndex < 5) {
      if (mevcutGun && mevcutGun.yemekler.length > 0) gunler.push(mevcutGun);
      const tarih = secilenHafta ? addDays(secilenHafta.iso, gunIndex) : referenceIso;
      mevcutGun = { gun_adi: GUNLER[gunIndex], tarih, yemekler: [] };
      mevcutKategori = null;
      continue;
    }
    if (!mevcutGun) continue;

    const kategori = isKategoriBasligi(line);
    if (kategori) {
      mevcutKategori = kategori;
      continue;
    }

    const yemek = extractYemekFromLine(line);
    if (yemek) {
      yemek.kategori = mevcutKategori;
      mevcutGun.yemekler.push(yemek);
    }
  }
  if (mevcutGun && mevcutGun.yemekler.length > 0) gunler.push(mevcutGun);

  return gunler;
}
