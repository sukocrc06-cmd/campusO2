// Uzun Odaklı Çalışma oturumu ilerledikçe büyüyen, süre dolunca tam
// olgunlaşan bitki illüstrasyonu. Hem çalışma tekniği sayfalarındaki büyük
// kartlarda hem de ana sayfadaki küçük özet widget'ında kullanılır — tek
// kaynaktan (percent) beslenip CSS transition'larla büyüme aşamalarını
// gösterir. Biriken toplam odak süresine göre farklı "bitki türleri"
// açılır (bitkiTuruBelirle) — bir koleksiyon hissi vermesi için.
//
// percent: 0-100 arası, oturumun ne kadarının tamamlandığını gösterir.
// tamamlandi: true ise (percent'ten bağımsız) tam olgunlaşmış hal gösterilir.
// tur: "cicek" | "bonsai" | "fidan" | "meyve" — hangi bitkinin çizileceği.

const TUR_ESIKLERI = [
  { tur: "meyve", saniye: 24 * 3600, ad: "Meyve Ağacı" },
  { tur: "fidan", saniye: 8 * 3600, ad: "Fidan" },
  { tur: "bonsai", saniye: 2 * 3600, ad: "Bonsai" },
  { tur: "cicek", saniye: 0, ad: "Çiçek" },
];

// Toplam biriken Uzun Odaklı Çalışma süresine (saniye) göre hangi bitki
// türünün açıldığını döndürür. Eşikler: 0-2 saat Çiçek, 2-8 saat Bonsai,
// 8-24 saat Fidan, 24 saat+ Meyve Ağacı.
export function bitkiTuruBelirle(toplamSaniye = 0) {
  const eslesen = TUR_ESIKLERI.find((e) => toplamSaniye >= e.saniye);
  return eslesen || TUR_ESIKLERI[TUR_ESIKLERI.length - 1];
}

export function BuyuyenBitki({ percent = 0, tamamlandi = false, size = 120, dark = false, tur = "cicek" }) {
  const p = tamamlandi ? 100 : Math.max(0, Math.min(100, percent));
  const sapOlcek = Math.max(0.04, Math.min(1, p / 85)); // sap 85%'te tam boyuna ulaşır
  const yaprak1 = p >= 18;
  const yaprak2 = p >= 40;
  const yaprak3 = p >= 62;
  const tomurcuk = p >= 80 && p < 100;
  const olgun = p >= 100;
  const govdeRenk = tur === "fidan" || tur === "meyve" ? (dark ? "#a9713f" : "#8a5a2f") : dark ? "#bfe6c8" : "#4f8f5b";
  const yaprakRenk = dark ? "#9fe0ae" : "#5cab68";
  const toprakRenk = dark ? "#2c4a34" : "#8a6a4a";
  const saksiRenk = dark ? "#23392b" : "#c98a55";
  const govdeKalinlik = tur === "meyve" ? 7 : tur === "fidan" ? 6 : tur === "bonsai" ? 8 : 5;

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

      {/* sap / gövde */}
      <g style={{ transform: `scaleY(${sapOlcek})`, transformOrigin: "60px 118px", transition: "transform 0.7s cubic-bezier(.34,1.4,.64,1)" }}>
        <path
          d={tur === "bonsai" ? "M60 118 C 56 100, 66 84, 58 58" : "M60 118 C 58 90, 62 60, 60 28"}
          stroke={govdeRenk}
          strokeWidth={govdeKalinlik}
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {/* yaprak çiftleri (büyüme sırasında, tür ne olursa olsun ortak) */}
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

      {/* tomurcuk (olgunlaşmadan hemen önce) */}
      <g style={{ opacity: tomurcuk ? 1 : 0, transition: "opacity 0.5s ease" }}>
        <circle cx="60" cy="26" r="7" fill={dark ? "#8fd6a0" : "#7fbf8c"} />
      </g>

      {/* tam olgunlaşma: türe göre çiçek ya da taç (canopy) */}
      <g
        style={{
          opacity: olgun ? 1 : 0,
          transform: olgun ? "scale(1)" : "scale(0.2)",
          transformOrigin: "60px 24px",
          transition: "all 0.6s cubic-bezier(.34,1.56,.64,1)",
        }}
      >
        {tur === "cicek" && (
          <>
            {[0, 60, 120, 180, 240, 300].map((deg) => (
              <ellipse key={deg} cx="60" cy="24" rx="6" ry="12" fill="#ffb4d0" transform={`rotate(${deg} 60 24)`} />
            ))}
            <circle cx="60" cy="24" r="6.5" fill="#ffd76a" />
          </>
        )}
        {tur === "bonsai" && (
          <>
            <ellipse cx="60" cy="30" rx="26" ry="16" fill={dark ? "#8fd6a0" : "#6fb87c"} />
            <ellipse cx="42" cy="40" rx="15" ry="10" fill={dark ? "#8fd6a0" : "#6fb87c"} />
            <ellipse cx="80" cy="42" rx="14" ry="9" fill={dark ? "#8fd6a0" : "#6fb87c"} />
            {[[48, 24], [66, 20], [78, 34], [40, 38]].map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r="3" fill="#ffd0e0" />
            ))}
          </>
        )}
        {tur === "fidan" && (
          <>
            <ellipse cx="60" cy="26" rx="32" ry="22" fill={dark ? "#8fd6a0" : "#5cab68"} />
            <ellipse cx="60" cy="14" rx="20" ry="14" fill={dark ? "#a6e6b3" : "#6fb87c"} />
            {[[46, 20], [72, 26], [58, 34]].map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r="3.2" fill="#fff6cf" />
            ))}
          </>
        )}
        {tur === "meyve" && (
          <>
            <ellipse cx="60" cy="24" rx="34" ry="24" fill={dark ? "#8fd6a0" : "#5cab68"} />
            <ellipse cx="60" cy="12" rx="22" ry="15" fill={dark ? "#a6e6b3" : "#6fb87c"} />
            {[[42, 18], [58, 8], [76, 20], [50, 32], [70, 34], [62, 24]].map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r="4.4" fill="#ff8a5c" stroke="#c8562f" strokeWidth="0.6" />
            ))}
          </>
        )}
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

