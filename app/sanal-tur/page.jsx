"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

// Kampüs Yaşamı > Sanal Tur (3.7). AYBÜ'nün resmi sanal turu (aybu.edu.tr/
// sanaltur) telifli 360° fotoğraflar kullanıyor — bunları kopyalayamayız ve
// elimizde kendi 360° çekimimiz yok. Bu yüzden Ulaşım/Kampüs Haritası'ndaki
// gibi "altyapıyı biz kurarız, gerçek görselleri admin zamanla yükler"
// yaklaşımını sürdürüyoruz: her durak "normal" (kaydırmalı galeri) ya da
// "panorama" (360°, Pannellum ile — ücretsiz/açık kaynak, API key gerekmez,
// npm bağımlılığı eklemeden CDN üzerinden yüklenir) fotoğraflar taşıyabilir.
// Admin elindeki sıradan fotoğraflarla hemen başlayabilir; telefonla 360°
// çekim eklenince o durak otomatik panorama moduna geçer.
const PANNELLUM_CSS = "https://cdnjs.cloudflare.com/ajax/libs/pannellum/2.5.7/pannellum.min.css";
const PANNELLUM_JS = "https://cdnjs.cloudflare.com/ajax/libs/pannellum/2.5.7/pannellum.min.js";

const KATEGORI_META = {
  sinif: { etiket: "Sınıflar", emoji: "🏫", renk: "#5b9dff" },
  kutuphane: { etiket: "Kütüphane / Çalışma Salonları", emoji: "📚", renk: "#34d399" },
  aktivite: { etiket: "Aktivite Alanları", emoji: "🎯", renk: "#ff9f5a" },
  laboratuvar: { etiket: "Laboratuvarlar", emoji: "🧪", renk: "#a78bfa" },
  yol: { etiket: "Yollar", emoji: "🛣️", renk: "#f472b6" },
  disalan: { etiket: "Açık Alanlar", emoji: "🌳", renk: "#84cc16" },
  diger: { etiket: "Diğer", emoji: "📍", renk: "#9fb0d0" },
};
function kategoriMeta(k) {
  return KATEGORI_META[k] || KATEGORI_META.diger;
}

