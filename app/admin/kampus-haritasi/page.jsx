"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

const cardStyle = { background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 24, marginBottom: 16 };
const inputStyle = { height: 42, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 10, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
const labelStyle = { fontSize: 11.5, fontWeight: 700, color: "#5b6b85", display: "flex", flexDirection: "column", gap: 5 };

const TIP_ETIKET = { egitim: "Eğitim Binası", laboratuvar: "Laboratuvar Binası", idari: "İdari Bina", sosyal: "Sosyal Alan", spor: "Spor Tesisi", yurt: "Yurt", diger: "Diğer" };
const MEKAN_TIP_ETIKET = { sinif: "Sınıf", laboratuvar: "Laboratuvar", ofis: "Ofis", wc: "WC", diger: "Diğer" };

function bosBina() {
  return { id: null, ad: "", tip: "egitim", aciklama: "", lat: "", lng: "", aktif: true, sira: 0, mekanlar: [{ kat: "", ad: "", tip: "sinif", aciklama: "" }] };
}

function mekanlarFormaDonustur(mekanlar) {
  if (!Array.isArray(mekanlar) || mekanlar.length === 0) return [{ kat: "", ad: "", tip: "sinif", aciklama: "" }];
  return mekanlar.map((m) => ({ kat: m.kat || "", ad: m.ad || "", tip: m.tip || "sinif", aciklama: m.aciklama || "" }));
}
function mekanlarKaydaDonustur(mekanlarForm) {
  return mekanlarForm
    .map((m) => ({ kat: m.kat.trim(), ad: m.ad.trim(), tip: m.tip, aciklama: m.aciklama.trim() || null }))
    .filter((m) => m.ad);
}

export default function AdminKampusHaritasiPage() {
  const [yetkili, setYetkili] = useState(null);
  const [binalar, setBinalar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(bosBina());
  const [duzenlenenId, setDuzenlenenId] = useState(null);
  const [kaydetBusy, setKaydetBusy] = useState(false);
  const [silBusyId, setSilBusyId] = useState(null);
  const [mesaj, setMesaj] = useState("");
  const [hata, setHata] = useState("");

  useEffect(() => {
    async function init() {
      if (!supabase) { setHata("Veritabanı bağlantısı yapılandırılmamış."); setYetkili(false); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email?.toLowerCase() !== "suko.crc06@gmail.com") {
        setYetkili(false);
        setLoading(false);
        return;
      }
      setYetkili(true);
      await listeyiYenile();
      setLoading(false);
    }
    init();
  }, []);

  async function listeyiYenile() {
    const { data, error: err } = await supabase.from("kampus_binalar").select("*").order("sira", { ascending: true }).order("created_at", { ascending: true });
    if (err) setHata("Liste alınamadı: " + err.message);
    else setBinalar(data || []);
  }

  function formuDuzenlemeyeAc(bina) {
    setDuzenlenenId(bina.id);
    setForm({
      id: bina.id,
      ad: bina.ad || "",
      tip: bina.tip || "egitim",
      aciklama: bina.aciklama || "",
      lat: bina.lat ?? "",
      lng: bina.lng ?? "",
      aktif: bina.aktif !== false,
      sira: bina.sira ?? 0,
      mekanlar: mekanlarFormaDonustur(bina.mekanlar),
    });
    setMesaj(""); setHata("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function formuSifirla() {
    setDuzenlenenId(null);
    setForm(bosBina());
  }

  function mekanGuncelle(idx, alan, deger) {
    setForm((f) => {
      const yeniMekanlar = f.mekanlar.slice();
      yeniMekanlar[idx] = { ...yeniMekanlar[idx], [alan]: deger };
      return { ...f, mekanlar: yeniMekanlar };
    });
  }
  function mekanEkle() {
    setForm((f) => ({ ...f, mekanlar: [...f.mekanlar, { kat: f.mekanlar[f.mekanlar.length - 1]?.kat || "", ad: "", tip: "sinif", aciklama: "" }] }));
  }
  function mekanSil(idx) {
    setForm((f) => ({ ...f, mekanlar: f.mekanlar.filter((_, i) => i !== idx) }));
  }

  async function handleKaydet(e) {
    e.preventDefault();
    const ad = form.ad.trim();
    if (!ad) { setHata("Bina adı zorunlu."); return; }
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { setHata("Konum (enlem/boylam) zorunlu ve sayısal olmalı."); return; }
    const mekanlar = mekanlarKaydaDonustur(form.mekanlar);

    setKaydetBusy(true); setHata(""); setMesaj("");
    const kayit = {
      ad,
      tip: form.tip,
      aciklama: form.aciklama.trim() || null,
      lat,
      lng,
      aktif: form.aktif,
      sira: Number(form.sira) || 0,
      mekanlar,
    };

    const { error: err } = duzenlenenId
      ? await supabase.from("kampus_binalar").update(kayit).eq("id", duzenlenenId)
      : await supabase.from("kampus_binalar").insert(kayit);

    setKaydetBusy(false);
    if (err) { setHata("Kaydedilemedi: " + err.message); return; }
    setMesaj(duzenlenenId ? `"${ad}" güncellendi.` : `"${ad}" eklendi.`);
    formuSifirla();
    await listeyiYenile();
  }

  async function handleSil(bina) {
    setSilBusyId(bina.id); setHata(""); setMesaj("");
    const { error: err } = await supabase.from("kampus_binalar").delete().eq("id", bina.id);
    setSilBusyId(null);
    if (err) { setHata("Silinemedi: " + err.message); return; }
    setMesaj(`"${bina.ad}" kaldırıldı.`);
    if (duzenlenenId === bina.id) formuSifirla();
    await listeyiYenile();
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=admin" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>YÖNETİM MERKEZİ · KAMPÜS YAŞAMI</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Kampüs Haritası — Binalar</div>
          </div>
        </div>
      </header>

      <main style={{ width: "min(720px, 100%)", margin: "0 auto", padding: "28px 18px 60px" }}>
        {yetkili === false ? (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>Bu sayfa yalnız yetkili yönetici hesabıyla kullanılabilir.</div>
        ) : (
          <>
            {hata ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{hata}</div> : null}
            {mesaj ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#e3faf0", border: "1px solid #b7e9d2", color: "#0b6b46", fontSize: 13, fontWeight: 600 }}>{mesaj}</div> : null}

            <section style={cardStyle}>
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>{duzenlenenId ? "Binayı Düzenle" : "Yeni Bina Ekle"}</div>
              <div style={{ fontSize: 12, color: "#8fa0bc", marginBottom: 16, lineHeight: 1.6 }}>
                Öğrenci sayfasında binalar gerçek bir harita (OpenStreetMap) üzerinde konumlarına göre gösterilir. Koordinatı bulmak için
                Google Maps'te binaya sağ tıklayıp enlem/boylamı kopyalayabilirsin.
              </div>

              <form onSubmit={handleKaydet} style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr 1fr" }}>
                  <label style={labelStyle}>Bina Adı
                    <input style={inputStyle} value={form.ad} onChange={(e) => setForm((f) => ({ ...f, ad: e.target.value }))} placeholder="Örn. A Blok — Eğitim Binası" />
                  </label>
                  <label style={labelStyle}>Tip
                    <select style={inputStyle} value={form.tip} onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))}>
                      {Object.entries(TIP_ETIKET).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                  <label style={labelStyle}>Sıra
                    <input style={inputStyle} type="number" value={form.sira} onChange={(e) => setForm((f) => ({ ...f, sira: e.target.value }))} />
                  </label>
                </div>

                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                  <label style={labelStyle}>Enlem (lat)
                    <input style={inputStyle} value={form.lat} onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))} placeholder="40.1328489" />
                  </label>
                  <label style={labelStyle}>Boylam (lng)
                    <input style={inputStyle} value={form.lng} onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))} placeholder="32.9440116" />
                  </label>
                </div>

                <label style={labelStyle}>Açıklama (opsiyonel)
                  <input style={inputStyle} value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} placeholder="Örn. Mühendislik Fakültesi dersliklerinin bulunduğu blok" />
                </label>

                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#5b6b85", marginBottom: 6 }}>Mekanlar (Sınıf / Laboratuvar / Ofis…)</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {form.mekanlar.map((m, idx) => (
                      <div key={idx} style={{ padding: 10, borderRadius: 11, border: "1px solid #eef2f8", display: "grid", gap: 8 }}>
                        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1.4fr 1fr auto", alignItems: "center" }}>
                          <input style={inputStyle} value={m.kat} onChange={(e) => mekanGuncelle(idx, "kat", e.target.value)} placeholder="Kat (örn. Zemin Kat, 1. Kat)" />
                          <input style={inputStyle} value={m.ad} onChange={(e) => mekanGuncelle(idx, "ad", e.target.value)} placeholder="Mekan adı (örn. B203, Kimya Laboratuvarı)" />
                          <select style={inputStyle} value={m.tip} onChange={(e) => mekanGuncelle(idx, "tip", e.target.value)}>
                            {Object.entries(MEKAN_TIP_ETIKET).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                          <button type="button" onClick={() => mekanSil(idx)} disabled={form.mekanlar.length <= 1} style={{ minHeight: 42, padding: "0 12px", fontSize: 12, fontWeight: 700, borderRadius: 9, border: "1px solid #f2c5ba", background: "#fff", color: "#984333", cursor: form.mekanlar.length <= 1 ? "not-allowed" : "pointer", opacity: form.mekanlar.length <= 1 ? 0.5 : 1 }}>Sil</button>
                        </div>
                        <input style={inputStyle} value={m.aciklama} onChange={(e) => mekanGuncelle(idx, "aciklama", e.target.value)} placeholder="Açıklama, opsiyonel (örn. 60 kişilik, projeksiyon var)" />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: "#8fa0bc", lineHeight: 1.5 }}>
                    Öğrenci sayfasında binaya tıklanınca bu mekanlar kat kat gruplanmış bir liste olarak gösterilir. Görsel bir kat planı yok — v1'de sade liste yeterli.
                  </div>
                  <button type="button" onClick={mekanEkle} style={{ marginTop: 8, minHeight: 36, padding: "0 14px", fontSize: 12, fontWeight: 700, borderRadius: 9, border: "1px dashed #c7deff", background: "#f5f9ff", color: "#175cd3", cursor: "pointer" }}>+ Mekan Ekle</button>
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 700, color: "#5b6b85" }}>
                  <input type="checkbox" checked={form.aktif} onChange={(e) => setForm((f) => ({ ...f, aktif: e.target.checked }))} />
                  Aktif (öğrencilere gösterilsin)
                </label>

                <div style={{ display: "flex", gap: 10 }}>
                  <button type="submit" disabled={kaydetBusy} className="button button-primary" style={{ minHeight: 44, padding: "0 20px", fontSize: 12.5 }}>
                    {kaydetBusy ? "Kaydediliyor…" : duzenlenenId ? "Güncelle" : "Ekle"}
                  </button>
                  {duzenlenenId && (
                    <button type="button" onClick={formuSifirla} style={{ minHeight: 44, padding: "0 16px", fontSize: 12.5, fontWeight: 700, borderRadius: 11, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", cursor: "pointer" }}>Vazgeç</button>
                  )}
                </div>
              </form>
            </section>

            <section style={cardStyle}>
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 12 }}>Kayıtlı Binalar {binalar.length > 0 && `(${binalar.length})`}</div>
              {loading ? (
                <div style={{ color: "#8fa0bc", fontSize: 13 }}>Yükleniyor…</div>
              ) : binalar.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "#8fa0bc", fontSize: 13, border: "1px dashed #e3ebf6", borderRadius: 12 }}>Henüz hiç bina eklenmedi.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {binalar.map((b) => (
                    <div key={b.id} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #e3ebf6" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13.5, fontWeight: 800 }}>{b.ad}</span>
                            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", padding: "2px 8px", borderRadius: 999, background: "#eaf1ff", color: "#175cd3" }}>{TIP_ETIKET[b.tip] || b.tip}</span>
                            {!b.aktif && <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "#fff4e2", color: "#a15c00" }}>Pasif</span>}
                          </div>
                          {b.aciklama && <div style={{ fontSize: 12, color: "#5b6b85", marginTop: 4 }}>{b.aciklama}</div>}
                          <div style={{ fontSize: 11, color: "#8fa0bc", marginTop: 4 }}>{b.lat}, {b.lng}</div>
                          {Array.isArray(b.mekanlar) && b.mekanlar.length > 0 && (
                            <div style={{ marginTop: 6, fontSize: 11.5, color: "#0f1b33" }}>{b.mekanlar.length} mekan kayıtlı</div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 6, flex: "none" }}>
                          <button type="button" onClick={() => formuDuzenlemeyeAc(b)} style={{ minHeight: 32, padding: "0 12px", fontSize: 11.5, fontWeight: 700, borderRadius: 9, border: "1px solid #c7deff", background: "#f5f9ff", color: "#175cd3", cursor: "pointer" }}>Düzenle</button>
                          <button type="button" disabled={silBusyId === b.id} onClick={() => handleSil(b)} style={{ minHeight: 32, padding: "0 12px", fontSize: 11.5, fontWeight: 700, borderRadius: 9, border: "1px solid #f2c5ba", background: "#fff", color: "#984333", cursor: "pointer" }}>{silBusyId === b.id ? "…" : "Sil"}</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
