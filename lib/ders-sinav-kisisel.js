// CampusO Vol 1-8 devamı: Özelleştirilmiş Ders ve Sınav Takvimi yardımcıları.
// Tarayıcı tarafında .ics (takvim) üretimi, sınav çakışma tespiti ve
// yaklaşan ders/sınav hatırlatıcı hesaplamaları.

const GUN_INDEKS = { "Pazartesi": 1, "Salı": 2, "Çarşamba": 3, "Perşembe": 4, "Cuma": 5, "Cumartesi": 6, "Pazar": 0 };

function pad2(n) { return n < 10 ? `0${n}` : `${n}`; }

function icsTarihSaat(date) {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}T${pad2(date.getHours())}${pad2(date.getMinutes())}00`;
}

function icsKacInSatirlariniKes(metin) {
  return String(metin || "").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

// Bir sonraki gelecek tarihli belirli haftanın gününü bulur (bugün dahil).
function sonrakiGunTarihi(gunAdi, saat) {
  const hedefGun = GUN_INDEKS[gunAdi];
  if (hedefGun === undefined) return null;
  const simdi = new Date();
  const [saatStr, dkStr] = String(saat || "00:00").split(":");
  const aday = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate(), Number(saatStr) || 0, Number(dkStr) || 0);
  let fark = (hedefGun - simdi.getDay() + 7) % 7;
  if (fark === 0 && aday < simdi) fark = 7;
  aday.setDate(aday.getDate() + fark);
  return aday;
}

export function dersProgramindanIcsUret(dersListesi, baslik) {
  const satirlar = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CampusO//Ders Programi//TR", "CALSCALE:GREGORIAN"];
  dersListesi.forEach((d) => {
    if (!d.baslangic_saat || !d.bitis_saat) return; // saat girilmemiş derste takvim etkinliği oluşturulamaz
    const baslangic = sonrakiGunTarihi(d.gun, d.baslangic_saat);
    const bitis = sonrakiGunTarihi(d.gun, d.bitis_saat);
    if (!baslangic || !bitis) return;
    const gunKisaltma = { "Pazartesi": "MO", "Salı": "TU", "Çarşamba": "WE", "Perşembe": "TH", "Cuma": "FR", "Cumartesi": "SA", "Pazar": "SU" }[d.gun];
    satirlar.push(
      "BEGIN:VEVENT",
      `UID:ders-${d.id}@campuso`,
      `SUMMARY:${icsKacInSatirlariniKes(d.ders_adi)}`,
      `DTSTART:${icsTarihSaat(baslangic)}`,
      `DTEND:${icsTarihSaat(bitis)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${gunKisaltma};COUNT=14`,
      `LOCATION:${icsKacInSatirlariniKes(d.derslik || "")}`,
      `DESCRIPTION:${icsKacInSatirlariniKes([d.hoca_adi, d.ders_kodu].filter(Boolean).join(" · "))}`,
      "END:VEVENT",
    );
  });
  satirlar.push("END:VCALENDAR");
  return satirlar.join("\r\n");
}

export function sinavTakvimindenIcsUret(sinavListesi) {
  const satirlar = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CampusO//Sinav Takvimi//TR", "CALSCALE:GREGORIAN"];
  sinavListesi.forEach((s) => {
    const [yil, ay, gun] = s.tarih.split("-").map(Number);
    const [saatH, saatD] = String(s.saat || "00:00").split(":").map(Number);
    const baslangic = new Date(yil, ay - 1, gun, saatH || 0, saatD || 0);
    const bitis = new Date(baslangic.getTime() + 90 * 60000);
    satirlar.push(
      "BEGIN:VEVENT",
      `UID:sinav-${s.id}@campuso`,
      `SUMMARY:${icsKacInSatirlariniKes(`${s.sinav_turu}: ${s.ders_adi}`)}`,
      `DTSTART:${icsTarihSaat(baslangic)}`,
      `DTEND:${icsTarihSaat(bitis)}`,
      `LOCATION:${icsKacInSatirlariniKes(s.derslik || "")}`,
      `DESCRIPTION:${icsKacInSatirlariniKes([s.hoca_adi, s.ders_kodu].filter(Boolean).join(" · "))}`,
      "END:VEVENT",
    );
  });
  satirlar.push("END:VCALENDAR");
  return satirlar.join("\r\n");
}

export function icsIndir(icsMetni, dosyaAdi) {
  const blob = new Blob([icsMetni], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dosyaAdi;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Aynı tarih + saat aralığı çakışan sınavları tespit eder; çakışan sınav id'lerinin kümesini döner.
export function sinavCakismalariniBul(sinavListesi) {
  const cakisanlar = new Set();
  for (let i = 0; i < sinavListesi.length; i++) {
    for (let j = i + 1; j < sinavListesi.length; j++) {
      const a = sinavListesi[i];
      const b = sinavListesi[j];
      if (a.tarih === b.tarih && a.saat === b.saat) {
        cakisanlar.add(a.id);
        cakisanlar.add(b.id);
      }
    }
  }
  return cakisanlar;
}

export function yaklasanDersiBul(dersListesi) {
  const simdi = new Date();
  let enYakin = null;
  let enYakinTarih = null;
  dersListesi.forEach((d) => {
    if (!d.baslangic_saat) return; // saat girilmemiş dersler için yaklaşan-ders sayacı hesaplanamaz
    const tarih = sonrakiGunTarihi(d.gun, d.baslangic_saat);
    if (!tarih) return;
    if (!enYakinTarih || tarih < enYakinTarih) { enYakinTarih = tarih; enYakin = d; }
  });
  if (!enYakin) return null;
  const farkDk = Math.round((enYakinTarih.getTime() - simdi.getTime()) / 60000);
  return { ders: enYakin, tarih: enYakinTarih, farkDk };
}

export function yaklasanSinaviBul(sinavListesi) {
  const bugunIso = new Date();
  bugunIso.setHours(0, 0, 0, 0);
  const gelecek = sinavListesi
    .map((s) => {
      const [yil, ay, gun] = s.tarih.split("-").map(Number);
      const [saatH, saatD] = String(s.saat || "00:00").split(":").map(Number);
      return { sinav: s, tarih: new Date(yil, ay - 1, gun, saatH || 0, saatD || 0) };
    })
    .filter((r) => r.tarih >= new Date())
    .sort((a, b) => a.tarih - b.tarih);
  return gelecek[0] || null;
}

export function gunFarkiMetni(hedefTarih) {
  const simdi = new Date();
  const gunFarki = Math.ceil((hedefTarih.setHours(0, 0, 0, 0) - new Date(simdi).setHours(0, 0, 0, 0)) / 86400000);
  if (gunFarki <= 0) return "bugün";
  if (gunFarki === 1) return "yarın";
  return `${gunFarki} gün sonra`;
}
