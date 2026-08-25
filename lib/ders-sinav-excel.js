// CampusO Vol 1-8: Sınav ve Ders Takvimi Entegrasyonu
// Excel şablon üretimi + yüklenen dosyanın satır satır ayrıştırılıp
// doğrulanması. Tamamen tarayıcı tarafında çalışır (SheetJS/xlsx).

import * as XLSX from "xlsx";

export const GUNLER = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
export const SINAV_TURLERI = ["Vize", "Final", "Bütünleme"];

export const DERS_PROGRAMI_KOLONLARI = [
  "Bölüm",
  "Sınıf",
  "Ders Kodu",
  "Ders Adı",
  "Gün",
  "Başlangıç Saati",
  "Bitiş Saati",
  "Derslik",
  "Öğretim Üyesi",
];

export const SINAV_TAKVIMI_KOLONLARI = [
  "Bölüm",
  "Sınıf",
  "Ders Kodu",
  "Ders Adı",
  "Sınav Türü",
  "Tarih",
  "Saat",
  "Derslik",
  "Öğretim Üyesi",
];

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function normalizeSaat(value) {
  if (value instanceof Date) {
    return `${pad2(value.getHours())}:${pad2(value.getMinutes())}`;
  }
  const str = String(value ?? "").trim();
  const match = /^([0-2]?\d)[:.]([0-5]\d)/.exec(str);
  if (!match) return null;
  const saat = parseInt(match[1], 10);
  if (saat > 23) return null;
  return `${pad2(saat)}:${match[2]}`;
}

function normalizeTarih(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  const str = String(value ?? "").trim();
  let m = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/.exec(str);
  if (m) return `${m[3]}-${pad2(parseInt(m[1], 10))}-${pad2(parseInt(m[2], 10))}`;
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str);
  if (m) return `${m[1]}-${pad2(parseInt(m[2], 10))}-${pad2(parseInt(m[3], 10))}`;
  return null;
}

function normalizeGun(value) {
  const str = String(value ?? "").trim();
  const found = GUNLER.find((g) => g.toLocaleLowerCase("tr-TR") === str.toLocaleLowerCase("tr-TR"));
  return found || null;
}

function normalizeSinavTuru(value) {
  const str = String(value ?? "").trim().toLocaleLowerCase("tr-TR");
  if (str.startsWith("vize") || str.startsWith("ara")) return "Vize";
  if (str.startsWith("büt") || str.startsWith("but")) return "Bütünleme";
  if (str.startsWith("fin") || str.startsWith("dönem sonu") || str.startsWith("donem sonu")) return "Final";
  return null;
}

function readWorkbookRows(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Dosya okunamadı."));
    reader.readAsArrayBuffer(file);
  });
}

export async function parseDersProgramiFile(file) {
  const rows = await readWorkbookRows(file);
  const gecerli = [];
  const hatalar = [];

  rows.forEach((row, idx) => {
    const satirNo = idx + 2; // başlık satırı 1
    const bolum = String(row["Bölüm"] ?? "").trim();
    const sinif = String(row["Sınıf"] ?? "").trim();
    const dersAdi = String(row["Ders Adı"] ?? "").trim();
    const gun = normalizeGun(row["Gün"]);
    const baslangic = normalizeSaat(row["Başlangıç Saati"]);
    const bitis = normalizeSaat(row["Bitiş Saati"]);

    if (!bolum && !sinif && !dersAdi) return; // tamamen boş satır, sessizce atla

    const eksikler = [];
    if (!bolum) eksikler.push("Bölüm");
    if (!sinif) eksikler.push("Sınıf");
    if (!dersAdi) eksikler.push("Ders Adı");
    if (!gun) eksikler.push("Gün (Pazartesi–Cuma olmalı)");
    // Saat artık zorunlu değil: dönemden döneme değiştiği için boş bırakılabilir.
    if ((row["Başlangıç Saati"] || row["Bitiş Saati"]) && (!baslangic || !bitis)) {
      eksikler.push("Başlangıç/Bitiş Saati (SS:DD biçiminde olmalı veya ikisi de boş bırakılmalı)");
    }

    if (eksikler.length) {
      hatalar.push({ satir: satirNo, mesaj: `Eksik/hatalı: ${eksikler.join(", ")}` });
      return;
    }

    gecerli.push({
      bolum,
      sinif,
      ders_kodu: String(row["Ders Kodu"] ?? "").trim() || null,
      ders_adi: dersAdi,
      gun,
      baslangic_saat: baslangic,
      bitis_saat: bitis,
      derslik: String(row["Derslik"] ?? "").trim() || null,
      hoca_adi: String(row["Öğretim Üyesi"] ?? "").trim() || null,
    });
  });

  return { gecerli, hatalar, toplamSatir: rows.length };
}

