"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTarih(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatGunNo(iso) {
  if (!iso) return "";
  const [, , d] = iso.split("-").map(Number);
  return String(d).padStart(2, "0");
}

function formatAyKisa(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("tr-TR", { month: "short" }).replace(".", "");
}

// Kategori başına sembol + renk paleti — yemek türüne göre görsel ayırt edicilik.
const KATEGORI_META = {
  "Çorba": { emoji: "🍲", renk: "#e08a1f", zemin: "#fff4e2", kenar: "#ffd9a3" },
  "Ana Yemek": { emoji: "🍗", renk: "#175cd3", zemin: "#eaf1ff", kenar: "#c7deff" },
  "Ara Sıcak": { emoji: "🍳", renk: "#175cd3", zemin: "#eaf1ff", kenar: "#c7deff" },
  "Yardımcı Yemek": { emoji: "🍚", renk: "#6b5b3f", zemin: "#f6f1e7", kenar: "#e6d9bd" },
  "Pilav": { emoji: "🍚", renk: "#6b5b3f", zemin: "#f6f1e7", kenar: "#e6d9bd" },
  "Makarna": { emoji: "🍝", renk: "#b0521f", zemin: "#fdf0e6", kenar: "#f3cda3" },
  "Tatlı": { emoji: "🍰", renk: "#0b8a5c", zemin: "#e9faf1", kenar: "#a9e8c8" },
  "Meyve": { emoji: "🍉", renk: "#0b8a5c", zemin: "#e9faf1", kenar: "#a9e8c8" },
  "Salata": { emoji: "🥗", renk: "#0b8a5c", zemin: "#e9faf1", kenar: "#a9e8c8" },
  "Ekmek": { emoji: "🍞", renk: "#8a5a2b", zemin: "#faf1e5", kenar: "#eeceac" },
};
const VARSAYILAN_KATEGORI = { emoji: "🍽️", renk: "#5b6b85", zemin: "#f4f6fa", kenar: "#e3ebf6" };

function kategoriMeta(kategori) {
  return KATEGORI_META[kategori] || VARSAYILAN_KATEGORI;
}

// Sayfa arkaplanı: düz beyazlık yerine çok soluk, gri tonda, hafif kabartma
// hissi veren tekrarlayan çatal-bıçak / fincan / başak / tabak deseni.
// Kabartma efekti: aynı ikon seti bir kez açık (beyaz, sola-yukarı kaydırılmış)
// bir kez koyu (lacivert, sağa-aşağı kaydırılmış, çok düşük opaklık) çizilerek
// elde ediliyor — göz yormaması için opaklıklar çok düşük tutuldu.
const YEMEK_DESENI_SVG = `
<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='200' height='200' viewBox='0 0 200 200'>
  <defs>
    <g id='y' fill='none' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'>
      <g transform='translate(20,20) rotate(-12)'>
        <path d='M4 0 L4 14 M8 0 L8 14 M12 0 L12 14 M4 14 Q4 20 8 20 Q12 20 12 14 M8 20 L8 40'/>
        <path d='M28 0 Q34 4 34 14 Q34 20 28 22 L28 40'/>
      </g>
      <g transform='translate(150,18) rotate(8)'>
        <rect x='0' y='6' width='26' height='20' rx='4'/>
        <path d='M26 10 Q36 10 36 18 Q36 26 26 24'/>
        <path d='M6 0 Q8 -4 6 -8 M14 0 Q16 -4 14 -8'/>
      </g>
      <g transform='translate(20,128) rotate(6)'>
        <path d='M10 0 L10 60 M10 10 L2 4 M10 10 L18 4 M10 22 L2 16 M10 22 L18 16 M10 34 L2 28 M10 34 L18 28 M10 46 L2 40 M10 46 L18 40'/>
      </g>
      <g transform='translate(138,132) rotate(-6)'>
        <ellipse cx='20' cy='30' rx='24' ry='9'/>
        <ellipse cx='20' cy='30' rx='14' ry='5'/>
        <path d='M10 14 Q6 8 10 2 M20 14 Q16 8 20 2 M30 14 Q26 8 30 2'/>
      </g>
    </g>
  </defs>
  <use href='#y' xlink:href='#y' transform='translate(0.6,0.6)' stroke='#0f1b33' stroke-opacity='0.055'/>
  <use href='#y' xlink:href='#y' transform='translate(-0.5,-0.5)' stroke='#ffffff' stroke-opacity='0.55'/>
</svg>`.replace(/\s+/g, " ").trim();

