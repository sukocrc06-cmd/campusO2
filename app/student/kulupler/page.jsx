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

export default function StudentKuluplerPage() {
  const [userId, setUserId] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("kulupler"); // kulupler | uyelikler | yonetim

  const [kulupler, setKulupler] = useState([]);
  const [uyelikler, setUyelikler] = useState([]); // kendi üyelikleri
  const [kategoriFilter, setKategoriFilter] = useState("all");
  const [motivasyonlar, setMotivasyonlar] = useState({}); // kulup_id -> metin
  const [ilgiAlanlari, setIlgiAlanlari] = useState({}); // kulup_id -> metin
  const [kurulMap, setKurulMap] = useState({}); // kulup_id -> [{student_id, full_name, unvan, rol}]

  const [yonetilenKulup, setYonetilenKulup] = useState(null);
  const [yonetimUyeler, setYonetimUyeler] = useState([]);
  const [profileMap, setProfileMap] = useState({});
  const [editForm, setEditForm] = useState({ ad: "", aciklama: "", kategori: "", website_url: "" });
  const [logoFile, setLogoFile] = useState(null);
  const [unvanTaslak, setUnvanTaslak] = useState({});

  async function loadKurul() {
    const { data } = await supabase.rpc("campuso_kulup_kurulu");
    const map = {};
    (data || []).forEach((row) => {
      map[row.kulup_id] = map[row.kulup_id] || [];
      map[row.kulup_id].push(row);
    });
    setKurulMap(map);
  }

  async function loadAll(uid) {
    const [{ data: kData, error: kErr }, { data: uData, error: uErr }] = await Promise.all([
      supabase.from("kulupler").select("*").order("ad", { ascending: true }),
      supabase.from("kulup_uyelikleri").select("*").eq("student_id", uid),
    ]);
    if (kErr) setError("Kulüpler alınamadı: " + kErr.message);
    else setKulupler(kData || []);
    if (uErr) setError((prev) => prev || "Üyelikler alınamadı: " + uErr.message);
    else setUyelikler(uData || []);
    await loadKurul();

    const yonetici = (uData || []).find((u) => u.rol === "yonetici" && u.durum === "aktif");
    if (yonetici) {
      const kulup = (kData || []).find((k) => k.id === yonetici.kulup_id);
      if (kulup) {
        setYonetilenKulup(kulup);
        setEditForm({ ad: kulup.ad, aciklama: kulup.aciklama || "", kategori: kulup.kategori || KULUP_KATEGORILERI[0], website_url: kulup.website_url || "" });
        await loadYonetimUyeler(kulup.id);
      }
    }
  }

  async function loadYonetimUyeler(kulupId) {
    const { data, error: err } = await supabase.from("kulup_uyelikleri").select("*").eq("kulup_id", kulupId).order("created_at", { ascending: false });
    if (err) { setError("Üye listesi alınamadı: " + err.message); return; }
    const rows = data || [];
    setYonetimUyeler(rows);
    const ids = Array.from(new Set(rows.map((r) => r.student_id)));
    if (ids.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      const map = {};
      (profiles || []).forEach((p) => { map[p.id] = p; });
      setProfileMap(map);
    }
  }

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Kulüp veritabanı bağlantısı yapılandırılmamış."); setFetching(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setFetching(false); return; }
      setUserId(session.user.id);
      await loadAll(session.user.id);
      setFetching(false);
    }
    init();
  }, []);

  const uyelikMap = useMemo(() => {
    const map = {};
    uyelikler.forEach((u) => { map[u.kulup_id] = u; });
    return map;
  }, [uyelikler]);

  const gorunenKulupler = kategoriFilter === "all" ? kulupler : kulupler.filter((k) => k.kategori === kategoriFilter);

  async function handleKatil(kulupId) {
    if (!userId) return;
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("kulup_uyelikleri").insert([{
      kulup_id: kulupId,
      student_id: userId,
      rol: "uye",
      durum: "beklemede",
      motivasyon: motivasyonlar[kulupId]?.trim() || null,
      ilgi_alani: ilgiAlanlari[kulupId]?.trim() || null,
    }]);
    if (err) setError("Başvuru gönderilemedi: " + err.message);
    else { setMessage("Başvurun gönderildi; kulüp yönetiminin onayını bekliyor."); await loadAll(userId); }
    setBusy(false);
  }

  async function handleBaskanYap(studentId) {
    if (!yonetilenKulup) return;
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("kulupler").update({ baskan_id: studentId }).eq("id", yonetilenKulup.id);
    if (err) { setError("Başkan atanamadı: " + err.message); setBusy(false); return; }
    const uyelik = yonetimUyeler.find((u) => u.student_id === studentId);
    if (uyelik && (uyelik.rol !== "yonetici" || uyelik.unvan !== "Başkan")) {
      await supabase.from("kulup_uyelikleri").update({ rol: "yonetici", unvan: "Başkan" }).eq("id", uyelik.id);
    }
    setMessage("Başkan atandı.");
    await loadAll(userId);
    setBusy(false);
  }

  async function handleUnvanKaydet(uyelikId) {
    const unvan = (unvanTaslak[uyelikId] || "").trim();
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("kulup_uyelikleri").update({ unvan: unvan || null }).eq("id", uyelikId);
    if (err) setError("Unvan kaydedilemedi: " + err.message);
    else { setMessage("Unvan güncellendi."); await loadYonetimUyeler(yonetilenKulup.id); }
    setBusy(false);
  }

  async function handleVazgec(uyelikId) {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("kulup_uyelikleri").delete().eq("id", uyelikId);
    if (err) setError("Hata: " + err.message);
    else { setMessage("Başvuru geri çekildi."); await loadAll(userId); }
    setBusy(false);
  }

  async function handleAyril(uyelikId) {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("kulup_uyelikleri").update({ durum: "ayrildi" }).eq("id", uyelikId);
    if (err) setError("Hata: " + err.message);
    else { setMessage("Kulüpten ayrıldın."); await loadAll(userId); }
    setBusy(false);
  }

  async function handleYonetimKaydet(e) {
    e.preventDefault();
    if (!yonetilenKulup) return;
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("kulupler").update({ ad: editForm.ad.trim(), aciklama: editForm.aciklama.trim() || null, kategori: editForm.kategori, website_url: editForm.website_url.trim() || null }).eq("id", yonetilenKulup.id);
    if (err) setError("Güncellenemedi: " + err.message);
    else { setMessage("Kulüp bilgileri güncellendi."); await loadAll(userId); }
    setBusy(false);
  }

  async function handleLogoUpload() {
    if (!logoFile || !yonetilenKulup) return;
    setBusy(true); setError(""); setMessage("");
    const ext = logoFile.name.split(".").pop();
    const path = `${yonetilenKulup.id}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("kulup-logolari").upload(path, logoFile, { upsert: true });
    if (upErr) { setError("Logo yüklenemedi: " + upErr.message); setBusy(false); return; }
    const { data: pub } = supabase.storage.from("kulup-logolari").getPublicUrl(path);
    const { error: updErr } = await supabase.from("kulupler").update({ logo_url: pub.publicUrl }).eq("id", yonetilenKulup.id);
    if (updErr) setError("Logo kaydedilemedi: " + updErr.message);
    else { setMessage("Logo güncellendi."); setLogoFile(null); await loadAll(userId); }
    setBusy(false);
  }

  async function handleYonetimKarar(uyelikId, karar) {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("kulup_uyelikleri").update({ durum: karar }).eq("id", uyelikId);
    if (err) setError("Hata: " + err.message);
    else { setMessage(karar === "aktif" ? "Üyelik onaylandı." : "Üyelik reddedildi."); await loadYonetimUyeler(yonetilenKulup.id); }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=student" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>VOL 1-6 · KULÜPLER</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Öğrenci Kulüpleri</div>
          </div>
        </div>
        <Link href="/?role=student" style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid #c7deff", color: "#0e4bae" }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(900px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
          {[
            { id: "kulupler", label: "Kulüpler" },
            { id: "uyelikler", label: `Üyeliklerim (${uyelikler.length})` },
            ...(yonetilenKulup ? [{ id: "yonetim", label: `${yonetilenKulup.ad} · Yönetim` }] : []),
          ].map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{ padding: "10px 16px", borderRadius: 999, border: tab === t.id ? "1px solid #175cd3" : "1px solid #e3ebf6", background: tab === t.id ? "#175cd3" : "#fff", color: tab === t.id ? "#fff" : "#5b6b85", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>

        {error ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}
        {message ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#effbf6", border: "1px solid #bde5d5", color: "#0b5c42", fontSize: 13, fontWeight: 600 }}>{message}</div> : null}

        {fetching ? (
          <p style={{ color: "#5b6b85" }}>Yükleniyor…</p>
        ) : (
          <>
            {tab === "kulupler" && (
              <div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  <button type="button" onClick={() => setKategoriFilter("all")} style={{ padding: "7px 14px", borderRadius: 999, border: kategoriFilter === "all" ? "1px solid #175cd3" : "1px solid #e3ebf6", background: kategoriFilter === "all" ? "#175cd3" : "#fff", color: kategoriFilter === "all" ? "#fff" : "#5b6b85", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>Tümü</button>
                  {KULUP_KATEGORILERI.map((k) => (
                    <button key={k} type="button" onClick={() => setKategoriFilter(k)} style={{ padding: "7px 14px", borderRadius: 999, border: kategoriFilter === k ? "1px solid #175cd3" : "1px solid #e3ebf6", background: kategoriFilter === k ? "#175cd3" : "#fff", color: kategoriFilter === k ? "#fff" : "#5b6b85", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>{k}</button>
                  ))}
                </div>

                {gorunenKulupler.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>Bu kategoride kulüp bulunamadı.</div>
                ) : (
                  <div style={{ display: "grid", gap: 14 }}>
                    {gorunenKulupler.map((k) => {
                      const uyelik = uyelikMap[k.id];
                      return (
                        <div key={k.id} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 18, display: "flex", gap: 16, flexWrap: "wrap" }}>
                          <div style={{ width: 60, height: 60, flex: "none", borderRadius: 14, border: "1px solid #e3ebf6", background: "#f5f8fc", display: "grid", placeItems: "center", overflow: "hidden" }}>
                            {k.logo_url ? <img src={k.logo_url} alt={k.ad} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 22 }}>🎓</span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <div style={{ fontWeight: 800, fontSize: 15 }}>{k.ad}</div>
                              {k.kategori ? <span style={{ fontSize: 10, fontWeight: 700, color: "#175cd3", background: "#e6f0ff", padding: "3px 9px", borderRadius: 999 }}>{k.kategori}</span> : null}
                            </div>
                            {k.aciklama ? <div style={{ fontSize: 12, color: "#5b6b85", marginTop: 6, lineHeight: 1.55 }}>{k.aciklama}</div> : null}
                            {k.website_url ? (
                              <a href={k.website_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 8, fontSize: 12, color: "#175cd3", fontWeight: 700, textDecoration: "none" }}>
                                Kulübün kendi sitesi ↗
                              </a>
                            ) : null}

                            {(kurulMap[k.id] || []).length > 0 && (
                              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {[...(kurulMap[k.id] || [])].sort((a, b) => (a.unvan === "Başkan" ? -1 : b.unvan === "Başkan" ? 1 : 0)).map((m) => (
                                  <span key={m.student_id} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, background: "#f5f8fc", border: "1px solid #e3ebf6", fontSize: 10.5 }}>
                                    <b>{m.full_name}</b>
                                    <span style={{ color: "#175cd3", fontWeight: 700 }}>{m.unvan || "Yönetici"}</span>
                                  </span>
                                ))}
                              </div>
                            )}

                            {!uyelik && (
                              <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#f5f8fc", border: "1px dashed #e3ebf6" }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: "#5b6b85", marginBottom: 8 }}>KATILIM FORMU</div>
                                <div style={{ display: "grid", gap: 8 }}>
                                  <textarea
                                    style={{ ...inputStyle, height: 56, padding: 10, resize: "vertical" }}
                                    placeholder="Neden katılmak istiyorsun? (opsiyonel)"
                                    value={motivasyonlar[k.id] || ""}
                                    onChange={(e) => setMotivasyonlar((m) => ({ ...m, [k.id]: e.target.value }))}
                                  />
                                  <input
                                    style={{ ...inputStyle, height: 38 }}
                                    placeholder="Hangi alanda katkı sağlamak istersin? (opsiyonel — örn. Etkinlik, Tasarım)"
                                    value={ilgiAlanlari[k.id] || ""}
                                    onChange={(e) => setIlgiAlanlari((m) => ({ ...m, [k.id]: e.target.value }))}
                                  />
                                  <button onClick={() => handleKatil(k.id)} disabled={busy} className="button button-primary" style={{ minHeight: 38, padding: "0 16px", fontSize: 12, width: "fit-content" }}>
                                    {busy ? "…" : "Başvuruyu Gönder"}
                                  </button>
                                </div>
                              </div>
                            )}
                            {uyelik && (
                              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                                <StatusBadge status={uyelik.durum} />
                                {uyelik.durum === "beklemede" && (
                                  <button onClick={() => handleVazgec(uyelik.id)} disabled={busy} style={{ minHeight: 32, padding: "0 12px", fontSize: 11, fontWeight: 700, borderRadius: 9, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", cursor: "pointer" }}>Başvuruyu Geri Çek</button>
                                )}
                                {uyelik.durum === "aktif" && (
                                  <button onClick={() => handleAyril(uyelik.id)} disabled={busy} style={{ minHeight: 32, padding: "0 12px", fontSize: 11, fontWeight: 700, borderRadius: 9, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", cursor: "pointer" }}>Kulüpten Ayrıl</button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === "uyelikler" && (
              <div>
                {uyelikler.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>
                    Henüz bir kulübe başvurmadın. <button type="button" onClick={() => setTab("kulupler")} style={{ border: "none", background: "none", color: "#175cd3", fontWeight: 700, cursor: "pointer" }}>Kulüplere göz at</button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {uyelikler.map((u) => {
                      const k = kulupler.find((x) => x.id === u.kulup_id);
                      return (
                        <div key={u.id} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 14, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 14 }}>{k?.ad || "Kulüp"}</div>
                            <div style={{ fontSize: 11, color: "#5b6b85", marginTop: 3 }}>{k?.kategori}</div>
                          </div>
                          <StatusBadge status={u.durum} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === "yonetim" && yonetilenKulup && (
              <div>
                <section style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 18, padding: 22, marginBottom: 20, display: "grid", gridTemplateColumns: "auto 1fr", gap: 20 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 88, height: 88, borderRadius: 16, border: "1px solid #e3ebf6", background: "#f5f8fc", display: "grid", placeItems: "center", overflow: "hidden" }}>
                      {yonetilenKulup.logo_url ? <img src={yonetilenKulup.logo_url} alt={yonetilenKulup.ad} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 30 }}>🎓</span>}
                    </div>
                    <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} style={{ fontSize: 11, width: 130 }} />
                    <button type="button" onClick={handleLogoUpload} disabled={!logoFile || busy} style={{ minHeight: 32, padding: "0 12px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #c7deff", background: "#fff", color: "#0e4bae", cursor: !logoFile || busy ? "not-allowed" : "pointer", opacity: !logoFile || busy ? 0.5 : 1 }}>
                      Logoyu Kaydet
                    </button>
                  </div>
                  <form onSubmit={handleYonetimKaydet} style={{ display: "grid", gap: 12 }}>
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
                    const kurul = yonetimUyeler.filter((u) => u.durum === "aktif" && (u.rol === "yonetici" || u.unvan));
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

                <section style={{ padding: 22, borderRadius: 18, border: "1px solid #e3ebf6", background: "#fff", boxShadow: "0 18px 45px -28px rgba(15,43,90,.28)" }}>
                  <h2 style={{ margin: "0 0 14px", fontSize: 16 }}>Üyeler</h2>
                  {yonetimUyeler.length === 0 ? (
                    <div style={{ display: "grid", placeItems: "center", minHeight: 100, border: "1px dashed #e3ebf6", borderRadius: 14, background: "#f5f8fc", color: "#8fa0bc", fontSize: 13 }}>Henüz üye yok.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {yonetimUyeler.map((u) => {
                        const p = profileMap[u.student_id];
                        const baskanMi = yonetilenKulup.baskan_id === u.student_id;
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
                                  <button onClick={() => handleYonetimKarar(u.id, "aktif")} disabled={busy} className="button button-primary" style={{ minHeight: 34, padding: "0 12px", fontSize: 12 }}>Onayla</button>
                                  <button onClick={() => handleYonetimKarar(u.id, "reddedildi")} disabled={busy} style={{ minHeight: 34, padding: "0 12px", fontSize: 12, fontWeight: 700, borderRadius: 10, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", cursor: "pointer" }}>Reddet</button>
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
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
