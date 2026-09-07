"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

// Kampüs Yaşamı > Kampüs Hizmetleri (3.4: ATM'ler, Market/Kırtasiye, Spor
// Salonu, Medikal Servis, Cami, Kargo Noktaları). AYBÜ'nün resmi
// kaynaklarında bu hizmetlerin çoğunun (ATM konumu, market/kırtasiye
// işletmecisi, revir, cami/mescit, kargo noktası) somut bilgisi
// yayınlanmamış — Kampüs Haritası/Ulaşım/Sanal Tur'daki gibi admin
// panelinden (/admin/kampus-hizmetleri) elle girilen bir tablo (jsonb değil,
// düz tablo — her hizmet ayrı satır) kullanılıyor. Sadece doğrulanmış
// bilgilerle (Spor Salonu, Yemekhane/SKS, PDR) başlangıç verisi var; diğer
// kategoriler admin panelinden zamanla dolacak. Her hizmet opsiyonel olarak
// bir kampus_binalar kaydına bağlanabiliyor — bağlıysa "Haritada Gör" linki
// /kampus-haritasi?bina=<id> ile o binayı otomatik seçili açıyor.
const KATEGORI_META = {
  atm: { etiket: "ATM", emoji: "💳", renk: "#5b9dff" },
  market: { etiket: "Market / Kırtasiye", emoji: "🛒", renk: "#34d399" },
  spor: { etiket: "Spor Salonu", emoji: "🏋️", renk: "#f472b6" },
  medikal: { etiket: "Medikal Servis", emoji: "⛑️", renk: "#ff8a5c" },
  cami: { etiket: "Cami / Mescit", emoji: "🕌", renk: "#a78bfa" },
  kargo: { etiket: "Kargo Noktası", emoji: "📦", renk: "#ffbf5a" },
  yemekhane: { etiket: "Yemekhane / Kantin", emoji: "🍽️", renk: "#5be0c2" },
  diger: { etiket: "Diğer", emoji: "📍", renk: "#9fb0d0" },
};
function kategoriMeta(kategori) {
  return KATEGORI_META[kategori] || KATEGORI_META.diger;
}

