"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { heroGradient, ROL_ETIKET } from "../../../lib/profil-secenekleri";

const inputStyle = { height: 42, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 11, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };

function baslangicHarfi(isim) {
  return (isim || "?").trim().charAt(0).toUpperCase() || "?";
}

export default function AdminProfillerPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [arama, setArama] = useState("");
  const [profiller, setProfiller] = useState([]);
  const zamanlayici = useRef(null);

  async function loadProfiller(aramaMetni) {
    let query = supabase.from("profiles").select("id, email, full_name, role, avatar_url, hero_renk, bolum, sinif, numara").order("full_name", { ascending: true }).limit(60);
    if (aramaMetni) query = query.or(`full_name.ilike.%${aramaMetni}%,email.ilike.%${aramaMetni}%`);
    const { data, error: err } = await query;
    if (err) setError("Profiller alınamadı: " + err.message);
    else setProfiller(data || []);
  }

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email?.toLowerCase() !== "suko.crc06@gmail.com") {
        setError("Bu sayfa yalnız yetkili yönetici hesabıyla kullanılabilir.");
        setLoading(false);
        return;
      }
      await loadProfiller("");
      setLoading(false);
    }
    init();
  }, []);

  function handleAramaDegisti(value) {
    setArama(value);
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    zamanlayici.current = setTimeout(() => loadProfiller(value), 350);
  }

  async function handleFotoKaldir(id) {
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", id);
    if (err) setError("Kaldırılamadı: " + err.message);
    else { setMessage("Profil fotoğrafı kaldırıldı."); await loadProfiller(arama); }
    setBusy(false);
  }

  async function handleHeroSifirla(id) {
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("profiles").update({ hero_renk: "mavi" }).eq("id", id);
    if (err) setError("Sıfırlanamadı: " + err.message);
    else { setMessage("Hero rengi varsayılana döndürüldü."); await loadProfiller(arama); }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg, #f5f8fc)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", color: "var(--ink, #0f1b33)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid var(--line, #e3ebf6)", background: "var(--white, #fff)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid var(--line, #e3ebf6)", background: "var(--bg, #f5f8fc)", color: "var(--blue-700, #175cd3)", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 820, letterSpacing: ".12em", color: "var(--blue-700, #175cd3)" }}>VOL 1-10 · PROFİL</div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.02em" }}>Profil Yönetimi</div>
          </div>
        </div>
        <Link href="/" className="button button-secondary" style={{ minHeight: 40, padding: "0 16px", fontSize: 13 }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(900px, 100%)", margin: "0 auto", padding: "28px 20px 60px" }}>
        {loading ? (
          <p style={{ color: "var(--slate)", fontSize: 13 }}>Yükleniyor…</p>
        ) : error && profiller.length === 0 ? (
          <div style={{ padding: 20, borderRadius: 14, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13 }}>{error}</div>
        ) : (
          <>
            <input
              style={{ ...inputStyle, height: 46, marginBottom: 18, fontSize: 14 }}
              placeholder="İsim veya e-posta ile ara…"
              value={arama}
              onChange={(e) => handleAramaDegisti(e.target.value)}
            />

            {error ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}
            {message ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#effbf6", border: "1px solid #bde5d5", color: "#0b5c42", fontSize: 13, fontWeight: 600 }}>{message}</div> : null}

            <div style={{ display: "grid", gap: 10 }}>
              {profiller.map((p) => (
                <div key={p.id} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: 16, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", flex: "none", background: heroGradient(p.hero_renk), display: "grid", placeItems: "center", overflow: "hidden" }}>
                    {p.avatar_url ? <img src={p.avatar_url} alt={p.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>{baslangicHarfi(p.full_name || p.email)}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <b style={{ fontSize: 14 }}>{p.full_name || "İsimsiz"}</b>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#175cd3", background: "#e6f0ff", padding: "2px 8px", borderRadius: 999 }}>{ROL_ETIKET[p.role] || p.role}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--slate)", marginTop: 3 }}>
                      {p.email} {p.bolum ? `· ${p.bolum}` : ""} {p.sinif ? `· ${p.sinif}` : ""} {p.numara ? `· No: ${p.numara}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Link href={`/profil/${p.id}`} style={{ minHeight: 32, padding: "0 10px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #c7deff", background: "#fff", color: "#0e4bae", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Görüntüle</Link>
                    <button onClick={() => handleFotoKaldir(p.id)} disabled={busy || !p.avatar_url} style={{ minHeight: 32, padding: "0 10px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", cursor: "pointer", opacity: p.avatar_url ? 1 : 0.4 }}>Fotoğrafı Kaldır</button>
                    <button onClick={() => handleHeroSifirla(p.id)} disabled={busy} style={{ minHeight: 32, padding: "0 10px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", cursor: "pointer" }}>Hero'yu Sıfırla</button>
                  </div>
                </div>
              ))}
              {profiller.length === 0 && (
                <div style={{ display: "grid", placeItems: "center", minHeight: 100, border: "1px dashed var(--line)", borderRadius: 14, background: "var(--bg)", color: "var(--muted)", fontSize: 13 }}>Sonuç bulunamadı.</div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