const YEMEK_DESENI_URL = `url("data:image/svg+xml,${encodeURIComponent(YEMEK_DESENI_SVG)}")`;

const GUN_KISA = { "Pazartesi": "Pzt", "Salı": "Sal", "Çarşamba": "Çar", "Perşembe": "Per", "Cuma": "Cum", "Cumartesi": "Cts", "Pazar": "Paz" };

// "Bir öğün" için referans kalori değeri — dairesel göstergenin yüzdesini bulmak için.
const OGUN_REFERANS_KCAL = 1200;

function KaloriHalkasi({ kcal }) {
  const yuzde = Math.max(0, Math.min(100, Math.round((kcal / OGUN_REFERANS_KCAL) * 100)));
  const r = 30;
  const cevre = 2 * Math.PI * r;
  const dolu = (yuzde / 100) * cevre;
  return (
    <div style={{ position: "relative", width: 72, height: 72, flex: "none" }}>
      <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="7" />
        <circle
          cx="36" cy="36" r={r} fill="none" stroke="#ffd166" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${dolu} ${cevre}`}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{kcal}</div>
        <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>KCAL</div>
      </div>
    </div>
  );
}

export default function YemekMenusuPage() {
  const [gunler, setGunler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [roleHref, setRoleHref] = useState("/");

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Menü veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
      const isAcademician = session.user.email?.toLowerCase() !== "suko.crc06@gmail.com" && profile?.role === "academician";
      setRoleHref(isAcademician ? "/?role=faculty" : "/?role=student");

      const today = todayIso();

      const { data, error: err } = await supabase
        .from("yemek_menusu")
        .select("*")
        .gte("tarih", today)
        .order("tarih", { ascending: true })
        .limit(10);

      if (err) { setError("Menü alınamadı: " + err.message); setLoading(false); return; }

      const rows = data || [];
      setGunler(rows);
      const bugunIdx = rows.findIndex((r) => r.tarih === today);
      setActiveIndex(bugunIdx !== -1 ? bugunIdx : 0);
      setLoading(false);
    }
    init();
  }, []);

  const aktifGun = gunler[activeIndex] || null;
  const bugun = todayIso();

  const kategoriliYemekler = useMemo(() => {
    if (!aktifGun) return [];
    const map = new Map();
    (aktifGun.yemekler || []).forEach((y) => {
      const kat = y.kategori || "Diğer";
      if (!map.has(kat)) map.set(kat, []);
      map.get(kat).push(y);
    });
    return Array.from(map.entries());
  }, [aktifGun]);

  const toplamKalori = useMemo(() => (aktifGun?.yemekler || []).reduce((s, y) => s + (y.kalori || 0), 0), [aktifGun]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "#f5f8fc",
        backgroundImage: YEMEK_DESENI_URL,
        backgroundRepeat: "repeat",
        backgroundSize: "200px 200px",
        fontFamily: "system-ui, sans-serif",
        color: "#0f1b33",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={roleHref} style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>VOL 1-7 · YEMEK MENÜSÜ</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Haftalık Yemek Menüsü</div>
          </div>
        </div>
        <Link href={roleHref} style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid #c7deff", color: "#0e4bae" }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(760px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        {error ? (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div>
        ) : loading ? (
          <p style={{ color: "#5b6b85" }}>Yükleniyor…</p>
        ) : gunler.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🍽️</div>
            Bu hafta için henüz menü verisi yok.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {gunler.map((g, i) => {
                const isBugun = g.tarih === bugun;
                const isActive = i === activeIndex;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setActiveIndex(i)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2,
                      minWidth: 58,
                      padding: "8px 10px 9px",
                      borderRadius: 14,
                      border: isActive ? "1px solid #175cd3" : isBugun ? "1px solid #a9e8c8" : "1px solid #e3ebf6",
                      background: isActive ? "linear-gradient(160deg, #175cd3, #0e4bae)" : isBugun ? "#eefaf3" : "#fff",
                      color: isActive ? "#fff" : "#0f1b33",
                      cursor: "pointer",
                      position: "relative",
                      boxShadow: isActive ? "0 10px 20px -12px rgba(23,92,211,.6)" : "none",
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".05em", color: isActive ? "rgba(255,255,255,0.85)" : "#8fa0bc" }}>
                      {GUN_KISA[g.gun_adi] || g.gun_adi.slice(0, 3)}
                    </span>
                    <span style={{ fontSize: 17, fontWeight: 800, lineHeight: 1 }}>{formatGunNo(g.tarih)}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: isActive ? "rgba(255,255,255,0.75)" : "#8fa0bc" }}>{formatAyKisa(g.tarih)}</span>
                    {isBugun && (
                      <span style={{ position: "absolute", top: -4, right: -4, width: 10, height: 10, borderRadius: 999, background: "#22b879", border: "2px solid #f5f8fc" }} />
                    )}
                  </button>
                );
              })}
            </div>

            {aktifGun && (
              <section
                style={{
                  position: "relative",
                  overflow: "hidden",
                  background: "linear-gradient(135deg, #0e4bae, #175cd3)",
                  borderRadius: 20,
                  padding: "24px 26px",
                  color: "#fff",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 18,
                }}
              >
                {/* Yemek temalı hafif desen: soluk tabak/çatal-bıçak motifleri */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage:
                      "radial-gradient(circle at 12% 20%, rgba(255,255,255,0.10) 0, rgba(255,255,255,0.10) 8px, transparent 9px)," +
                      "radial-gradient(circle at 85% 15%, rgba(255,255,255,0.08) 0, rgba(255,255,255,0.08) 14px, transparent 15px)," +
                      "radial-gradient(circle at 70% 80%, rgba(255,255,255,0.08) 0, rgba(255,255,255,0.08) 10px, transparent 11px)",
                    pointerEvents: "none",
                  }}
                />
                <div aria-hidden style={{ position: "absolute", right: -10, bottom: -22, fontSize: 96, opacity: 0.12, transform: "rotate(-8deg)", pointerEvents: "none" }}>
                  🍽️
                </div>

                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", opacity: 0.85 }}>{aktifGun.gun_adi.toUpperCase()}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, letterSpacing: "-0.02em" }}>{formatTarih(aktifGun.tarih)}</div>
                  {kategoriliYemekler.length > 0 && (
                    <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {kategoriliYemekler.map(([kategori]) => (
                        <span key={kategori} style={{ fontSize: 14 }} title={kategori}>{kategoriMeta(kategori).emoji}</span>
                      ))}
                    </div>
                  )}
                </div>

                {toplamKalori > 0 && (
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <KaloriHalkasi kcal={toplamKalori} />
                  </div>
                )}
              </section>
            )}

            {kategoriliYemekler.length === 0 ? (
              <div style={{ padding: 28, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>
                Bu gün için yemek listesi bulunamadı.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {kategoriliYemekler.map(([kategori, yemekler]) => {
                  const meta = kategoriMeta(kategori);
                  return (
                    <div
                      key={kategori}
                      style={{
                        background: meta.zemin,
                        border: `1px solid ${meta.kenar}`,
                        borderRadius: 14,
                        padding: 16,
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          flex: "none",
                          width: 38,
                          height: 38,
                          borderRadius: 11,
                          background: "#fff",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 19,
                          boxShadow: `0 4px 10px -6px ${meta.renk}55`,
                        }}
                      >
                        {meta.emoji}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: meta.renk, marginBottom: 8 }}>{kategori.toUpperCase()}</div>
                        <div style={{ display: "grid", gap: 6 }}>
                          {yemekler.map((y, idx) => (
                            <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                              <span style={{ fontSize: 14, fontWeight: 600 }}>{y.ad}</span>
                              {y.kalori ? <span style={{ fontSize: 11, color: "#5b6b85", whiteSpace: "nowrap" }}>{y.kalori} kcal</span> : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
