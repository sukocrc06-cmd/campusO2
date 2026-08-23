// CampusO Vol 1-5: Sosyal Sorumluluk Durumu
// Öğrencilerin tamamlaması beklenen toplam sosyal sorumluluk saati burada
// tanımlıdır. Bu değer örnek/varsayılan bir hedeftir; üniversitenin kendi
// yönergesine göre değiştirilebilir.

export const SOSYAL_SORUMLULUK_HEDEF_SAAT = 30;

export function toplamOnayliSaat(kayitlar) {
  return kayitlar
    .filter((kayit) => kayit.onay_durumu === "onaylandi")
    .reduce((sum, kayit) => sum + Number(kayit.saat || 0), 0);
}