export async function parseSinavTakvimiFile(file) {
  const rows = await readWorkbookRows(file);
  const gecerli = [];
  const hatalar = [];

  rows.forEach((row, idx) => {
    const satirNo = idx + 2;
    const bolum = String(row["Bölüm"] ?? "").trim();
    const sinif = String(row["Sınıf"] ?? "").trim();
    const dersAdi = String(row["Ders Adı"] ?? "").trim();
    const sinavTuru = normalizeSinavTuru(row["Sınav Türü"]);
    const tarih = normalizeTarih(row["Tarih"]);
    const saat = normalizeSaat(row["Saat"]);

    if (!bolum && !sinif && !dersAdi) return;

    const eksikler = [];
    if (!bolum) eksikler.push("Bölüm");
    if (!sinif) eksikler.push("Sınıf");
    if (!dersAdi) eksikler.push("Ders Adı");
    if (!sinavTuru) eksikler.push("Sınav Türü (Vize/Final/Bütünleme olmalı)");
    if (!tarih) eksikler.push("Tarih (GG.AA.YYYY)");
    if (!saat) eksikler.push("Saat (SS:DD)");

    if (eksikler.length) {
      hatalar.push({ satir: satirNo, mesaj: `Eksik/hatalı: ${eksikler.join(", ")}` });
      return;
    }

    gecerli.push({
      bolum,
      sinif,
      ders_kodu: String(row["Ders Kodu"] ?? "").trim() || null,
      ders_adi: dersAdi,
      sinav_turu: sinavTuru,
      tarih,
      saat,
      derslik: String(row["Derslik"] ?? "").trim() || null,
      hoca_adi: String(row["Öğretim Üyesi"] ?? "").trim() || null,
    });
  });

  return { gecerli, hatalar, toplamSatir: rows.length };
}

export function indirDersProgramiSablonu() {
  const ornek = {
    "Bölüm": "Bilgisayar Mühendisliği",
    "Sınıf": "2",
    "Ders Kodu": "BIL201",
    "Ders Adı": "Veri Yapıları",
    "Gün": "Pazartesi",
    "Başlangıç Saati": "09:00",
    "Bitiş Saati": "10:50",
    "Derslik": "A-204",
    "Öğretim Üyesi": "Dr. Öğr. Üyesi Örnek Hoca",
  };
  const ws = XLSX.utils.json_to_sheet([ornek], { header: DERS_PROGRAMI_KOLONLARI });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ders Programı");
  XLSX.writeFile(wb, "campuso-ders-programi-sablonu.xlsx");
}

export function indirSinavTakvimiSablonu() {
  const ornek = {
    "Bölüm": "Bilgisayar Mühendisliği",
    "Sınıf": "2",
    "Ders Kodu": "BIL201",
    "Ders Adı": "Veri Yapıları",
    "Sınav Türü": "Vize",
    "Tarih": "17.11.2026",
    "Saat": "10:00",
    "Derslik": "A-204",
    "Öğretim Üyesi": "Dr. Öğr. Üyesi Örnek Hoca",
  };
  const ws = XLSX.utils.json_to_sheet([ornek], { header: SINAV_TAKVIMI_KOLONLARI });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sınav Takvimi");
  XLSX.writeFile(wb, "campuso-sinav-takvimi-sablonu.xlsx");
}
