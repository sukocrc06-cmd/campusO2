"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { KULUP_KATEGORILERI, KULUP_UYELIK_DURUM, KULUP_UNVANLARI } from "../../../lib/kulup-kategoriler";

function StatusBadge({ status }) {
  const s = KULUP_UYELIK_DURUM[status] || { label: status, color: "#5b6b85", bg: "#f5f8fc" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 11px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.color}33`,
      }}
    >
      <i style={{ width: 7, height: 7, borderRadius: "50%", background: s.color }} />
      {s.label}
    </span>
  );
}

const inputStyle = { height: 44, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 11, fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" };
const labelStyle = { display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 700, color: "#5b6b85" };

export default function AcademicianKuluplerPage() {
  const [userId, setUserId] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [kulupler, setKulupler] = useState([]); // danışmanlık yaptığı kulüpler
  const [activeKulupId, setActiveKulupId] = useState(null);
  const [uyelikler, setUyelikler] = useState([]);
  const [profileMap, setProfileMap] = useState({});
  const [uyeFilter, setUyeFilter] = useState("beklemede");

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ ad: "", aciklama: "", kategori: KULUP_KATEGORILERI[0], website_url: "" });
  const [createLogoFile, setCreateLogoFile] = useState(null);

  const [editForm, setEditForm] = useState({ ad: "", aciklama: "", kategori: "", website_url: "" });
  const [logoFile, setLogoFile] = useState(null);
  const [unvanTaslak, setUnvanTaslak] = useState({});

  async function loadKulupler(uid) {
    const { data, error: err } = await supabase
      .from("kulupler")
      .select("*")
      .eq("danisman_id", uid)
      .order("created_at", { ascending: false });
    if (err) {
      setError("Kulüp bilgisi alınamadı: " + err.message);
      return [];
    }
    setKulupler(data || []);
    return data || [];
  }

  async function loadUyelikler(kulupId) {
    const { data, error: err } = await supabase
      .from("kulup_uyelikleri")
      .select("*")
      .eq("kulup_id", kulupId)
      .order("created_at", { ascending: false });
    if (err) {
      setError("Üye listesi alınamadı: " + err.message);
      return;
    }
    const rows = data || [];
    setUyelikler(rows);
    const ids = Array.from(new Set(rows.map((r) => r.student_id)));
    if (ids.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      const map = {};
      (profiles || []).forEach((p) => { map[p.id] = p; });
      setProfileMap(map);
    } else {
      setProfileMap({});
    }
  }

  useEffect(() => {
    async function init() {
      if (!supabase) {
        setError("Kulüp veritabanı bağlantısı yapılandırılmamış.");
        setFetching(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Bu sayfa için akademisyen oturumu gereklidir.");
        setFetching(false);
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
      if (profile?.role !== "academician") {
        setError("Bu sayfa yalnız yetkili akademisyen hesabıyla kullanılabilir.");
        setFetching(false);
        return;
      }
      setUserId(session.user.id);
      const list = await loadKulupler(session.user.id);
      if (list.length) {
        setActiveKulupId(list[0].id);
        setEditForm({ ad: list[0].ad, aciklama: list[0].aciklama || "", kategori: list[0].kategori || KULUP_KATEGORILERI[0], website_url: list[0].website_url || "" });
        await loadUyelikler(list[0].id);
      }
      setFetching(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (!activeKulupId) return;
    const k = kulupler.find((x) => x.id === activeKulupId);
    if (k) setEditForm({ ad: k.ad, aciklama: k.aciklama || "", kategori: k.kategori || KULUP_KATEGORILERI[0], website_url: k.website_url || "" });
    loadUyelikler(activeKulupId);
  }, [activeKulupId]);

  const aktifKulup = useMemo(() => kulupler.find((k) => k.id === activeKulupId) || null, [kulupler, activeKulupId]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!createForm.ad.trim()) { setError("Kulüp adı zorunludur."); return; }
    setBusy(true); setError(""); setMessage("");
    const { data, error: err } = await supabase
      .from("kulupler")
      .insert([{ ad: createForm.ad.trim(), aciklama: createForm.aciklama.trim() || null, kategori: createForm.kategori, website_url: createForm.website_url.trim() || null, danisman_id: userId }])
      .select()
      .single();
    if (err) {
      setError("Kulüp oluşturulamadı: " + err.message);
      setBusy(false);
      return;
    }
    let logoUyari = "";
    if (createLogoFile) {
      const ext = createLogoFile.name.split(".").pop();
      const path = `${data.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("kulup-logolari").upload(path, createLogoFile, { upsert: true });
      if (upErr) {
        logoUyari = " (logo yüklenemedi: " + upErr.message + ")";
      } else {
        const { data: pub } = supabase.storage.from("kulup-logolari").getPublicUrl(path);
        await supabase.from("kulupler").update({ logo_url: pub.publicUrl }).eq("id", data.id);
      }
    }
    setMessage("Kulüp oluşturuldu." + logoUyari);
    setShowCreate(false);
    setCreateForm({ ad: "", aciklama: "", kategori: KULUP_KATEGORILERI[0], website_url: "" });
    setCreateLogoFile(null);
    const list = await loadKulupler(userId);
    setActiveKulupId(data.id);
    void list;
    setBusy(false);
  }

  async function handleBaskanYap(studentId) {
    if (!aktifKulup) return;
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("kulupler").update({ baskan_id: studentId }).eq("id", aktifKulup.id);
    if (err) { setError("Başkan atanamadı: " + err.message); setBusy(false); return; }
    const uyelik = uyelikler.find((u) => u.student_id === studentId && u.kulup_id === aktifKulup.id);
    if (uyelik && (uyelik.rol !== "yonetici" || uyelik.unvan !== "Başkan")) {
      await supabase.from("kulup_uyelikleri").update({ rol: "yonetici", unvan: "Başkan" }).eq("id", uyelik.id);
    }
    setMessage("Başkan atandı.");
    await loadKulupler(userId);
    await loadUyelikler(aktifKulup.id);
    setBusy(false);
  }

  async function handleUnvanKaydet(uyelikId) {
    const unvan = (unvanTaslak[uyelikId] || "").trim();
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("kulup_uyelikleri").update({ unvan: unvan || null }).eq("id", uyelikId);
    if (err) setError("Unvan kaydedilemedi: " + err.message);
    else { setMessage("Unvan güncellendi."); await loadUyelikler(activeKulupId); }
    setBusy(false);
  }

  async function handleEditSave(e) {
    e.preventDefault();
    if (!aktifKulup) return;
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase
      .from("kulupler")
      .update({ ad: editForm.ad.trim(), aciklama: editForm.aciklama.trim() || null, kategori: editForm.kategori, website_url: editForm.website_url.trim() || null })
      .eq("id", aktifKulup.id);
    if (err) setError("Güncellenemedi: " + err.message);
    else { setMessage("Kulüp bilgileri güncellendi."); await loadKulupler(userId); }
    setBusy(false);
  }

  async function handleLogoUpload() {
    if (!logoFile || !aktifKulup) return;
    setBusy(true); setError(""); setMessage("");
    const ext = logoFile.name.split(".").pop();
    const path = `${aktifKulup.id}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("kulup-logolari").upload(path, logoFile, { upsert: true });
    if (upErr) {
      setError("Logo yüklenemedi: " + upErr.message);
      setBusy(false);
      return;
    }
    const { data: pub } = supabase.storage.from("kulup-logolari").getPublicUrl(path);
    const { error: updErr } = await supabase.from("kulupler").update({ logo_url: pub.publicUrl }).eq("id", aktifKulup.id);
    if (updErr) setError("Logo kaydedilemedi: " + updErr.message);
    else { setMessage("Logo güncellendi."); setLogoFile(null); await loadKulupler(userId); }
    setBusy(false);
  }

  async function handleKarar(uyelikId, karar) {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("kulup_uyelikleri").update({ durum: karar }).eq("id", uyelikId);
    if (err) setError("Hata: " + err.message);
    else { setMessage(karar === "aktif" ? "Üyelik onaylandı." : "Üyelik reddedildi."); await loadUyelikler(activeKulupId); }
    setBusy(false);
  }

  async function handleYoneticiYap(uyelikId, mevcutRol) {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("kulup_uyelikleri").update({ rol: mevcutRol === "yonetici" ? "uye" : "yonetici" }).eq("id", uyelikId);
    if (err) setError("Hata: " + err.message);
    else { setMessage(mevcutRol === "yonetici" ? "Yönetici yetkisi kaldırıldı." : "Yönetici yetkisi verildi."); await loadUyelikler(activeKulupId); }
    setBusy(false);
  }

  const filtrelenmisUyeler = uyeFilter === "all" ? uyelikler : uyelikler.filter((u) => u.durum === uyeFilter);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg, #f5f8fc)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", color: "var(--ink, #0f1b33)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid var(--line, #e3ebf6)", background: "var(--white, #fff)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid var(--line, #e3ebf6)", background: "var(--bg, #f5f8fc)", color: "var(--blue-700, #175cd3)", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 820, letterSpacing: ".12em", color: "var(--blue-700, #175cd3)" }}>VOL 1-6 · KULÜPLER</div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.02em" }}>Kulüp Yönetimi</div>
          </div>
        </div>
        <Link href="/" className="button button-secondary" style={{ minHeight: 40, padding: "0 16px", fontSize: 13 }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(980px, 100%)", margin: "0 auto", padding: "28px 20px 60px" }}>
        {fetching ? (
          <p style={{ color: "var(--slate)", fontSize: 13 }}>Yükleniyor…</p>
        ) : !userId ? (
          <div style={{ padding: 20, borderRadius: 14, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13 }}>{error}</div>
        ) : (
          <>
            {kulupler.length === 0 ? (
              <section style={{ padding: 24, borderRadius: 18, border: "1px solid var(--line, #e3ebf6)", background: "var(--white, #fff)", boxShadow: "0 18px 45px -28px rgba(15,43,90,.28)", textAlign: "center" }}>
                <p style={{ color: "var(--slate)", fontSize: 13, marginBottom: 14 }}>Henüz danışmanlığını yaptığın bir kulüp yok.</p>
                <button type="button" onClick={() => setShowCreate(true)} className="button button-primary" style={{ minHeight: 44, padding: "0 20px" }}>Kulüp Oluştur</button>
              </section>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
                  {kulupler.length > 1 ? (
                    <select value={activeKulupId || ""} onChange={(e) => setActiveKulupId(e.target.value)} style={{ ...inputStyle, width: "auto", fontWeight: 700 }}>
                      {kulupler.map((k) => <option key={k.id} value={k.id}>{k.ad}</option>)}
                    </select>
                  ) : (
                    <h1 style={{ margin: 0, fontSize: 20 }}>{aktifKulup?.ad}</h1>
                  )}
                  <button type="button" onClick={() => setShowCreate((v) => !v)} style={{ minHeight: 38, padding: "0 14px", fontSize: 12, fontWeight: 700, borderRadius: 10, border: "1px solid #c7deff", background: "#fff", color: "#0e4bae", cursor: "pointer" }}>
                    + Yeni Kulüp
                  </button>
                </div>

                {showCreate && (
                  <form onSubmit={handleCreate} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 20, display: "grid", gap: 12, marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#175cd3" }}>Yeni kulüp oluştur</div>
                    <label style={labelStyle}>Kulüp adı *
                      <input style={inputStyle} required value={createForm.ad} onChange={(e) => setCreateForm((f) => ({ ...f, ad: e.target.value }))} placeholder="Örn. Fintech Kulübü" />
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                      <label style={labelStyle}>Kategori
                        <select style={inputStyle} value={createForm.kategori} onChange={(e) => setCreateForm((f) => ({ ...f, kategori: e.target.value }))}>
                          {KULUP_KATEGORILERI.map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </label>
                      <label style={labelStyle}>Kulübün kendi sitesi (opsiyonel)
                        <input style={inputStyle} value={createForm.website_url} onChange={(e) => setCreateForm((f) => ({ ...f, website_url: e.target.value }))} placeholder="https://ornekklup.vercel.app" />
                      </label>
                    </div>
                    <label style={labelStyle}>Açıklama
                      <textarea style={{ ...inputStyle, height: 80, padding: 12, resize: "vertical" }} value={createForm.aciklama} onChange={(e) => setCreateForm((f) => ({ ...f, aciklama: e.target.value }))} />
                    </label>
                    <label style={labelStyle}>Kulüp logosu (opsiyonel)
                      <input type="file" accept="image/*" onChange={(e) => setCreateLogoFile(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
                    </label>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button type="submit" disabled={busy} className="button button-primary" style={{ minHeight: 42, padding: "0 18px" }}>{busy ? "…" : "Oluştur"}</button>
                      <button type="button" onClick={() => setShowCreate(false)} style={{ minHeight: 42, padding: "0 18px", border: "1px solid #e3ebf6", background: "#fff", borderRadius: 11, cursor: "pointer" }}>Vazgeç</button>
                    </div>
                  </form>
                )}

                {error ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}
                {message ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#effbf6", border: "1px solid #bde5d5", color: "#0b5c42", fontSize: 13, fontWeight: 600 }}>{message}</div> : null}

                {aktifKulup && (
                  <>
                    <section style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 18, padding: 22, marginBottom: 20, display: "grid", gridTemplateColumns: "auto 1fr", gap: 20 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 88, height: 88, borderRadius: 16, border: "1px solid #e3ebf6", background: "#f5f8fc", display: "grid", placeItems: "center", overflow: "hidden" }}>
                          {aktifKulup.logo_url ? <img src={aktifKulup.logo_url} alt={aktifKulup.ad} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 30 }}>🎓</span>}
                        </div>
                        <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} style={{ fontSize: 11, width: 130 }} />
                        <button type="button" onClick={handleLogoUpload} disabled={!logoFile || busy} style={{ minHeight: 32, padding: "0 12px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #c7deff", background: "#fff", color: "#0e4bae", cursor: !logoFile || busy ? "not-allowed" : "pointer", opacity: !logoFile || busy ? 0.5 : 1 }}>
                          Logoyu Kaydet
                        </button>
                      </div>

                      <form onSubmit={handleEditSave} style={{ display: "grid", gap: 12 }}>
                        <label style={labelStyle}>Kulüp adı
                          <input style={inputStyle} value={editForm.ad} onChange={(e) => setEditForm((f) => ({ ...f, ad: e.target.value }))} />
                        </label>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                          <label style={labelStyle}>Kategori
                            <select style={inputStyle} value={editForm.kategori} onChange={(e) => setEditForm((f) => ({ ...f, kategori: e.target.value }))}>
                              {KULUP_KATEGORILERI.map((k) => <option key={k} value={k}>{k}</option>)}
                            </select>
                          </label>
                          <label style={labelStyle}>Kulübün kendi sitesi
                            <input style={inputStyle} value={editForm.website_url} onChange={(e) => setEditForm((f) => ({ ...f, website_url: e.target.value }))} placeholder="https://ornekklup.vercel.app" />
                          </label>
                        </div>
                        <label style={labelStyle}>Açıklama
                          <textarea style={{ ...inputStyle, height: 70, padding: 12, resize: "vertical" }} value={editForm.aciklama} onChange={(e) => setEditForm((f) => ({ ...f, aciklama: e.target.value }))} />
                        </label>
                        <button type="submit" disabled={busy} className="button button-primary" style={{ minHeight: 42, padding: "0 18px", width: "fit-content" }}>{busy ? "…" : "Bilgileri Kaydet"}</button>
                      </form>
                    </section>

                    <section style={{ padding: 18, borderRadius: 16, border: "1px solid #c7deff", background: "#f4f8ff", marginBottom: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#0e4bae", marginBottom: 8 }}>YÖNETİM KURULU</div>
                      {(() => {
                        const kurul = uyelikler.filter((u) => u.durum === "aktif" && (u.rol === "yonetici" || u.unvan));
                        if (kurul.length === 0) return <div style={{ fontSize: 12.5, color: "#5b6b85" }}>Henüz kurul üyesi atanmadı. Aşağıdaki üye listesinden "Başkan Yap" veya unvan atayarak kurulu oluşturabilirsin.</div>;
                        const sirali = [...kurul].sort((a, b) => (a.unvan === "Başkan" ? -1 : b.unvan === "Başkan" ? 1 : 0));
                        return (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {sirali.map((u) => (
                              <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#fff", border: "1px solid #c7deff", fontSize: 12 }}>
                                <b>{profileMap[u.student_id]?.full_name || profileMap[u.student_id]?.email || "Üye"}</b>
                                <span style={{ color: "#0e4bae", fontWeight: 700 }}>{u.unvan || "Yönetici"}</span>
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </section>

                    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                      {[{ id: "beklemede", label: "Bekleyenler" }, { id: "aktif", label: "Aktif Üyeler" }, { id: "all", label: "Tümü" }].map((f) => (
                        <button key={f.id} type="button" onClick={() => setUyeFilter(f.id)} style={{ padding: "9px 16px", borderRadius: 999, border: uyeFilter === f.id ? "1px solid #175cd3" : "1px solid #e3ebf6", background: uyeFilter === f.id ? "#175cd3" : "#fff", color: uyeFilter === f.id ? "#fff" : "#5b6b85", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <section style={{ padding: 22, borderRadius: 18, border: "1px solid var(--line, #e3ebf6)", background: "#fff", boxShadow: "0 18px 45px -28px rgba(15,43,90,.28)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                        <h2 style={{ margin: 0, fontSize: 16 }}>Üyeler</h2>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>{filtrelenmisUyeler.length} kayıt</span>
                      </div>
                      {filtrelenmisUyeler.length === 0 ? (
                        <div style={{ display: "grid", placeItems: "center", minHeight: 100, border: "1px dashed var(--line)", borderRadius: 14, background: "var(--bg)", color: "var(--muted)", fontSize: 13 }}>Kayıt bulunamadı.</div>
                      ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                          {filtrelenmisUyeler.map((u) => {
                            const p = profileMap[u.student_id];
                            const baskanMi = aktifKulup.baskan_id === u.student_id;
                            return (
                              <div key={u.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", border: baskanMi ? "1px solid #ffd58a" : "1px solid #e3ebf6", borderRadius: 12 }}>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                                    {p?.full_name || p?.email || `${u.student_id?.slice(0, 8)}…`}
                                    {baskanMi && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: "#c65d1f", background: "#fff4e0", padding: "2px 8px", borderRadius: 999 }}>📌 BAŞKAN</span>}
                                    {!baskanMi && u.rol === "yonetici" && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: "#175cd3", background: "#e6f0ff", padding: "2px 8px", borderRadius: 999 }}>{u.unvan || "YÖNETİCİ"}</span>}
                                  </div>
                                  {u.motivasyon ? <div style={{ fontSize: 12, color: "#5b6b85", marginTop: 4, maxWidth: 420 }}>{u.motivasyon}</div> : null}
                                  {u.ilgi_alani ? <div style={{ fontSize: 11.5, color: "#0e4bae", marginTop: 3, maxWidth: 420 }}>İlgi alanı: {u.ilgi_alani}</div> : null}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                  <StatusBadge status={u.durum} />
                                  {u.durum === "beklemede" && (
                                    <>
                                      <button onClick={() => handleKarar(u.id, "aktif")} disabled={busy} className="button button-primary" style={{ minHeight: 34, padding: "0 12px", fontSize: 12 }}>Onayla</button>
                                      <button onClick={() => handleKarar(u.id, "reddedildi")} disabled={busy} style={{ minHeight: 34, padding: "0 12px", fontSize: 12, fontWeight: 700, borderRadius: 10, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", cursor: "pointer" }}>Reddet</button>
                                    </>
                                  )}
                                  {u.durum === "aktif" && (
                                    <>
                                      <select
                                        value={unvanTaslak[u.id] ?? (u.unvan || "")}
                                        onChange={(e) => setUnvanTaslak((prev) => ({ ...prev, [u.id]: e.target.value }))}
                                        style={{ height: 34, fontSize: 11.5, borderRadius: 8, border: "1px solid #e3ebf6", padding: "0 6px" }}
                                      >
                                        <option value="">— Unvan yok —</option>
                                        {KULUP_UNVANLARI.map((unvan) => <option key={unvan} value={unvan}>{unvan}</option>)}
                                      </select>
                                      <button onClick={() => handleUnvanKaydet(u.id)} disabled={busy} style={{ minHeight: 34, padding: "0 10px", fontSize: 11.5, fontWeight: 700, borderRadius: 8, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", cursor: "pointer" }}>Unvanı Kaydet</button>
                                      <button onClick={() => handleYoneticiYap(u.id, u.rol)} disabled={busy} style={{ minHeight: 34, padding: "0 12px", fontSize: 12, fontWeight: 700, borderRadius: 10, border: "1px solid #c7deff", background: "#fff", color: "#0e4bae", cursor: "pointer" }}>
                                        {u.rol === "yonetici" ? "Yöneticilikten Al" : "Yönetici Yap"}
                                      </button>
                                      {!baskanMi && (
                                        <button onClick={() => handleBaskanYap(u.student_id)} disabled={busy} style={{ minHeight: 34, padding: "0 12px", fontSize: 12, fontWeight: 700, borderRadius: 10, border: "1px solid #ffd58a", background: "#fff8eb", color: "#c65d1f", cursor: "pointer" }}>
                                          Başkan Yap
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  </>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
