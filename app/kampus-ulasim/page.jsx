"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

// Kampüs Yaşamı > Ulaşım (3.2). AYBÜ'nün resmi sitesinde ring/servis
// saatleri için otomatik senkronize edilebilecek bir kaynak yok — bu yüzden
// veri admin panelinden (/admin/kampus-ulasim) elle giriliyor (bkz. gerçek
// AYBÜ verisi: 20260925_kampus_ulasim_esenboga_cubuk_veri.sql migration'ı —
// kullanıcının paylaştığı resmi "Yerleşkelerimize Ulaşım" belgesinden ve
// @aybu_sks Instagram hesabından elle işlendi). Durak konumu: EGO Cepte'nin
// web'den erişilebilir bir API'si olmadığı için gerçek zamanlı EGO verisi
// gömülemiyor — bunun yerine her durak için admin panelinde girilen
// opsiyonel "konum" metni (koordinat ya da yer adı), API key gerektirmeyen
// düz bir Google Maps arama linkine (google.com/maps/search) dönüştürülüp
// "Haritada Aç" butonu olarak gösteriliyor — tamamen ücretsiz.
//
// Görsel (2. iterasyon): ilk sürümde şerit yukarıdan aşağı dar bir sütunda
// akıyordu ve uzun rotalarda kart gereksiz yere uzayıp "alt alta" görünüyordu
// — bunun yerine şerit artık kartın tüm genişliğini ölçüp (ResizeObserver)
// SOLDAN SAĞA dalgalanan bir akışa geçti; bir satıra sığmayan adımlar bir
// alt satıra kayıyor. Sayfa da koyu lacivert bir "gece haritası" temasına
// geçirildi — kartlar yarı saydam koyu cam (glassmorphism) panelleri,
// rota/rozet renkleri parlak tonlarla üzerinde öne çıkıyor.
const TIP_META = {
  ring: { etiket: "Ring", emoji: "🚌", renk: "#5b9dff", zemin: "rgba(91,157,255,0.14)", kenar: "rgba(91,157,255,0.35)" },
  servis: { etiket: "Servis", emoji: "🚐", renk: "#34d399", zemin: "rgba(52,211,153,0.14)", kenar: "rgba(52,211,153,0.35)" },
  ego: { etiket: "EGO Otobüs", emoji: "🚍", renk: "#ff9f5a", zemin: "rgba(255,159,90,0.14)", kenar: "rgba(255,159,90,0.35)" },
  diger: { etiket: "Diğer", emoji: "🚏", renk: "#9fb0d0", zemin: "rgba(159,176,208,0.14)", kenar: "rgba(159,176,208,0.35)" },
};
function tipMeta(tip) {
  return TIP_META[tip] || TIP_META.diger;
}

// Adım/durak adına bakıp uygun bir ikon tahmin eder — sadece görsel süs,
// veri girişini karmaşıklaştırmamak için admin panelinde ayrı bir alan
// istemiyoruz.
const ADIM_IKON_KURALLARI = [
  { anahtar: ["havalima", "havaş", "belko", "uçak"], ikon: "✈️" },
  { anahtar: ["yht", "gar", "tren"], ikon: "🚆" },
  { anahtar: ["ankaray", "metro"], ikon: "🚇" },
  { anahtar: ["aşti"], ikon: "🚏" },
  { anahtar: ["külliye", "yerleşke", "kampüs"], ikon: "🏫" },
];
function adimIkonuBul(ad, sonMu) {
  if (sonMu) return "🏁";
  const kucuk = (ad || "").toLocaleLowerCase("tr-TR");
  for (const kural of ADIM_IKON_KURALLARI) {
    if (kural.anahtar.some((a) => kucuk.includes(a))) return kural.ikon;
  }
  return "📍";
}

// Bir elemanın gerçek render genişliğini (ResizeObserver ile canlı) ölçer —
// güzergah şeridinin kaç adımı bir satıra sığdırabileceğini hesaplamak için.
function useKapGenislik() {
  const ref = useRef(null);
  const [genislik, setGenislik] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    function olc() { setGenislik(el.clientWidth); }
    olc();
    const ro = new ResizeObserver(olc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, genislik];
}

