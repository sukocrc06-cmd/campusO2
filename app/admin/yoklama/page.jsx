"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { YOKLAMA_DURUMLARI, devamYuzdesiHesapla } from "../../../lib/yoklama";

const inputStyle = { height: 36, padding: "0 10px", border: "1px solid #e3ebf6", borderRadius: 9, fontSize: 12.5, outline: "none" };

export default function AdminYoklamaPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [dersler, setDersler] = useState([]);
  const [akademisyenler, setAkademisyenler] = useState([]);
  const [tumOturumlar, setTumOturumlar] = useState([]);
  const [tumKayitlar, setTumKayitlar] = useState([]);
  const [profilMap, setProfilMap] = useState({});
  const [acikDers, setAcikDers] = useState(null);

  async function loadAll() {
    const [{ data: d, error: dErr }, { data: akademisyenListe }, { data: oturumlar }] = await Promise.all([
      supabase.from("ders_programi").select("*").order("bolum").order("sinif").order("ders_adi"),
      supabase.from("profiles").select("id, full_name, email").eq("role", "academician").order("full_name"),
      supabase.from("yoklama_oturumlari").select("*"),
    ]);
    if (dErr) setError("Dersler alınamadı: " + dErr.message);
    else setDersler(d || []);
    setAkademisyenler(akademisyenListe || []);
    setTumOturumlar(oturumlar || []);

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
    const { error: err } = await supabase.from("ders_programi").update({ akademisyen_id: akademisyenId || null, akademisyen_id_manuel: true }).eq("id", dersId);
    if (err) setError("Atanamadı: " + err.message);
    else { setMessage("Akademisyen ataması güncellendi."); await loadAll(); }
    setBusy(false);
  }

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
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.02em" }}>Yoklama Yönetimi</div>
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
                                  <span>{new Date(o.tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })} · {kayitlar.length} kayıt</span>
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
