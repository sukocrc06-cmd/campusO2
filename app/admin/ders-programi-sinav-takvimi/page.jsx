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

const DERS_BOS_FORM = { bolum: "", sinif: "", ders_kodu: "", ders_adi: "", gun: GUNLER[0], baslangic_saat: "", bitis_saat: "", derslik: "", hoca_adi: "", hoca_email: "" };
const SINAV_BOS_FORM = { bolum: "", sinif: "", ders_kodu: "", ders_adi: "", sinav_turu: SINAV_TURLERI[0], tarih: "", saat: "", derslik: "", hoca_adi: "" };

const DONEM_ETIKET = { guz: "Güz", bahar: "Bahar" };

// Bölüm/Sınıf bazlı katlanabilir gruplar — uzun düz listeleri (163+ kayıt)
// varsayılan kapalı, kısa başlıklara ayırarak admin panelindeki sonu gelmeyen
// scroll sorununu çözer. Her grup { bolum, sinif, kayitlar } biçiminde döner.
function gruplaBolumSinif(liste) {
  const gruplar = new Map();
  for (const kayit of liste) {
    const bolum = kayit.bolum || "Bölüm belirtilmemiş";
    const sinif = kayit.sinif || "?";
    const anahtar = `${bolum}||${sinif}`;
    if (!gruplar.has(anahtar)) gruplar.set(anahtar, { bolum, sinif, kayitlar: [] });
    gruplar.get(anahtar).kayitlar.push(kayit);
  }
  return Array.from(gruplar.values()).sort((a, b) => {
    const bolumFark = a.bolum.localeCompare(b.bolum, "tr-TR");
    if (bolumFark !== 0) return bolumFark;
    return a.sinif.localeCompare(b.sinif, "tr-TR", { numeric: true });
  });
}

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
  const [akademisyenler, setAkademisyenler] = useState([]);
  const [onayBekleyenler, setOnayBekleyenler] = useState([]);
  const [adminId, setAdminId] = useState(null);

  // Güz/Bahar dönem ayrımı: "aktifDonem" tüm sistemde (öğrenci/akademisyen
  // ders programı, yoklama, QR yoklama) canlı olarak gösterilen dönemdir —
  // admin panelinden değiştirilince her yere otomatik yansır. "donemGoruntule"
  // ise SADECE bu admin ekranında hangi dönemin görüntülendiğini/düzenlendiğini
  // belirler (varsayılan olarak aktif dönemle aynı başlar, admin isterse diğer
  // dönemi görüntüleyip düzenleyebilir — aktif dönemi değiştirmeden).
  const [aktifDonem, setAktifDonem] = useState("bahar");
  const [donemGoruntule, setDonemGoruntule] = useState("bahar");
  const [donemKaydediliyor, setDonemKaydediliyor] = useState(false);

  function hocaAdinaGoreAkademisyenBul(hocaAdi) {
    if (!hocaAdi) return null;
    const temiz = hocaAdi.trim().toLocaleLowerCase("tr-TR");
    const eslesen = akademisyenler.find((a) => (a.full_name || "").trim().toLocaleLowerCase("tr-TR") === temiz);
    return eslesen?.id || null;
  }

  async function loadAll() {
    const [{ data: d, error: dErr }, { data: s, error: sErr }, { data: akademisyenListe }, { data: oneriListe, error: oErr }, { data: donemSatiri }] = await Promise.all([
      supabase.from("ders_programi").select("*").order("bolum").order("sinif").order("gun").order("baslangic_saat"),
      supabase.from("sinav_takvimi").select("*").order("bolum").order("sinif").order("tarih").order("saat"),
      supabase.from("profiles").select("id, full_name").eq("role", "academician"),
      supabase.from("akademisyen_eslesme_onerileri")
        .select("*, ders_programi(id, ders_adi, ders_kodu, bolum, sinif, hoca_adi), akademisyen:profiles!onerilen_akademisyen_id(id, full_name, email)")
        .eq("durum", "bekliyor")
        .order("olusturulma_zamani"),
      supabase.from("aktif_donem").select("donem").eq("id", true).maybeSingle(),
    ]);
    if (dErr) setError("Ders programı alınamadı: " + dErr.message);
    else setDersListe(d || []);
    if (sErr) setError((prev) => prev || "Sınav takvimi alınamadı: " + sErr.message);
    else setSinavListe(s || []);
    setAkademisyenler(akademisyenListe || []);
    if (!oErr) setOnayBekleyenler(oneriListe || []);
    if (donemSatiri?.donem) {
      setAktifDonem(donemSatiri.donem);
      setDonemGoruntule((prev) => prev || donemSatiri.donem);
    }
  }

  async function handleAktifDonemDegistir(yeniDonem) {
    if (yeniDonem === aktifDonem || donemKaydediliyor) return;
    const onay = window.confirm(
      `Aktif dönemi "${DONEM_ETIKET[yeniDonem]}" yapmak istediğine emin misin? Bu değişiklik ANINDA tüm öğrenci/akademisyen ders programı, yoklama ve QR yoklama ekranlarına yansır.`,
    );
    if (!onay) return;
    setDonemKaydediliyor(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("aktif_donem").update({ donem: yeniDonem }).eq("id", true);
    if (err) setError("Aktif dönem değiştirilemedi: " + err.message);
    else { setAktifDonem(yeniDonem); setMessage(`Aktif dönem "${DONEM_ETIKET[yeniDonem]}" olarak ayarlandı — tüm ekranlara yansıdı.`); }
    setDonemKaydediliyor(false);
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

  const bolumSecenekleri = useMemo(() => {
    const set = new Set([
      ...dersListe.filter((d) => (d.donem || "bahar") === donemGoruntule).map((d) => d.bolum),
      ...sinavListe.filter((s) => (s.donem || "bahar") === donemGoruntule).map((s) => s.bolum),
    ]);
    return Array.from(set).filter(Boolean).sort();
  }, [dersListe, sinavListe, donemGoruntule]);

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
    const satirlar = dersOnizleme.gecerli.map((satir) => {
      const eslesenId = hocaAdinaGoreAkademisyenBul(satir.hoca_adi);
      return { ...satir, akademisyen_id: eslesenId, akademisyen_id_manuel: !!eslesenId, donem: donemGoruntule };
    });
    const eslesenSayisi = satirlar.filter((s) => s.akademisyen_id).length;
    const { error: err } = await supabase.from("ders_programi").insert(satirlar);
    if (err) setError("İçe aktarılamadı: " + err.message);
    else { setMessage(`${satirlar.length} ders programı satırı eklendi${eslesenSayisi > 0 ? ` (${eslesenSayisi} satırda öğretim üyesi hesabı otomatik eşleşti)` : ""}.`); setDersOnizleme(null); await loadAll(); }
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
    const satirlar = sinavOnizleme.gecerli.map((satir) => ({ ...satir, donem: donemGoruntule }));
    const { error: err } = await supabase.from("sinav_takvimi").insert(satirlar);
    if (err) setError("İçe aktarılamadı: " + err.message);
    else { setMessage(`${sinavOnizleme.gecerli.length} sınav takvimi satırı eklendi.`); setSinavOnizleme(null); await loadAll(); }
    setBusy(false);
  }

  async function handleDersManuelEkle(e) {
    e.preventDefault();
    if (!dersForm.bolum.trim() || !dersForm.sinif.trim() || !dersForm.ders_adi.trim()) {
      setError("Bölüm, sınıf ve ders adı zorunludur.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("ders_programi").insert([{
      bolum: dersForm.bolum.trim(), sinif: dersForm.sinif.trim(), ders_kodu: dersForm.ders_kodu.trim() || null,
      ders_adi: dersForm.ders_adi.trim(), gun: dersForm.gun, baslangic_saat: dersForm.baslangic_saat || null, bitis_saat: dersForm.bitis_saat || null,
      derslik: dersForm.derslik.trim() || null, hoca_adi: dersForm.hoca_adi.trim() || null,
      hoca_email: dersForm.hoca_email.trim() || null,
      akademisyen_id: hocaAdinaGoreAkademisyenBul(dersForm.hoca_adi.trim()),
      akademisyen_id_manuel: !!hocaAdinaGoreAkademisyenBul(dersForm.hoca_adi.trim()),
      donem: donemGoruntule,
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
      donem: donemGoruntule,
    }]);
    if (err) setError("Eklenemedi: " + err.message);
    else { setMessage("Sınav eklendi."); setSinavForm(SINAV_BOS_FORM); await loadAll(); }
    setBusy(false);
  }

  async function handleOneriOnayla(oneri) {
    setBusy(true); setError(""); setMessage("");
    const { error: err1 } = await supabase.from("ders_programi").update({
      akademisyen_id: oneri.onerilen_akademisyen_id, akademisyen_id_manuel: true, eslesme_kaynagi: "admin_onay",
    }).eq("id", oneri.ders_id);
    if (err1) { setError("Onaylanamadı: " + err1.message); setBusy(false); return; }
    const { error: err2 } = await supabase.from("akademisyen_eslesme_onerileri").update({
      durum: "onaylandi", karar_zamani: new Date().toISOString(), karar_veren_id: adminId,
    }).eq("id", oneri.id);
    if (err2) setError("Öneri güncellenemedi: " + err2.message);
    else setMessage("Eşleşme onaylandı.");
    await loadAll();
    setBusy(false);
  }

  async function handleOneriReddet(oneri) {
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("akademisyen_eslesme_onerileri").update({
      durum: "reddedildi", karar_zamani: new Date().toISOString(), karar_veren_id: adminId,
    }).eq("id", oneri.id);
    if (err) setError("Reddedilemedi: " + err.message);
    else setMessage("Eşleşme önerisi reddedildi.");
    await loadAll();
    setBusy(false);
  }

  async function handleHocaEmailDuzenle(ders) {
    const yeni = window.prompt("Bu dersi veren hocanın e-postası (Supabase Auth ile giriş yaptığı e-posta):", ders.hoca_email || "");
    if (yeni === null) return;
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("ders_programi").update({ hoca_email: yeni.trim() || null }).eq("id", ders.id);
    if (err) setError("E-posta kaydedilemedi: " + err.message);
    else { setMessage("E-posta kaydedildi. Hoca bu e-posta ile giriş yaptığında ders otomatik ve güvenli şekilde bağlanacak."); await loadAll(); }
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
    let query = supabase.from(tablo).delete().eq("bolum", filtreBolum).eq("donem", donemGoruntule);
    if (filtreSinif) query = query.eq("sinif", filtreSinif);
    const { error: err } = await query;
    if (err) setError("Silinemedi: " + err.message);
    else { setMessage("Filtrelenen kayıtlar silindi."); await loadAll(); }
    setBusy(false);
  }

  const filtrelenmisDers = dersListe.filter((d) => (d.donem || "bahar") === donemGoruntule && (!filtreBolum || d.bolum === filtreBolum) && (!filtreSinif || d.sinif === filtreSinif));
  const filtrelenmisSinav = sinavListe.filter((s) => (s.donem || "bahar") === donemGoruntule && (!filtreBolum || s.bolum === filtreBolum) && (!filtreSinif || s.sinif === filtreSinif));

  // Bölüm/Sınıf bazlı katlanabilir gruplar — 163+ kaydı tek düz liste yerine
  // varsayılan kapalı başlıklara ayırarak scroll'u kısaltır.
  const dersGruplari = useMemo(() => gruplaBolumSinif(filtrelenmisDers), [filtrelenmisDers]);
  const sinavGruplari = useMemo(() => gruplaBolumSinif(filtrelenmisSinav), [filtrelenmisSinav]);

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
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin/yoklama" style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid #c7deff", color: "#0e4bae" }}>Yoklama Yönetimi</Link>
          <Link href="/" className="button button-secondary" style={{ minHeight: 40, padding: "0 16px", fontSize: 13 }}>Panele dön</Link>
        </div>
      </header>

      <main style={{ width: "min(1080px, 100%)", margin: "0 auto", padding: "28px 20px 60px" }}>
        {loading ? (
          <p style={{ color: "var(--slate)", fontSize: 13 }}>Yükleniyor…</p>
        ) : error && dersListe.length === 0 && sinavListe.length === 0 && !dersOnizleme && !sinavOnizleme ? (
          <div style={{ padding: 20, borderRadius: 14, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13 }}>{error}</div>
        ) : (
          <>
            <section style={{ background: "#fffaf0", border: "1px solid #f4d9a8", borderRadius: 16, padding: "14px 18px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#8a5a12" }}>🔄 Şu an sistemde AKTİF dönem: {DONEM_ETIKET[aktifDonem]}</div>
                <div style={{ fontSize: 11.5, color: "#8a5a12", marginTop: 2 }}>Öğrenci/akademisyen ders programı, yoklama ve QR yoklama ekranlarında görünen dönem budur.</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {["guz", "bahar"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    disabled={donemKaydediliyor || d === aktifDonem}
                    onClick={() => handleAktifDonemDegistir(d)}
                    style={{
                      padding: "9px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: d === aktifDonem ? "default" : "pointer",
                      border: d === aktifDonem ? "1px solid #22b879" : "1px solid #f4d9a8",
                      background: d === aktifDonem ? "#e3faf0" : "#fff",
                      color: d === aktifDonem ? "#0b8f5c" : "#8a5a12",
                    }}
                  >
                    {d === aktifDonem ? `✓ ${DONEM_ETIKET[d]} (aktif)` : `${DONEM_ETIKET[d]}'ı aktif yap`}
                  </button>
                ))}
              </div>
            </section>

            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#5b6b85" }}>Görüntülenen/düzenlenen dönem:</span>
              {["guz", "bahar"].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDonemGoruntule(d)}
                  style={{ padding: "7px 14px", borderRadius: 999, border: donemGoruntule === d ? "1px solid #175cd3" : "1px solid #e3ebf6", background: donemGoruntule === d ? "#175cd3" : "#fff", color: donemGoruntule === d ? "#fff" : "#5b6b85", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                >
                  {DONEM_ETIKET[d]}
                </button>
              ))}
            </div>

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
                    <label style={labelStyle}>Başlangıç Saati (varsa)<input style={inputStyle} type="time" value={dersForm.baslangic_saat} onChange={(e) => setDersForm((f) => ({ ...f, baslangic_saat: e.target.value }))} /></label>
                    <label style={labelStyle}>Bitiş Saati (varsa)<input style={inputStyle} type="time" value={dersForm.bitis_saat} onChange={(e) => setDersForm((f) => ({ ...f, bitis_saat: e.target.value }))} /></label>
                    <label style={labelStyle}>Derslik<input style={inputStyle} value={dersForm.derslik} onChange={(e) => setDersForm((f) => ({ ...f, derslik: e.target.value }))} /></label>
                    <label style={labelStyle}>Öğretim Üyesi<input style={inputStyle} value={dersForm.hoca_adi} onChange={(e) => setDersForm((f) => ({ ...f, hoca_adi: e.target.value }))} /></label>
                    <label style={labelStyle}>Hoca E-postası (varsa)<input style={inputStyle} type="email" placeholder="hoca@aybu.edu.tr" value={dersForm.hoca_email} onChange={(e) => setDersForm((f) => ({ ...f, hoca_email: e.target.value }))} /></label>
                    <div style={{ alignSelf: "end" }}>
                      <button type="submit" disabled={busy} className="button button-primary" style={{ minHeight: 42, padding: "0 16px", fontSize: 12, width: "100%" }}>Ekle</button>
                    </div>
                  </form>
                </details>

                {onayBekleyenler.length > 0 && (
                  <section style={{ background: "#fffaf0", border: "1px solid #f4d9a8", borderRadius: 16, padding: 20, marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#8a5a12", marginBottom: 4 }}>⚠ Onay bekleyen akademisyen eşleşmeleri ({onayBekleyenler.length})</div>
                    <div style={{ fontSize: 12, color: "#8a5a12", marginBottom: 12 }}>
                      Bir akademisyen hesabının adı, bir ders satırındaki öğretim üyesi adıyla eşleşti. Güvenlik nedeniyle bu eşleşme sadece SEN onaylarsan hesaba bağlanır — aksi halde hesap o dersi/yoklamayı göremez.
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {onayBekleyenler.map((o) => (
                        <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #f4d9a8", borderRadius: 10, fontSize: 12.5, flexWrap: "wrap", background: "#fff" }}>
                          <div>
                            <b>{o.akademisyen?.full_name || "(isim yok)"}</b> ({o.akademisyen?.email || "e-posta yok"})
                            <div style={{ color: "#5b6b85", marginTop: 2 }}>
                              → {o.ders_programi?.ders_adi} {o.ders_programi?.ders_kodu ? `(${o.ders_programi.ders_kodu})` : ""} · {o.ders_programi?.bolum} / {o.ders_programi?.sinif}. sınıf
                              <br />Ders satırındaki hoca adı: <i>{o.ders_programi?.hoca_adi}</i>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => handleOneriOnayla(o)} disabled={busy} style={{ minHeight: 32, padding: "0 12px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "none", background: "#22b879", color: "#fff", cursor: "pointer" }}>✓ Onayla</button>
                            <button onClick={() => handleOneriReddet(o)} disabled={busy} style={{ minHeight: 32, padding: "0 12px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", cursor: "pointer" }}>✕ Reddet</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 20 }}>
                  <FiltreBar bolumSecenekleri={bolumSecenekleri} filtreBolum={filtreBolum} setFiltreBolum={setFiltreBolum} filtreSinif={filtreSinif} setFiltreSinif={setFiltreSinif} onToplu={() => handleFiltrelenenleriSil("ders_programi")} busy={busy} />
                  <div style={{ fontSize: 12, color: "var(--muted)", margin: "10px 0" }}>{filtrelenmisDers.length} kayıt · {dersGruplari.length} bölüm/sınıf grubu</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {dersGruplari.map((grup) => (
                      <details key={`${grup.bolum}||${grup.sinif}`} style={{ border: "1px solid #e3ebf6", borderRadius: 12, overflow: "hidden" }}>
                        <summary style={{ cursor: "pointer", listStyle: "none", padding: "12px 14px", fontSize: 12.5, fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f5f8fc" }}>
                          <span>{grup.bolum} / {grup.sinif}. sınıf</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#5b6b85" }}>{grup.kayitlar.length} ders</span>
                        </summary>
                        <div style={{ display: "grid", gap: 8, padding: 10 }}>
                          {grup.kayitlar.map((d) => (
                            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #e3ebf6", borderRadius: 10, fontSize: 12.5, flexWrap: "wrap" }}>
                              <div>
                                <b>{d.ders_adi}</b> {d.ders_kodu ? `(${d.ders_kodu})` : ""} · {d.bolum} / {d.sinif}. sınıf
                                <div style={{ color: "#5b6b85", marginTop: 2 }}>{d.gun}{d.baslangic_saat && d.bitis_saat ? ` ${d.baslangic_saat}–${d.bitis_saat}` : " · saat girilmedi"} {d.derslik ? `· ${d.derslik}` : ""} {d.hoca_adi ? `· ${d.hoca_adi}` : ""}</div>
                                {d.hoca_adi && (
                                  <div style={{ marginTop: 3, fontSize: 10.5, fontWeight: 700, color: d.akademisyen_id ? "#0b8f5c" : "#c65d1f" }}>
                                    {d.akademisyen_id
                                      ? `✓ Yoklama için hesap bağlı${d.eslesme_kaynagi === "email" ? " (e-posta ile otomatik)" : d.eslesme_kaynagi === "katalog" ? " (resmi ders kataloğuyla otomatik doğrulandı)" : d.eslesme_kaynagi === "admin_onay" ? " (admin onaylı)" : d.eslesme_kaynagi === "admin_manuel" ? " (admin atadı)" : ""}`
                                      : "⚠ Yoklama hesabı bağlanmadı — Yoklama Yönetimi'nden ata veya hoca e-postasını gir"}
                                  </div>
                                )}
                                <button type="button" onClick={() => handleHocaEmailDuzenle(d)} disabled={busy} style={{ marginTop: 3, fontSize: 10, fontWeight: 700, border: "none", background: "none", color: "#175cd3", cursor: "pointer", padding: 0 }}>
                                  {d.hoca_email ? `✉ ${d.hoca_email} (düzenle)` : "✉ Hoca e-postasını gir (güvenli otomatik eşleşme için)"}
                                </button>
                              </div>
                              <button onClick={() => handleSil("ders_programi", d.id)} disabled={busy} style={{ minHeight: 30, padding: "0 10px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", cursor: "pointer" }}>Sil</button>
                            </div>
                          ))}
                        </div>
                      </details>
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
                  <div style={{ fontSize: 12, color: "var(--muted)", margin: "10px 0" }}>{filtrelenmisSinav.length} kayıt · {sinavGruplari.length} bölüm/sınıf grubu</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {sinavGruplari.map((grup) => (
                      <details key={`${grup.bolum}||${grup.sinif}`} style={{ border: "1px solid #e3ebf6", borderRadius: 12, overflow: "hidden" }}>
                        <summary style={{ cursor: "pointer", listStyle: "none", padding: "12px 14px", fontSize: 12.5, fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f5f8fc" }}>
                          <span>{grup.bolum} / {grup.sinif}. sınıf</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#5b6b85" }}>{grup.kayitlar.length} sınav</span>
                        </summary>
                        <div style={{ display: "grid", gap: 8, padding: 10 }}>
                          {grup.kayitlar.map((s) => (
                            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #e3ebf6", borderRadius: 10, fontSize: 12.5, flexWrap: "wrap" }}>
                              <div>
                                <b>{s.ders_adi}</b> {s.ders_kodu ? `(${s.ders_kodu})` : ""} · {s.bolum} / {s.sinif}. sınıf
                                <div style={{ color: "#5b6b85", marginTop: 2 }}>{s.sinav_turu} · {s.tarih} {s.saat} {s.derslik ? `· ${s.derslik}` : ""} {s.hoca_adi ? `· ${s.hoca_adi}` : ""}</div>
                              </div>
                              <button onClick={() => handleSil("sinav_takvimi", s.id)} disabled={busy} style={{ minHeight: 30, padding: "0 10px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", cursor: "pointer" }}>Sil</button>
                            </div>
                          ))}
                        </div>
                      </details>
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
