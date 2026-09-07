"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

// Kampüs Yaşamı > Kampüs Haritası (3.3). Genel görünüm gerçek koordinatlarla
// çiziliyor: Leaflet + OpenStreetMap/CARTO kutucukları (tamamen ücretsiz, API
// key gerekmez) — Ulaşım modülündeki "ücretsiz gerçek veri" yaklaşımının
// devamı. Leaflet npm bağımlılığı eklemeden CDN üzerinden (leaflet.js/css)
// yükleniyor ki mevcut build hattı (vite + next hibrit) hiç değişmesin.
// Bina koordinatları ve mekan (sınıf/laboratuvar/ofis) listeleri admin
// panelinden (/admin/kampus-haritasi) elle giriliyor — AYBÜ'nün resmi
// sitesinde kampüs merkez koordinatı var ama bina bazlı otomatik çekilebilecek
// bir kaynak yok. İç mekan navigasyonu (yol bulma) bilinçli olarak v1 kapsamı
// dışında bırakıldı; her bina için sadece kat bazlı basit bir mekan listesi
// gösteriliyor.
const LEAFLET_CSS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css";
const LEAFLET_JS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js";

const TIP_META = {
  egitim: { etiket: "Eğitim Binası", emoji: "🏫", renk: "#5b9dff" },
  laboratuvar: { etiket: "Laboratuvar Binası", emoji: "🧪", renk: "#34d399" },
  idari: { etiket: "İdari Bina", emoji: "🏛️", renk: "#9fb0d0" },
  sosyal: { etiket: "Sosyal Alan", emoji: "☕", renk: "#ff9f5a" },
  spor: { etiket: "Spor Tesisi", emoji: "🏟️", renk: "#f472b6" },
  yurt: { etiket: "Yurt", emoji: "🛏️", renk: "#a78bfa" },
  diger: { etiket: "Diğer", emoji: "📍", renk: "#9fb0d0" },
};
function tipMeta(tip) {
  return TIP_META[tip] || TIP_META.diger;
}
const MEKAN_TIP_ETIKET = { sinif: "Sınıf", laboratuvar: "Laboratuvar", ofis: "Ofis", wc: "WC", diger: "Diğer" };

function useLeafletYukle() {
  const [hazir, setHazir] = useState(typeof window !== "undefined" && !!window.L);
  useEffect(() => {
    if (typeof window === "undefined" || window.L) { setHazir(true); return; }
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const mevcutScript = document.querySelector(`script[src="${LEAFLET_JS}"]`);
    if (mevcutScript) {
      mevcutScript.addEventListener("load", () => setHazir(true));
      if (window.L) setHazir(true);
      return;
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => setHazir(true);
    document.body.appendChild(script);
  }, []);
  return hazir;
}

function KampusHaritasi({ binalar, seciliId, onSecim }) {
  const kapRef = useRef(null);
  const haritaRef = useRef(null);
  const markerlarRef = useRef({});
  const leafletHazir = useLeafletYukle();

  useEffect(() => {
    if (!leafletHazir || !kapRef.current || haritaRef.current) return;
    const L = window.L;
    const merkez = binalar.length > 0
      ? [binalar.reduce((s, b) => s + b.lat, 0) / binalar.length, binalar.reduce((s, b) => s + b.lng, 0) / binalar.length]
      : [40.1328489, 32.9440116];
    const harita = L.map(kapRef.current, { zoomControl: true, attributionControl: true }).setView(merkez, 17);
    // CARTO'nun ücretsiz "dark matter" kutucukları — API key gerekmez, sayfanın
    // koyu "gece haritası" temasıyla görsel olarak uyumlu.
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıda bulunanlar &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
      subdomains: "abcd",
    }).addTo(harita);
    haritaRef.current = harita;
    return () => { harita.remove(); haritaRef.current = null; };
  }, [leafletHazir, binalar]);

  useEffect(() => {
    const harita = haritaRef.current;
    if (!harita || !leafletHazir) return;
    const L = window.L;

    // Önce eski marker'ları temizle, sonra güncel listeye göre yeniden çiz.
    Object.values(markerlarRef.current).forEach((m) => harita.removeLayer(m));
    markerlarRef.current = {};

    binalar.forEach((b) => {
      const meta = tipMeta(b.tip);
      const secili = seciliId === b.id;
      const ikon = L.divIcon({
        className: "",
        html: `<div style="
          width: ${secili ? 40 : 32}px; height: ${secili ? 40 : 32}px; border-radius: 50%;
          background: ${meta.renk}; border: ${secili ? 3 : 2}px solid #fff;
          display:flex; align-items:center; justify-content:center; font-size: ${secili ? 18 : 14}px;
          box-shadow: 0 6px 16px -6px rgba(0,0,0,0.7);
        ">${meta.emoji}</div>`,
        iconSize: [secili ? 40 : 32, secili ? 40 : 32],
        iconAnchor: [secili ? 20 : 16, secili ? 20 : 16],
      });
      const marker = L.marker([b.lat, b.lng], { icon: ikon }).addTo(harita);
      marker.on("click", () => onSecim(b.id));
      marker.bindTooltip(b.ad, { direction: "top", offset: [0, -14] });
      markerlarRef.current[b.id] = marker;
    });
  }, [binalar, seciliId, leafletHazir, onSecim]);

  return (
    <div style={{ position: "relative", width: "100%", height: "min(62vh, 520px)", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)" }}>
      <div ref={kapRef} style={{ width: "100%", height: "100%", background: "#0a1428" }} />
      {!leafletHazir && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(232,238,252,0.6)", fontSize: 13 }}>Harita yükleniyor…</div>
      )}
    </div>
  );
}

