"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import {
  GUNLER,
  SINAV_TURLERI,
  parseDersProgramiFile,
  parseSinavTakvimiFile,
  indirDersProgramiSablonu,
  indirSinavTakvimiSablonu,
} from "../../../lib/ders-sinav-excel";

const inputStyle = { height: 42, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 11, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
const labelStyle = { display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 700, color: "#5b6b85" };

const DERS_BOS_FORM = { bolum: "", sinif: "", ders_kodu: "", ders_adi: "", gun: GUNLER[0], baslangic_saat: "", bitis_saat: "", derslik: "", hoca_adi: "" };
const SINAV_BOS_FORM = { bolum: "", sinif: "", ders_kodu: "", ders_adi: "", sinav_turu: SINAV_TURLERI[0], tarih: "", saat: "", derslik: "", hoca_adi: "" };

export default function AdminDersSinavPage() {
  const [tab, setTab] = useState("ders"); // ders | sinav
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [dersListe, setDersListe] = useState([]);
  const [sinavListe, setSinavListe] = useState([]);

  const [dersOnizleme, setDersOnizleme] = useState(null);
  const [sinavOnizleme, setSinavOnizleme] = useState(null);

  const [dersForm, setDersForm] = useState(DERS_BOS_FORM);
  const [sinavForm, setSinavForm] = useState(SINAV_BOS_FORM);

  const [filtreBolum, setFiltreBolum] = useState("");
  const [filtreSinif, setFiltreSinif] = useState("");

  async function loadAll() {
    const [{ data: d, error: dErr }, { data: s, error: sErr }] = await Promise.all([
      supabase.from("ders_programi").select("*").order("bolum").order("sinif").order("gun").order("baslangic_saat"),
      supabase.from("sinav_takvimi").select("*").order("bolum").order("sinif").order("tarih").order("saat"),
    ]);
    if (dErr) setError("Ders programı alınamadı: " + dErr.message);
    else setDersListe(d || []);
    if (sErr) setError((prev) => prev || "Sınav takvimi alınamadı: " + sErr.message);
    else setSinavListe(s || []);
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
      await loadAll();
      setLoading(false);
    }
    init();
  }, []);

  const bolumSecenekleri = useMemo(() => {
    const set = new Set([...dersListe.map((d) => d.bolum), ...sinavListe.map((s) => s.bolum)]);
    return Array.from(set).filter(Boolean).sort();
  }, [dersListe, sinavListe]);

  async function handleDersDosya(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const sonuc = await parseDersProgramiFile(file);
      setDersOnizleme(sonuc);
    } catch (err) {
      setError("Excel okunamadı: " + (err instanceof Error ? err.message : String(err)));
    }
    setBusy(false);
    e.target.value = "";
  }

  async function handleDersIceAktar() {
    if (!dersOnizleme?.gecerli?.length) return;
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("ders_programi").insert(dersOnizleme.gecerli);
    if (err) setError("İçe aktarılamadı: " + err.message);
    else { setMessage(`${dersOnizleme.gecerli.length} ders programı satırı eklendi.`); setDersOnizleme(null); await loadAll(); }
    setBusy(false);
  }

  async function handleSinavDosya(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const sonuc = await parseSinavTakvimiFile(file);
      setSinavOnizleme(sonuc);
    } catch (err) {
      setError("Excel okunamadı: " + (err instanceof Error ? err.message : String(err)));
    }
    setBusy(false);
    e.target.value = "";
  }

  async function handleSinavIceAktar() {
    if (!sinavOnizleme?.gecerli?.length) return;
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("sinav_takvimi").insert(sinavOnizleme.gecerli);
    if (err) setError("İçe aktarılamadı: " + err.message);
    else { setMessage(`${sinavOnizleme.gecerli.length} sınav takvimi satırı eklendi.`); setSinavOnizleme(null); await loadAll(); }
    setBusy(false);
  }

  async function handleDersManuelEkle(e) {
    e.preventDefault();
    if (!dersForm.bolum.trim() || !dersForm.sinif.trim() || !dersForm.ders_adi.trim() || !dersForm.baslangic_saat || !dersForm.bitis_saat) {
      setError("Bölüm, sınıf, ders adı, başlangıç ve bitiş saati zorunludur.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("ders_programi").insert([{
      bolum: dersForm.bolum.trim(), sinif: dersForm.sinif.trim(), ders_kodu: dersForm.ders_kodu.trim() || null,
      ders_adi: dersForm.ders_adi.trim(), gun: dersForm.gun, baslangic_saat: dersForm.baslangic_saat, bitis_saat: dersForm.bitis_saat,
      derslik: dersForm.derslik.trim() || null, hoca_adi: dersForm.hoca_adi.trim() || null,
    }]);
    if (err) setError("Eklenemedi: " + err.message);
    else { setMessage("Ders eklendi."); setDersForm(DERS_BOS_FORM); await loadAll(); }
    setBusy(false);
  }

  async function handleSinavManuelEkle(e) {
    e.preventDefault();
    if (!sinavForm.bolum.trim() || !sinavForm.sinif.trim() || !sinavForm.ders_adi.trim() || !sinavForm.tarih || !sinavForm.saat) {
      setError("Bölüm, sınıf, ders adı, tarih ve saat zorunludur.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("sinav_takvimi").insert([{
      bolum: sinavForm.bolum.trim(), sinif: sinavForm.sinif.trim(), ders_kodu: sinavForm.ders_kodu.trim() || null,
      ders_adi: sinavForm.ders_adi.trim(), sinav_turu: sinavForm.sinav_turu, tarih: sinavForm.tarih, saat: sinavForm.saat,
      derslik: sinavForm.derslik.trim() || null, hoca_adi: sinavForm.hoca_adi.trim() || null,
    }]);
    if (err) setError("Eklenemedi: " + err.message);
    else { setMessage("Sınav eklendi."); setSinavForm(SINAV_BOS_FORM); await loadAll(); }
    setBusy(false);
  }

  async function handleSil(tablo, id) {
    setBusy(true); setError("");
    const { error: err } = await supabase.from(tablo).delete().eq("id", id);
    if (err) setError("Silinemedi: " + err.message);
    else await loadAll();
    setBusy(false);
  }

  async function handleFiltrelenenleriSil(tablo) {
    if (!filtreBolum) { setError("Toplu silmek için önce bir bölüm filtresi seçin."); return; }
    const onay = window.confirm(`${filtreBolum}${filtreSinif ? " / " + filtreSinif + ". sınıf" : ""} için tüm kayıtları silmek istediğine emin misin?`);
    if (!onay) return;
    setBusy(true); setError("");
    let query = supabase.from(tablo).delete().eq("bolum", filtreBolum);
    if (filtreSinif) query = query.eq("sinif", filtreSinif);
    const { error: err } = await query;
    if (err) setError("Silinemedi: " + err.message);
    else { setMessage("Filtrelenen kayıtlar silindi."); await loadAll(); }
    setBusy(false);
  }

  const filtrelenmisDers = dersListe.filter((d) => (!filtreBolum || d.bolum === filtreBolum) && (!filtreSinif || d.sinif === filtreSinif));
  const filtrelenmisSinav = sinavListe.filter((s) => (!filtreBolum || s.bolum === filtreBolum) && (!filtreSinif || s.sinif === filtreSinif));

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg, #f5f8fc)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", color: "var(--ink, #0f1b33)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid var(--line, #e3ebf6)", background: "var(--white, #fff)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid var(--line, #e3ebf6)", background: "var(--bg, #f5f8fc)", color: "var(--blue-700, #175cd3)", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 820, letterSpacing: ".12em", color: "var(--blue-700, #175cd3)" }}>VOL 1-8 · DERS VE SINAV TAKVİMİ</div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.02em" }}>Ders Programı & Sınav Takvimi Yönetimi</div>
          </div>
        </div>
        <Link href="/" className="button button-secondary" style={{ minHeight: 40, padding: "0 16px", fontSize: 13 }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(1080px, 100%)", margin: "0 auto", padding: "28px 20px 60px" }}>
        {loading ? (
          <p style={{ color: "var(--slate)", fontSize: 13 }}>Yükleniyor…</p>
        ) : error && dersListe.length === 0 && sinavListe.length === 0 && !dersOnizleme && !sinavOnizleme ? (
          <div style={{ padding: 20, borderRadius: 14, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13 }}>{error}</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              <button type="button" onClick={() => setTab("ders")} style={{ padding: "10px 18px", borderRadius: 999, border: tab === "ders" ? "1px solid #175cd3" : "1px solid #e3ebf6", background: tab === "ders" ? "#175cd3" : "#fff", color: tab === "ders" ? "#fff" : "#5b6b85", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Ders Programı</button>
              <button type="button" onClick={() => setTab("sinav")} style={{ padding: "10px 18px", borderRadius: 999, border: tab === "sinav" ? "1px solid #175cd3" : "1px solid #e3ebf6", background: tab === "sinav" ? "#175cd3" : "#fff", color: tab === "sinav" ? "#fff" : "#5b6b85", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Sınav Takvimi</button>
            </div>

            {error ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}
            {message ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#effbf6", border: "1px solid #bde5d5", color: "#0b5c42", fontSize: 13, fontWeight: 600 }}>{message}</div> : null}

            {tab === "ders" && (
              <>
                <section style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 20, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>Excel ile toplu içe aktar</div>
                      <div style={{ fontSize: 12, color: "#5b6b85", marginTop: 2 }}>Bölüm, Sınıf, Ders Kodu, Ders Adı, Gün, Başlangıç/Bitiş Saati, Derslik, Öğretim Üyesi sütunlarını içeren bir .xlsx dosyası yükle.</div>
                    </div>
                    <button type="button" onClick={indirDersProgramiSablonu} style={{ minHeight: 38, padding: "0 14px", fontSize: 12, fontWeight: 700, borderRadius: 10, border: "1px solid #c7deff", background: "#fff", color: "#0e4bae", cursor: "pointer", whiteSpace: "nowrap" }}>Şablonu İndir</button>
                  </div>
                  <input type="file" accept=".xlsx,.xls" onChange={handleDersDosya} disabled={busy} style={{ fontSize: 13 }} />

                  {dersOnizleme && (
                    <div style={{ marginTop: 16, border: "1px solid #e3ebf6", borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                        {dersOnizleme.toplamSatir} satır okundu · <span style={{ color: "#22b879" }}>{dersOnizleme.gecerli.length} geçerli</span>
                        {dersOnizleme.hatalar.length > 0 && <span style={{ color: "#984333" }}> · {dersOnizleme.hatalar.length} hatalı</span>}
                      </div>
                      {dersOnizleme.hatalar.length > 0 && (
                        <div style={{ maxHeight: 140, overflowY: "auto", marginBottom: 10, fontSize: 11, color: "#984333" }}>
                          {dersOnizleme.hatalar.map((h, i) => <div key={i}>Satır {h.satir}: {h.mesaj}</div>)}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 10 }}>
                        <button type="button" onClick={handleDersIceAktar} disabled={busy || !dersOnizleme.gecerli.length} className="button button-primary" style={{ minHeight: 38, padding: "0 16px", fontSize: 12 }}>
                          {busy ? "…" : `${dersOnizleme.gecerli.length} satırı içe aktar`}
                        </button>
                        <button type="button" onClick={() => setDersOnizleme(null)} style={{ minHeight: 38, padding: "0 14px", fontSize: 12, border: "1px solid #e3ebf6", background: "#fff", borderRadius: 10, cursor: "pointer" }}>Vazgeç</button>
                      </div>
                    </div>
                  )}
                </section>

                <details style={{ marginBottom: 20 }}>
                  <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#175cd3" }}>+ Tek satır elle ekle</summary>
                  <form onSubmit={handleDersManuelEkle} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 14, padding: 18, marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                    <label style={labelStyle}>Bölüm *<input style={inputStyle} value={dersForm.bolum} onChange={(e) => setDersForm((f) => ({ ...f, bolum: e.target.value }))} /></label>
                    <label style={labelStyle}>Sınıf *<input style={inputStyle} value={dersForm.sinif} onChange={(e) => setDersForm((f) => ({ ...f, sinif: e.target.value }))} placeholder="1, 2, 3, 4" /></label>
                    <label style={labelStyle}>Ders Kodu<input style={inputStyle} value={dersForm.ders_kodu} onChange={(e) => setDersForm((f) => ({ ...f, ders_kodu: e.target.value }))} /></label>
                    <label style={labelStyle}>Ders Adı *<input style={inputStyle} value={dersForm.ders_adi} onChange={(e) => setDersForm((f) => ({ ...f, ders_adi: e.target.value }))} /></label>
                    <label style={labelStyle}>Gün *
                      <select style={inputStyle} value={dersForm.gun} onChange={(e) => setDersForm((f) => ({ ...f, gun: e.target.value }))}>
                        {GUNLER.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </label>
                    <label style={labelStyle}>Başlangıç Saati *<input style={inputStyle} type="time" value={dersForm.baslangic_saat} onChange={(e) => setDersForm((f) => ({ ...f, baslangic_saat: e.target.value }))} /></label>
                    <label style={labelStyle}>Bitiş Saati *<input style={inputStyle} type="time" value={dersForm.bitis_saat} onChange={(e) => setDersForm((f) => ({ ...f, bitis_saat: e.target.value }))} /></label>
                    <label style={labelStyle}>Derslik<input style={inputStyle} value={dersForm.derslik} onChange={(e) => setDersForm((f) => ({ ...f, derslik: e.target.value }))} /></label>
                    <label style={labelStyle}>Öğretim Üyesi<input style={inputStyle} value={dersForm.hoca_adi} onChange={(e) => setDersForm((f) => ({ ...f, hoca_adi: e.target.value }))} /></label>
                    <div style={{ alignSelf: "end" }}>
                      <button type="submit" disabled={busy} className="button button-primary" style={{ minHeight: 42, padding: "0 16px", fontSize: 12, width: "100%" }}>Ekle</button>
                    </div>
                  </form>
                </details>

                <section style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 20 }}>
                  <FiltreBar bolumSecenekleri={bolumSecenekleri} filtreBolum={filtreBolum} setFiltreBolum={setFiltreBolum} filtreSinif={filtreSinif} setFiltreSinif={setFiltreSinif} onToplu={() => handleFiltrelenenleriSil("ders_programi")} busy={busy} />
                  <div style={{ fontSize: 12, color: "var(--muted)", margin: "10px 0" }}>{filtrelenmisDers.length} kayıt</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {filtrelenmisDers.map((d) => (
                      <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #e3ebf6", borderRadius: 10, fontSize: 12.5, flexWrap: "wrap" }}>
                        <div>
                          <b>{d.ders_adi}</b> {d.ders_kodu ? `(${d.ders_kodu})` : ""} · {d.bolum} / {d.sinif}. sınıf
                          <div style={{ color: "#5b6b85", marginTop: 2 }}>{d.gun} {d.baslangic_saat}–{d.bitis_saat} {d.derslik ? `· ${d.derslik}` : ""} {d.hoca_adi ? `· ${d.hoca_adi}` : ""}</div>
                        </div>
                        <button onClick={() => handleSil("ders_programi", d.id)} disabled={busy} style={{ minHeight: 30, padding: "0 10px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", cursor: "pointer" }}>Sil</button>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {tab === "sinav" && (
              <>
                <section style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 20, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>Excel ile toplu içe aktar</div>
                      <div style={{ fontSize: 12, color: "#5b6b85", marginTop: 2 }}>Bölüm, Sınıf, Ders Kodu, Ders Adı, Sınav Türü, Tarih, Saat, Derslik, Öğretim Üyesi sütunlarını içeren bir .xlsx dosyası yükle.</div>
                    </div>
                    <button type="button" onClick={indirSinavTakvimiSablonu} style={{ minHeight: 38, padding: "0 14px", fontSize: 12, fontWeight: 700, borderRadius: 10, border: "1px solid #c7deff", background: "#fff", color: "#0e4bae", cursor: "pointer", whiteSpace: "nowrap" }}>Şablonu İndir</button>
                  </div>
                  <input type="file" accept=".xlsx,.xls" onChange={handleSinavDosya} disabled={busy} style={{ fontSize: 13 }} />

                  {sinavOnizleme && (
                    <div style={{ marginTop: 16, border: "1px solid #e3ebf6", borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                        {sinavOnizleme.toplamSatir} satır okundu · <span style={{ color: "#22b879" }}>{sinavOnizleme.gecerli.length} geçerli</span>
                        {sinavOnizleme.hatalar.length > 0 && <span style={{ color: "#984333" }}> · {sinavOnizleme.hatalar.length} hatalı</span>}
                      </div>
                      {sinavOnizleme.hatalar.length > 0 && (
                        <div style={{ maxHeight: 140, overflowY: "auto", marginBottom: 10, fontSize: 11, color: "#984333" }}>
                          {sinavOnizleme.hatalar.map((h, i) => <div key={i}>Satır {h.satir}: {h.mesaj}</div>)}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 10 }}>
                        <button type="button" onClick={handleSinavIceAktar} disabled={busy || !sinavOnizleme.gecerli.length} className="button button-primary" style={{ minHeight: 38, padding: "0 16px", fontSize: 12 }}>
                          {busy ? "…" : `${sinavOnizleme.gecerli.length} satırı içe aktar`}
                        </button>
                        <button type="button" onClick={() => setSinavOnizleme(null)} style={{ minHeight: 38, padding: "0 14px", fontSize: 12, border: "1px solid #e3ebf6", background: "#fff", borderRadius: 10, cursor: "pointer" }}>Vazgeç</button>
                      </div>
                    </div>
                  )}
                </section>

                <details style={{ marginBottom: 20 }}>
                  <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#175cd3" }}>+ Tek satır elle ekle</summary>
                  <form onSubmit={handleSinavManuelEkle} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 14, padding: 18, marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                    <label style={labelStyle}>Bölüm *<input style={inputStyle} value={sinavForm.bolum} onChange={(e) => setSinavForm((f) => ({ ...f, bolum: e.target.value }))} /></label>
                    <label style={labelStyle}>Sınıf *<input style={inputStyle} value={sinavForm.sinif} onChange={(e) => setSinavForm((f) => ({ ...f, sinif: e.target.value }))} placeholder="1, 2, 3, 4" /></label>
                    <label style={labelStyle}>Ders Kodu<input style={inputStyle} value={sinavForm.ders_kodu} onChange={(e) => setSinavForm((f) => ({ ...f, ders_kodu: e.target.value }))} /></label>
                    <label style={labelStyle}>Ders Adı *<input style={inputStyle} value={sinavForm.ders_adi} onChange={(e) => setSinavForm((f) => ({ ...f, ders_adi: e.target.value }))} /></label>
                    <label style={labelStyle}>Sınav Türü *
                      <select style={inputStyle} value={sinavForm.sinav_turu} onChange={(e) => setSinavForm((f) => ({ ...f, sinav_turu: e.target.value }))}>
                        {SINAV_TURLERI.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                    <label style={labelStyle}>Tarih *<input style={inputStyle} type="date" value={sinavForm.tarih} onChange={(e) => setSinavForm((f) => ({ ...f, tarih: e.target.value }))} /></label>
                    <label style={labelStyle}>Saat *<input style={inputStyle} type="time" value={sinavForm.saat} onChange={(e) => setSinavForm((f) => ({ ...f, saat: e.target.value }))} /></label>
                    <label style={labelStyle}>Derslik<input style={inputStyle} value={sinavForm.derslik} onChange={(e) => setSinavForm((f) => ({ ...f, derslik: e.target.value }))} /></label>
                    <label style={labelStyle}>Öğretim Üyesi<input style={inputStyle} value={sinavForm.hoca_adi} onChange={(e) => setSinavForm((f) => ({ ...f, hoca_adi: e.target.value }))} /></label>
                    <div style={{ alignSelf: "end" }}>
                      <button type="submit" disabled={busy} className="button button-primary" style={{ minHeight: 42, padding: "0 16px", fontSize: 12, width: "100%" }}>Ekle</button>
                    </div>
                  </form>
                </details>

                <section style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 20 }}>
                  <FiltreBar bolumSecenekleri={bolumSecenekleri} filtreBolum={filtreBolum} setFiltreBolum={setFiltreBolum} filtreSinif={filtreSinif} setFiltreSinif={setFiltreSinif} onToplu={() => handleFiltrelenenleriSil("sinav_takvimi")} busy={busy} />
                  <div style={{ fontSize: 12, color: "var(--muted)", margin: "10px 0" }}>{filtrelenmisSinav.length} kayıt</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {filtrelenmisSinav.map((s) => (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #e3ebf6", borderRadius: 10, fontSize: 12.5, flexWrap: "wrap" }}>
                        <div>
                          <b>{s.ders_adi}</b> {s.ders_kodu ? `(${s.ders_kodu})` : ""} · {s.bolum} / {s.sinif}. sınıf
                          <div style={{ color: "#5b6b85", marginTop: 2 }}>{s.sinav_turu} · {s.tarih} {s.saat} {s.derslik ? `· ${s.derslik}` : ""} {s.hoca_adi ? `· ${s.hoca_adi}` : ""}</div>
                        </div>
                        <button onClick={() => handleSil("sinav_takvimi", s.id)} disabled={busy} style={{ minHeight: 30, padding: "0 10px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", cursor: "pointer" }}>Sil</button>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function FiltreBar({ bolumSecenekleri, filtreBolum, setFiltreBolum, filtreSinif, setFiltreSinif, onToplu, busy }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
      <label style={{ ...labelStyle, minWidth: 180 }}>Bölüm filtrele
        <select style={inputStyle} value={filtreBolum} onChange={(e) => setFiltreBolum(e.target.value)}>
          <option value="">Tümü</option>
          {bolumSecenekleri.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </label>
      <label style={{ ...labelStyle, minWidth: 120 }}>Sınıf filtrele
        <input style={inputStyle} value={filtreSinif} onChange={(e) => setFiltreSinif(e.target.value)} placeholder="ör. 2" />
      </label>
      <button type="button" onClick={onToplu} disabled={busy || !filtreBolum} style={{ minHeight: 42, padding: "0 14px", fontSize: 12, fontWeight: 700, borderRadius: 10, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", cursor: busy || !filtreBolum ? "not-allowed" : "pointer", opacity: !filtreBolum ? 0.5 : 1 }}>
        Filtrelenenleri Sil
      </button>
    </div>
  );
}
