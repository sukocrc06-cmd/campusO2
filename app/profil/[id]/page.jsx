"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { heroGradient, ROL_ETIKET } from "../../../lib/profil-secenekleri";

function baslangicHarfi(isim) {
  return (isim || "?").trim().charAt(0).toUpperCase() || "?";
}

export default function PublicProfilPage() {
  const params = useParams();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profil, setProfil] = useState(null);
  const [kendiId, setKendiId] = useState(null);

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Bu sayfayı görmek için giriş yapmalısın."); setLoading(false); return; }
      setKendiId(session.user.id);

      const { data, error: err } = await supabase.rpc("campuso_get_profil", { p_user_id: id });
      if (err) { setError("Profil alınamadı: " + err.message); setLoading(false); return; }
      const kayit = Array.isArray(data) ? data[0] : data;
      if (!kayit) { setError("Bu kullanıcıya ait bir profil bulunamadı."); setLoading(false); return; }
      setProfil(kayit);
      setLoading(false);
    }
    if (id) init();
  }, [id]);

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>VOL 1-10 · PROFİL</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Kampüs Profili</div>
          </div>
        </div>
        {kendiId === id && (
          <Link href="/profil" style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid #c7deff", color: "#0e4bae" }}>Profilimi düzenle</Link>
        )}
      </header>

      <main style={{ width: "min(700px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        {loading ? (
          <p style={{ color: "#5b6b85" }}>Yükleniyor…</p>
        ) : !profil ? (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div>
        ) : (
          <section style={{ borderRadius: 20, overflow: "hidden", boxShadow: "0 18px 45px -28px rgba(15,43,90,.35)" }}>
            <div style={{ height: 150, background: heroGradient(profil.hero_renk) }} />
            <div style={{ background: "#fff", padding: "0 26px 26px", position: "relative" }}>
              <div style={{ width: 104, height: 104, borderRadius: "50%", border: "4px solid #fff", background: "#e6f0ff", marginTop: -52, display: "grid", placeItems: "center", overflow: "hidden", boxShadow: "0 4px 14px rgba(15,43,90,.18)" }}>
                {profil.avatar_url ? (
                  <img src={profil.avatar_url} alt={profil.full_name || "Profil"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 36, fontWeight: 800, color: "#175cd3" }}>{baslangicHarfi(profil.full_name)}</span>
                )}
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 21, fontWeight: 800 }}>{profil.full_name || "İsimsiz kullanıcı"}</div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#175cd3", background: "#e6f0ff", padding: "3px 9px", borderRadius: 999 }}>{ROL_ETIKET[profil.role] || profil.role}</span>
                </div>
                <div style={{ fontSize: 13, color: "#5b6b85", marginTop: 6 }}>
                  {[profil.bolum, profil.sinif && (profil.role === "student" ? `${profil.sinif}. sınıf` : profil.sinif)].filter(Boolean).join(" · ")}
                </div>
                {profil.bio ? <p style={{ fontSize: 14, color: "#334155", marginTop: 14, lineHeight: 1.65 }}>{profil.bio}</p> : null}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
