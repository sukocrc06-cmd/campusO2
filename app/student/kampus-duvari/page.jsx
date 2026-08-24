"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { heroGradient } from "../../../lib/profil-secenekleri";

const inputStyle = { padding: "10px 14px", border: "1px solid #e3ebf6", borderRadius: 12, fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box", resize: "vertical" };

function baslangicHarfi(isim) {
  return (isim || "?").trim().charAt(0).toUpperCase() || "?";
}

function zamanFormat(iso) {
  const fark = Date.now() - new Date(iso).getTime();
  const dk = Math.floor(fark / 60000);
  if (dk < 1) return "az önce";
  if (dk < 60) return `${dk} dk önce`;
  const saat = Math.floor(dk / 60);
  if (saat < 24) return `${saat} sa önce`;
  const gun = Math.floor(saat / 24);
  if (gun < 7) return `${gun} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

function Avatar({ profil, size = 36 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flex: "none", background: heroGradient(profil?.hero_renk), display: "grid", placeItems: "center", overflow: "hidden" }}>
      {profil?.avatar_url ? (
        <img src={profil.avatar_url} alt={profil.full_name || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ color: "#fff", fontWeight: 800, fontSize: size * 0.4 }}>{baslangicHarfi(profil?.full_name)}</span>
      )}
    </div>
  );
}

export default function KampusDuvariPage() {
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [gonderiler, setGonderiler] = useState([]);
  const [profilMap, setProfilMap] = useState({});
  const [icerik, setIcerik] = useState("");
  const [gorselFile, setGorselFile] = useState(null);

  const [genisletilmis, setGenisletilmis] = useState({});
  const [yorumlarMap, setYorumlarMap] = useState({});
  const [yeniYorum, setYeniYorum] = useState({});

  async function profilleriYukle(idler) {
    const eksik = idler.filter((id) => !profilMap[id]);
    if (eksik.length === 0) return;
    const { data } = await supabase.rpc("campuso_get_profiller", { p_user_ids: eksik });
    if (data) {
      setProfilMap((prev) => {
        const next = { ...prev };
        data.forEach((p) => { next[p.id] = p; });
        return next;
      });
    }
  }

  async function loadGonderiler() {
    const { data, error: err } = await supabase.from("gonderiler").select("*").order("created_at", { ascending: false }).limit(40);
    if (err) { setError("Gönderiler alınamadı: " + err.message); return; }
    const rows = data || [];
    setGonderiler(rows);
    await profilleriYukle(Array.from(new Set(rows.map((g) => g.yazar_id))));
  }

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
      if (profile?.role !== "student") { setError("Kampüs Duvarı şu an yalnız öğrenciler için açık."); setLoading(false); return; }
      setUserId(session.user.id);
      await loadGonderiler();
      setLoading(false);
    }
    init();
  }, []);

  async function handlePaylas(e) {
    e.preventDefault();
    if (!icerik.trim()) { setError("Bir şeyler yazmadan paylaşamazsın."); return; }
    setBusy(true); setError("");
    let gorselUrl = null;
    if (gorselFile) {
      const ext = gorselFile.name.split(".").pop();
      const path = `${userId}/gonderi-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("gonderi-gorselleri").upload(path, gorselFile);
      if (upErr) { setError("Görsel yüklenemedi: " + upErr.message); setBusy(false); return; }
      gorselUrl = supabase.storage.from("gonderi-gorselleri").getPublicUrl(path).data.publicUrl;
    }
    const { error: err } = await supabase.from("gonderiler").insert([{ yazar_id: userId, icerik: icerik.trim(), gorsel_url: gorselUrl }]);
    if (err) setError("Paylaşılamadı: " + err.message);
    else { setIcerik(""); setGorselFile(null); await loadGonderiler(); }
    setBusy(false);
  }

  async function handleGonderiSil(id) {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("gonderiler").delete().eq("id", id);
    if (err) setError("Silinemedi: " + err.message);
    else setGonderiler((prev) => prev.filter((g) => g.id !== id));
    setBusy(false);
  }

  async function handleSikayet(hedefTip, hedefId) {
    const sebep = window.prompt("Bu içeriği neden şikayet ediyorsun? (opsiyonel)") ?? "";
    const { error: err } = await supabase.from("kampus_duvari_sikayetleri").insert([{ hedef_tip: hedefTip, hedef_id: hedefId, bildiren_id: userId, sebep: sebep.trim() || null }]);
    if (err) setError("Şikayet gönderilemedi: " + err.message);
    else window.alert("Şikayetin admin'e iletildi, teşekkürler.");
  }

  async function toggleYorumlar(gonderiId) {
    const acikMi = genisletilmis[gonderiId];
    setGenisletilmis((prev) => ({ ...prev, [gonderiId]: !acikMi }));
    if (!acikMi && !yorumlarMap[gonderiId]) {
      const { data, error: err } = await supabase.from("yorumlar").select("*").eq("gonderi_id", gonderiId).order("created_at", { ascending: true });
      if (err) { setError("Yorumlar alınamadı: " + err.message); return; }
      setYorumlarMap((prev) => ({ ...prev, [gonderiId]: data || [] }));
      await profilleriYukle(Array.from(new Set((data || []).map((y) => y.yazar_id))));
    }
  }

  async function handleYorumEkle(gonderiId, e) {
    e.preventDefault();
    const metin = (yeniYorum[gonderiId] || "").trim();
    if (!metin) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.from("yorumlar").insert([{ gonderi_id: gonderiId, yazar_id: userId, icerik: metin }]);
    if (err) setError("Yorum eklenemedi: " + err.message);
    else {
      setYeniYorum((prev) => ({ ...prev, [gonderiId]: "" }));
      const { data } = await supabase.from("yorumlar").select("*").eq("gonderi_id", gonderiId).order("created_at", { ascending: true });
      setYorumlarMap((prev) => ({ ...prev, [gonderiId]: data || [] }));
    }
    setBusy(false);
  }

  async function handleYorumSil(id, gonderiId) {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("yorumlar").delete().eq("id", id);
    if (err) setError("Silinemedi: " + err.message);
    else setYorumlarMap((prev) => ({ ...prev, [gonderiId]: (prev[gonderiId] || []).filter((y) => y.id !== id) }));
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=student" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>VOL 1-11 · KAMPÜS DUVARI</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Kampüs Duvarı</div>
          </div>
        </div>
        <Link href="/?role=student" style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid #c7deff", color: "#0e4bae" }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(640px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        {error ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}

        {loading ? (
          <p style={{ color: "#5b6b85" }}>Yükleniyor…</p>
        ) : !userId ? null : (
          <>
            <form onSubmit={handlePaylas} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 16, marginBottom: 20 }}>
              <textarea
                style={{ ...inputStyle, minHeight: 70 }}
                maxLength={2000}
                placeholder="Kampüste neler oluyor? Bir şeyler paylaş…"
                value={icerik}
                onChange={(e) => setIcerik(e.target.value)}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 10, flexWrap: "wrap" }}>
                <input type="file" accept="image/*" onChange={(e) => setGorselFile(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
                <button type="submit" disabled={busy} className="button button-primary" style={{ minHeight: 40, padding: "0 18px", fontSize: 13, opacity: busy ? 0.6 : 1 }}>
                  {busy ? "…" : "Paylaş"}
                </button>
              </div>
            </form>

            {gonderiler.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>
                Henüz gönderi yok. İlk paylaşımı sen yap!
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {gonderiler.map((g) => {
                  const yazar = profilMap[g.yazar_id];
                  const kendisiMi = g.yazar_id === userId;
                  const yorumlar = yorumlarMap[g.id] || [];
                  return (
                    <div key={g.id} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 16 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <Avatar profil={yazar} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <b style={{ fontSize: 13.5 }}>{yazar?.full_name || "Öğrenci"}</b>
                            <span style={{ fontSize: 11, color: "#8fa0bc" }}>{zamanFormat(g.created_at)}</span>
                          </div>
                          <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{g.icerik}</p>
                          {g.gorsel_url ? (
                            <img src={g.gorsel_url} alt="" style={{ marginTop: 10, borderRadius: 12, width: "100%", maxHeight: 360, objectFit: "cover", border: "1px solid #e3ebf6" }} />
                          ) : null}
                          <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12, color: "#5b6b85" }}>
                            <button type="button" onClick={() => toggleYorumlar(g.id)} style={{ border: "none", background: "none", color: "#175cd3", fontWeight: 700, cursor: "pointer", padding: 0 }}>
                              💬 Yorumlar {yorumlar.length > 0 ? `(${yorumlar.length})` : ""}
                            </button>
                            {kendisiMi ? (
                              <button type="button" onClick={() => handleGonderiSil(g.id)} disabled={busy} style={{ border: "none", background: "none", color: "#984333", fontWeight: 700, cursor: "pointer", padding: 0 }}>Sil</button>
                            ) : (
                              <button type="button" onClick={() => handleSikayet("gonderi", g.id)} style={{ border: "none", background: "none", color: "#8fa0bc", fontWeight: 700, cursor: "pointer", padding: 0 }}>Şikayet Et</button>
                            )}
                          </div>
                        </div>
                      </div>

                      {genisletilmis[g.id] && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #e3ebf6", display: "grid", gap: 10 }}>
                          {yorumlar.map((y) => {
                            const yYazar = profilMap[y.yazar_id];
                            const yKendisiMi = y.yazar_id === userId;
                            return (
                              <div key={y.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <Avatar profil={yYazar} size={26} />
                                <div style={{ flex: 1, background: "#f5f8fc", borderRadius: 10, padding: "8px 12px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                                    <b style={{ fontSize: 12 }}>{yYazar?.full_name || "Öğrenci"}</b>
                                    <span style={{ fontSize: 10, color: "#8fa0bc" }}>{zamanFormat(y.created_at)}</span>
                                  </div>
                                  <div style={{ fontSize: 12.5, marginTop: 3, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{y.icerik}</div>
                                  <div style={{ marginTop: 4 }}>
                                    {yKendisiMi ? (
                                      <button type="button" onClick={() => handleYorumSil(y.id, g.id)} disabled={busy} style={{ border: "none", background: "none", color: "#984333", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>Sil</button>
                                    ) : (
                                      <button type="button" onClick={() => handleSikayet("yorum", y.id)} style={{ border: "none", background: "none", color: "#8fa0bc", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>Şikayet Et</button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          <form onSubmit={(e) => handleYorumEkle(g.id, e)} style={{ display: "flex", gap: 8 }}>
                            <input
                              style={{ ...inputStyle, padding: "8px 12px", fontSize: 12.5 }}
                              placeholder="Yorum yaz…"
                              maxLength={500}
                              value={yeniYorum[g.id] || ""}
                              onChange={(e) => setYeniYorum((prev) => ({ ...prev, [g.id]: e.target.value }))}
                            />
                            <button type="submit" disabled={busy} style={{ minHeight: 36, padding: "0 14px", fontSize: 12, fontWeight: 700, borderRadius: 10, border: "none", background: "#175cd3", color: "#fff", cursor: "pointer" }}>Gönder</button>
                          </form>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
