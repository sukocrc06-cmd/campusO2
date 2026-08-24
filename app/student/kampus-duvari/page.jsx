"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { heroGradient } from "../../../lib/profil-secenekleri";
import { hashtagleriAyikla } from "../../../lib/kampus-duvari-yardimcilari";

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
  const [kendiBolum, setKendiBolum] = useState("");
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

  const [gonderiBegenilerim, setGonderiBegenilerim] = useState(new Set());
  const [gonderiBegeniSayilari, setGonderiBegeniSayilari] = useState({});
  const [yorumBegenilerim, setYorumBegenilerim] = useState(new Set());
  const [yorumBegeniSayilari, setYorumBegeniSayilari] = useState({});

  const [duzenlenenGonderi, setDuzenlenenGonderi] = useState(null);
  const [duzenlenenGonderiMetin, setDuzenlenenGonderiMetin] = useState("");
  const [duzenlenenYorum, setDuzenlenenYorum] = useState(null);
  const [duzenlenenYorumMetin, setDuzenlenenYorumMetin] = useState("");

  const [aktifEtiket, setAktifEtiket] = useState(null);
  const [sadeceBolumum, setSadeceBolumum] = useState(false);

  const [bildirimler, setBildirimler] = useState([]);
  const [bildirimAcik, setBildirimAcik] = useState(false);

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

  async function begenileriYukle(gonderiIdler, uid) {
    if (gonderiIdler.length === 0) return;
    const { data } = await supabase.from("gonderi_begenileri").select("gonderi_id, kullanici_id").in("gonderi_id", gonderiIdler);
    if (data) {
      const sayilar = {};
      const benimkiler = new Set();
      data.forEach((row) => {
        sayilar[row.gonderi_id] = (sayilar[row.gonderi_id] || 0) + 1;
        if (row.kullanici_id === uid) benimkiler.add(row.gonderi_id);
      });
      setGonderiBegeniSayilari(sayilar);
      setGonderiBegenilerim(benimkiler);
    }
  }

  async function bildirimleriYukle(uid) {
    const { data } = await supabase
      .from("kampus_duvari_bildirimleri")
      .select("*")
      .eq("kullanici_id", uid)
      .order("created_at", { ascending: false })
      .limit(20);
    setBildirimler(data || []);
    if (data) await profilleriYukle(Array.from(new Set(data.map((b) => b.olusturan_id).filter(Boolean))));
  }

  async function loadGonderiler(uid) {
    const { data, error: err } = await supabase
      .from("gonderiler")
      .select("*")
      .order("sabitlenmis", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40);
    if (err) { setError("Gönderiler alınamadı: " + err.message); return; }
    const rows = data || [];
    setGonderiler(rows);
    await profilleriYukle(Array.from(new Set(rows.map((g) => g.yazar_id))));
    await begenileriYukle(rows.map((g) => g.id), uid);
  }

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("role, bolum").eq("id", session.user.id).maybeSingle();
      if (profile?.role !== "student") { setError("Kampüs Duvarı şu an yalnız öğrenciler için açık."); setLoading(false); return; }
      setUserId(session.user.id);
      setKendiBolum(profile?.bolum || "");
      await loadGonderiler(session.user.id);
      await bildirimleriYukle(session.user.id);
      setLoading(false);
    }
    init();
  }, []);

  const etiketler = useMemo(() => {
    const hepsi = new Set();
    gonderiler.forEach((g) => hashtagleriAyikla(g.icerik).forEach((h) => hepsi.add(h)));
    return Array.from(hepsi).slice(0, 20);
  }, [gonderiler]);

  const gorunenGonderiler = useMemo(() => {
    return gonderiler.filter((g) => {
      if (aktifEtiket && !hashtagleriAyikla(g.icerik).includes(aktifEtiket)) return false;
      if (sadeceBolumum && kendiBolum && g.bolum !== kendiBolum) return false;
      return true;
    });
  }, [gonderiler, aktifEtiket, sadeceBolumum, kendiBolum]);

  const okunmamisSayisi = bildirimler.filter((b) => !b.okundu).length;

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
    const { data: eklenen, error: err } = await supabase.from("gonderiler").insert([{ yazar_id: userId, icerik: icerik.trim(), gorsel_url: gorselUrl }]).select("onay_bekliyor").maybeSingle();
    if (err) setError("Paylaşılamadı: " + err.message);
    else {
      setIcerik(""); setGorselFile(null);
      await loadGonderiler(userId);
      if (eklenen?.onay_bekliyor) setError("Gönderin incelemeye alındı, onaylanana kadar yalnız sen görebilirsin.");
    }
    setBusy(false);
  }

  async function handleGonderiSil(id) {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("gonderiler").delete().eq("id", id);
    if (err) setError("Silinemedi: " + err.message);
    else setGonderiler((prev) => prev.filter((g) => g.id !== id));
    setBusy(false);
  }

  function gonderiDuzenlemeyeBasla(g) {
    setDuzenlenenGonderi(g.id);
    setDuzenlenenGonderiMetin(g.icerik);
  }

  async function handleGonderiDuzenleKaydet(id) {
    const metin = duzenlenenGonderiMetin.trim();
    if (!metin) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.from("gonderiler").update({ icerik: metin }).eq("id", id);
    if (err) setError("Düzenlenemedi: " + err.message);
    else {
      setDuzenlenenGonderi(null);
      await loadGonderiler(userId);
    }
    setBusy(false);
  }

  async function handleSikayet(hedefTip, hedefId) {
    const sebep = window.prompt("Bu içeriği neden şikayet ediyorsun? (opsiyonel)") ?? "";
    const { error: err } = await supabase.from("kampus_duvari_sikayetleri").insert([{ hedef_tip: hedefTip, hedef_id: hedefId, bildiren_id: userId, sebep: sebep.trim() || null }]);
    if (err) setError("Şikayet gönderilemedi: " + err.message);
    else window.alert("Şikayetin admin'e iletildi, teşekkürler.");
  }

  async function handleGonderiBegen(gonderiId) {
    const begendimMi = gonderiBegenilerim.has(gonderiId);
    if (begendimMi) {
      const { error: err } = await supabase.from("gonderi_begenileri").delete().eq("gonderi_id", gonderiId).eq("kullanici_id", userId);
      if (err) { setError("İşlem başarısız: " + err.message); return; }
      setGonderiBegenilerim((prev) => { const next = new Set(prev); next.delete(gonderiId); return next; });
      setGonderiBegeniSayilari((prev) => ({ ...prev, [gonderiId]: Math.max(0, (prev[gonderiId] || 1) - 1) }));
    } else {
      const { error: err } = await supabase.from("gonderi_begenileri").insert([{ gonderi_id: gonderiId, kullanici_id: userId }]);
      if (err) { setError("İşlem başarısız: " + err.message); return; }
      setGonderiBegenilerim((prev) => new Set(prev).add(gonderiId));
      setGonderiBegeniSayilari((prev) => ({ ...prev, [gonderiId]: (prev[gonderiId] || 0) + 1 }));
    }
  }

  async function handleYorumBegen(yorumId) {
    const begendimMi = yorumBegenilerim.has(yorumId);
    if (begendimMi) {
      const { error: err } = await supabase.from("yorum_begenileri").delete().eq("yorum_id", yorumId).eq("kullanici_id", userId);
      if (err) { setError("İşlem başarısız: " + err.message); return; }
      setYorumBegenilerim((prev) => { const next = new Set(prev); next.delete(yorumId); return next; });
      setYorumBegeniSayilari((prev) => ({ ...prev, [yorumId]: Math.max(0, (prev[yorumId] || 1) - 1) }));
    } else {
      const { error: err } = await supabase.from("yorum_begenileri").insert([{ yorum_id: yorumId, kullanici_id: userId }]);
      if (err) { setError("İşlem başarısız: " + err.message); return; }
      setYorumBegenilerim((prev) => new Set(prev).add(yorumId));
      setYorumBegeniSayilari((prev) => ({ ...prev, [yorumId]: (prev[yorumId] || 0) + 1 }));
    }
  }

  async function yorumBegenileriniYukle(yorumIdler) {
    if (yorumIdler.length === 0) return;
    const { data } = await supabase.from("yorum_begenileri").select("yorum_id, kullanici_id").in("yorum_id", yorumIdler);
    if (data) {
      const sayilar = {};
      const benimkiler = new Set();
      data.forEach((row) => {
        sayilar[row.yorum_id] = (sayilar[row.yorum_id] || 0) + 1;
        if (row.kullanici_id === userId) benimkiler.add(row.yorum_id);
      });
      setYorumBegeniSayilari((prev) => ({ ...prev, ...sayilar }));
      setYorumBegenilerim((prev) => new Set([...prev, ...benimkiler]));
    }
  }

  async function toggleYorumlar(gonderiId) {
    const acikMi = genisletilmis[gonderiId];
    setGenisletilmis((prev) => ({ ...prev, [gonderiId]: !acikMi }));
    if (!acikMi && !yorumlarMap[gonderiId]) {
      const { data, error: err } = await supabase.from("yorumlar").select("*").eq("gonderi_id", gonderiId).order("created_at", { ascending: true });
      if (err) { setError("Yorumlar alınamadı: " + err.message); return; }
      setYorumlarMap((prev) => ({ ...prev, [gonderiId]: data || [] }));
      await profilleriYukle(Array.from(new Set((data || []).map((y) => y.yazar_id))));
      await yorumBegenileriniYukle((data || []).map((y) => y.id));
    }
  }

  async function handleYorumEkle(gonderiId, e) {
    e.preventDefault();
    const metin = (yeniYorum[gonderiId] || "").trim();
    if (!metin) return;
    setBusy(true); setError("");
    const { data: eklenen, error: err } = await supabase.from("yorumlar").insert([{ gonderi_id: gonderiId, yazar_id: userId, icerik: metin }]).select("onay_bekliyor").maybeSingle();
    if (err) setError("Yorum eklenemedi: " + err.message);
    else {
      setYeniYorum((prev) => ({ ...prev, [gonderiId]: "" }));
      const { data } = await supabase.from("yorumlar").select("*").eq("gonderi_id", gonderiId).order("created_at", { ascending: true });
      setYorumlarMap((prev) => ({ ...prev, [gonderiId]: data || [] }));
      if (eklenen?.onay_bekliyor) setError("Yorumun incelemeye alındı, onaylanana kadar yalnız sen görebilirsin.");
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

  function yorumDuzenlemeyeBasla(y) {
    setDuzenlenenYorum(y.id);
    setDuzenlenenYorumMetin(y.icerik);
  }

  async function handleYorumDuzenleKaydet(id, gonderiId) {
    const metin = duzenlenenYorumMetin.trim();
    if (!metin) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.from("yorumlar").update({ icerik: metin }).eq("id", id);
    if (err) setError("Düzenlenemedi: " + err.message);
    else {
      setDuzenlenenYorum(null);
      const { data } = await supabase.from("yorumlar").select("*").eq("gonderi_id", gonderiId).order("created_at", { ascending: true });
      setYorumlarMap((prev) => ({ ...prev, [gonderiId]: data || [] }));
    }
    setBusy(false);
  }

  async function handleBildirimAc() {
    setBildirimAcik((prev) => !prev);
    const okunmamislar = bildirimler.filter((b) => !b.okundu).map((b) => b.id);
    if (okunmamislar.length > 0) {
      await supabase.from("kampus_duvari_bildirimleri").update({ okundu: true }).in("id", okunmamislar);
      setBildirimler((prev) => prev.map((b) => ({ ...b, okundu: true })));
    }
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
          <button type="button" onClick={handleBildirimAc} style={{ position: "relative", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", cursor: "pointer", fontSize: 16 }}>
            🔔
            {okunmamisSayisi > 0 && (
              <span style={{ position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: "#ef5c63", color: "#fff", fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center" }}>{okunmamisSayisi}</span>
            )}
          </button>
          {bildirimAcik && (
            <div style={{ position: "absolute", top: 44, right: 0, width: 300, maxHeight: 360, overflowY: "auto", background: "#fff", border: "1px solid #e3ebf6", borderRadius: 14, boxShadow: "0 12px 30px rgba(15,27,51,0.14)", zIndex: 20, padding: 8 }}>
              {bildirimler.length === 0 ? (
                <div style={{ padding: 14, fontSize: 12.5, color: "#8fa0bc", textAlign: "center" }}>Henüz bildirim yok.</div>
              ) : bildirimler.map((b) => {
                const kimden = profilMap[b.olusturan_id];
                return (
                  <div key={b.id} style={{ padding: "8px 10px", borderRadius: 10, fontSize: 12, background: b.okundu ? "transparent" : "#eef5ff" }}>
                    <b>{kimden?.full_name || "Bir öğrenci"}</b> gönderine yorum yaptı.
                    <div style={{ color: "#8fa0bc", fontSize: 10.5, marginTop: 2 }}>{zamanFormat(b.created_at)}</div>
                  </div>
                );
              })}
            </div>
          )}
          <Link href="/?role=student" style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid #c7deff", color: "#0e4bae" }}>Panele dön</Link>
        </div>
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
                placeholder="Kampüste neler oluyor? Bir şeyler paylaş… (#etiket kullanabilirsin)"
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

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
              {kendiBolum ? (
                <button type="button" onClick={() => setSadeceBolumum((prev) => !prev)} style={{ minHeight: 30, padding: "0 12px", fontSize: 11.5, fontWeight: 700, borderRadius: 999, border: sadeceBolumum ? "1px solid #175cd3" : "1px solid #e3ebf6", background: sadeceBolumum ? "#175cd3" : "#fff", color: sadeceBolumum ? "#fff" : "#5b6b85", cursor: "pointer" }}>
                  Sadece {kendiBolum}
                </button>
              ) : null}
              {etiketler.map((etiket) => (
                <button key={etiket} type="button" onClick={() => setAktifEtiket((prev) => (prev === etiket ? null : etiket))} style={{ minHeight: 30, padding: "0 12px", fontSize: 11.5, fontWeight: 700, borderRadius: 999, border: aktifEtiket === etiket ? "1px solid #175cd3" : "1px solid #e3ebf6", background: aktifEtiket === etiket ? "#175cd3" : "#fff", color: aktifEtiket === etiket ? "#fff" : "#5b6b85", cursor: "pointer" }}>
                  {etiket}
                </button>
              ))}
            </div>

            {gorunenGonderiler.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>
                {gonderiler.length === 0 ? "Henüz gönderi yok. İlk paylaşımı sen yap!" : "Bu filtreye uyan gönderi yok."}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {gorunenGonderiler.map((g) => {
                  const yazar = profilMap[g.yazar_id];
                  const kendisiMi = g.yazar_id === userId;
                  const yorumlar = yorumlarMap[g.id] || [];
                  const begendimMi = gonderiBegenilerim.has(g.id);
                  const begeniSayisi = gonderiBegeniSayilari[g.id] || 0;
                  return (
                    <div key={g.id} style={{ background: "#fff", border: g.sabitlenmis ? "1px solid #ffd58a" : "1px solid #e3ebf6", borderRadius: 16, padding: 16 }}>
                      {g.sabitlenmis && (
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#c65d1f", marginBottom: 8 }}>📌 SABİTLENMİŞ DUYURU</div>
                      )}
                      {kendisiMi && g.onay_bekliyor && (
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#984333", marginBottom: 8 }}>⏳ İncelemede — onaylanana kadar yalnız sen görüyorsun.</div>
                      )}
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <Avatar profil={yazar} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <b style={{ fontSize: 13.5 }}>{yazar?.full_name || "Öğrenci"}</b>
                            <span style={{ fontSize: 11, color: "#8fa0bc" }}>{zamanFormat(g.created_at)}{g.updated_at ? " · düzenlendi" : ""}</span>
                          </div>
                          {duzenlenenGonderi === g.id ? (
                            <div style={{ marginTop: 6 }}>
                              <textarea style={{ ...inputStyle, minHeight: 60 }} maxLength={2000} value={duzenlenenGonderiMetin} onChange={(e) => setDuzenlenenGonderiMetin(e.target.value)} />
                              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                                <button type="button" onClick={() => handleGonderiDuzenleKaydet(g.id)} disabled={busy} style={{ minHeight: 30, padding: "0 12px", fontSize: 11.5, fontWeight: 700, borderRadius: 8, border: "none", background: "#175cd3", color: "#fff", cursor: "pointer" }}>Kaydet</button>
                                <button type="button" onClick={() => setDuzenlenenGonderi(null)} style={{ minHeight: 30, padding: "0 12px", fontSize: 11.5, fontWeight: 700, borderRadius: 8, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", cursor: "pointer" }}>Vazgeç</button>
                              </div>
                            </div>
                          ) : (
                            <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{g.icerik}</p>
                          )}
                          {g.gorsel_url ? (
                            <img src={g.gorsel_url} alt="" style={{ marginTop: 10, borderRadius: 12, width: "100%", maxHeight: 360, objectFit: "cover", border: "1px solid #e3ebf6" }} />
                          ) : null}
                          <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12, color: "#5b6b85", alignItems: "center", flexWrap: "wrap" }}>
                            <button type="button" onClick={() => handleGonderiBegen(g.id)} style={{ border: "none", background: "none", color: begendimMi ? "#ef5c63" : "#5b6b85", fontWeight: 700, cursor: "pointer", padding: 0 }}>
                              {begendimMi ? "❤️" : "🤍"} {begeniSayisi > 0 ? begeniSayisi : ""}
                            </button>
                            <button type="button" onClick={() => toggleYorumlar(g.id)} style={{ border: "none", background: "none", color: "#175cd3", fontWeight: 700, cursor: "pointer", padding: 0 }}>
                              💬 Yorumlar {yorumlar.length > 0 ? `(${yorumlar.length})` : ""}
                            </button>
                            {kendisiMi ? (
                              <>
                                <button type="button" onClick={() => gonderiDuzenlemeyeBasla(g)} style={{ border: "none", background: "none", color: "#5b6b85", fontWeight: 700, cursor: "pointer", padding: 0 }}>Düzenle</button>
                                <button type="button" onClick={() => handleGonderiSil(g.id)} disabled={busy} style={{ border: "none", background: "none", color: "#984333", fontWeight: 700, cursor: "pointer", padding: 0 }}>Sil</button>
                              </>
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
                            const yBegendimMi = yorumBegenilerim.has(y.id);
                            const yBegeniSayisi = yorumBegeniSayilari[y.id] || 0;
                            return (
                              <div key={y.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <Avatar profil={yYazar} size={26} />
                                <div style={{ flex: 1, background: "#f5f8fc", borderRadius: 10, padding: "8px 12px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                                    <b style={{ fontSize: 12 }}>{yYazar?.full_name || "Öğrenci"}</b>
                                    <span style={{ fontSize: 10, color: "#8fa0bc" }}>{zamanFormat(y.created_at)}{y.updated_at ? " · düzenlendi" : ""}</span>
                                  </div>
                                  {duzenlenenYorum === y.id ? (
                                    <div style={{ marginTop: 4 }}>
                                      <input style={{ ...inputStyle, padding: "6px 10px", fontSize: 12 }} maxLength={500} value={duzenlenenYorumMetin} onChange={(e) => setDuzenlenenYorumMetin(e.target.value)} />
                                      <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                                        <button type="button" onClick={() => handleYorumDuzenleKaydet(y.id, g.id)} disabled={busy} style={{ minHeight: 24, padding: "0 8px", fontSize: 10.5, fontWeight: 700, borderRadius: 6, border: "none", background: "#175cd3", color: "#fff", cursor: "pointer" }}>Kaydet</button>
                                        <button type="button" onClick={() => setDuzenlenenYorum(null)} style={{ minHeight: 24, padding: "0 8px", fontSize: 10.5, fontWeight: 700, borderRadius: 6, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", cursor: "pointer" }}>Vazgeç</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: 12.5, marginTop: 3, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{y.icerik}</div>
                                  )}
                                  <div style={{ marginTop: 4, display: "flex", gap: 10, alignItems: "center" }}>
                                    <button type="button" onClick={() => handleYorumBegen(y.id)} style={{ border: "none", background: "none", color: yBegendimMi ? "#ef5c63" : "#8fa0bc", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                                      {yBegendimMi ? "❤️" : "🤍"} {yBegeniSayisi > 0 ? yBegeniSayisi : ""}
                                    </button>
                                    {yKendisiMi ? (
                                      <>
                                        <button type="button" onClick={() => yorumDuzenlemeyeBasla(y)} style={{ border: "none", background: "none", color: "#8fa0bc", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>Düzenle</button>
                                        <button type="button" onClick={() => handleYorumSil(y.id, g.id)} disabled={busy} style={{ border: "none", background: "none", color: "#984333", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>Sil</button>
                                      </>
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
