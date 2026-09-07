"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

const cardStyle = { background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 24, marginBottom: 16 };
const inputStyle = { height: 42, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 10, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
const labelStyle = { fontSize: 11.5, fontWeight: 700, color: "#5b6b85", display: "flex", flexDirection: "column", gap: 5 };

const TIP_ETIKET = { ring: "Ring", servis: "Servis", ego: "EGO Otobüs", diger: "Diğer" };

function bosHat() {
  return { id: null, ad: "", tip: "ring", aciklama: "", notlar: "", aktif: true, sira: 0, duraklar: [{ ad: "", saatler: "", konum: "", hat_no: "" }] };
}

// duraklar jsonb <-> form arasında dönüştürücüler. Veritabanında
// [{ ad, saatler: ["07:30","08:15"], konum, hat_no }] olarak saklanıyor;
// formda her durağın saatleri tek bir virgülle-ayrılmış metin alanı olarak
// düzenleniyor. "konum" tamamen opsiyonel — koordinat ("39.9756,32.8623")
// ya da düz bir yer adı ("AYBÜ Esenboğa Kampüsü Ana Kapı") olabilir; öğrenci
// sayfasında bu, API key gerektirmeyen düz bir Google Maps arama linkine
// (google.com/maps/search) dönüştürülüyor — tamamen ücretsiz. "hat_no" da
// opsiyonel — bir duraktan BİR SONRAKİ adıma binilecek otobüs/metro hattını
// belirtir (örn. "472" ya da "486 / 477"); saat çizelgesi yerine "şu
// duraktan şu hatta binin" tarzı güzergah tariflerini (AŞTİ/Havalimanı/YHT
// gibi) desteklemek için eklendi. Öğrenci sayfasında ≥2 durağı olan hatlar
// otomatik olarak animasyonlu bir güzergah şeridi olarak gösteriliyor.
function duraklarFormaDonustur(duraklar) {
  if (!Array.isArray(duraklar) || duraklar.length === 0) return [{ ad: "", saatler: "", konum: "", hat_no: "" }];
  return duraklar.map((d) => ({ ad: d.ad || "", saatler: (d.saatler || []).join(", "), konum: d.konum || "", hat_no: d.hat_no || "" }));
}
function duraklarKaydaDonustur(duraklarForm) {
  return duraklarForm
    .map((d) => ({
      ad: d.ad.trim(),
      saatler: d.saatler.split(",").map((s) => s.trim()).filter(Boolean),
      konum: d.konum.trim() || null,
      hat_no: d.hat_no.trim() || null,
    }))
    .filter((d) => d.ad);
}

export default function AdminKampusUlasimPage() {
  const [yetkili, setYetkili] = useState(null);
  const [hatlar, setHatlar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(bosHat());
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
    const { data, error: err } = await supabase.from("kampus_ulasim_hatlari").select("*").order("sira", { ascending: true }).order("created_at", { ascending: true });
    if (err) setHata("Liste alınamadı: " + err.message);
    else setHatlar(data || []);
  }

  function formuDuzenlemeyeAc(hat) {
    setDuzenlenenId(hat.id);
    setForm({
      id: hat.id,
      ad: hat.ad || "",
      tip: hat.tip || "ring",
      aciklama: hat.aciklama || "",
      notlar: hat.notlar || "",
      aktif: hat.aktif !== false,
      sira: hat.sira ?? 0,
      duraklar: duraklarFormaDonustur(hat.duraklar),
    });
    setMesaj(""); setHata("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function formuSifirla() {
    setDuzenlenenId(null);
    setForm(bosHat());
  }

  function durakGuncelle(idx, alan, deger) {
    setForm((f) => {
      const yeniDuraklar = f.duraklar.slice();
      yeniDuraklar[idx] = { ...yeniDuraklar[idx], [alan]: deger };
      return { ...f, duraklar: yeniDuraklar };
    });
  }
  function durakEkle() {
    setForm((f) => ({ ...f, duraklar: [...f.duraklar, { ad: "", saatler: "" }] }));
  }
  function durakSil(idx) {
    setForm((f) => ({ ...f, duraklar: f.duraklar.filter((_, i) => i !== idx) }));
  }

  async function handleKaydet(e) {
    e.preventDefault();
    const ad = form.ad.trim();
    if (!ad) { setHata("Hat adı zorunlu."); return; }
    const duraklar = duraklarKaydaDonustur(form.duraklar);

    setKaydetBusy(true); setHata(""); setMesaj("");
    const kayit = {
      ad,
      tip: form.tip,
      aciklama: form.aciklama.trim() || null,
      notlar: form.notlar.trim() || null,
      aktif: form.aktif,
      sira: Number(form.sira) || 0,
      duraklar,
    };

    const { error: err } = duzenlenenId
      ? await supabase.from("kampus_ulasim_hatlari").update(kayit).eq("id", duzenlenenId)
      : await supabase.from("kampus_ulasim_hatlari").insert(kayit);

    setKaydetBusy(false);
    if (err) { setHata("Kaydedilemedi: " + err.message); return; }
    setMesaj(duzenlenenId ? `"${ad}" güncellendi.` : `"${ad}" eklendi.`);
    formuSifirla();
    await listeyiYenile();
  }

  async function handleSil(hat) {
    setSilBusyId(hat.id); setHata(""); setMesaj("");
    const { error: err } = await supabase.from("kampus_ulasim_hatlari").delete().eq("id", hat.id);
    setSilBusyId(null);
    if (err) { setHata("Silinemedi: " + err.message); return; }
    setMesaj(`"${hat.ad}" kaldırıldı.`);
    if (duzenlenenId === hat.id) formuSifirla();
    await listeyiYenile();
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=admin" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>YÖNETİM MERKEZİ · KAMPÜS YAŞAMI</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Kampüs Ulaşımı — Ring / Servis Hatları</div>
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
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>{duzenlenenId ? "Hattı Düzenle" : "Yeni Hat Ekle"}</div>
              <div style={{ fontSize: 12, color: "#8fa0bc", marginBottom: 16, lineHeight: 1.6 }}>
                AYBÜ'nün resmi sitesinde otomatik çekilebilecek bir ring/servis kaynağı olmadığı için bu bilgiler elle girilip
                dönem başında güncelleniyor. Öğrenciler bu listeyi Kampüs Yaşamı → Ulaşım altında görür.
              </div>

              <form onSubmit={handleKaydet} style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr 1fr" }}>
                  <label style={labelStyle}>Hat Adı
                    <input style={inputStyle} value={form.ad} onChange={(e) => setForm((f) => ({ ...f, ad: e.target.value }))} placeholder="Kızılay - Esenboğa Ring" />
                  </label>
                  <label style={labelStyle}>Tip
                    <select style={inputStyle} value={form.tip} onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))}>
                      <option value="ring">Ring</option>
                      <option value="servis">Servis</option>
                      <option value="ego">EGO Otobüs</option>
                      <option value="diger">Diğer</option>
                    </select>
                  </label>
                  <label style={labelStyle}>Sıra
                    <input style={inputStyle} type="number" value={form.sira} onChange={(e) => setForm((f) => ({ ...f, sira: e.target.value }))} />
                  </label>
                </div>

                <label style={labelStyle}>Açıklama (opsiyonel)
                  <input style={inputStyle} value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} placeholder="Örn. Hafta içi her gün çalışır" />
                </label>

                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#5b6b85", marginBottom: 6 }}>Duraklar / Güzergah Adımları</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {form.duraklar.map((d, idx) => (
                      <div key={idx} style={{ padding: 10, borderRadius: 11, border: "1px solid #eef2f8", display: "grid", gap: 8 }}>
                        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1.3fr 1fr auto", alignItems: "center" }}>
                          <input style={inputStyle} value={d.ad} onChange={(e) => durakGuncelle(idx, "ad", e.target.value)} placeholder="Durak/adım adı (örn. Kızılay 15 Temmuz Milli İrade Meydanı)" />
                          <input style={inputStyle} value={d.hat_no} onChange={(e) => durakGuncelle(idx, "hat_no", e.target.value)} placeholder="Hat no (opsiyonel, örn. 472)" />
                          <button type="button" onClick={() => durakSil(idx)} disabled={form.duraklar.length <= 1} style={{ minHeight: 42, padding: "0 12px", fontSize: 12, fontWeight: 700, borderRadius: 9, border: "1px solid #f2c5ba", background: "#fff", color: "#984333", cursor: form.duraklar.length <= 1 ? "not-allowed" : "pointer", opacity: form.duraklar.length <= 1 ? 0.5 : 1 }}>Sil</button>
                        </div>
                        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
                          <input style={inputStyle} value={d.saatler} onChange={(e) => durakGuncelle(idx, "saatler", e.target.value)} placeholder="Saatler, opsiyonel (07:30, 08:15)" />
                          <input
                            style={inputStyle}
                            value={d.konum}
                            onChange={(e) => durakGuncelle(idx, "konum", e.target.value)}
                            placeholder={'Konum, opsiyonel (yer adı ya da "39.9756,32.8623")'}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: "#8fa0bc", lineHeight: 1.5 }}>
                    2 veya daha fazla durak/adım girersen öğrenci sayfasında bunlar otomatik olarak animasyonlu bir güzergah şeridi halinde gösterilir — her adımın altında "Hat no" girilmişse rozet olarak çıkar.
                    Konum girilirse ayrıca "Haritada Aç" butonu çıkar ve Google Maps'te açılır — API key gerekmez, tamamen ücretsiz.
                    Koordinatı bulmak için Google Maps'te durağa sağ tıklayıp koordinatları kopyalayabilirsin.
                  </div>
                  <button type="button" onClick={durakEkle} style={{ marginTop: 8, minHeight: 36, padding: "0 14px", fontSize: 12, fontWeight: 700, borderRadius: 9, border: "1px dashed #c7deff", background: "#f5f9ff", color: "#175cd3", cursor: "pointer" }}>+ Durak Ekle</button>
                </div>

                <label style={labelStyle}>Notlar (opsiyonel)
                  <input style={inputStyle} value={form.notlar} onChange={(e) => setForm((f) => ({ ...f, notlar: e.target.value }))} placeholder="Örn. Resmi tatillerde çalışmaz" />
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
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 12 }}>Kayıtlı Hatlar {hatlar.length > 0 && `(${hatlar.length})`}</div>
              {loading ? (
                <div style={{ color: "#8fa0bc", fontSize: 13 }}>Yükleniyor…</div>
              ) : hatlar.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "#8fa0bc", fontSize: 13, border: "1px dashed #e3ebf6", borderRadius: 12 }}>Henüz hiç hat eklenmedi.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {hatlar.map((h) => (
                    <div key={h.id} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #e3ebf6" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 800 }}>{h.ad}</span>
                            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", padding: "2px 8px", borderRadius: 999, background: "#eaf1ff", color: "#175cd3" }}>{TIP_ETIKET[h.tip] || h.tip}</span>
                            {!h.aktif && <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "#fff4e2", color: "#a15c00" }}>Pasif</span>}
                          </div>
                          {h.aciklama && <div style={{ fontSize: 12, color: "#5b6b85", marginTop: 4 }}>{h.aciklama}</div>}
                          {Array.isArray(h.duraklar) && h.duraklar.length > 0 && (
                            <div style={{ marginTop: 8, display: "grid", gap: 3 }}>
                              {h.duraklar.map((d, i) => (
                                <div key={i} style={{ fontSize: 11.5, color: "#0f1b33" }}>
                                  <b>{d.ad}</b>{d.hat_no ? ` · 🚍 ${d.hat_no}` : ""}{d.saatler?.length ? ` — ${d.saatler.join(", ")}` : ""}
                                  {d.konum && (
                                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.konum)}`} target="_blank" rel="noreferrer" style={{ marginLeft: 6, fontSize: 10.5, color: "#175cd3", fontWeight: 700 }}>📍 haritada gör</a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
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
