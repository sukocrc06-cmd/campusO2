"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { heroGradient } from "../../../lib/profil-secenekleri";
import { SUSTURMA_SURELERI, susturmaBitisTarihi } from "../../../lib/kampus-duvari-yardimcilari";

function baslangicHarfi(isim) {
  return (isim || "?").trim().charAt(0).toUpperCase() || "?";
}

function zamanFormat(iso) {
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Avatar({ profil, size = 34 }) {
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

export default function AdminKampusDuvariPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [adminId, setAdminId] = useState(null);
  const [gonderiler, setGonderiler] = useState([]);
  const [yorumSayilari, setYorumSayilari] = useState({});
  const [sikayetler, setSikayetler] = useState([]);
  const [onayBekleyenGonderiler, setOnayBekleyenGonderiler] = useState([]);
  const [onayBekleyenYorumlar, setOnayBekleyenYorumlar] = useState([]);
  const [yasakliKelimeler, setYasakliKelimeler] = useState([]);
  const [yeniKelime, setYeniKelime] = useState("");
  const [profilMap, setProfilMap] = useState({});
  const [genisletilmis, setGenisletilmis] = useState({});
  const [yorumlarMap, setYorumlarMap] = useState({});
  const [susturSecim, setSusturSecim] = useState({});
  const [susturulmuslar, setSusturulmuslar] = useState([]);
  const [duyuruMetni, setDuyuruMetni] = useState("");
  const [duyuruGonderiliyor, setDuyuruGonderiliyor] = useState(false);

  async function profilleriYukle(idler) {
    const eksik = idler.filter((id) => id && !profilMap[id]);
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

  async function loadAll() {
    const [{ data: g, error: gErr }, { data: y, error: yErr }, { data: s, error: sErr }, { data: obG }, { data: obY }, { data: kelimeler }, { data: susturmalar }] = await Promise.all([
      supabase.from("gonderiler").select("*").order("sabitlenmis", { ascending: false }).order("created_at", { ascending: false }).limit(60),
      supabase.from("yorumlar").select("id, gonderi_id"),
      supabase.from("kampus_duvari_sikayetleri").select("*").order("created_at", { ascending: false }).limit(40),
      supabase.from("gonderiler").select("*").eq("onay_bekliyor", true).order("created_at", { ascending: false }),
      supabase.from("yorumlar").select("*").eq("onay_bekliyor", true).order("created_at", { ascending: false }),
      supabase.from("kampus_duvari_yasakli_kelimeler").select("*").order("kelime", { ascending: true }),
      supabase.from("kampus_duvari_susturmalar").select("*").gt("bitis", new Date().toISOString()).order("bitis", { ascending: true }),
    ]);
    if (gErr) setError("Gönderiler alınamadı: " + gErr.message);
    else setGonderiler(g || []);
    if (!yErr) {
      const sayilar = {};
      (y || []).forEach((row) => { sayilar[row.gonderi_id] = (sayilar[row.gonderi_id] || 0) + 1; });
      setYorumSayilari(sayilar);
    }
    if (sErr) setError((prev) => prev || "Şikayetler alınamadı: " + sErr.message);
    else setSikayetler(s || []);
    setOnayBekleyenGonderiler(obG || []);
    setOnayBekleyenYorumlar(obY || []);
    setYasakliKelimeler(kelimeler || []);
    setSusturulmuslar(susturmalar || []);

    const idler = new Set([
      ...(g || []).map((row) => row.yazar_id),
      ...(s || []).map((row) => row.bildiren_id),
      ...(obG || []).map((row) => row.yazar_id),
      ...(obY || []).map((row) => row.yazar_id),
      ...(susturmalar || []).map((row) => row.kullanici_id),
    ]);
    await profilleriYukle(Array.from(idler));
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
      setAdminId(session.user.id);
      await loadAll();
      setLoading(false);
    }
    init();
  }, []);

  const stats = useMemo(() => ({
    gonderi: gonderiler.length,
    yorum: Object.values(yorumSayilari).reduce((a, b) => a + b, 0),
    sikayet: sikayetler.length,
    onayBekleyen: onayBekleyenGonderiler.length + onayBekleyenYorumlar.length,
  }), [gonderiler, yorumSayilari, sikayetler, onayBekleyenGonderiler, onayBekleyenYorumlar]);

  async function handleGonderiSil(id) {
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("gonderiler").delete().eq("id", id);
    if (err) setError("Silinemedi: " + err.message);
    else { setMessage("Gönderi silindi."); await loadAll(); }
    setBusy(false);
  }

  async function handleYorumSil(id, gonderiId) {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("yorumlar").delete().eq("id", id);
    if (err) setError("Silinemedi: " + err.message);
    else {
      setYorumlarMap((prev) => ({ ...prev, [gonderiId]: (prev[gonderiId] || []).filter((y) => y.id !== id) }));
      await loadAll();
    }
    setBusy(false);
  }

  async function handleSikayetKapat(id) {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("kampus_duvari_sikayetleri").delete().eq("id", id);
    if (err) setError("Kapatılamadı: " + err.message);
    else { setMessage("Şikayet kapatıldı."); setSikayetler((prev) => prev.filter((s) => s.id !== id)); }
    setBusy(false);
  }

  async function handleGonderiOnayla(id) {
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("gonderiler").update({ onay_bekliyor: false }).eq("id", id);
    if (err) setError("Onaylanamadı: " + err.message);
    else { setMessage("Gönderi onaylandı, artık herkes görebilir."); await loadAll(); }
    setBusy(false);
  }

  async function handleYorumOnayla(id) {
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("yorumlar").update({ onay_bekliyor: false }).eq("id", id);
    if (err) setError("Onaylanamadı: " + err.message);
    else { setMessage("Yorum onaylandı."); await loadAll(); }
    setBusy(false);
  }

  async function handleGonderiSabitle(id, mevcut) {
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("gonderiler").update({ sabitlenmis: !mevcut }).eq("id", id);
    if (err) setError("İşlem başarısız: " + err.message);
    else { setMessage(mevcut ? "Sabitleme kaldırıldı." : "Gönderi duvarın en üstüne sabitlendi."); await loadAll(); }
    setBusy(false);
  }

  async function handleKelimeEkle(e) {
    e.preventDefault();
    const kelime = yeniKelime.trim().toLowerCase();
    if (!kelime) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.from("kampus_duvari_yasakli_kelimeler").insert([{ kelime }]);
    if (err) setError("Eklenemedi: " + err.message);
    else { setYeniKelime(""); await loadAll(); }
    setBusy(false);
  }

  async function handleKelimeSil(id) {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("kampus_duvari_yasakli_kelimeler").delete().eq("id", id);
    if (err) setError("Silinemedi: " + err.message);
    else setYasakliKelimeler((prev) => prev.filter((k) => k.id !== id));
    setBusy(false);
  }

  async function handleDuyuruGonder(e) {
    e.preventDefault();
    const metin = duyuruMetni.trim();
    if (!metin || !adminId) return;
    setDuyuruGonderiliyor(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("gonderiler").insert([{
      yazar_id: adminId,
      icerik: metin,
      resmi_duyuru: true,
      sabitlenmis: true,
    }]);
    if (err) setError("Duyuru gönderilemedi: " + err.message);
    else { setMessage("Resmi duyuru duvara gönderildi ve sabitlendi."); setDuyuruMetni(""); await loadAll(); }
    setDuyuruGonderiliyor(false);
  }

  async function handleSusturmaKaldir(id) {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("kampus_duvari_susturmalar").delete().eq("id", id);
    if (err) setError("Susturma kaldırılamadı: " + err.message);
    else { setMessage("Susturma erken kaldırıldı."); setSusturulmuslar((prev) => prev.filter((s) => s.id !== id)); }
    setBusy(false);
  }

  async function handleSustur(kullaniciId) {
    const saat = susturSecim[kullaniciId] || SUSTURMA_SURELERI[0].saat;
    const sebep = window.prompt("Susturma sebebi (opsiyonel):") ?? "";
    setBusy(true); setError(""); setMessage("");
    const { data: { session } } = await supabase.auth.getSession();
    const { error: err } = await supabase.from("kampus_duvari_susturmalar").insert([{
      kullanici_id: kullaniciId,
      sebep: sebep.trim() || null,
      bitis: susturmaBitisTarihi(Number(saat)),
      olusturan_id: session?.user?.id || null,
    }]);
    if (err) setError("Susturulamadı: " + err.message);
    else { setMessage("Kullanıcı susturuldu."); await loadAll(); }
    setBusy(false);
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

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg, #f5f8fc)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", color: "var(--ink, #0f1b33)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid var(--line, #e3ebf6)", background: "var(--white, #fff)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid var(--line, #e3ebf6)", background: "var(--bg, #f5f8fc)", color: "var(--blue-700, #175cd3)", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 820, letterSpacing: ".12em", color: "var(--blue-700, #175cd3)" }}>VOL 1-11 · KAMPÜS DUVARI</div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.02em" }}>Kampüs Duvarı Moderasyonu</div>
          </div>
        </div>
        <Link href="/" className="button button-secondary" style={{ minHeight: 40, padding: "0 16px", fontSize: 13 }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(900px, 100%)", margin: "0 auto", padding: "28px 20px 60px" }}>
        {loading ? (
          <p style={{ color: "var(--slate)", fontSize: 13 }}>Yükleniyor…</p>
        ) : error && gonderiler.length === 0 && sikayetler.length === 0 ? (
          <div style={{ padding: 20, borderRadius: 14, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13 }}>{error}</div>
        ) : (
          <>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
              <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "#fff" }}>
                <small style={{ color: "var(--muted)", fontSize: 11 }}>Toplam gönderi</small>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{stats.gonderi}</div>
              </div>
              <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "#fff" }}>
                <small style={{ color: "var(--muted)", fontSize: 11 }}>Toplam yorum</small>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{stats.yorum}</div>
              </div>
              <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "#fff" }}>
                <small style={{ color: "var(--muted)", fontSize: 11 }}>Bekleyen şikayet</small>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: stats.sikayet > 0 ? "#ef5c63" : "#22b879" }}>{stats.sikayet}</div>
              </div>
              <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "#fff" }}>
                <small style={{ color: "var(--muted)", fontSize: 11 }}>Onay bekleyen</small>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: stats.onayBekleyen > 0 ? "#ef5c63" : "#22b879" }}>{stats.onayBekleyen}</div>
              </div>
            </section>

            {error ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}
            {message ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#effbf6", border: "1px solid #bde5d5", color: "#0b5c42", fontSize: 13, fontWeight: 600 }}>{message}</div> : null}

            <section style={{ background: "linear-gradient(135deg, #0e4bae, #175cd3)", borderRadius: 16, padding: 18, marginBottom: 24, color: "#fff" }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>📢 Resmi Duyuru Gönder</div>
              <div style={{ fontSize: 11.5, opacity: 0.85, marginBottom: 12 }}>Duvara admin adına, öğrenci gönderilerinden görsel olarak ayrışan bir duyuru paylaşır ve otomatik olarak en üste sabitler.</div>
              <form onSubmit={handleDuyuruGonder} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                <textarea
                  value={duyuruMetni}
                  onChange={(e) => setDuyuruMetni(e.target.value)}
                  placeholder="Örn. Yarın kampüste elektrik kesintisi olacaktır…"
                  maxLength={2000}
                  rows={2}
                  style={{ flex: 1, minWidth: 240, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 13, resize: "vertical", outline: "none" }}
                />
                <button type="submit" disabled={duyuruGonderiliyor || !duyuruMetni.trim()} style={{ minHeight: 40, padding: "0 18px", fontSize: 13, fontWeight: 800, borderRadius: 10, border: "none", background: "#fff", color: "#0e4bae", cursor: "pointer", opacity: duyuruGonderiliyor || !duyuruMetni.trim() ? 0.6 : 1 }}>
                  {duyuruGonderiliyor ? "Gönderiliyor…" : "Duyuruyu Yayınla"}
                </button>
              </form>
            </section>

            {susturulmuslar.length > 0 && (
              <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: 18, marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Susturulmuş Kullanıcılar ({susturulmuslar.length})</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {susturulmuslar.map((s) => {
                    const kullanici = profilMap[s.kullanici_id];
                    return (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: "#f5f8fc", borderRadius: 10, padding: "10px 12px", flexWrap: "wrap" }}>
                        <div style={{ fontSize: 12 }}>
                          <b>{kullanici?.full_name || "Öğrenci"}</b>
                          {s.sebep ? <span style={{ color: "#5b6b85" }}> · "{s.sebep}"</span> : null}
                          <div style={{ color: "#8fa0bc", fontSize: 10.5, marginTop: 2 }}>Bitiş: {zamanFormat(s.bitis)}</div>
                        </div>
                        <button onClick={() => handleSusturmaKaldir(s.id)} disabled={busy} style={{ minHeight: 30, padding: "0 12px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #c7deff", background: "#eaf1ff", color: "#175cd3", cursor: "pointer" }}>Susturmayı Kaldır</button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {(onayBekleyenGonderiler.length > 0 || onayBekleyenYorumlar.length > 0) && (
              <section style={{ background: "#fff8ec", border: "1px solid #ffd58a", borderRadius: 16, padding: 18, marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#8a5a12", marginBottom: 10 }}>Onay Bekleyen İçerik ({stats.onayBekleyen}) — anahtar kelime filtresine takıldı</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {onayBekleyenGonderiler.map((g) => {
                    const yazar = profilMap[g.yazar_id];
                    return (
                      <div key={g.id} style={{ background: "#fff", borderRadius: 10, padding: "10px 12px" }}>
                        <div style={{ fontSize: 12, marginBottom: 6 }}><b>{yazar?.full_name || "Öğrenci"}</b> · gönderi · {zamanFormat(g.created_at)}</div>
                        <div style={{ fontSize: 12.5, color: "#5b6b85", marginBottom: 8 }}>{g.icerik}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => handleGonderiOnayla(g.id)} disabled={busy} style={{ minHeight: 28, padding: "0 10px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #bde5d5", background: "#effbf6", color: "#0b5c42", cursor: "pointer" }}>Onayla</button>
                          <button onClick={() => handleGonderiSil(g.id)} disabled={busy} style={{ minHeight: 28, padding: "0 10px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", cursor: "pointer" }}>Reddet / Sil</button>
                        </div>
                      </div>
                    );
                  })}
                  {onayBekleyenYorumlar.map((y) => {
                    const yazar = profilMap[y.yazar_id];
                    return (
                      <div key={y.id} style={{ background: "#fff", borderRadius: 10, padding: "10px 12px" }}>
                        <div style={{ fontSize: 12, marginBottom: 6 }}><b>{yazar?.full_name || "Öğrenci"}</b> · yorum · {zamanFormat(y.created_at)}</div>
                        <div style={{ fontSize: 12.5, color: "#5b6b85", marginBottom: 8 }}>{y.icerik}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => handleYorumOnayla(y.id)} disabled={busy} style={{ minHeight: 28, padding: "0 10px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #bde5d5", background: "#effbf6", color: "#0b5c42", cursor: "pointer" }}>Onayla</button>
                          <button onClick={() => handleYorumSil(y.id, y.gonderi_id)} disabled={busy} style={{ minHeight: 28, padding: "0 10px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", cursor: "pointer" }}>Reddet / Sil</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {sikayetler.length > 0 && (
              <section style={{ background: "#fff4f0", border: "1px solid #f2c5ba", borderRadius: 16, padding: 18, marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#984333", marginBottom: 10 }}>Şikayetler ({sikayetler.length})</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {sikayetler.map((s) => {
                    const bildiren = profilMap[s.bildiren_id];
                    return (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: "#fff", borderRadius: 10, padding: "10px 12px", flexWrap: "wrap" }}>
                        <div style={{ fontSize: 12 }}>
                          <b>{s.hedef_tip === "gonderi" ? "Gönderi" : "Yorum"}</b> şikayeti — {bildiren?.full_name || "bir öğrenci"} tarafından
                          {s.sebep ? <span style={{ color: "#5b6b85" }}> · "{s.sebep}"</span> : null}
                          <div style={{ color: "#8fa0bc", fontSize: 10.5, marginTop: 2 }}>{zamanFormat(s.created_at)} · hedef id: {s.hedef_id.slice(0, 8)}…</div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => (s.hedef_tip === "gonderi" ? handleGonderiSil(s.hedef_id) : handleYorumSil(s.hedef_id, null))} disabled={busy} style={{ minHeight: 30, padding: "0 10px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", cursor: "pointer" }}>İçeriği Sil</button>
                          <button onClick={() => handleSikayetKapat(s.id)} disabled={busy} style={{ minHeight: 30, padding: "0 10px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", cursor: "pointer" }}>Şikayeti Kapat</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: 18, marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Yasaklı Kelimeler</div>
              <form onSubmit={handleKelimeEkle} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input value={yeniKelime} onChange={(e) => setYeniKelime(e.target.value)} placeholder="Örn. küfür1" style={{ flex: 1, height: 36, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 9, fontSize: 12.5, outline: "none" }} />
                <button type="submit" disabled={busy} style={{ minHeight: 36, padding: "0 14px", fontSize: 12, fontWeight: 700, borderRadius: 9, border: "none", background: "#175cd3", color: "#fff", cursor: "pointer" }}>Ekle</button>
              </form>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {yasakliKelimeler.length === 0 ? (
                  <span style={{ fontSize: 12, color: "#8fa0bc" }}>Henüz yasaklı kelime eklenmedi. Eklenen kelimeyi içeren gönderi/yorumlar otomatik olarak "onay bekliyor" durumuna alınır.</span>
                ) : yasakliKelimeler.map((k) => (
                  <span key={k.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: "#f5f8fc", border: "1px solid #e3ebf6" }}>
                    {k.kelime}
                    <button onClick={() => handleKelimeSil(k.id)} disabled={busy} style={{ border: "none", background: "none", color: "#984333", cursor: "pointer", fontWeight: 800, padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
            </section>

            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Tüm Gönderiler</div>
            {gonderiler.length === 0 ? (
              <div style={{ display: "grid", placeItems: "center", minHeight: 100, border: "1px dashed var(--line)", borderRadius: 14, background: "var(--bg)", color: "var(--muted)", fontSize: 13 }}>Henüz gönderi yok.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {gonderiler.map((g) => {
                  const yazar = profilMap[g.yazar_id];
                  const yorumSayisi = yorumSayilari[g.id] || 0;
                  const yorumlar = yorumlarMap[g.id] || [];
                  return (
                    <div key={g.id} style={{ background: "#fff", border: g.resmi_duyuru ? "1px solid #c7deff" : g.sabitlenmis ? "1px solid #ffd58a" : "1px solid #e3ebf6", borderRadius: 14, padding: 16 }}>
                      {g.resmi_duyuru ? (
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#175cd3", marginBottom: 6 }}>📢 RESMİ DUYURU</div>
                      ) : g.sabitlenmis ? (
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#c65d1f", marginBottom: 6 }}>📌 SABİTLENMİŞ</div>
                      ) : null}
                      <div style={{ display: "flex", gap: 10 }}>
                        <Avatar profil={yazar} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <div>
                              <b style={{ fontSize: 13 }}>{yazar?.full_name || "Öğrenci"}</b>
                              <span style={{ fontSize: 11, color: "#8fa0bc", marginLeft: 8 }}>{zamanFormat(g.created_at)}</span>
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <button onClick={() => handleGonderiSabitle(g.id, g.sabitlenmis)} disabled={busy} style={{ minHeight: 28, padding: "0 10px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #ffd58a", background: g.sabitlenmis ? "#ffd58a" : "#fff8ec", color: "#8a5a12", cursor: "pointer" }}>{g.sabitlenmis ? "Sabitlemeyi Kaldır" : "Sabitle"}</button>
                              <select value={susturSecim[g.yazar_id] || SUSTURMA_SURELERI[0].saat} onChange={(e) => setSusturSecim((prev) => ({ ...prev, [g.yazar_id]: e.target.value }))} style={{ height: 28, fontSize: 11, borderRadius: 8, border: "1px solid #e3ebf6" }}>
                                {SUSTURMA_SURELERI.map((s) => <option key={s.saat} value={s.saat}>{s.label}</option>)}
                              </select>
                              <button onClick={() => handleSustur(g.yazar_id)} disabled={busy} style={{ minHeight: 28, padding: "0 10px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", cursor: "pointer" }}>Yazarı Sustur</button>
                              <button onClick={() => handleGonderiSil(g.id)} disabled={busy} style={{ minHeight: 28, padding: "0 10px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", cursor: "pointer" }}>Sil</button>
                            </div>
                          </div>
                          <p style={{ margin: "6px 0 0", fontSize: 13.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{g.icerik}</p>
                          {(g.gorsel_urls && g.gorsel_urls.length > 0 ? g.gorsel_urls : (g.gorsel_url ? [g.gorsel_url] : [])).length > 0 ? (
                            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {(g.gorsel_urls && g.gorsel_urls.length > 0 ? g.gorsel_urls : [g.gorsel_url]).map((u) => (
                                <img key={u} src={u} alt="" style={{ borderRadius: 10, height: 120, width: 120, objectFit: "cover", border: "1px solid #e3ebf6" }} />
                              ))}
                            </div>
                          ) : null}
                          <button type="button" onClick={() => toggleYorumlar(g.id)} style={{ marginTop: 8, border: "none", background: "none", color: "#175cd3", fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0 }}>
                            Yorumlar {yorumSayisi > 0 ? `(${yorumSayisi})` : ""}
                          </button>

                          {genisletilmis[g.id] && (
                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e3ebf6", display: "grid", gap: 8 }}>
                              {yorumlar.length === 0 ? (
                                <div style={{ fontSize: 12, color: "#8fa0bc" }}>Yorum yok.</div>
                              ) : yorumlar.map((y) => {
                                const yYazar = profilMap[y.yazar_id];
                                return (
                                  <div key={y.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, background: "#f5f8fc", borderRadius: 10, padding: "8px 12px", alignItems: "flex-start" }}>
                                    <div style={{ fontSize: 12 }}>
                                      <b>{yYazar?.full_name || "Öğrenci"}</b> <span style={{ color: "#8fa0bc", fontSize: 10.5 }}>{zamanFormat(y.created_at)}</span>
                                      <div style={{ marginTop: 2 }}>{y.icerik}</div>
                                    </div>
                                    <div style={{ display: "flex", gap: 6, flex: "none" }}>
                                      <button onClick={() => handleSustur(y.yazar_id)} disabled={busy} style={{ minHeight: 26, padding: "0 8px", fontSize: 10.5, fontWeight: 700, borderRadius: 7, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", cursor: "pointer" }}>Sustur</button>
                                      <button onClick={() => handleYorumSil(y.id, g.id)} disabled={busy} style={{ minHeight: 26, padding: "0 8px", fontSize: 10.5, fontWeight: 700, borderRadius: 7, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", cursor: "pointer" }}>Sil</button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
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
