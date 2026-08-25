// CampusO Vol 1-12: Özelleştirilmiş Yoklama Takibi yardımcıları.

export const YOKLAMA_DURUMLARI = {
  var: { label: "Var", color: "#0b8f5c", bg: "#e3faf0" },
  gec: { label: "Geç", color: "#c65d1f", bg: "#fff2e6" },
  izinli: { label: "İzinli", color: "#175cd3", bg: "#e6f0ff" },
  yok: { label: "Yok", color: "#c0273c", bg: "#ffe9ec" },
};

// İzinli, hem katılan hem toplam oturum sayısından çıkarılır (devamsızlık sayılmaz).
export function devamYuzdesiHesapla(kayitlar) {
  const sayilanlar = kayitlar.filter((k) => k.durum !== "izinli");
  if (sayilanlar.length === 0) return null;
  const katilan = sayilanlar.filter((k) => k.durum === "var" || k.durum === "gec").length;
  return Math.round((katilan / sayilanlar.length) * 100);
}

// Bölüm/sınıf eşleşen varsayılan roster ile akademisyenin elle eklediği/çıkardığı
// override kayıtlarını birleştirip nihai öğrenci id listesini üretir.
export function rosterBirlestir(varsayilanOgrenciler, overrideler) {
  const harita = new Map(varsayilanOgrenciler.map((o) => [o.id, o]));
  overrideler.forEach((ov) => {
    if (ov.dahil === false) harita.delete(ov.ogrenci_id);
  });
  return Array.from(harita.values());
}

export function ekstraDahilEdilenler(overrideler, varsayilanIdSeti) {
  return overrideler.filter((ov) => ov.dahil === true && !varsayilanIdSeti.has(ov.ogrenci_id));
}
