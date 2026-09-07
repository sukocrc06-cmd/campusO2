"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

const cardStyle = { background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 24, marginBottom: 16 };
const inputStyle = { height: 42, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 10, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
const labelStyle = { fontSize: 11.5, fontWeight: 700, color: "#5b6b85", display: "flex", flexDirection: "column", gap: 5 };

function bosPark() {
  return { id: null, ad: "", aciklama: "", lat: "", lng: "", kapasite: "", engelliKontenjan: 0, aktif: true, sira: 0 };
}

export default function AdminParkAlanlariPage() {
  const [yetkili, setYetkili] = useState(null);
  const [parklar, setParklar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(bosPark());
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
    const { data, error: err } = await supabase.from("kampus_park_alanlari").select("*").order("sira", { ascending: true }).order("created_at", { ascending: true });
    if (err) setHata("Liste alınamadı: " + err.message);
    else setParklar(data || []);
  }

  function formuDuzenlemeyeAc(p) {
    setDuzenlenenId(p.id);
    setForm({
      id: p.id,
      ad: p.ad || "",
      aciklama: p.aciklama || "",
      lat: p.lat ?? "",
      lng: p.lng ?? "",
      kapasite: p.kapasite ?? "",
      engelliKontenjan: p.engelli_kontenjan ?? 0,
      aktif: p.aktif !== false,
      sira: p.sira ?? 0,
    });
    setMesaj(""); setHata("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function formuSifirla() {
    setDuzenlenenId(null);
    setForm(bosPark());
  }

  async function handleKaydet(e) {
    e.preventDefault();
    const ad = form.ad.trim();
    if (!ad) { setHata("Park alanı adı zorunlu."); return; }
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { setHata("Konum (enlem/boylam) zorunlu ve sayısal olmalı."); return; }

    setKaydetBusy(true); setHata(""); setMesaj("");
    const kayit = {
      ad,
      aciklama: form.aciklama.trim() || null,
      lat,
      lng,
      kapasite: form.kapasite === "" ? null : Number(form.kapasite) || 0,
      engelli_kontenjan: Number(form.engelliKontenjan) || 0,
      aktif: form.aktif,
      sira: Number(form.sira) || 0,
    };

    const { error: err } = duzenlenenId
      ? await supabase.from("kampus_park_alanlari").update(kayit).eq("id", duzenlenenId)
      : await supabase.from("kampus_park_alanlari").insert(kayit);

    setKaydetBusy(false);
    if (err) { setHata("Kaydedilemedi: " + err.message); return; }
    setMesaj(duzenlenenId ? `"${ad}" güncellendi.` : `"${ad}" eklendi.`);
    formuSifirla();
    await listeyiYenile();
  }

  async function handleSil(p) {
    setSilBusyId(p.id); setHata(""); setMesaj("");
    const { error: err } = await supabase.from("kampus_park_alanlari").delete().eq("id", p.id);
    setSilBusyId(null);
    if (err) { setHata("Silinemedi: " + err.message); return; }
    setMesaj(`"${p.ad}" kaldırıldı (bağlı doluluk bildirimleri de silindi).`);
    if (duzenlenenId === p.id) formuSifirla();
    await listeyiYenile();
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=admin" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>YÖNETİM MERKEZİ · KAMPÜS YAŞAMI</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Park Alanları</div>
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
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>{duzenlenenId ? "Park Alanını Düzenle" : "Yeni Park Alanı Ekle"}</div>
              <div style={{ fontSize: 12, color: "#8fa0bc", marginBottom: 16, lineHeight: 1.6 }}>
                Doluluk oranı burada girilmiyor — o, öğrencilerin /park-alanlari sayfasından gönderdiği canlı "Boş/Orta/Dolu" bildirimlerinden otomatik
                hesaplanıyor. Burada sadece konum ve kapasite bilgisini giriyorsun; bu park Kampüs Haritası'nda da 🅿️ işaretiyle gösterilecek.
              </div>

              <form onSubmit={handleKaydet} style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr" }}>
                  <label style={labelStyle}>Park Alanı Adı
                    <input style={inputStyle} value={form.ad} onChange={(e) => setForm((f) => ({ ...f, ad: e.target.value }))} placeholder="Örn. B Blok Açık Otopark" />
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

                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                  <label style={labelStyle}>Toplam kapasite (opsiyonel)
                    <input style={inputStyle} type="number" value={form.kapasite} onChange={(e) => setForm((f) => ({ ...f, kapasite: e.target.value }))} placeholder="Örn. 150" />
                  </label>
                  <label style={labelStyle}>Engelli kontenjanı
                    <input style={inputStyle} type="number" value={form.engelliKontenjan} onChange={(e) => setForm((f) => ({ ...f, engelliKontenjan: e.target.value }))} />
                  </label>
                </div>

                <label style={labelStyle}>Açıklama (opsiyonel)
                  <input style={inputStyle} value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} placeholder="Örn. Ana girişin sağındaki açık alan" />
                </label>

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
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 12 }}>Kayıtlı Park Alanları {parklar.length > 0 && `(${parklar.length})`}</div>
              {loading ? (
                <div style={{ color: "#8fa0bc", fontSize: 13 }}>Yükleniyor…</div>
              ) : parklar.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "#8fa0bc", fontSize: 13, border: "1px dashed #e3ebf6", borderRadius: 12 }}>Henüz hiç park alanı eklenmedi.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {parklar.map((p) => (
                    <div key={p.id} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #e3ebf6" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13.5, fontWeight: 800 }}>{p.ad}</span>
                            {!p.aktif && <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "#fff4e2", color: "#a15c00" }}>Pasif</span>}
                          </div>
                          {p.aciklama && <div style={{ fontSize: 12, color: "#5b6b85", marginTop: 4 }}>{p.aciklama}</div>}
                          <div style={{ fontSize: 11, color: "#8fa0bc", marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <span>{p.lat}, {p.lng}</span>
                            {p.kapasite != null && <span>🚗 {p.kapasite} kapasite</span>}
                            {p.engelli_kontenjan > 0 && <span>♿ {p.engelli_kontenjan} engelli kontenjanı</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flex: "none" }}>
                          <button type="button" onClick={() => formuDuzenlemeyeAc(p)} style={{ minHeight: 32, padding: "0 12px", fontSize: 11.5, fontWeight: 700, borderRadius: 9, border: "1px solid #c7deff", background: "#f5f9ff", color: "#175cd3", cursor: "pointer" }}>Düzenle</button>
                          <button type="button" disabled={silBusyId === p.id} onClick={() => handleSil(p)} style={{ minHeight: 32, padding: "0 12px", fontSize: 11.5, fontWeight: 700, borderRadius: 9, border: "1px solid #f2c5ba", background: "#fff", color: "#984333", cursor: "pointer" }}>{silBusyId === p.id ? "…" : "Sil"}</button>
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