function usePannellumYukle() {
  const [hazir, setHazir] = useState(typeof window !== "undefined" && !!window.pannellum);
  useEffect(() => {
    if (typeof window === "undefined" || window.pannellum) { setHazir(true); return; }
    if (!document.querySelector(`link[href="${PANNELLUM_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = PANNELLUM_CSS;
      document.head.appendChild(link);
    }
    const mevcutScript = document.querySelector(`script[src="${PANNELLUM_JS}"]`);
    if (mevcutScript) {
      mevcutScript.addEventListener("load", () => setHazir(true));
      if (window.pannellum) setHazir(true);
      return;
    }
    const script = document.createElement("script");
    script.src = PANNELLUM_JS;
    script.async = true;
    script.onload = () => setHazir(true);
    document.body.appendChild(script);
  }, []);
  return hazir;
}

function PanoramaGoruntuleyici({ panoramalar }) {
  const kapRef = useRef(null);
  const viewerRef = useRef(null);
  const [aktifIdx, setAktifIdx] = useState(0);
  const hazir = usePannellumYukle();

  useEffect(() => {
    if (!hazir || !kapRef.current || panoramalar.length === 0) return;
    const sahneler = {};
    panoramalar.forEach((p, i) => {
      sahneler[`sahne${i}`] = { type: "equirectangular", panorama: p.url, title: p.baslik || "", autoLoad: true, compass: false };
    });
    const viewer = window.pannellum.viewer(kapRef.current, {
      default: { firstScene: "sahne0", sceneFadeDuration: 500 },
      scenes: sahneler,
      showZoomCtrl: true,
      showFullscreenCtrl: true,
      autoRotate: -2,
    });
    viewerRef.current = viewer;
    return () => { try { viewer.destroy(); } catch { /* zaten kapanmış olabilir */ } viewerRef.current = null; };
  }, [hazir, panoramalar]);

  function sahneGec(i) {
    setAktifIdx(i);
    if (viewerRef.current) viewerRef.current.loadScene(`sahne${i}`);
  }

  return (
    <div>
      <div style={{ position: "relative", width: "100%", height: "min(56vh, 460px)", borderRadius: 14, overflow: "hidden", background: "#0a1428" }}>
        <div ref={kapRef} style={{ width: "100%", height: "100%" }} />
        {!hazir && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(232,238,252,0.6)", fontSize: 13 }}>360° görüntüleyici yükleniyor…</div>
        )}
      </div>
      {panoramalar.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {panoramalar.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => sahneGec(i)}
              style={{
                fontSize: 11.5, fontWeight: 700, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
                color: aktifIdx === i ? "#0b1220" : "#e8eefc",
                background: aktifIdx === i ? "#ffbf5a" : "rgba(255,255,255,0.06)",
                border: `1px solid ${aktifIdx === i ? "#ffbf5a" : "rgba(255,255,255,0.14)"}`,
              }}
            >
              {p.baslik || `Nokta ${i + 1}`}
            </button>
          ))}
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 11, color: "rgba(232,238,252,0.45)" }}>Sürükleyerek etrafı izleyebilir, tekerlekle yakınlaştırabilirsin.</div>
    </div>
  );
}

function NormalGaleri({ fotograflar }) {
  const [buyukIdx, setBuyukIdx] = useState(null);
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
        {fotograflar.map((f, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setBuyukIdx(i)}
            style={{ padding: 0, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, overflow: "hidden", cursor: "pointer", background: "none" }}
          >
            <img src={f.url} alt={f.baslik || ""} style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }} />
          </button>
        ))}
      </div>
      {buyukIdx !== null && (
        <div
          onClick={() => setBuyukIdx(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(5,10,22,0.92)", zIndex: 50, display: "grid", placeItems: "center", padding: 24, cursor: "zoom-out" }}
        >
          <img src={fotograflar[buyukIdx].url} alt={fotograflar[buyukIdx].baslik || ""} style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 12, boxShadow: "0 30px 60px -20px rgba(0,0,0,0.8)" }} />
        </div>
      )}
    </>
  );
}

function DurakDetayi({ durak, onKapat }) {
  const meta = kategoriMeta(durak.kategori);
  const fotograflar = Array.isArray(durak.fotograflar) ? durak.fotograflar : [];
  const panoramalar = fotograflar.filter((f) => f.tip === "panorama");
  const normalFotolar = fotograflar.filter((f) => f.tip !== "panorama");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(5,10,22,0.85)", backdropFilter: "blur(6px)", zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onKapat}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(760px, 100%)", maxHeight: "92vh", overflowY: "auto",
          background: "linear-gradient(165deg, #101f3d 0%, #0a1428 60%)",
          border: "1px solid rgba(255,255,255,0.1)", borderTopLeftRadius: 22, borderTopRightRadius: 22,
          padding: "20px 22px 28px", color: "#e8eefc",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: `${meta.renk}22`, display: "grid", placeItems: "center", fontSize: 19, flex: "none" }}>{meta.emoji}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#f4f8ff" }}>{durak.baslik}</div>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: meta.renk, background: `${meta.renk}22`, padding: "2px 8px", borderRadius: 999 }}>{meta.etiket.toUpperCase()}</span>
            </div>
          </div>
          <button type="button" onClick={onKapat} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)", color: "#e8eefc", fontSize: 16, cursor: "pointer", flex: "none" }}>×</button>
        </div>

        {durak.aciklama && <div style={{ fontSize: 12.5, color: "rgba(232,238,252,0.65)", marginBottom: 14, lineHeight: 1.5 }}>{durak.aciklama}</div>}

        {durak.bina && (
          <Link
            href={`/kampus-haritasi`}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 14, fontSize: 11.5, fontWeight: 800, color: "#9cc4ff", textDecoration: "none", padding: "5px 10px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)" }}
          >
            🏫 {durak.bina.ad} — Kampüs Haritası'nda gör
          </Link>
        )}

        {panoramalar.length > 0 ? (
          <PanoramaGoruntuleyici panoramalar={panoramalar} />
        ) : normalFotolar.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", border: "1px dashed rgba(255,255,255,0.14)", borderRadius: 14, color: "rgba(232,238,252,0.45)", fontSize: 13 }}>Bu durak için henüz fotoğraf eklenmedi.</div>
        ) : null}

        {normalFotolar.length > 0 && (
          <div style={{ marginTop: panoramalar.length > 0 ? 18 : 0 }}>
            {panoramalar.length > 0 && <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", color: "rgba(232,238,252,0.5)", marginBottom: 8 }}>DİĞER FOTOĞRAFLAR</div>}
            <NormalGaleri fotograflar={normalFotolar} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function SanalTurPage() {
  const [duraklar, setDuraklar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleHref, setRoleHref] = useState("/");
  const [aktifKategori, setAktifKategori] = useState("hepsi");
  const [seciliDurak, setSeciliDurak] = useState(null);

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
      const isAcademician = session.user.email?.toLowerCase() !== "suko.crc06@gmail.com" && profile?.role === "academician";
      setRoleHref(isAcademician ? "/?role=faculty" : "/?role=student");

      const { data, error: err } = await supabase
        .from("kampus_sanal_tur_duraklari")
        .select("*, bina:kampus_binalar(id, ad)")
        .eq("aktif", true)
        .order("sira", { ascending: true })
        .order("created_at", { ascending: true });

      if (err) { setError("Sanal tur alınamadı: " + err.message); setLoading(false); return; }
      setDuraklar(data || []);
      setLoading(false);
    }
    init();
  }, []);

  const kategoriler = ["hepsi", ...Array.from(new Set(duraklar.map((d) => d.kategori)))];
  const gorunenDuraklar = aktifKategori === "hepsi" ? duraklar : duraklar.filter((d) => d.kategori === aktifKategori);

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(165deg, #0e1c38 0%, #0a1428 45%, #050a16 100%)", fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(8,14,28,0.72)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={roleHref} style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#9cc4ff", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#7fb2ff" }}>KAMPÜS YAŞAMI · SANAL TUR</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f4f8ff" }}>Kampüsü Keşfet</div>
          </div>
        </div>
        <Link href={roleHref} style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid rgba(127,178,255,0.35)", color: "#9cc4ff", background: "rgba(91,157,255,0.08)" }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(880px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        {error ? (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,138,92,0.1)", border: "1px solid rgba(255,138,92,0.3)", color: "#ffb59a", fontSize: 13, fontWeight: 600 }}>{error}</div>
        ) : loading ? (
          <p style={{ color: "rgba(232,238,252,0.6)" }}>Yükleniyor…</p>
        ) : duraklar.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", border: "1px dashed rgba(255,255,255,0.14)", borderRadius: 16, background: "rgba(255,255,255,0.03)", color: "rgba(232,238,252,0.5)", fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🧭</div>
            Henüz sanal tur durağı eklenmedi.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {kategoriler.map((k) => {
                const meta = k === "hepsi" ? { etiket: "Hepsi", emoji: "🧭", renk: "#9fb0d0" } : kategoriMeta(k);
                const secili = aktifKategori === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setAktifKategori(k)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
                      fontSize: 12, fontWeight: 700,
                      color: secili ? "#0b1220" : "#e8eefc",
                      background: secili ? meta.renk : "rgba(255,255,255,0.06)",
                      border: `1px solid ${secili ? meta.renk : "rgba(255,255,255,0.14)"}`,
                    }}
                  >
                    <span>{meta.emoji}</span>{meta.etiket}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
              {gorunenDuraklar.map((d) => {
                const meta = kategoriMeta(d.kategori);
                const fotograflar = Array.isArray(d.fotograflar) ? d.fotograflar : [];
                const kapak = fotograflar[0];
                const panoramaVar = fotograflar.some((f) => f.tip === "panorama");
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSeciliDurak(d)}
                    style={{
                      textAlign: "left", cursor: "pointer", padding: 0, border: `1px solid ${meta.renk}33`, borderRadius: 16,
                      overflow: "hidden", background: "rgba(255,255,255,0.045)", backdropFilter: "blur(10px)", color: "#e8eefc",
                    }}
                  >
                    <div style={{ position: "relative", width: "100%", height: 120, background: `${meta.renk}18` }}>
                      {kapak ? (
                        <img src={kapak.url} alt={d.baslik} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 30 }}>{meta.emoji}</div>
                      )}
                      {panoramaVar && (
                        <span style={{ position: "absolute", top: 8, right: 8, fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "#ffbf5a", color: "#3a2400" }}>360°</span>
                      )}
                    </div>
                    <div style={{ padding: "10px 12px" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#f4f8ff" }}>{d.baslik}</div>
                      <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.05em", color: meta.renk }}>{meta.etiket.toUpperCase()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>

      {seciliDurak && <DurakDetayi durak={seciliDurak} onKapat={() => setSeciliDurak(null)} />}
    </div>
  );
}
