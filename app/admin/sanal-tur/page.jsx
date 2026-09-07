"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

const cardStyle = { background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 24, marginBottom: 16 };
const inputStyle = { height: 42, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 10, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
const labelStyle = { fontSize: 11.5, fontWeight: 700, color: "#5b6b85", display: "flex", flexDirection: "column", gap: 5 };

const KATEGORI_ETIKET = { sinif: "Sınıflar", kutuphane: "Kütüphane / Çalışma Salonları", aktivite: "Aktivite Alanları", laboratuvar: "Laboratuvarlar", yol: "Yollar", disalan: "Açık Alanlar", diger: "Diğer" };

function bosDurak() {
  return { id: null, baslik: "", kategori: "diger", aciklama: "", bina_id: "", aktif: true, sira: 0, fotograflar: [] };
}

export default function AdminSanalTurPage() {
  const [yetkili, setYetkili] = useState(null);
  const [duraklar, setDuraklar] = useState([]);
  const [binalar, setBinalar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(bosDurak());
  const [duzenlenenId, setDuzenlenenId] = useState(null);
  const [kaydetBusy, setKaydetBusy] = useState(false);
  const [silBusyId, setSilBusyId] = useState(null);
  const [fotoBusy, setFotoBusy] = useState(false);
  const [fotoTipSecim, setFotoTipSecim] = useState("normal");
  const [fotoBaslikTaslak, setFotoBaslikTaslak] = useState("");
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
      const { data: binaData } = await supabase.from("kampus_binalar").select("id, ad").order("sira", { ascending: true });
      setBinalar(binaData || []);
      await listeyiYenile();
      setLoading(false);
    }
    init();
  }, []);

  async function listeyiYenile() {
    const { data, error: err } = await supabase.from("kampus_sanal_tur_duraklari").select("*").order("sira", { ascending: true }).order("created_at", { ascending: true });
    if (err) setHata("Liste alınamadı: " + err.message);
    else setDuraklar(data || []);
  }

  function formuDuzenlemeyeAc(durak) {
    setDuzenlenenId(durak.id);
    setForm({
      id: durak.id,
      baslik: durak.baslik || "",
      kategori: durak.kategori || "diger",
      aciklama: durak.aciklama || "",
      bina_id: durak.bina_id || "",
      aktif: durak.aktif !== false,
      sira: durak.sira ?? 0,
      fotograflar: Array.isArray(durak.fotograflar) ? durak.fotograflar : [],
    });
    setMesaj(""); setHata("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function formuSifirla() {
    setDuzenlenenId(null);
    setForm(bosDurak());
  }

  async function handleKaydet(e) {
    e.preventDefault();
    const baslik = form.baslik.trim();
    if (!baslik) { setHata("Durak başlığı zorunlu."); return; }

    setKaydetBusy(true); setHata(""); setMesaj("");
    const kayit = {
      baslik,
      kategori: form.kategori,
      aciklama: form.aciklama.trim() || null,
      bina_id: form.bina_id || null,
      aktif: form.aktif,
      sira: Number(form.sira) || 0,
    };

    if (duzenlenenId) {
      const { error: err } = await supabase.from("kampus_sanal_tur_duraklari").update(kayit).eq("id", duzenlenenId);
      setKaydetBusy(false);
      if (err) { setHata("Kaydedilemedi: " + err.message); return; }
      setMesaj(`"${baslik}" güncellendi.`);
      await listeyiYenile();
    } else {
      // Yeni durak eklendikten sonra formu sıfırlamıyoruz — id oluşana kadar
      // fotoğraf yüklenemiyor, bu yüzden admin hemen aynı durağı düzenleme
      // moduna geçip fotoğraf eklemeye devam edebilsin diye kaydı geri alıp
      // düzenleme moduna açıyoruz.
      const { data: yeniKayit, error: err } = await supabase.from("kampus_sanal_tur_duraklari").insert(kayit).select().single();
      setKaydetBusy(false);
      if (err) { setHata("Kaydedilemedi: " + err.message); return; }
      setMesaj(`"${baslik}" eklendi. Şimdi fotoğraf ekleyebilirsin.`);
      await listeyiYenile();
      if (yeniKayit) formuDuzenlemeyeAc(yeniKayit);
    }
  }

  async function handleSil(durak) {
    setSilBusyId(durak.id); setHata(""); setMesaj("");
    const { error: err } = await supabase.from("kampus_sanal_tur_duraklari").delete().eq("id", durak.id);
    setSilBusyId(null);
    if (err) { setHata("Silinemedi: " + err.message); return; }
    setMesaj(`"${durak.baslik}" kaldırıldı.`);
    if (duzenlenenId === durak.id) formuSifirla();
    await listeyiYenile();
  }

  async function fotoYukle(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!duzenlenenId) { setHata("Fotoğraf eklemeden önce durağı kaydet."); e.target.value = ""; return; }
    setFotoBusy(true); setHata("");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${duzenlenenId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("sanal-tur-fotograflari").upload(path, file, { upsert: true });
    if (upErr) { setFotoBusy(false); setHata("Fotoğraf yüklenemedi: " + upErr.message); e.target.value = ""; return; }
    const { data: pub } = supabase.storage.from("sanal-tur-fotograflari").getPublicUrl(path);
    const yeniFotograflar = [...form.fotograflar, { url: pub.publicUrl, tip: fotoTipSecim, baslik: fotoBaslikTaslak.trim() || null }];
    const { error: guncelleErr } = await supabase.from("kampus_sanal_tur_duraklari").update({ fotograflar: yeniFotograflar }).eq("id", duzenlenenId);
    setFotoBusy(false);
    if (guncelleErr) { setHata("Fotoğraf kaydedilemedi: " + guncelleErr.message); e.target.value = ""; return; }
    setForm((f) => ({ ...f, fotograflar: yeniFotograflar }));
    setFotoBaslikTaslak("");
    e.target.value = "";
    await listeyiYenile();
  }

  async function fotoSil(idx) {
    if (!duzenlenenId) return;
    const yeniFotograflar = form.fotograflar.filter((_, i) => i !== idx);
    setFotoBusy(true); setHata("");
    const { error: err } = await supabase.from("kampus_sanal_tur_duraklari").update({ fotograflar: yeniFotograflar }).eq("id", duzenlenenId);
    setFotoBusy(false);
    if (err) { setHata("Fotoğraf silinemedi: " + err.message); return; }
    setForm((f) => ({ ...f, fotograflar: yeniFotograflar }));
    await listeyiYenile();
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=admin" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>YÖNETİM MERKEZİ · KAMPÜS YAŞAMI</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Sanal Tur — Duraklar ve Fotoğraflar</div>
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
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>{duzenlenenId ? "Durağı Düzenle" : "Yeni Durak Ekle"}</div>
              <div style={{ fontSize: 12, color: "#8fa0bc", marginBottom: 16, lineHeight: 1.6 }}>
                Gerçek 360° panorama çekimimiz olmadığı için elindeki sıradan fotoğraflarla başlayabilirsin — her fotoğrafı "Normal" ya da
                "360° Panorama" olarak işaretlersin, öğrenci sayfasında buna göre gösterilir. Fotoğraf eklemek için önce durağı kaydetmen gerekiyor.
              </div>

              <form onSubmit={handleKaydet} style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr 1fr" }}>
                  <label style={labelStyle}>Durak Başlığı
                    <input style={inputStyle} value={form.baslik} onChange={(e) => setForm((f) => ({ ...f, baslik: e.target.value }))} placeholder="Örn. Kütüphane Okuma Salonu" />
                  </label>
                  <label style={labelStyle}>Kategori
                    <select style={inputStyle} value={form.kategori} onChange={(e) => setForm((f) => ({ ...f, kategori: e.target.value }))}>
                      {Object.entries(KATEGORI_ETIKET).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                  <label style={labelStyle}>Sıra
                    <input style={inputStyle} type="number" value={form.sira} onChange={(e) => setForm((f) => ({ ...f, sira: e.target.value }))} />
                  </label>
                </div>

                <label style={labelStyle}>Bağlı Bina (opsiyonel)
                  <select style={inputStyle} value={form.bina_id} onChange={(e) => setForm((f) => ({ ...f, bina_id: e.target.value }))}>
                    <option value="">— Bina yok / açık alan —</option>
                    {binalar.map((b) => <option key={b.id} value={b.id}>{b.ad}</option>)}
                  </select>
                </label>

                <label style={labelStyle}>Açıklama (opsiyonel)
                  <input style={inputStyle} value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} placeholder="Örn. 7/24 açık, 300 kişilik sessiz çalışma alanı" />
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
                    <button type="button" onClick={formuSifirla} style={{ minHeight: 44, padding: "0 16px", fontSize: 12.5, fontWeight: 700, borderRadius: 11, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", cursor: "pointer" }}>Yeni Durak Ekle</button>
                  )}
                </div>
              </form>

              {duzenlenenId && (
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #eef2f8" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 10 }}>Fotoğraflar {form.fotograflar.length > 0 && `(${form.fotograflar.length})`}</div>

                  {form.fotograflar.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8, marginBottom: 14 }}>
                      {form.fotograflar.map((f, idx) => (
                        <div key={idx} style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid #eef2f8" }}>
                          <img src={f.url} alt={f.baslik || ""} style={{ width: "100%", height: 72, objectFit: "cover", display: "block" }} />
                          <span style={{ position: "absolute", top: 4, left: 4, fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 999, background: f.tip === "panorama" ? "#175cd3" : "rgba(15,27,51,0.65)", color: "#fff" }}>
                            {f.tip === "panorama" ? "360°" : "Normal"}
                          </span>
                          <button type="button" onClick={() => fotoSil(idx)} disabled={fotoBusy} style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", border: "none", background: "rgba(152,67,51,0.9)", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer", lineHeight: 1 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr", marginBottom: 8 }}>
                    <select style={inputStyle} value={fotoTipSecim} onChange={(e) => setFotoTipSecim(e.target.value)}>
                      <option value="normal">Normal fotoğraf</option>
                      <option value="panorama">360° Panorama</option>
                    </select>
                    <input style={inputStyle} value={fotoBaslikTaslak} onChange={(e) => setFotoBaslikTaslak(e.target.value)} placeholder="Fotoğraf başlığı, opsiyonel" />
                  </div>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 40, padding: "0 14px", fontSize: 12.5, fontWeight: 700, borderRadius: 10, border: "1px dashed #c7deff", background: "#f5f9ff", color: "#175cd3", cursor: fotoBusy ? "not-allowed" : "pointer", opacity: fotoBusy ? 0.6 : 1 }}>
                    {fotoBusy ? "Yükleniyor…" : "+ Fotoğraf Yükle"}
                    <input type="file" accept="image/*" onChange={fotoYukle} disabled={fotoBusy} style={{ display: "none" }} />
                  </label>
                  <div style={{ marginTop: 8, fontSize: 11, color: "#8fa0bc", lineHeight: 1.5 }}>
                    360° panorama için: telefonda "Panorama" ya da "360 Fotoğraf" modunda çekilmiş, tam bir daireyi kapatan bir kare yeterli — özel ekipman gerekmez.
                    Normal fotoğraflar da eklenebilir, öğrenci sayfasında kaydırmalı galeri olarak gösterilir.
                  </div>
                </div>
              )}
            </section>

            <section style={cardStyle}>
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 12 }}>Kayıtlı Duraklar {duraklar.length > 0 && `(${duraklar.length})`}</div>
              {loading ? (
                <div style={{ color: "#8fa0bc", fontSize: 13 }}>Yükleniyor…</div>
              ) : duraklar.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "#8fa0bc", fontSize: 13, border: "1px dashed #e3ebf6", borderRadius: 12 }}>Henüz hiç durak eklenmedi.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {duraklar.map((d) => (
                    <div key={d.id} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #e3ebf6" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13.5, fontWeight: 800 }}>{d.baslik}</span>
                            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", padding: "2px 8px", borderRadius: 999, background: "#eaf1ff", color: "#175cd3" }}>{KATEGORI_ETIKET[d.kategori] || d.kategori}</span>
                            {!d.aktif && <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "#fff4e2", color: "#a15c00" }}>Pasif</span>}
                          </div>
                          {d.aciklama && <div style={{ fontSize: 12, color: "#5b6b85", marginTop: 4 }}>{d.aciklama}</div>}
                          <div style={{ fontSize: 11.5, color: "#0f1b33", marginTop: 4 }}>
                            {Array.isArray(d.fotograflar) ? d.fotograflar.length : 0} fotoğraf
                            {Array.isArray(d.fotograflar) && d.fotograflar.some((f) => f.tip === "panorama") ? " · 360° içerir" : ""}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flex: "none" }}>
                          <button type="button" onClick={() => formuDuzenlemeyeAc(d)} style={{ minHeight: 32, padding: "0 12px", fontSize: 11.5, fontWeight: 700, borderRadius: 9, border: "1px solid #c7deff", background: "#f5f9ff", color: "#175cd3", cursor: "pointer" }}>Düzenle</button>
                          <button type="button" disabled={silBusyId === d.id} onClick={() => handleSil(d)} style={{ minHeight: 32, padding: "0 12px", fontSize: 11.5, fontWeight: 700, borderRadius: 9, border: "1px solid #f2c5ba", background: "#fff", color: "#984333", cursor: "pointer" }}>{silBusyId === d.id ? "…" : "Sil"}</button>
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
