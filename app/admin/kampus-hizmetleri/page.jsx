"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

const cardStyle = { background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 24, marginBottom: 16 };
const inputStyle = { height: 42, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 10, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
const labelStyle = { fontSize: 11.5, fontWeight: 700, color: "#5b6b85", display: "flex", flexDirection: "column", gap: 5 };

const KATEGORI_ETIKET = {
  atm: "ATM", market: "Market / Kırtasiye", spor: "Spor Salonu", medikal: "Medikal Servis",
  cami: "Cami / Mescit", kargo: "Kargo Noktası", yemekhane: "Yemekhane / Kantin", diger: "Diğer",
};

function bosHizmet() {
  return { id: null, baslik: "", kategori: "diger", aciklama: "", konumMetni: "", binaId: "", calismaSaatleri: "", iletisim: "", aktif: true, sira: 0 };
}

export default function AdminKampusHizmetleriPage() {
  const [yetkili, setYetkili] = useState(null);
  const [hizmetler, setHizmetler] = useState([]);
  const [binalar, setBinalar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(bosHizmet());
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
      const { data: binaData } = await supabase.from("kampus_binalar").select("id, ad").order("sira", { ascending: true });
      setBinalar(binaData || []);
      await listeyiYenile();
      setLoading(false);
    }
    init();
  }, []);

  async function listeyiYenile() {
    const { data, error: err } = await supabase.from("kampus_hizmetleri").select("*").order("sira", { ascending: true }).order("created_at", { ascending: true });
    if (err) setHata("Liste alınamadı: " + err.message);
    else setHizmetler(data || []);
  }

  function formuDuzenlemeyeAc(h) {
    setDuzenlenenId(h.id);
    setForm({
      id: h.id,
      baslik: h.baslik || "",
      kategori: h.kategori || "diger",
      aciklama: h.aciklama || "",
      konumMetni: h.konum_metni || "",
      binaId: h.bina_id || "",
      calismaSaatleri: h.calisma_saatleri || "",
      iletisim: h.iletisim || "",
      aktif: h.aktif !== false,
      sira: h.sira ?? 0,
    });
    setMesaj(""); setHata("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function formuSifirla() {
    setDuzenlenenId(null);
    setForm(bosHizmet());
  }

  async function handleKaydet(e) {
    e.preventDefault();
    const baslik = form.baslik.trim();
    if (!baslik) { setHata("Başlık zorunlu."); return; }

    setKaydetBusy(true); setHata(""); setMesaj("");
    const kayit = {
      baslik,
      kategori: form.kategori,
      aciklama: form.aciklama.trim() || null,
      konum_metni: form.konumMetni.trim() || null,
      bina_id: form.binaId || null,
      calisma_saatleri: form.calismaSaatleri.trim() || null,
      iletisim: form.iletisim.trim() || null,
      aktif: form.aktif,
      sira: Number(form.sira) || 0,
    };

    const { error: err } = duzenlenenId
      ? await supabase.from("kampus_hizmetleri").update(kayit).eq("id", duzenlenenId)
      : await supabase.from("kampus_hizmetleri").insert(kayit);

    setKaydetBusy(false);
    if (err) { setHata("Kaydedilemedi: " + err.message); return; }
    setMesaj(duzenlenenId ? `"${baslik}" güncellendi.` : `"${baslik}" eklendi.`);
    formuSifirla();
    await listeyiYenile();
  }

  async function handleSil(h) {
    setSilBusyId(h.id); setHata(""); setMesaj("");
    const { error: err } = await supabase.from("kampus_hizmetleri").delete().eq("id", h.id);
    setSilBusyId(null);
    if (err) { setHata("Silinemedi: " + err.message); return; }
    setMesaj(`"${h.baslik}" kaldırıldı.`);
    if (duzenlenenId === h.id) formuSifirla();
    await listeyiYenile();
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=admin" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>YÖNETİM MERKEZİ · KAMPÜS YAŞAMI</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Kampüs Hizmetleri</div>
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
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>{duzenlenenId ? "Hizmeti Düzenle" : "Yeni Hizmet Ekle"}</div>
              <div style={{ fontSize: 12, color: "#8fa0bc", marginBottom: 16, lineHeight: 1.6 }}>
                ATM, market/kırtasiye, medikal servis, cami, kargo noktası gibi kampüs hizmetlerinin çoğu AYBÜ'nün resmi sitesinde yayınlanmıyor —
                gerçek konum/saat/iletişim bilgisini buradan senin girmen gerekiyor. İstersen bir binaya bağlayarak Kampüs Haritası'nda da gösterebilirsin.
              </div>

              <form onSubmit={handleKaydet} style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr 1fr" }}>
                  <label style={labelStyle}>Başlık
                    <input style={inputStyle} value={form.baslik} onChange={(e) => setForm((f) => ({ ...f, baslik: e.target.value }))} placeholder="Örn. A Blok ATM" />
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

                <label style={labelStyle}>Açıklama (opsiyonel)
                  <input style={inputStyle} value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} placeholder="Örn. Ziraat Bankası ATM'si, giriş katta" />
                </label>

                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                  <label style={labelStyle}>Konum açıklaması (opsiyonel)
                    <input style={inputStyle} value={form.konumMetni} onChange={(e) => setForm((f) => ({ ...f, konumMetni: e.target.value }))} placeholder="Örn. B Blok zemin kat" />
                  </label>
                  <label style={labelStyle}>Bağlı bina (opsiyonel, Kampüs Haritası'nda gösterir)
                    <select style={inputStyle} value={form.binaId} onChange={(e) => setForm((f) => ({ ...f, binaId: e.target.value }))}>
                      <option value="">— Bina seçilmedi —</option>
                      {binalar.map((b) => <option key={b.id} value={b.id}>{b.ad}</option>)}
                    </select>
                  </label>
                </div>

                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                  <label style={labelStyle}>Çalışma saatleri (opsiyonel)
                    <input style={inputStyle} value={form.calismaSaatleri} onChange={(e) => setForm((f) => ({ ...f, calismaSaatleri: e.target.value }))} placeholder="Örn. 08:00 – 17:00" />
                  </label>
                  <label style={labelStyle}>İletişim (opsiyonel)
                    <input style={inputStyle} value={form.iletisim} onChange={(e) => setForm((f) => ({ ...f, iletisim: e.target.value }))} placeholder="Örn. 0312 xxx xx xx" />
                  </label>
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
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 12 }}>Kayıtlı Hizmetler {hizmetler.length > 0 && `(${hizmetler.length})`}</div>
              {loading ? (
                <div style={{ color: "#8fa0bc", fontSize: 13 }}>Yükleniyor…</div>
              ) : hizmetler.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "#8fa0bc", fontSize: 13, border: "1px dashed #e3ebf6", borderRadius: 12 }}>Henüz hiç hizmet eklenmedi.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {hizmetler.map((h) => (
                    <div key={h.id} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #e3ebf6" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13.5, fontWeight: 800 }}>{h.baslik}</span>
                            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", padding: "2px 8px", borderRadius: 999, background: "#eaf1ff", color: "#175cd3" }}>{KATEGORI_ETIKET[h.kategori] || h.kategori}</span>
                            {!h.aktif && <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "#fff4e2", color: "#a15c00" }}>Pasif</span>}
                          </div>
                          {h.aciklama && <div style={{ fontSize: 12, color: "#5b6b85", marginTop: 4 }}>{h.aciklama}</div>}
                          <div style={{ fontSize: 11, color: "#8fa0bc", marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                            {h.konum_metni && <span>📍 {h.konum_metni}</span>}
                            {h.calisma_saatleri && <span>🕒 {h.calisma_saatleri}</span>}
                            {h.iletisim && <span>☎️ {h.iletisim}</span>}
                            {h.bina_id && <span>🗺️ Haritaya bağlı</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flex: "none" }}>
                          <button type="button" onClick={() => formuDuzenlemeyeAc(h)} style={{ minHeight: 32, padding: "0 12px", fontSize: 11.5, fontWeight: 700, borderRadius: 9, border: "1px solid #c7deff", background: "#f5f9ff", color: "#175cd3", cursor: "pointer" }}>Düzenle</button>
                          <button type="button" disabled={silBusyId === h.id} onClick={() => handleSil(h)} style={{ minHeight: 32, padding: "0 12px", fontSize: 11.5, fontWeight: 700, borderRadius: 9, border: "1px solid #f2c5ba", background: "#fff", color: "#984333", cursor: "pointer" }}>{silBusyId === h.id ? "…" : "Sil"}</button>
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
