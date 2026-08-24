"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { HERO_PALETI, HERO_ANAHTARLARI, heroGradient, SINIF_SECENEKLERI, ROL_ETIKET } from "../../lib/profil-secenekleri";

const inputStyle = { height: 44, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 11, fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" };
const labelStyle = { display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 700, color: "#5b6b85" };

function baslangicHarfi(isim) {
  return (isim || "?").trim().charAt(0).toUpperCase() || "?";
}

export default function ProfilPage() {
  const [userId, setUserId] = useState(null);
  const [roleHref, setRoleHref] = useState("/");
  const [profil, setProfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({ full_name: "", bolum: "", sinif: "", numara: "", bio: "" });
  const [heroSecim, setHeroSecim] = useState("mavi");
  const [fotoFile, setFotoFile] = useState(null);

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }
      setUserId(session.user.id);

      const isAdmin = session.user.email?.toLowerCase() === "suko.crc06@gmail.com";
      const { data: p, error: err } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      if (err) { setError("Profil alınamadı: " + err.message); setLoading(false); return; }

      const etkinRol = isAdmin ? "admin" : (p?.role || "student");
      setRoleHref(etkinRol === "student" ? "/?role=student" : etkinRol === "academician" ? "/?role=faculty" : "/");

      setProfil({ ...p, role: etkinRol, email: session.user.email });
      setForm({
        full_name: p?.full_name || "",
        bolum: p?.bolum || "",
        sinif: p?.sinif || "",
        numara: p?.numara || "",
        bio: p?.bio || "",
      });
      setHeroSecim(p?.hero_renk || "mavi");
      setLoading(false);
    }
    init();
  }, []);

  async function handleKaydet(e) {
    e.preventDefault();
    if (!userId) return;
    if (form.bio.length > 280) { setError("Hakkımda yazısı en fazla 280 karakter olabilir."); return; }
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("profiles").update({
      full_name: form.full_name.trim() || null,
      bolum: form.bolum.trim() || null,
      sinif: form.sinif.trim() || null,
      numara: form.numara.trim() || null,
      bio: form.bio.trim() || null,
      hero_renk: heroSecim,
    }).eq("id", userId);
    if (err) setError("Kaydedilemedi: " + err.message);
    else {
      setMessage("Profilin güncellendi.");
      setProfil((prev) => ({ ...prev, ...form, hero_renk: heroSecim }));
    }
    setBusy(false);
  }

  async function handleFotoYukle() {
    if (!fotoFile || !userId) return;
    setBusy(true); setError(""); setMessage("");
    const ext = fotoFile.name.split(".").pop();
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("profil-fotograflari").upload(path, fotoFile, { upsert: true });
    if (upErr) { setError("Fotoğraf yüklenemedi: " + upErr.message); setBusy(false); return; }
    const { data: pub } = supabase.storage.from("profil-fotograflari").getPublicUrl(path);
    const { error: updErr } = await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", userId);
    if (updErr) setError("Fotoğraf kaydedilemedi: " + updErr.message);
    else { setMessage("Profil fotoğrafın güncellendi."); setFotoFile(null); setProfil((prev) => ({ ...prev, avatar_url: pub.publicUrl })); }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={roleHref} style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>VOL 1-10 · PROFİL</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Profilim</div>
          </div>
        </div>
        <Link href={roleHref} style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid #c7deff", color: "#0e4bae" }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(760px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        {loading ? (
          <p style={{ color: "#5b6b85" }}>Yükleniyor…</p>
        ) : !profil ? (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div>
        ) : (
          <>
            <section style={{ borderRadius: 20, overflow: "hidden", marginBottom: 46, boxShadow: "0 18px 45px -28px rgba(15,43,90,.35)" }}>
              <div style={{ height: 130, background: heroGradient(heroSecim) }} />
              <div style={{ background: "#fff", padding: "0 24px 20px", position: "relative" }}>
                <div style={{ width: 92, height: 92, borderRadius: "50%", border: "4px solid #fff", background: "#e6f0ff", marginTop: -46, display: "grid", placeItems: "center", overflow: "hidden", boxShadow: "0 4px 14px rgba(15,43,90,.18)" }}>
                  {profil.avatar_url ? (
                    <img src={profil.avatar_url} alt={profil.full_name || "Profil"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 32, fontWeight: 800, color: "#175cd3" }}>{baslangicHarfi(profil.full_name || profil.email)}</span>
                  )}
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 19, fontWeight: 800 }}>{form.full_name || profil.email}</div>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#175cd3", background: "#e6f0ff", padding: "3px 9px", borderRadius: 999 }}>{ROL_ETIKET[profil.role] || profil.role}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "#5b6b85", marginTop: 4 }}>
                    {[form.bolum, form.sinif && (profil.role === "student" ? `${form.sinif}. sınıf` : form.sinif), form.numara].filter(Boolean).join(" · ") || "Bölüm/sınıf bilgisi eklenmedi"}
                  </div>
                  {form.bio ? <p style={{ fontSize: 13, color: "#334155", marginTop: 10, lineHeight: 1.6 }}>{form.bio}</p> : null}
                </div>
              </div>
            </section>

            {error ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}
            {message ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#effbf6", border: "1px solid #bde5d5", color: "#0b5c42", fontSize: 13, fontWeight: 600 }}>{message}</div> : null}

            <section style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Profil fotoğrafı</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <input type="file" accept="image/*" onChange={(e) => setFotoFile(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
                <button type="button" onClick={handleFotoYukle} disabled={!fotoFile || busy} className="button button-primary" style={{ minHeight: 38, padding: "0 16px", fontSize: 12, opacity: !fotoFile || busy ? 0.5 : 1 }}>
                  {busy ? "…" : "Fotoğrafı Kaydet"}
                </button>
              </div>
            </section>

            <section style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Hero (kapak) rengi</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {HERO_ANAHTARLARI.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setHeroSecim(key)}
                    title={HERO_PALETI[key].label}
                    style={{
                      width: 44, height: 44, borderRadius: 12, border: heroSecim === key ? "3px solid #0f1b33" : "1px solid #e3ebf6",
                      background: HERO_PALETI[key].gradient, cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            </section>

            <form onSubmit={handleKaydet} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 20, display: "grid", gap: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>Bilgilerim</div>
              <label style={labelStyle}>Ad Soyad
                <input style={inputStyle} value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <label style={labelStyle}>Bölüm
                  <input style={inputStyle} value={form.bolum} onChange={(e) => setForm((f) => ({ ...f, bolum: e.target.value }))} placeholder="Örn. Bilgisayar Mühendisliği" />
                </label>
                {profil.role === "student" ? (
                  <label style={labelStyle}>Sınıf
                    <select style={inputStyle} value={form.sinif} onChange={(e) => setForm((f) => ({ ...f, sinif: e.target.value }))}>
                      <option value="">Seçiniz…</option>
                      {SINIF_SECENEKLERI.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                ) : (
                  <label style={labelStyle}>Unvan / Ek Bilgi
                    <input style={inputStyle} value={form.sinif} onChange={(e) => setForm((f) => ({ ...f, sinif: e.target.value }))} placeholder="Örn. Dr. Öğr. Üyesi" />
                  </label>
                )}
                <label style={labelStyle}>{profil.role === "student" ? "Öğrenci Numarası" : "Personel Numarası"}
                  <input style={inputStyle} value={form.numara} onChange={(e) => setForm((f) => ({ ...f, numara: e.target.value }))} />
                </label>
              </div>
              <label style={labelStyle}>
                Hakkımda <span style={{ fontWeight: 500, color: "#8fa0bc" }}>({form.bio.length}/280)</span>
                <textarea
                  style={{ ...inputStyle, height: 90, padding: 12, resize: "vertical" }}
                  maxLength={280}
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  placeholder="Kendini kısaca tanıt…"
                />
              </label>
              <button type="submit" disabled={busy} className="button button-primary" style={{ minHeight: 46, padding: "0 18px", fontSize: 14, width: "fit-content" }}>
                {busy ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