// Yatay dalga güzergah şeridi: duraklar soldan sağa, yukarı-aşağı dalgalanan
// noktalara yerleştirilip aralarından kavisli bir SVG yolu geçiriliyor. Kart
// genişliği bir satıra sığmayacak kadar çok adım varsa (ör. 6 duraklı Çubuk
// ring hattı dar bir ekranda), fazla adımlar bir alt satıra kayıyor — böylece
// hem geniş ekranda gereksiz dikey uzamıyor hem dar ekranda taşmıyor. Yolun
// üzerinde küçük bir otobüs ikonu <animateMotion> ile sürekli baştan sona
// dolaşıyor; baloncuklar mount olduğunda sırayla belirir (staggered).
function GuzergahSeridi({ adimlar, renk }) {
  const benzersizId = useId().replace(/[:]/g, "");
  const [kapRef, kapGenislik] = useKapGenislik();
  const [hoverI, setHoverI] = useState(-1);
  const [kaydirildi, setKaydirildi] = useState(false);
  const n = adimlar.length;
  const genislik = kapGenislik > 0 ? kapGenislik : 600; // ölçülene kadarki makul varsayım
  const kolonHedefGenisligi = 130;
  // Dar ekranda (ör. telefon) çok adımlı bir rotayı alt alta sıkıştırmak yerine
  // tek satırda bırakıp yatay kaydırmaya bırakıyoruz — hem kart gereksiz uzamıyor
  // hem de akış (soldan sağa gidiş yönü) bozulmuyor.
  const darEkran = genislik > 0 && genislik < 380 && n > 3;
  const kolonSabitGenisligi = 108;
  const satirBasinaAdim = darEkran ? n : Math.max(2, Math.min(n, Math.floor(genislik / kolonHedefGenisligi)));
  const satirSayisi = darEkran ? 1 : Math.ceil(n / satirBasinaAdim);
  const satirYuksekligi = 138;
  const ustBant = satirYuksekligi * 0.34;
  const altBant = satirYuksekligi * 0.7;
  const dikeyBosluk = 10;
  const yukseklik = satirSayisi * satirYuksekligi + dikeyBosluk * 2;
  const icerikGenisligi = darEkran ? Math.max(genislik, n * kolonSabitGenisligi) : genislik;

  const noktalar = adimlar.map((_, i) => {
    const satir = Math.floor(i / satirBasinaAdim);
    const satirBaslangic = satir * satirBasinaAdim;
    const buSatirdakiAdim = Math.min(satirBasinaAdim, n - satirBaslangic);
    const konumSira = i - satirBaslangic;
    const kolonG = icerikGenisligi / buSatirdakiAdim;
    return {
      x: kolonG * (konumSira + 0.5),
      y: dikeyBosluk + satir * satirYuksekligi + (konumSira % 2 === 0 ? ustBant : altBant),
    };
  });

  let yol = `M ${noktalar[0].x} ${noktalar[0].y}`;
  for (let i = 1; i < noktalar.length; i++) {
    const onceki = noktalar[i - 1];
    const su = noktalar[i];
    const dx = su.x - onceki.x;
    yol += ` C ${onceki.x + dx / 2} ${onceki.y}, ${su.x - dx / 2} ${su.y}, ${su.x} ${su.y}`;
  }

  const sure = `${Math.max(5, n * 2.2).toFixed(1)}s`;

  return (
    <div ref={kapRef} style={{ position: "relative", width: "100%" }}>
    <div
      style={{ position: "relative", width: "100%", overflowX: darEkran ? "auto" : "visible", WebkitOverflowScrolling: "touch" }}
      onScroll={darEkran ? () => setKaydirildi(true) : undefined}
    >
    <div style={{ position: "relative", width: icerikGenisligi, minWidth: "100%", height: yukseklik, margin: "16px 0 4px" }}>
      {n > 1 && kapGenislik > 0 && (
        <svg width={icerikGenisligi} height={yukseklik} viewBox={`0 0 ${icerikGenisligi} ${yukseklik}`} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <linearGradient id={`grad-${benzersizId}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={renk} stopOpacity="0.35" />
              <stop offset="100%" stopColor={renk} stopOpacity="0.95" />
            </linearGradient>
          </defs>
          <path d={yol} fill="none" stroke={renk} strokeWidth={12} strokeOpacity={0.1} strokeLinecap="round" />
          <path id={`yol-${benzersizId}`} d={yol} fill="none" stroke={`url(#grad-${benzersizId})`} strokeWidth={3.5} strokeLinecap="round" strokeDasharray="1 9" />
          <text fontSize="15" textAnchor="middle" dominantBaseline="central">
            🚌
            <animateMotion dur={sure} repeatCount="indefinite" rotate="0">
              <mpath xlinkHref={`#yol-${benzersizId}`} href={`#yol-${benzersizId}`} />
            </animateMotion>
          </text>
        </svg>
      )}

      {kapGenislik > 0 && adimlar.map((adim, i) => {
        const nokta = noktalar[i];
        const sonMu = i === n - 1;
        const hoverli = hoverI === i;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: nokta.x,
              top: nokta.y,
              transform: "translate(-50%, -50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
              width: Math.min(126, icerikGenisligi / (n > satirBasinaAdim ? satirBasinaAdim : n) - 6),
              opacity: 0,
              zIndex: hoverli ? 4 : 1,
              animation: `kuGuzergahBelir 0.5s ease ${(i * 0.15).toFixed(2)}s forwards`,
            }}
          >
            <div
              onMouseEnter={() => setHoverI(i)}
              onMouseLeave={() => setHoverI(-1)}
              title={adim.hat_no ? `${adim.ad} · 🚍 ${adim.hat_no}` : adim.ad}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 5,
                width: "100%",
                cursor: "default",
                transform: hoverli ? "scale(1.12)" : "scale(1)",
                transition: "transform 0.18s ease",
              }}
            >
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    width: sonMu ? 52 : 44,
                    height: sonMu ? 52 : 44,
                    borderRadius: "50%",
                    background: sonMu ? renk : "rgba(255,255,255,0.07)",
                    border: sonMu ? "3px solid rgba(255,255,255,0.9)" : `3px solid ${renk}`,
                    display: "grid",
                    placeItems: "center",
                    fontSize: sonMu ? 21 : 17,
                    boxShadow: hoverli
                      ? `0 10px 26px -8px ${renk}, 0 0 0 6px rgba(255,255,255,0.08)`
                      : `0 8px 18px -10px ${renk}, 0 0 0 4px rgba(255,255,255,0.03)`,
                    filter: hoverli ? "brightness(1.15)" : "none",
                    transition: "box-shadow 0.18s ease, filter 0.18s ease",
                    flex: "none",
                  }}
                >
                  {adimIkonuBul(adim.ad, sonMu)}
                </div>
                <span
                  style={{
                    position: "absolute",
                    bottom: -3,
                    left: -3,
                    minWidth: 16,
                    height: 16,
                    padding: "0 3px",
                    borderRadius: "50%",
                    background: "#0b1730",
                    border: `1.5px solid ${renk}`,
                    color: "#e8eefc",
                    fontSize: 9,
                    fontWeight: 800,
                    display: "grid",
                    placeItems: "center",
                    lineHeight: 1,
                  }}
                >
                  {i + 1}
                </span>
                {adim.hat_no && (
                  <span
                    style={{
                      position: "absolute",
                      top: -10,
                      left: "50%",
                      transform: "translateX(-50%)",
                      maxWidth: 108,
                      padding: "3px 8px",
                      borderRadius: 10,
                      background: renk,
                      color: "#0b1220",
                      border: "2.5px solid #0b1730",
                      fontSize: 10.5,
                      fontWeight: 900,
                      letterSpacing: "-0.01em",
                      textAlign: "center",
                      lineHeight: 1.2,
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                      boxShadow: `0 6px 14px -6px ${renk}`,
                    }}
                  >
                    {adim.hat_no}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textAlign: "center",
                  color: hoverli ? "#ffffff" : "#e8eefc",
                  lineHeight: 1.25,
                  transition: "color 0.18s ease",
                }}
              >
                {adim.ad}
              </div>
              {adim.saatler?.length > 0 && (
                <span style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(232,238,252,0.55)" }}>{adim.saatler.join(" · ")}</span>
              )}
              {adim.konum && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adim.konum)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 9.5, fontWeight: 800, color: renk, textDecoration: "none" }}
                >
                  📍 Haritada Aç
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
    </div>
    {darEkran && !kaydirildi && (
      <div
        style={{
          position: "absolute",
          right: 2,
          bottom: dikeyBosluk + 2,
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "3px 9px",
          borderRadius: 999,
          background: "rgba(11,23,48,0.85)",
          border: "1px solid rgba(255,255,255,0.18)",
          color: "rgba(232,238,252,0.75)",
          fontSize: 10,
          fontWeight: 700,
          pointerEvents: "none",
          animation: "kuKaydirIpucu 1.4s ease-in-out infinite",
        }}
      >
        kaydırın →
      </div>
    )}
    </div>
  );
}