export default function KampusHaritasiPage() {
  const [binalar, setBinalar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleHref, setRoleHref] = useState("/");
  const [seciliId, setSeciliId] = useState(null);

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
      const isAcademician = session.user.email?.toLowerCase() !== "suko.crc06@gmail.com" && profile?.role === "academician";
      setRoleHref(isAcademician ? "/?role=faculty" : "/?role=student");

      const { data, error: err } = await supabase
        .from("kampus_binalar")
        .select("*")
        .eq("aktif", true)
        .order("sira", { ascending: true })
        .order("created_at", { ascending: true });

      if (err) { setError("Kampüs haritası alınamadı: " + err.message); setLoading(false); return; }
      setBinalar((data || []).filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng)));
      setLoading(false);
    }
    init();
  }, []);

  const seciliBina = binalar.find((b) => b.id === seciliId) || null;
  const seciliMeta = seciliBina ? tipMeta(seciliBina.tip) : null;

  const mekanlarKatGrubu = {};
  if (seciliBina && Array.isArray(seciliBina.mekanlar)) {
    for (const m of seciliBina.mekanlar) {
      const k = m.kat || "Diğer";
      (mekanlarKatGrubu[k] = mekanlarKatGrubu[k] || []).push(m);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(165deg, #0e1c38 0%, #0a1428 45%, #050a16 100%)", fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(8,14,28,0.72)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={roleHref} style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#9cc4ff", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#7fb2ff" }}>KAMPÜS YAŞAMI · KAMPÜS HARİTASI</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f4f8ff" }}>Binalar ve Mekanlar</div>
          </div>
        </div>
        <Link href={roleHref} style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid rgba(127,178,255,0.35)", color: "#9cc4ff", background: "rgba(91,157,255,0.08)" }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(880px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        {error ? (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,138,92,0.1)", border: "1px solid rgba(255,138,92,0.3)", color: "#ffb59a", fontSize: 13, fontWeight: 600 }}>{error}</div>
        ) : loading ? (
          <p style={{ color: "rgba(232,238,252,0.6)" }}>Yükleniyor…</p>
        ) : binalar.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", border: "1px dashed rgba(255,255,255,0.14)", borderRadius: 16, background: "rgba(255,255,255,0.03)", color: "rgba(232,238,252,0.5)", fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🗺️</div>
            Henüz bina eklenmedi.
          </div>
        ) : (
          <>
            <KampusHaritasi binalar={binalar} seciliId={seciliId} onSecim={setSeciliId} />

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
              {binalar.map((b) => {
                const meta = tipMeta(b.tip);
                const secili = seciliId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSeciliId(secili ? null : b.id)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "6px 12px", borderRadius: 999, cursor: "pointer",
                      fontSize: 12, fontWeight: 700,
                      color: secili ? "#0b1220" : "#e8eefc",
                      background: secili ? meta.renk : "rgba(255,255,255,0.06)",
                      border: `1px solid ${secili ? meta.renk : "rgba(255,255,255,0.14)"}`,
                    }}
                  >
                    <span>{meta.emoji}</span>{b.ad}
                  </button>
                );
              })}
            </div>

            {seciliBina && (
              <section
                style={{
                  marginTop: 16,
                  background: "rgba(255,255,255,0.045)",
                  border: `1px solid ${seciliMeta.renk}55`,
                  borderRadius: 18,
                  padding: "20px 22px",
                  backdropFilter: "blur(10px)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: `${seciliMeta.renk}22`, display: "grid", placeItems: "center", fontSize: 19, flex: "none" }}>{seciliMeta.emoji}</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#f4f8ff" }}>{seciliBina.ad}</div>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: seciliMeta.renk, background: `${seciliMeta.renk}22`, padding: "2px 8px", borderRadius: 999 }}>{seciliMeta.etiket.toUpperCase()}</span>
                  </div>
                </div>

                {seciliBina.aciklama && <div style={{ fontSize: 12.5, color: "rgba(232,238,252,0.65)", marginTop: 8, lineHeight: 1.5 }}>{seciliBina.aciklama}</div>}

                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${seciliBina.lat},${seciliBina.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4, marginTop: 10,
                    fontSize: 11.5, fontWeight: 800, color: seciliMeta.renk, textDecoration: "none",
                    padding: "5px 10px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: `1px solid ${seciliMeta.renk}55`,
                  }}
                >
                  📍 Google Maps'te Aç / Yol Tarifi Al
                </a>

                {Object.keys(mekanlarKatGrubu).length > 0 ? (
                  <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                    {Object.entries(mekanlarKatGrubu).map(([kat, mekanlar]) => (
                      <div key={kat}>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", color: "rgba(232,238,252,0.5)", marginBottom: 6 }}>{kat.toUpperCase()}</div>
                        <div style={{ display: "grid", gap: 6 }}>
                          {mekanlar.map((m, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#f4f8ff" }}>{m.ad}</span>
                                {m.aciklama && <span style={{ fontSize: 11, color: "rgba(232,238,252,0.5)" }}>{m.aciklama}</span>}
                              </span>
                              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", color: seciliMeta.renk, background: `${seciliMeta.renk}22`, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
                                {MEKAN_TIP_ETIKET[m.tip] || m.tip}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: 14, fontSize: 12, color: "rgba(232,238,252,0.45)" }}>Bu bina için henüz mekan (sınıf/laboratuvar) bilgisi eklenmedi.</div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
