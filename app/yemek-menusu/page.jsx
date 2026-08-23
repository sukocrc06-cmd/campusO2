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

const KATEGORI_RENK = {
  "Çorba": "#ffb13b",
  "Ana Yemek": "#175cd3",
  "Ara Sıcak": "#175cd3",
  "Yardımcı Yemek": "#5b6b85",
  "Pilav": "#5b6b85",
  "Makarna": "#5b6b85",
  "Tatlı": "#22b879",
  "Meyve": "#22b879",
  "Salata": "#22b879",
};

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
      const alt = new Date(today);
      const bugunTs = new Date(today).getTime();

      const { data, error: err } = await supabase
        .from("yemek_menusu")
        .select("*")
        .gte("tarih", new Date(bugunTs - 6 * 86400000).toISOString().slice(0, 10))
        .order("tarih", { ascending: true })
        .limit(10);
      void alt;

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
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
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
                      padding: "10px 16px",
                      borderRadius: 999,
                      border: isActive ? "1px solid #175cd3" : "1px solid #e3ebf6",
                      background: isActive ? "#175cd3" : "#fff",
                      color: isActive ? "#fff" : "#5b6b85",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    {g.gun_adi}
                    {isBugun && (
                      <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, color: isActive ? "#fff" : "#22b879" }}>● BUGÜN</span>
                    )}
                  </button>
                );
              })}
            </div>

            {aktifGun && (
              <section style={{ background: "linear-gradient(135deg, #0e4bae, #175cd3)", borderRadius: 20, padding: "24px 26px", color: "#fff", marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", opacity: 0.85 }}>{aktifGun.gun_adi.toUpperCase()}</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, letterSpacing: "-0.02em" }}>{formatTarih(aktifGun.tarih)}</div>
                {toplamKalori > 0 && <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>Toplam yaklaşık {toplamKalori} kcal</div>}
              </section>
            )}

            {kategoriliYemekler.length === 0 ? (
              <div style={{ padding: 28, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>
                Bu gün için yemek listesi bulunamadı.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {kategoriliYemekler.map(([kategori, yemekler]) => (
                  <div key={kategori} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 14, padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: KATEGORI_RENK[kategori] || "#5b6b85", marginBottom: 8 }}>{kategori.toUpperCase()}</div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {yemekler.map((y, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{y.ad}</span>
                          {y.kalori ? <span style={{ fontSize: 11, color: "#5b6b85", whiteSpace: "nowrap" }}>{y.kalori} kcal</span> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
