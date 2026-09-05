// Uzun Odaklı Çalışma oturumu ilerledikçe büyüyen, süre dolunca tam
// olgunlaşan (çiçek açan) bitki illüstrasyonu. Hem /student/calisma-teknikleri
// sayfasındaki büyük kartta hem de ana sayfadaki küçük özet widget'ında
// kullanılır — tek kaynaktan (percent) beslenip CSS transition'larla
// büyüme aşamalarını gösterir.
//
// percent: 0-100 arası, oturumun ne kadarının tamamlandığını gösterir.
// tamamlandi: true ise (percent'ten bağımsız) tam olgunlaşmış/çiçekli hal
//   gösterilir (örn. geçmiş bir "hasat" özetinde).

export function BuyuyenBitki({ percent = 0, tamamlandi = false, size = 120, dark = false }) {
  const p = tamamlandi ? 100 : Math.max(0, Math.min(100, percent));
  const sapOlcek = Math.max(0.04, Math.min(1, p / 85)); // sap 85%'te tam boyuna ulaşır
  const yaprak1 = p >= 18;
  const yaprak2 = p >= 40;
  const yaprak3 = p >= 62;
  const tomurcuk = p >= 80 && p < 100;
  const cicek = p >= 100;
  const govdeRenk = dark ? "#bfe6c8" : "#4f8f5b";
  const yaprakRenk = dark ? "#9fe0ae" : "#5cab68";
  const toprakRenk = dark ? "#2c4a34" : "#8a6a4a";
  const saksiRenk = dark ? "#23392b" : "#c98a55";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 140"
      style={{ overflow: "visible", display: "block" }}
      aria-hidden="true"
    >
      {/* saksı / toprak */}
      <path d="M22 118 L98 118 L90 136 L30 136 Z" fill={saksiRenk} />
      <ellipse cx="60" cy="118" rx="38" ry="8" fill={toprakRenk} />

      {/* sap */}
      <g style={{ transform: `scaleY(${sapOlcek})`, transformOrigin: "60px 118px", transition: "transform 0.7s cubic-bezier(.34,1.4,.64,1)" }}>
        <path d="M60 118 C 58 90, 62 60, 60 28" stroke={govdeRenk} strokeWidth="5" strokeLinecap="round" fill="none" />
      </g>

      {/* yaprak çiftleri */}
      <g style={{ opacity: yaprak1 ? 1 : 0, transform: yaprak1 ? "scale(1)" : "scale(0.4)", transformOrigin: "60px 100px", transition: "all 0.6s ease" }}>
        <path d="M60 100 C 44 96, 36 106, 34 116 C 52 116, 60 110, 60 100 Z" fill={yaprakRenk} />
        <path d="M60 100 C 76 96, 84 106, 86 116 C 68 116, 60 110, 60 100 Z" fill={yaprakRenk} />
      </g>
      <g style={{ opacity: yaprak2 ? 1 : 0, transform: yaprak2 ? "scale(1)" : "scale(0.4)", transformOrigin: "60px 74px", transition: "all 0.6s ease" }}>
        <path d="M60 74 C 42 70, 32 80, 30 90 C 50 90, 60 84, 60 74 Z" fill={yaprakRenk} />
        <path d="M60 74 C 78 70, 88 80, 90 90 C 70 90, 60 84, 60 74 Z" fill={yaprakRenk} />
      </g>
      <g style={{ opacity: yaprak3 ? 1 : 0, transform: yaprak3 ? "scale(1)" : "scale(0.4)", transformOrigin: "60px 50px", transition: "all 0.6s ease" }}>
        <path d="M60 50 C 46 46, 38 54, 36 62 C 52 62, 60 58, 60 50 Z" fill={yaprakRenk} />
        <path d="M60 50 C 74 46, 82 54, 84 62 C 68 62, 60 58, 60 50 Z" fill={yaprakRenk} />
      </g>

      {/* tomurcuk (çiçek açmadan hemen önce) */}
      <g style={{ opacity: tomurcuk ? 1 : 0, transition: "opacity 0.5s ease" }}>
        <circle cx="60" cy="26" r="7" fill={dark ? "#8fd6a0" : "#7fbf8c"} />
      </g>

      {/* çiçek (tam olgunlaşma) */}
      <g
        style={{
          opacity: cicek ? 1 : 0,
          transform: cicek ? "scale(1)" : "scale(0.2)",
          transformOrigin: "60px 24px",
          transition: "all 0.6s cubic-bezier(.34,1.56,.64,1)",
        }}
      >
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <ellipse key={deg} cx="60" cy="24" rx="6" ry="12" fill="#ffb4d0" transform={`rotate(${deg} 60 24)`} />
        ))}
        <circle cx="60" cy="24" r="6.5" fill="#ffd76a" />
      </g>
    </svg>
  );
}

export function saniyeyiMMSSyapVeyaSaat(saniye) {
  const s = Math.max(0, Math.round(saniye));
  const saat = Math.floor(s / 3600);
  const dk = Math.floor((s % 3600) / 60);
  const sn = s % 60;
  if (saat > 0) {
    return `${String(saat).padStart(2, "0")}:${String(dk).padStart(2, "0")}:${String(sn).padStart(2, "0")}`;
  }
  return `${String(dk).padStart(2, "0")}:${String(sn).padStart(2, "0")}`;
}
