"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { KULUP_KATEGORILERI } from "../../../lib/kulup-kategoriler";

const inputStyle = { height: 42, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 11, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
const labelStyle = { display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 700, color: "#5b6b85" };

export default function AdminKuluplerPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [kulupler, setKulupler] = useState([]);
  const [uyelikler, setUyelikler] = useState([]);
  const [akademisyenler, setAkademisyenler] = useState([]);
  const [profileMap, setProfileMap] = useState({});

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ ad: "", aciklama: "", kategori: KULUP_KATEGORILERI[0], website_url: "", danisman_id: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ ad: "", aciklama: "", kategori: "", website_url: "", danisman_id: "" });

  async function loadAll() {
    const [{ data: kData, error: kErr }, { data: uData, error: uErr }, { data: aData }] = await Promise.all([
      supabase.from("kulupler").select("*").order("created_at", { ascending: false }),
      supabase.from("kulup_uyelikleri").select("*"),
      supabase.from("profiles").select("id, full_name, email").eq("role", "academician"),
    ]);
    if (kErr) setError("Kulüpler alınamadı: " + kErr.message);
    else setKulupler(kData || []);
    if (uErr) setError((prev) => prev || "Üyelikler alınamadı: " + uErr.message);
    else setUyelikler(uData || []);
    setAkademisyenler(aData || []);

    const ilgiliIds = Array.from(new Set((kData || []).flatMap((k) => [k.danisman_id, k.baskan_id]).filter(Boolean)));
    if (ilgiliIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ilgiliIds);
      const map = {};
      (profiles || []).forEach((p) => { map[p.id] = p; });
      setProfileMap(map);
    }
  }

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Kulüp veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email?.toLowerCase() !== "suko.crc06@gmail.com") {
        setError("Bu sayfa yalnız yetkili yönetici hesabıyla kullanılabilir.");
        setLoading(false);
        return;
      }
      await loadAll();
      setLoading(false);
    }
    init();
  }, []);

  const stats = useMemo(() => {
    const aktif = uyelikler.filter((u) => u.durum === "aktif");
    const bekleyen = uyelikler.filter((u) => u.durum === "beklemede");
    const kategoriDagilimi = {};
    kulupler.forEach((k) => { const kat = k.kategori || "Diğer"; kategoriDagilimi[kat] = (kategoriDagilimi[kat] || 0) + 1; });
    return { toplamKulup: kulupler.length, aktifUye: aktif.length, bekleyen: bekleyen.length, kategoriDagilimi };
  }, [kulupler, uyelikler]);

  function uyeSayisi(kulupId) {
    return uyelikler.filter((u) => u.kulup_id === kulupId && u.durum === "aktif").length;
  }
  function bekleyenSayisi(kulupId) {
    return uyelikler.filter((u) => u.kulup_id === kulupId && u.durum === "beklemede").length;
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!createForm.ad.trim()) { setError("Kulüp adı zorunludur."); return; }
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("kulupler").insert([{
      ad: createForm.ad.trim(),
      aciklama: createForm.aciklama.trim() || null,
      kategori: createForm.kategori,
      website_url: createForm.website_url.trim() || null,
      danisman_id: createForm.danisman_id || null,
    }]);
    if (err) setError("Kulüp oluşturulamadı: " + err.message);
    else {
      setMessage("Kulüp oluşturuldu.");
      setShowCreate(false);
      setCreateForm({ ad: "", aciklama: "", kategori: KULUP_KATEGORILERI[0], website_url: "", danisman_id: "" });
      await loadAll();
    }
    setBusy(false);
  }

  function startEdit(k) {
    setEditingId(k.id);
    setEditForm({ ad: k.ad, aciklama: k.aciklama || "", kategori: k.kategori || KULUP_KATEGORILERI[0], website_url: k.website_url || "", danisman_id: k.danisman_id || "" });
  }

  async function handleEditSave(id) {
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("kulupler").update({
      ad: editForm.ad.trim(),
      aciklama: editForm.aciklama.trim() || null,
      kategori: editForm.kategori,
      website_url: editForm.website_url.trim() || null,
      danisman_id: editForm.danisman_id || null,
    }).eq("id", id);
    if (err) setError("Güncellenemedi: " + err.message);
    else { setMessage("Kulüp güncellendi."); setEditingId(null); await loadAll(); }
    setBusy(false);
  }

  async function handleDelete(id, ad) {
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("kulupler").delete().eq("id", id);
    if (err) setError("Silinemedi: " + err.message);
    else { setMessage(`"${ad}" kulübü silindi.`); await loadAll(); }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg, #f5f8fc)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", color: "var(--ink, #0f1b33)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid var(--line, #e3ebf6)", background: "var(--white, #fff)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid var(--line, #e3ebf6)", background: "var(--bg, #f5f8fc)", color: "var(--blue-700, #175cd3)", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 820, letterSpacing: ".12em", color: "var(--blue-700, #175cd3)" }}>VOL 1-6 · KULÜPLER</div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.02em" }}>Kulüp Yönetimi (Admin)</div>
          </div>
        </div>
        <Link href="/" className="button button-secondary" style={{ minHeight: 40, padding: "0 16px", fontSize: 13 }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(1080px, 100%)", margin: "0 auto", padding: "28px 20px 60px" }}>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 }}>
          <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "#fff" }}>
            <small style={{ color: "var(--muted)", fontSize: 11 }}>Toplam kulüp</small>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{stats.toplamKulup}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "#fff" }}>
            <small style={{ color: "var(--muted)", fontSize: 11 }}>Aktif üyelik</small>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: "#22b879" }}>{stats.aktifUye}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "#fff" }}>
            <small style={{ color: "var(--muted)", fontSize: 11 }}>Onay bekleyen</small>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: "#ffb13b" }}>{stats.bekleyen}</div>
          </div>
        </section>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Kulüpler</h2>
          <button type="button" onClick={() => setShowCreate((v) => !v)} className="button button-primary" style={{ minHeight: 40, padding: "0 16px", fontSize: 13 }}>
            {showCreate ? "Vazgeç" : "+ Yeni Kulüp"}
          </button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 20, display: "grid", gap: 12, marginBottom: 20 }}>
            <label style={labelStyle}>Kulüp adı *
              <input style={inputStyle} required value={createForm.ad} onChange={(e) => setCreateForm((f) => ({ ...f, ad: e.target.value }))} placeholder="Örn. Fintech Kulübü" />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <label style={labelStyle}>Kategori
                <select style={inputStyle} value={createForm.kategori} onChange={(e) => setCreateForm((f) => ({ ...f, kategori: e.target.value }))}>
                  {KULUP_KATEGORILERI.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
              <label style={labelStyle}>Danışman akademisyen
                <select style={inputStyle} value={createForm.danisman_id} onChange={(e) => setCreateForm((f) => ({ ...f, danisman_id: e.target.value }))}>
                  <option value="">— Atanmadı —</option>
                  {akademisyenler.map((a) => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
                </select>
              </label>
              <label style={labelStyle}>Kulübün kendi sitesi
                <input style={inputStyle} value={createForm.website_url} onChange={(e) => setCreateForm((f) => ({ ...f, website_url: e.target.value }))} placeholder="https://ornekklup.vercel.app" />
              </label>
            </div>
            <label style={labelStyle}>Açıklama
              <textarea style={{ ...inputStyle, height: 80, padding: 12, resize: "vertical" }} value={createForm.aciklama} onChange={(e) => setCreateForm((f) => ({ ...f, aciklama: e.target.value }))} />
            </label>
            <button type="submit" disabled={busy} className="button button-primary" style={{ minHeight: 42, padding: "0 18px", width: "fit-content" }}>{busy ? "…" : "Oluştur"}</button>
          </form>
        )}

        {error ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}
        {message ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#effbf6", border: "1px solid #bde5d5", color: "#0b5c42", fontSize: 13, fontWeight: 600 }}>{message}</div> : null}

        {loading ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Yükleniyor…</p>
        ) : kulupler.length === 0 ? (
          <div style={{ display: "grid", placeItems: "center", minHeight: 120, border: "1px dashed var(--line)", borderRadius: 14, background: "var(--bg)", color: "var(--muted)", fontSize: 13 }}>Henüz kulüp yok.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {kulupler.map((k) => (
              <div key={k.id} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: 18 }}>
                {editingId === k.id ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    <label style={labelStyle}>Kulüp adı
                      <input style={inputStyle} value={editForm.ad} onChange={(e) => setEditForm((f) => ({ ...f, ad: e.target.value }))} />
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                      <label style={labelStyle}>Kategori
                        <select style={inputStyle} value={editForm.kategori} onChange={(e) => setEditForm((f) => ({ ...f, kategori: e.target.value }))}>
                          {KULUP_KATEGORILERI.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </label>
                      <label style={labelStyle}>Danışman
                        <select style={inputStyle} value={editForm.danisman_id} onChange={(e) => setEditForm((f) => ({ ...f, danisman_id: e.target.value }))}>
                          <option value="">— Atanmadı —</option>
                          {akademisyenler.map((a) => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
                        </select>
                      </label>
                      <label style={labelStyle}>Site
                        <input style={inputStyle} value={editForm.website_url} onChange={(e) => setEditForm((f) => ({ ...f, website_url: e.target.value }))} />
                      </label>
                    </div>
                    <label style={labelStyle}>Açıklama
                      <textarea style={{ ...inputStyle, height: 70, padding: 12, resize: "vertical" }} value={editForm.aciklama} onChange={(e) => setEditForm((f) => ({ ...f, aciklama: e.target.value }))} />
                    </label>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button type="button" onClick={() => handleEditSave(k.id)} disabled={busy} className="button button-primary" style={{ minHeight: 40, padding: "0 16px", fontSize: 13 }}>{busy ? "…" : "Kaydet"}</button>
                      <button type="button" onClick={() => setEditingId(null)} style={{ minHeight: 40, padding: "0 16px", fontSize: 13, border: "1px solid #e3ebf6", background: "#fff", borderRadius: 11, cursor: "pointer" }}>Vazgeç</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ width: 56, height: 56, flex: "none", borderRadius: 14, border: "1px solid #e3ebf6", background: "#f5f8fc", display: "grid", placeItems: "center", overflow: "hidden" }}>
                      {k.logo_url ? <img src={k.logo_url} alt={k.ad} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 20 }}>🎓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 800, fontSize: 15 }}>{k.ad}</div>
                        {k.kategori ? <span style={{ fontSize: 10, fontWeight: 700, color: "#175cd3", background: "#e6f0ff", padding: "3px 9px", borderRadius: 999 }}>{k.kategori}</span> : null}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 6 }}>
                        Danışman: {profileMap[k.danisman_id]?.full_name || profileMap[k.danisman_id]?.email || "Atanmadı"}
                        {" · "}Başkan: {k.baskan_id ? (profileMap[k.baskan_id]?.full_name || profileMap[k.baskan_id]?.email || "—") : "Atanmadı"}
                        {" · "}{uyeSayisi(k.id)} aktif üye
                        {bekleyenSayisi(k.id) > 0 ? ` · ${bekleyenSayisi(k.id)} bekleyen` : ""}
                      </div>
                      {k.website_url ? <a href={k.website_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 6, fontSize: 12, color: "#175cd3", fontWeight: 700, textDecoration: "none" }}>Kulübün kendi sitesi ↗</a> : null}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <button type="button" onClick={() => startEdit(k)} style={{ minHeight: 36, padding: "0 14px", fontSize: 12, fontWeight: 700, borderRadius: 10, border: "1px solid #c7deff", background: "#fff", color: "#0e4bae", cursor: "pointer" }}>Düzenle</button>
                      <button type="button" onClick={() => handleDelete(k.id, k.ad)} disabled={busy} style={{ minHeight: 36, padding: "0 14px", fontSize: 12, fontWeight: 700, borderRadius: 10, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", cursor: "pointer" }}>Sil</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