export default function KampusUlasimPage() {
  const [hatlar, setHatlar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleHref, setRoleHref] = useState("/");

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
      const isAcademician = session.user.email?.toLowerCase() !== "suko.crc06@gmail.com" && profile?.role === "academician";
      setRoleHref(isAcademician ? "/?role=faculty" : "/?role=student");

      const { data, error: err } = await supabase
        .from("kampus_ulasim_hatlari")
        .select("*")
        .eq("aktif", true)
        .order("sira", { ascending: true })
        .order("created_at", { ascending: true });

      if (err) { setError("Ulaşım bilgileri alınamadı: " + err.message); setLoading(false); return; }
      setHatlar(data || []);
      setLoading(false);
    }
    init();
  }, []);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(165deg, #0e1c38 0%, #0a1428 45%, #050a16 100%)",
        fontFamily: "system-ui, sans-serif",
        color: "#e8eefc",
      }}
    >
      <style>{`
        @keyframes kuGuzergahBelir {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes kuKaydirIpucu {
          0%, 100% { transform: translateX(0); opacity: 0.7; }
          50% { transform: translateX(4px); opacity: 1; }
        }
      `}</style>

      <header
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
          padding: "14px 22px", borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(8,14,28,0.72)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 5,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={roleHref} style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#9cc4ff", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#7fb2ff" }}>KAMPÜS YAŞAMI · ULAŞIM</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f4f8ff" }}>Ring ve Servis Saatleri</div>
          </div>
        </div>
        <Link href={roleHref} style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid rgba(127,178,255,0.35)", color: "#9cc4ff", background: "rgba(91,157,255,0.08)" }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(720px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        {error ? (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,138,92,0.1)", border: "1px solid rgba(255,138,92,0.3)", color: "#ffb59a", fontSize: 13, fontWeight: 600 }}>{error}</div>
        ) : loading ? (
          <p style={{ color: "rgba(232,238,252,0.6)" }}>Yükleniyor…</p>
        ) : hatlar.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", border: "1px dashed rgba(255,255,255,0.14)", borderRadius: 16, background: "rgba(255,255,255,0.03)", color: "rgba(232,238,252,0.5)", fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🚌</div>
            Henüz ring/servis bilgisi eklenmedi.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {hatlar.map((h) => {
              const meta = tipMeta(h.tip);
              const duraklar = Array.isArray(h.duraklar) ? h.duraklar : [];
              return (
                <section
                  key={h.id}
                  style={{
                    background: "rgba(255,255,255,0.045)",
                    border: `1px solid ${meta.kenar}`,
                    borderRadius: 18,
                    padding: "20px 22px",
                    boxShadow: "0 20px 44px -28px rgba(0,0,0,0.7)",
                    backdropFilter: "blur(10px)",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: meta.zemin, display: "grid", placeItems: "center", fontSize: 19, flex: "none" }}>{meta.emoji}</div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#f4f8ff" }}>{h.ad}</div>
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: meta.renk, background: meta.zemin, padding: "2px 8px", borderRadius: 999 }}>{meta.etiket.toUpperCase()}</span>
                      {duraklar.length > 1 && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(232,238,252,0.5)", marginLeft: 8 }}>Toplam {duraklar.length} adım</span>
                      )}
                    </div>
                  </div>

                  {h.aciklama && <div style={{ fontSize: 12.5, color: "rgba(232,238,252,0.65)", marginTop: 8, lineHeight: 1.5 }}>{h.aciklama}</div>}

                  {duraklar.length > 1 ? (
                    <GuzergahSeridi adimlar={duraklar} renk={meta.renk} />
                  ) : duraklar.length === 1 ? (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 11, background: meta.zemin }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#f4f8ff" }}>{duraklar[0].ad}</span>
                          {duraklar[0].konum && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(duraklar[0].konum)}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                fontSize: 10.5, fontWeight: 800, color: meta.renk, textDecoration: "none",
                                display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 8px",
                                borderRadius: 999, background: "rgba(255,255,255,0.06)", border: `1px solid ${meta.kenar}`, whiteSpace: "nowrap",
                              }}
                            >
                              📍 Haritada Aç
                            </a>
                          )}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: meta.renk, textAlign: "right", whiteSpace: "nowrap" }}>
                          {duraklar[0].hat_no ? `🚍 ${duraklar[0].hat_no}` : duraklar[0].saatler?.length ? duraklar[0].saatler.join(" · ") : "—"}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {h.notlar && (
                    <div style={{ marginTop: 12, fontSize: 11.5, color: "rgba(232,238,252,0.55)", display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <span>ℹ️</span><span>{h.notlar}</span>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
