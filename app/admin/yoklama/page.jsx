"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { YOKLAMA_DURUMLARI, devamYuzdesiHesapla } from "../../../lib/yoklama";

const inputStyle = { height: 36, padding: "0 10px", border: "1px solid #e3ebf6", borderRadius: 9, fontSize: 12.5, outline: "none" };

// campuso_normalize_ad / campuso_ad_eslesiyor_mu (SQL) ile aynı mantığın
// istemci tarafı karşılığı — toplu isim bazlı öneri ekranı için, ekstra
// sunucu gidiş-gelişi olmadan hızlı eşleşme önerisi üretir.
function normalizeAd(s) {
  if (!s) return "";
  let base = s.replace(/\b(Prof|Doç|Dr|Öğr|Gör|Üyesi|Arş|Yrd)\b\.?/gi, " ");
  base = base
    .replace(/İ/g, "i").replace(/I/g, "i").replace(/ı/g, "i")
    .replace(/Ş/g, "s").replace(/ş/g, "s")
    .replace(/Ğ/g, "g").replace(/ğ/g, "g")
    .replace(/Ü/g, "u").replace(/ü/g, "u")
    .replace(/Ö/g, "o").replace(/ö/g, "o")
    .replace(/Ç/g, "c").replace(/ç/g, "c")
    .replace(/[^a-z\s]/gi, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return base;
}
function adlarEslesiyorMu(a, b) {
  const na = normalizeAd(a);
  const nb = normalizeAd(b);
  if (na.length < 6 || nb.length < 6) return false;
  return na.includes(nb) || nb.includes(na);
}

export default function AdminYoklamaPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [dersler, setDersler] = useState([]);
  const [akademisyenler, setAkademisyenler] = useState([]);
  const [tumOturumlar, setTumOturumlar] = useState([]);
  const [tumKayitlar, setTumKayitlar] = useState([]);
  const [qrOturumIdSeti, setQrOturumIdSeti] = useState(new Set());
  const [profilMap, setProfilMap] = useState({});
  const [acikDers, setAcikDers] = useState(null);

  const [topluSecim, setTopluSecim] = useState({}); // grupAnahtari -> akademisyenId
  const [topluAramaMetni, setTopluAramaMetni] = useState({}); // grupAnahtari -> metin
  const [topluAramaSonuc, setTopluAramaSonuc] = useState({}); // grupAnahtari -> [profil]
  const [gizlenenGruplar, setGizlenenGruplar] = useState(new Set());
  const [atanmisAcik, setAtanmisAcik] = useState(null); // akademisyen_id
  const [aktifDonem, setAktifDonem] = useState("bahar");

  async function loadAll() {
    const { data: donemSatiri } = await supabase.from("aktif_donem").select("donem").eq("id", true).maybeSingle();
    const guncelDonem = donemSatiri?.donem || "bahar";
    setAktifDonem(guncelDonem);
    const [{ data: d, error: dErr }, { data: akademisyenListe }, { data: oturumlar }, { data: qrOturumlar }] = await Promise.all([
      supabase.from("ders_programi").select("*").eq("donem", guncelDonem).order("bolum").order("sinif").order("ders_adi"),
      supabase.from("profiles").select("id, full_name, email").eq("role", "academician").order("full_name"),
      supabase.from("yoklama_oturumlari").select("*"),
      supabase.from("yoklama_qr_oturumlari").select("oturum_id"),
    ]);
    if (dErr) setError("Dersler alınamadı: " + dErr.message);
    else setDersler(d || []);
    setAkademisyenler(akademisyenListe || []);
    setTumOturumlar(oturumlar || []);
    setQrOturumIdSeti(new Set((qrOturumlar || []).map((q) => q.oturum_id)));

    const oturumIdler = (oturumlar || []).map((o) => o.id);
    if (oturumIdler.length > 0) {
      const { data: kayitlar } = await supabase.from("yoklama_kayitlari").select("*").in("oturum_id", oturumIdler);
      setTumKayitlar(kayitlar || []);
      const ogrenciIdler = Array.from(new Set((kayitlar || []).map((k) => k.ogrenci_id)));
      if (ogrenciIdler.length > 0) {
        const { data: profiller } = await supabase.rpc("campuso_get_profiller", { p_user_ids: ogrenciIdler });
        const map = {};
        (profiller || []).forEach((p) => { map[p.id] = p; });
        setProfilMap(map);
      }
    } else {
      setTumKayitlar([]);
    }
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

  const dersIstatistikleri = useMemo(() => {
    const harita = new Map();
    dersler.forEach((d) => {
      const oturumIdler = tumOturumlar.filter((o) => o.ders_programi_id === d.id).map((o) => o.id);
      const kayitlar = tumKayitlar.filter((k) => oturumIdler.includes(k.oturum_id));
      const gruplu = new Map();
      kayitlar.forEach((k) => {
        if (!gruplu.has(k.ogrenci_id)) gruplu.set(k.ogrenci_id, []);
        gruplu.get(k.ogrenci_id).push(k);
      });
      const esik = d.asgari_devam_yuzdesi ?? 70;
      const devamsizlar = [];
      gruplu.forEach((kl, ogrenciId) => {
        const yuzde = devamYuzdesiHesapla(kl);
        if (yuzde !== null && yuzde < esik) devamsizlar.push({ ogrenciId, yuzde });
      });
      harita.set(d.id, { oturumSayisi: oturumIdler.length, ogrenciSayisi: gruplu.size, devamsizlar: devamsizlar.sort((a, b) => a.yuzde - b.yuzde) });
    });
    return harita;
  }, [dersler, tumOturumlar, tumKayitlar]);

  async function handleAkademisyenAta(dersId, akademisyenId) {
    setBusy(true); setError(""); setMessage("");
    // Elle yapılan bu seçim (boşa alma dahil) artık "manuel" işaretleniyor ki
    // sistemin arka planda çalışan otomatik hoca-eşleme mekanizması bu kararı
    // sonradan ezip tekrar otomatik bir hesaba bağlamasın.
    const { error: err } = await supabase.from("ders_programi").update({ akademisyen_id: akademisyenId || null, akademisyen_id_manuel: true, eslesme_kaynagi: akademisyenId ? "admin_manuel" : "yok" }).eq("id", dersId);
    if (err) setError("Atanamadı: " + err.message);
    else { setMessage("Akademisyen ataması güncellendi."); await loadAll(); }
    setBusy(false);
  }

  // Toplu isim bazlı atama: akademisyen_id boş olan tüm dersleri hoca_adi'ye
  // göre grupla (unvan/nokta farklarını normalize ederek), her grup için en
  // iyi isim eşleşmesini öner. Admin tek grup için tek tıkla o hocanın
  // TÜM derslerini birden atayabilir — 163 tekil karar yerine ~30-40 isim
  // bazlı karar.
  const topluGruplar = useMemo(() => {
    const haritasi = new Map(); // normalizeAd(hoca_adi) -> grup
    dersler.forEach((d) => {
      if (d.akademisyen_id || !d.hoca_adi || !d.hoca_adi.trim()) return;
      const anahtar = normalizeAd(d.hoca_adi);
      if (!anahtar) return;
      if (!haritasi.has(anahtar)) {
        haritasi.set(anahtar, { anahtar, gosterimAdi: d.hoca_adi, hocaAdiVaryantlari: new Set(), dersIdler: [], dersOzet: [] });
      }
      const grup = haritasi.get(anahtar);
      // En uzun (genelde unvanlı) varyantı gösterim adı olarak tut.
      if (d.hoca_adi.length > grup.gosterimAdi.length) grup.gosterimAdi = d.hoca_adi;
      grup.hocaAdiVaryantlari.add(d.hoca_adi);
      grup.dersIdler.push(d.id);
      grup.dersOzet.push(`${d.ders_kodu || ""} ${d.ders_adi || ""}`.trim());
    });
    return Array.from(haritasi.values())
      .map((grup) => {
        const oneri = akademisyenler.find((a) => adlarEslesiyorMu(a.full_name, grup.gosterimAdi));
        return { ...grup, hocaAdiVaryantlari: Array.from(grup.hocaAdiVaryantlari), onerilenId: oneri?.id || "" };
      })
      .sort((a, b) => b.dersIdler.length - a.dersIdler.length);
  }, [dersler, akademisyenler]);

  async function handleTopluAta(grup) {
    const akademisyenId = topluSecim[grup.anahtar] ?? grup.onerilenId;
    if (!akademisyenId) return;
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("ders_programi")
      .update({ akademisyen_id: akademisyenId, akademisyen_id_manuel: true, eslesme_kaynagi: "admin_manuel" })
      .in("id", grup.dersIdler);
    if (err) setError("Toplu atama başarısız: " + err.message);
    else { setMessage(`${grup.gosterimAdi}: ${grup.dersIdler.length} ders atandı.`); await loadAll(); }
    setBusy(false);
  }

  function handleTopluGizle(grup) {
    setGizlenenGruplar((prev) => new Set(prev).add(grup.anahtar));
  }

  async function handleTopluArama(grup, metin) {
    setTopluAramaMetni((prev) => ({ ...prev, [grup.anahtar]: metin }));
    if (!metin.trim()) { setTopluAramaSonuc((prev) => ({ ...prev, [grup.anahtar]: [] })); return; }
    const { data } = await supabase.rpc("campuso_profil_ara", { p_arama: metin.trim() });
    setTopluAramaSonuc((prev) => ({ ...prev, [grup.anahtar]: (data || []).filter((p) => p.role === "academician") }));
  }

  // "Ali İhsan hoca toplu atamada yok" gibi sorularda admin'in önce kontrol
  // edebilmesi için: zaten bir hesaba bağlanmış dersleri, hoca bazında
  // gruplayıp burada gösteriyoruz (toplu atama yalnızca akademisyen_id BOŞ
  // olanları listeler, o yüzden zaten atanmışlar orada görünmez).
  const atanmisGruplar = useMemo(() => {
    const harita = new Map(); // akademisyen_id -> grup
    dersler.forEach((d) => {
      if (!d.akademisyen_id) return;
      if (!harita.has(d.akademisyen_id)) harita.set(d.akademisyen_id, { akademisyenId: d.akademisyen_id, dersler: [] });
      harita.get(d.akademisyen_id).dersler.push(d);
    });
    return Array.from(harita.values())
      .map((grup) => ({ ...grup, akademisyen: akademisyenler.find((a) => a.id === grup.akademisyenId) || null }))
      .sort((a, b) => (a.akademisyen?.full_name || "").localeCompare(b.akademisyen?.full_name || "", "tr"));
  }, [dersler, akademisyenler]);

  const kaynakEtiket = { email: "e-posta", katalog: "katalog", admin_onay: "admin onaylı", admin_manuel: "admin atadı" };

  async function handleOturumSil(id) {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("yoklama_oturumlari").delete().eq("id", id);
    if (err) setError("Silinemedi: " + err.message);
    else { setMessage("Oturum silindi."); await loadAll(); }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg, #f5f8fc)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", color: "var(--ink, #0f1b33)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid var(--line, #e3ebf6)", background: "var(--white, #fff)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid var(--line, #e3ebf6)", background: "var(--bg, #f5f8fc)", color: "var(--blue-700, #175cd3)", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 820, letterSpacing: ".12em", color: "var(--blue-700, #175cd3)" }}>VOL 1-12 · YOKLAMA TAKİBİ</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.02em" }}>Yoklama Yönetimi</span>
              <span style={{ fontSize: 10.5, fontWeight: 800, padding: "3px 8px", borderRadius: 999, background: "#e3faf0", color: "#0b8f5c" }}>{aktifDonem === "guz" ? "Güz Dönemi" : "Bahar Dönemi"}</span>
            </div>
          </div>
        </div>
        <Link href="/" className="button button-secondary" style={{ minHeight: 40, padding: "0 16px", fontSize: 13 }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(960px, 100%)", margin: "0 auto", padding: "28px 20px 60px" }}>
        {loading ? (
          <p style={{ color: "var(--slate)", fontSize: 13 }}>Yükleniyor…</p>
        ) : error && dersler.length === 0 ? (
          <div style={{ padding: 20, borderRadius: 14, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13 }}>{error}</div>
        ) : (
          <>
            {error ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}
            {message ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#effbf6", border: "1px solid #bde5d5", color: "#0b5c42", fontSize: 13, fontWeight: 600 }}>{message}</div> : null}

            <div style={{ fontSize: 12.5, color: "#5b6b85", marginBottom: 16 }}>
              Bir akademisyenin bir derse yoklama girebilmesi için buradan o dersin gerçek öğretim üyesi hesabıyla eşleştirilmesi gerekir. Excel/elle giriş sırasında yalnız isim (metin) girilir, hesap ataması burada yapılır.
            </div>

            {topluGruplar.filter((g) => !gizlenenGruplar.has(g.anahtar)).length > 0 && (
              <section style={{ marginBottom: 20, background: "#fff", border: "1px solid #c7deff", borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>⚡ Toplu Hoca Atama</div>
                <div style={{ fontSize: 12, color: "#5b6b85", marginBottom: 14 }}>
                  Ders programındaki isim (metin) ile bir akademisyen hesabı arasında eşleşme bulundu. Tek tıkla o hocanın TÜM derslerini birden ata — dersi tek tek dropdown'dan seçmene gerek yok.
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {topluGruplar.filter((g) => !gizlenenGruplar.has(g.anahtar)).map((grup) => {
                    const secili = topluSecim[grup.anahtar] ?? grup.onerilenId;
                    const aramaSonuc = topluAramaSonuc[grup.anahtar] || [];
                    return (
                      <div key={grup.anahtar} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "#f5f8fc" }}>
                        <div style={{ flex: "1 1 220px", minWidth: 180 }}>
                          <b style={{ fontSize: 12.5 }}>{grup.gosterimAdi}</b>
                          <div style={{ fontSize: 11, color: "#8fa0bc" }}>{grup.dersIdler.length} ders · {grup.dersOzet.slice(0, 3).join(", ")}{grup.dersOzet.length > 3 ? "…" : ""}</div>
                        </div>
                        {grup.onerilenId ? (
                          <select
                            style={inputStyle}
                            value={secili}
                            onChange={(e) => setTopluSecim((prev) => ({ ...prev, [grup.anahtar]: e.target.value }))}
                          >
                            {akademisyenler.map((a) => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
                          </select>
                        ) : (
                          <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160 }}>
                            <input
                              style={inputStyle}
                              placeholder="Hesap bulunamadı — isimle ara…"
                              value={topluAramaMetni[grup.anahtar] || ""}
                              onChange={(e) => handleTopluArama(grup, e.target.value)}
                            />
                            {aramaSonuc.length > 0 && (
                              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 5, background: "#fff", border: "1px solid #e3ebf6", borderRadius: 8, marginTop: 4, boxShadow: "0 8px 20px rgba(15,27,51,0.1)" }}>
                                {aramaSonuc.map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => { setTopluSecim((prev) => ({ ...prev, [grup.anahtar]: p.id })); setTopluAramaMetni((prev) => ({ ...prev, [grup.anahtar]: p.full_name })); setTopluAramaSonuc((prev) => ({ ...prev, [grup.anahtar]: [] })); }}
                                    style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", fontSize: 12, border: "none", background: "none", cursor: "pointer" }}
                                  >
                                    {p.full_name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <button
                          onClick={() => handleTopluAta(grup)}
                          disabled={busy || !secili}
                          className="button button-primary"
                          style={{ minHeight: 34, padding: "0 14px", fontSize: 12 }}
                        >
                          Onayla ({grup.dersIdler.length})
                        </button>
                        <button
                          onClick={() => handleTopluGizle(grup)}
                          disabled={busy}
                          style={{ minHeight: 34, padding: "0 10px", fontSize: 11, border: "1px solid #e3ebf6", background: "#fff", color: "#8fa0bc", borderRadius: 8, cursor: "pointer" }}
                        >
                          Gizle
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {atanmisGruplar.length > 0 && (
              <section style={{ marginBottom: 20, background: "#fff", border: "1px solid #e3ebf6", borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>✅ Zaten Atanmış Hocalar</div>
                <div style={{ fontSize: 12, color: "#5b6b85", marginBottom: 14 }}>
                  Bu hocaların hesabı zaten bir veya daha fazla derse bağlı (o yüzden toplu atama listesinde görünmüyorlar). Yanlış görünen varsa açıp dersten kaldırabilirsin.
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {atanmisGruplar.map((grup) => {
                    const acik = atanmisAcik === grup.akademisyenId;
                    return (
                      <div key={grup.akademisyenId} style={{ border: "1px solid #e3ebf6", borderRadius: 10, overflow: "hidden" }}>
                        <button
                          type="button"
                          onClick={() => setAtanmisAcik(acik ? null : grup.akademisyenId)}
                          style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#f5f8fc", border: "none", cursor: "pointer", textAlign: "left" }}
                        >
                          <b style={{ fontSize: 12.5 }}>{grup.akademisyen?.full_name || "Bilinmeyen hesap"}</b>
                          <span style={{ fontSize: 11.5, color: "#8fa0bc" }}>{grup.dersler.length} ders {acik ? "▲" : "▼"}</span>
                        </button>
                        {acik && (
                          <div style={{ padding: "8px 12px", display: "grid", gap: 6 }}>
                            {grup.dersler.map((d) => (
                              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12 }}>
                                <span>{d.ders_kodu ? `${d.ders_kodu} · ` : ""}{d.ders_adi} <small style={{ color: "#8fa0bc" }}>({kaynakEtiket[d.eslesme_kaynagi] || d.eslesme_kaynagi || "?"})</small></span>
                                <button
                                  onClick={() => handleAkademisyenAta(d.id, "")}
                                  disabled={busy}
                                  style={{ fontSize: 10.5, fontWeight: 700, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", borderRadius: 7, padding: "3px 8px", cursor: "pointer" }}
                                >
                                  Kaldır
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {dersler.length === 0 ? (
              <div style={{ display: "grid", placeItems: "center", minHeight: 100, border: "1px dashed var(--line)", borderRadius: 14, background: "var(--bg)", color: "var(--muted)", fontSize: 13 }}>Henüz ders programı girilmemiş.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {dersler.map((d) => {
                  const istatistik = dersIstatistikleri.get(d.id) || { oturumSayisi: 0, ogrenciSayisi: 0, devamsizlar: [] };
                  const acik = acikDers === d.id;
                  const dersOturumlari = tumOturumlar.filter((o) => o.ders_programi_id === d.id).sort((a, b) => b.tarih.localeCompare(a.tarih));
                  return (
                    <div key={d.id} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 14, padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <b style={{ fontSize: 13.5 }}>{d.ders_adi}</b> {d.ders_kodu ? `(${d.ders_kodu})` : ""}
                          <div style={{ fontSize: 11.5, color: "#5b6b85", marginTop: 2 }}>{d.bolum} / {d.sinif}. sınıf {d.hoca_adi ? `· ${d.hoca_adi}` : ""} · {istatistik.oturumSayisi} oturum · {istatistik.ogrenciSayisi} öğrenci</div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <select style={inputStyle} value={d.akademisyen_id || ""} onChange={(e) => handleAkademisyenAta(d.id, e.target.value)} disabled={busy}>
                            <option value="">Akademisyen atanmadı</option>
                            {akademisyenler.map((a) => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
                          </select>
                          {istatistik.oturumSayisi > 0 && (
                            <button onClick={() => setAcikDers(acik ? null : d.id)} style={{ minHeight: 32, padding: "0 12px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", cursor: "pointer" }}>{acik ? "Kapat" : "Detay"}</button>
                          )}
                        </div>
                      </div>

                      {istatistik.devamsizlar.length > 0 && (
                        <div style={{ marginTop: 10, fontSize: 11.5, fontWeight: 700, color: "#984333" }}>
                          ⚠️ {istatistik.devamsizlar.length} öğrenci asgari %{d.asgari_devam_yuzdesi ?? 70} eşiğinin altında
                        </div>
                      )}

                      {acik && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e3ebf6" }}>
                          {istatistik.devamsizlar.length > 0 && (
                            <div style={{ marginBottom: 12, display: "grid", gap: 4 }}>
                              {istatistik.devamsizlar.map((dv) => (
                                <div key={dv.ogrenciId} style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                                  <span>{profilMap[dv.ogrenciId]?.full_name || "Öğrenci"}</span>
                                  <b style={{ color: "#c0273c" }}>%{dv.yuzde}</b>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ display: "grid", gap: 6 }}>
                            {dersOturumlari.map((o) => {
                              const kayitlar = tumKayitlar.filter((k) => k.oturum_id === o.id);
                              return (
                                <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: "#f5f8fc", borderRadius: 8, padding: "6px 10px", fontSize: 11.5 }}>
                                  <span>
                                    {new Date(o.tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })} · {kayitlar.length} kayıt
                                    {qrOturumIdSeti.has(o.id) && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: "#1f8fc4", background: "#eaf7fd", borderRadius: 999, padding: "2px 8px" }}>📷 QR</span>}
                                  </span>
                                  <button onClick={() => handleOturumSil(o.id)} disabled={busy} style={{ fontSize: 10.5, fontWeight: 700, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", borderRadius: 7, padding: "3px 8px", cursor: "pointer" }}>Sil</button>
                                </div>
                              );
                            })}
                          </div>
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