// Saniyeyi "2 saat 15 dakika" gibi okunur bir metne çevirir (haftalık özet,
// toplam odak süresi gösterimi için).
export function saniyeyiOkunurMetneYap(saniye) {
  const s = Math.max(0, Math.round(saniye));
  const saat = Math.floor(s / 3600);
  const dk = Math.floor((s % 3600) / 60);
  if (saat === 0 && dk === 0) return "1 dakikadan az";
  const parcalar = [];
  if (saat > 0) parcalar.push(`${saat} saat`);
  if (dk > 0) parcalar.push(`${dk} dakika`);
  return parcalar.join(" ");
}

// Dairesel ilerleme göstergesi — Pomodoro sayacının etrafında kullanılır.
export function OdakHalkasi({ percent = 0, size = 220, strokeWidth = 10, renk = "#175cd3", izRengi = "#e3ebf6", children }) {
  const p = Math.max(0, Math.min(100, percent));
  const r = (size - strokeWidth) / 2;
  const cevre = 2 * Math.PI * r;
  const offset = cevre * (1 - p / 100);
  return (
    <div style={{ position: "relative", width: size, height: size, display: "grid", placeItems: "center" }}>
      <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={izRengi} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={renk} strokeWidth={strokeWidth}
          strokeDasharray={cevre} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.9s linear" }}
        />
      </svg>
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

// Kısa bildirim/kutlama sesleri — harici ses dosyası gerektirmeden Web Audio
// API ile üretilir. Tarayıcı otomatik oynatma kısıtlaması nedeniyle ilk kez
// bir kullanıcı etkileşimi (Başlat butonuna tıklama) sonrasında çağrılmalı.
export function sesCal(tip = "bildirim") {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notalar = tip === "kutlama" ? [523.25, 659.25, 783.99] : [660, 880];
    notalar.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const kazanc = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const baslangic = ctx.currentTime + i * 0.13;
      kazanc.gain.setValueAtTime(0.0001, baslangic);
      kazanc.gain.exponentialRampToValueAtTime(0.16, baslangic + 0.02);
      kazanc.gain.exponentialRampToValueAtTime(0.0001, baslangic + 0.32);
      osc.connect(kazanc);
      kazanc.connect(ctx.destination);
      osc.start(baslangic);
      osc.stop(baslangic + 0.34);
    });
    setTimeout(() => ctx.close().catch(() => {}), (notalar.length * 0.13 + 0.5) * 1000);
  } catch {
    // Ses üretimi desteklenmiyorsa sessizce yoksay.
  }
}

// Hafif konfeti patlaması — harici kütüphane olmadan, tamamlanma anında
// kısa süreliğine render edilir (parent, "aktif" iken bu bileşeni gösterir).
export function Konfeti({ adet = 26 }) {
  const renkler = ["#ffb4d0", "#ffd76a", "#7fbf8c", "#9adfff", "#c9a2ff"];
  const parcalar = Array.from({ length: adet }, (_, i) => ({
    id: i,
    sol: Math.random() * 100,
    gecikme: Math.random() * 0.4,
    sure: 1.1 + Math.random() * 0.9,
    renk: renkler[i % renkler.length],
    donme: Math.random() * 360,
    boyut: 6 + Math.random() * 5,
  }));
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }} aria-hidden="true">
      <style>{`@keyframes campuso-konfeti-dusme { from { transform: translateY(-10px) rotate(0deg); opacity: 1; } to { transform: translateY(160px) rotate(360deg); opacity: 0; } }`}</style>
      {parcalar.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute", top: 0, left: `${p.sol}%`, width: p.boyut, height: p.boyut * 0.4,
            background: p.renk, borderRadius: 2, transform: `rotate(${p.donme}deg)`,
            animation: `campuso-konfeti-dusme ${p.sure}s ease-in ${p.gecikme}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