function HizmetKarti({ hizmet, index, acikMi, onToggle }) {
  const meta = kategoriMeta(hizmet.kategori);
  return (
    <section
      style={{
        border: `1px solid ${acikMi ? meta.renk + "66" : "rgba(255,255,255,0.1)"}`,
        borderRadius: 16,
        background: "rgba(255,255,255,0.045)",
        backdropFilter: "blur(10px)",
        overflow: "hidden",
        opacity: 0,
        animation: `khBelir 0.5s ease ${(index * 0.07).toFixed(2)}s forwards`,
        transition: "border-color 0.25s ease",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12,
          padding: "16px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        <div
          style={{
            width: 40, height: 40, borderRadius: 12, flex: "none", display: "grid", placeItems: "center",
            fontSize: 19, background: `${meta.renk}22`, transition: "transform 0.25s ease", transform: acikMi ? "scale(1.08)" : "scale(1)",
          }}
        >
          {meta.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#f4f8ff" }}>{hizmet.baslik}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 3 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.04em", color: meta.renk, background: `${meta.renk}1e`, padding: "1px 8px", borderRadius: 999 }}>{meta.etiket.toUpperCase()}</span>
            {hizmet.konum_metni && <span style={{ fontSize: 11.5, color: "rgba(232,238,252,0.5)" }}>📍 {hizmet.konum_metni}</span>}
          </div>
        </div>
        <div
          style={{
            flex: "none", fontSize: 16, color: meta.renk, transition: "transform 0.25s ease",
            transform: acikMi ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ⌄
        </div>
      </button>

      <div
        style={{
          maxHeight: acikMi ? 320 : 0,
          opacity: acikMi ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.35s ease, opacity 0.25s ease",
        }}
      >
        <div style={{ padding: "0 18px 18px 18px" }}>
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 14 }} />
          {hizmet.aciklama && <div style={{ fontSize: 12.5, color: "rgba(232,238,252,0.8)", lineHeight: 1.55, marginBottom: 10 }}>{hizmet.aciklama}</div>}
          <div style={{ display: "grid", gap: 6, fontSize: 12, color: "rgba(232,238,252,0.65)" }}>
            {hizmet.calisma_saatleri && <div>🕒 <strong style={{ color: "#f4f8ff" }}>Çalışma saatleri:</strong> {hizmet.calisma_saatleri}</div>}
            {hizmet.iletisim && <div>☎️ <strong style={{ color: "#f4f8ff" }}>İletişim:</strong> {hizmet.iletisim}</div>}
          </div>
          {hizmet.bina && (
            <Link
              href={`/kampus-haritasi?bina=${hizmet.bina.id}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4, marginTop: 12,
                fontSize: 11.5, fontWeight: 800, color: meta.renk, textDecoration: "none",
                padding: "6px 12px", borderRadius: 999, background: `${meta.renk}18`, border: `1px solid ${meta.renk}55`,
              }}
            >
              🗺️ {hizmet.bina.ad} — Haritada Gör
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

export default function KampusHizmetleriPage() {
  const [hizmetler, setHizmetler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleHref, setRoleHref] = useState("/");
  const [acikId, setAcikId] = useState(null);
  const [kategoriFiltre, setKategoriFiltre] = useState("tumu");

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
        const isAcademician = session.user.email?.toLowerCase() !== "suko.crc06@gmail.com" && profile?.role === "academician";
        setRoleHref(isAcademician ? "/?role=faculty" : "/?role=student");
      }

      const { data, error: err } = await supabase
        .from("kampus_hizmetleri")
        .select("*, bina:kampus_binalar(id, ad)")
        .eq("aktif", true)
        .order("sira", { ascending: true })
        .order("created_at", { ascending: true });

      if (err) { setError("Kampüs hizmetleri alınamadı: " + err.message); setLoading(false); return; }
      setHizmetler(data || []);
      setLoading(false);
    }
    init();
  }, []);

  const mevcutKategoriler = [...new Set(hizmetler.map((h) => h.kategori))];
  const gosterilenler = kategoriFiltre === "tumu" ? hizmetler : hizmetler.filter((h) => h.kategori === kategoriFiltre);

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(165deg, #0e1c38 0%, #0a1428 45%, #050a16 100%)", fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <style>{`
        @keyframes khBelir {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(8,14,28,0.72)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={roleHref} style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#9cc4ff", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#7fb2ff" }}>KAMPÜS YAŞAMI · KAMPÜS HİZMETLERİ</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f4f8ff" }}>ATM, Market, Spor, Medikal, Cami, Kargo</div>
          </div>
        </div>
        <Link href={roleHref} style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid rgba(127,178,255,0.35)", color: "#9cc4ff", background: "rgba(91,157,255,0.08)" }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(880px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        <div style={{ fontSize: 12.5, color: "rgba(232,238,252,0.55)", marginBottom: 16, lineHeight: 1.6 }}>
          Kampüsteki günlük ihtiyaçlar için hizmet noktaları — konum, çalışma saati ve iletişim bilgisiyle. Bazı kategoriler henüz eklenmediyse, bu bilgi
          AYBÜ'nün resmi kaynaklarında da yayınlanmıyor demektir; zamanla admin tarafından güncel bilgiyle doldurulacak.
        </div>

        {error ? (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,138,92,0.1)", border: "1px solid rgba(255,138,92,0.3)", color: "#ffb59a", fontSize: 13, fontWeight: 600 }}>{error}</div>
        ) : loading ? (
          <p style={{ color: "rgba(232,238,252,0.6)" }}>Yükleniyor…</p>
        ) : hizmetler.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", border: "1px dashed rgba(255,255,255,0.14)", borderRadius: 16, background: "rgba(255,255,255,0.03)", color: "rgba(232,238,252,0.5)", fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🛎️</div>
            Henüz hizmet eklenmedi.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
              <button
                type="button"
                onClick={() => setKategoriFiltre("tumu")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999, cursor: "pointer",
                  fontSize: 12, fontWeight: 700, color: kategoriFiltre === "tumu" ? "#0b1220" : "#e8eefc",
                  background: kategoriFiltre === "tumu" ? "#9cc4ff" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${kategoriFiltre === "tumu" ? "#9cc4ff" : "rgba(255,255,255,0.14)"}`,
                }}
              >
                Tümü ({hizmetler.length})
              </button>
              {mevcutKategoriler.map((kat) => {
                const meta = kategoriMeta(kat);
                const secili = kategoriFiltre === kat;
                const sayi = hizmetler.filter((h) => h.kategori === kat).length;
                return (
                  <button
                    key={kat}
                    type="button"
                    onClick={() => setKategoriFiltre(secili ? "tumu" : kat)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999, cursor: "pointer",
                      fontSize: 12, fontWeight: 700, color: secili ? "#0b1220" : "#e8eefc",
                      background: secili ? meta.renk : "rgba(255,255,255,0.06)",
                      border: `1px solid ${secili ? meta.renk : "rgba(255,255,255,0.14)"}`,
                    }}
                  >
                    <span>{meta.emoji}</span>{meta.etiket} ({sayi})
                  </button>
                );
              })}
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", alignItems: "start" }}>
              {gosterilenler.map((h, i) => (
                <HizmetKarti key={h.id} hizmet={h} index={i} acikMi={acikId === h.id} onToggle={() => setAcikId(acikId === h.id ? null : h.id)} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
