"use client";

import { useEffect, useId, useState } from "react";
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
// Görsel: kullanıcının paylaştığı "Çubuk Yerleşkesine Gidiş Güzergahı"
// görselindeki kıvrımlı/zikzak güzergah şeridi stilini (duraklar sola-sağa
// alternatif sıralı baloncuklar, aralarında kavisli bir çizgi) SVG ile
// yeniden üretiyoruz — ek kütüphane gerekmeden, sadece SVG <path> + native
// <animateMotion> (küçük bir otobüs ikonu şeridi sürekli baştan sona
// dolaşıyor) ve CSS ile.
const TIP_META = {
  ring: { etiket: "Ring", emoji: "🚌", renk: "#175cd3", zemin: "#eaf1ff", kenar: "#c7deff" },
  servis: { etiket: "Servis", emoji: "🚐", renk: "#0b8a5c", zemin: "#e9faf1", kenar: "#a9e8c8" },
  ego: { etiket: "EGO Otobüs", emoji: "🚍", renk: "#b0521f", zemin: "#fdf0e6", kenar: "#f3cda3" },
  diger: { etiket: "Diğer", emoji: "🚏", renk: "#5b6b85", zemin: "#f4f6fa", kenar: "#e3ebf6" },
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

// Kıvrımlı güzergah şeridi: duraklar sırayla sol/sağ alternatif noktalara
// yerleştirilip aralarından kavisli (S eğrili) bir SVG yolu geçiriliyor —
// tıpkı paylaşılan "Çubuk Yerleşkesine Gidiş" görselindeki gibi. Baloncuklar
// mount olduğunda sırayla belirir (staggered), yolun üzerinde küçük bir
// otobüs ikonu <animateMotion> ile sürekli baştan sona dolaşır.
function GuzergahSeridi({ adimlar, renk, zemin }) {
  const benzersizId = useId().replace(/[:]/g, "");
  const n = adimlar.length;
  const genislik = 320;
  const solX = genislik * 0.28;
  const sagX = genislik * 0.72;
  const adimAraligi = 118;
  const ustAltBosluk = 56;
  const yukseklik = ustAltBosluk * 2 + (n - 1) * adimAraligi;

  const noktalar = adimlar.map((_, i) => ({
    x: i % 2 === 0 ? solX : sagX,
    y: ustAltBosluk + i * adimAraligi,
  }));

  let yol = `M ${noktalar[0].x} ${noktalar[0].y}`;
  for (let i = 1; i < noktalar.length; i++) {
    const onceki = noktalar[i - 1];
    const su = noktalar[i];
    const dy = su.y - onceki.y;
    yol += ` C ${onceki.x} ${onceki.y + dy / 2}, ${su.x} ${su.y - dy / 2}, ${su.x} ${su.y}`;
  }

  const sure = `${Math.max(5, n * 2.4).toFixed(1)}s`;

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 340, margin: "16px auto 8px", aspectRatio: `${genislik} / ${yukseklik}` }}>
      {n > 1 && (
        <svg viewBox={`0 0 ${genislik} ${yukseklik}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <defs>
            <linearGradient id={`grad-${benzersizId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={renk} stopOpacity="0.35" />
              <stop offset="100%" stopColor={renk} stopOpacity="0.95" />
            </linearGradient>
          </defs>
          <path d={yol} fill="none" stroke={renk} strokeWidth={12} strokeOpacity={0.08} strokeLinecap="round" />
          <path id={`yol-${benzersizId}`} d={yol} fill="none" stroke={`url(#grad-${benzersizId})`} strokeWidth={3.5} strokeLinecap="round" strokeDasharray="1 9" />
          <text fontSize="15" textAnchor="middle" dominantBaseline="central">
            🚌
            <animateMotion dur={sure} repeatCount="indefinite" rotate="0">
              <mpath xlinkHref={`#yol-${benzersizId}`} href={`#yol-${benzersizId}`} />
            </animateMotion>
          </text>
        </svg>
      )}

      {adimlar.map((adim, i) => {
        const nokta = noktalar[i];
        const sonMu = i === n - 1;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${(nokta.x / genislik) * 100}%`,
              top: `${(nokta.y / yukseklik) * 100}%`,
              transform: "translate(-50%, -50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
              width: 128,
              opacity: 0,
              animation: `kuGuzergahBelir 0.55s ease ${(i * 0.18).toFixed(2)}s forwards`,
            }}
          >
            <div style={{ position: "relative" }}>
              <div
                style={{
                  width: sonMu ? 54 : 46,
                  height: sonMu ? 54 : 46,
                  borderRadius: "50%",
                  background: sonMu ? renk : "#fff",
                  border: `3px solid ${renk}`,
                  display: "grid",
                  placeItems: "center",
                  fontSize: sonMu ? 22 : 18,
                  boxShadow: `0 8px 18px -10px ${renk}`,
                  flex: "none",
                }}
              >
                {adimIkonuBul(adim.ad, sonMu)}
              </div>
              {adim.hat_no && (
                <span
                  style={{
                    position: "absolute",
                    top: -10,
                    right: -14,
                    minWidth: 30,
                    padding: "3px 7px",
                    borderRadius: 999,
                    background: renk,
                    color: "#fff",
                    border: "2.5px solid #fff",
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: "-0.01em",
                    textAlign: "center",
                    boxShadow: `0 6px 14px -6px ${renk}`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {adim.hat_no}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, textAlign: "center", color: "#0f1b33", lineHeight: 1.25 }}>{adim.ad}</div>
            {adim.saatler?.length > 0 && (
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#8fa0bc" }}>{adim.saatler.join(" · ")}</span>
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
        );
      })}
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
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <style>{`
        @keyframes kuGuzergahBelir {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>

      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={roleHref} style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>KAMPÜS YAŞAMI · ULAŞIM</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Ring ve Servis Saatleri</div>
          </div>
        </div>
        <Link href={roleHref} style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid #c7deff", color: "#0e4bae" }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(720px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        {error ? (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div>
        ) : loading ? (
          <p style={{ color: "#5b6b85" }}>Yükleniyor…</p>
        ) : hatlar.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>
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
                    background: "#fff",
                    border: `1px solid ${meta.kenar}`,
                    borderRadius: 18,
                    padding: "20px 22px",
                    boxShadow: "0 10px 24px -18px rgba(15,27,51,0.25)",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: meta.zemin, display: "grid", placeItems: "center", fontSize: 19, flex: "none" }}>{meta.emoji}</div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>{h.ad}</div>
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: meta.renk, background: meta.zemin, padding: "2px 8px", borderRadius: 999 }}>{meta.etiket.toUpperCase()}</span>
                    </div>
                  </div>

                  {h.aciklama && <div style={{ fontSize: 12.5, color: "#5b6b85", marginTop: 8, lineHeight: 1.5 }}>{h.aciklama}</div>}

                  {duraklar.length > 1 ? (
                    <GuzergahSeridi adimlar={duraklar} renk={meta.renk} zemin={meta.zemin} />
                  ) : duraklar.length === 1 ? (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 11, background: meta.zemin }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{duraklar[0].ad}</span>
                          {duraklar[0].konum && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(duraklar[0].konum)}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                fontSize: 10.5, fontWeight: 800, color: meta.renk, textDecoration: "none",
                                display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 8px",
                                borderRadius: 999, background: "#fff", border: `1px solid ${meta.kenar}`, whiteSpace: "nowrap",
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
                    <div style={{ marginTop: 12, fontSize: 11.5, color: "#8fa0bc", display: "flex", alignItems: "flex-start", gap: 6 }}>
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
