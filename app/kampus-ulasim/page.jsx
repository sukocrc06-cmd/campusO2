"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

// Kampüs Yaşamı > Ulaşım (3.2). AYBÜ'nün resmi sitesinde ring/servis
// saatleri için otomatik senkronize edilebilecek bir kaynak yok — bu yüzden
// veri admin panelinden (/admin/kampus-ulasim) elle giriliyor. Bu sayfa o
// veriyi öğrencilere/akademisyenlere gösteriyor.
const TIP_META = {
  ring: { etiket: "Ring", emoji: "🚌", renk: "#175cd3", zemin: "#eaf1ff", kenar: "#c7deff" },
  servis: { etiket: "Servis", emoji: "🚐", renk: "#0b8a5c", zemin: "#e9faf1", kenar: "#a9e8c8" },
  ego: { etiket: "EGO Otobüs", emoji: "🚍", renk: "#b0521f", zemin: "#fdf0e6", kenar: "#f3cda3" },
  diger: { etiket: "Diğer", emoji: "🚏", renk: "#5b6b85", zemin: "#f4f6fa", kenar: "#e3ebf6" },
};
function tipMeta(tip) {
  return TIP_META[tip] || TIP_META.diger;
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
              return (
                <section
                  key={h.id}
                  style={{
                    background: "#fff",
                    border: `1px solid ${meta.kenar}`,
                    borderRadius: 18,
                    padding: "20px 22px",
                    boxShadow: "0 10px 24px -18px rgba(15,27,51,0.25)",
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

                  {Array.isArray(h.duraklar) && h.duraklar.length > 0 && (
                    <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                      {h.duraklar.map((d, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 11, background: meta.zemin }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{d.ad}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: meta.renk, textAlign: "right" }}>
                            {d.saatler?.length ? d.saatler.join(" · ") : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

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
