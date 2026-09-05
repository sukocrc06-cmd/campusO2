"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

const inputStyle = { height: 42, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 11, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
const labelStyle = { display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 700, color: "#5b6b85" };

// Akademik Yönetim > Ders İçerikleri — öğrencinin kendi bölüm/sınıfına göre
// önden filtrelenmiş, salt okunur ders içeriği kataloğu (amaç, içerik,
// ön koşul, öğrenme çıktıları, haftalık konular, dersi veren hoca).
// Veri zaten var (ders_icerikleri tablosu, admin panelinden yönetiliyor);
// bu sayfa ilk kez öğrenciye açıyor.
export default function OgrenciDersIcerikleriPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dersler, setDersler] = useState([]);
  const [filtreBolum, setFiltreBolum] = useState("");
  const [filtreSinif, setFiltreSinif] = useState("");
  const [arama, setArama] = useState("");
  const [acikId, setAcikId] = useState(null);

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }

      const { data: profil } = await supabase.from("profiles").select("bolum, sinif").eq("id", session.user.id).maybeSingle();

      const { data, error: err } = await supabase.from("ders_icerikleri").select("*").order("bolum").order("yariyil").order("ders_kodu");
      if (err) { setError("Ders içerikleri alınamadı: " + err.message); setLoading(false); return; }
      setDersler(data || []);

      if (profil?.bolum) setFiltreBolum(profil.bolum);
      if (profil?.sinif) setFiltreSinif(String(profil.sinif));

      setLoading(false);
    }
    init();
  }, []);

  const bolumSecenekleri = useMemo(() => Array.from(new Set(dersler.map((d) => d.bolum))).sort((a, b) => a.localeCompare(b, "tr")), [dersler]);
  const sinifSecenekleri = useMemo(() => Array.from(new Set(dersler.map((d) => d.sinif))).sort((a, b) => a - b), [dersler]);

  const filtrelenmis = useMemo(() => {
    const aramaKucuk = arama.trim().toLocaleLowerCase("tr-TR");
    return dersler.filter((d) => {
      if (filtreBolum && d.bolum !== filtreBolum) return false;
      if (filtreSinif && String(d.sinif) !== String(filtreSinif)) return false;
      if (aramaKucuk) {
        const hedef = `${d.ders_kodu} ${d.ders_adi} ${d.dersi_veren || ""}`.toLocaleLowerCase("tr-TR");
        if (!hedef.includes(aramaKucuk)) return false;
      }
      return true;
    });
  }, [dersler, filtreBolum, filtreSinif, arama]);

  const gruplu = useMemo(() => {
    const map = new Map();
    filtrelenmis.forEach((d) => {
      const anahtar = `${d.bolum} · ${d.yariyil}. Yarıyıl`;
      if (!map.has(anahtar)) map.set(anahtar, []);
      map.get(anahtar).push(d);
    });
    return Array.from(map.entries());
  }, [filtrelenmis]);

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=student" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>AKADEMİK YÖNETİM</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Ders İçerikleri</div>
          </div>
        </div>
        <Link href="/ders-programi-sinav-takvimi" style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid #c7deff", color: "#0e4bae" }}>Ders Programına git</Link>
      </header>

      <main style={{ width: "min(900px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        {loading ? (
          <p style={{ color: "#8fa0bc", fontSize: 13 }}>Yükleniyor…</p>
        ) : error ? (
          <div style={{ padding: 20, borderRadius: 14, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13 }}>{error}</div>
        ) : (
          <>
            <section style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 18, marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: "#5b6b85", marginBottom: 14 }}>
                Her ders için amaç, içerik, ön koşul, öğrenme çıktıları, haftalık konular ve dersi veren hoca bilgisi. Toplam {dersler.length} ders.
              </div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <label style={labelStyle}>Bölüm
                  <select style={inputStyle} value={filtreBolum} onChange={(e) => setFiltreBolum(e.target.value)}>
                    <option value="">Tümü</option>
                    {bolumSecenekleri.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </label>
                <label style={labelStyle}>Sınıf
                  <select style={inputStyle} value={filtreSinif} onChange={(e) => setFiltreSinif(e.target.value)}>
                    <option value="">Tümü</option>
                    {sinifSecenekleri.map((s) => <option key={s} value={s}>{s}. sınıf</option>)}
                  </select>
                </label>
                <label style={labelStyle}>Ara (ders kodu, adı, hoca)
                  <input style={inputStyle} value={arama} onChange={(e) => setArama(e.target.value)} placeholder="ör. BF303, Statistics, Korkut…" />
                </label>
              </div>
              <div style={{ fontSize: 12, color: "#8fa0bc", marginTop: 10 }}>{filtrelenmis.length} ders listeleniyor</div>
            </section>

            {gruplu.length === 0 ? (
              <div style={{ padding: 28, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>Filtreyle eşleşen ders bulunamadı.</div>
            ) : (
              gruplu.map(([baslik, list]) => (
                <details key={baslik} open={!!arama.trim()} style={{ marginBottom: 12, border: "1px solid #e3ebf6", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
                  <summary style={{ cursor: "pointer", listStyle: "none", padding: "12px 14px", fontSize: 12.5, fontWeight: 800, color: "#175cd3", background: "#f5f8fc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{baslik}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#5b6b85" }}>{list.length} ders</span>
                  </summary>
                  <div style={{ display: "grid", gap: 8, padding: 10 }}>
                    {list.map((d) => {
                      const acik = acikId === d.id;
                      return (
                        <div key={d.id} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 12, overflow: "hidden" }}>
                          <button
                            type="button"
                            onClick={() => setAcikId(acik ? null : d.id)}
                            style={{ width: "100%", textAlign: "left", padding: "12px 14px", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}
                          >
                            <div>
                              <b style={{ fontSize: 13 }}>{d.ders_kodu}</b> <span style={{ fontSize: 13 }}>{d.ders_adi}</span>
                              <div style={{ fontSize: 11, color: "#5b6b85", marginTop: 2 }}>{d.t_u_l} · {d.tur} · {d.akts} AKTS · {d.ogretim_sekli} · {d.dil}{d.dersi_veren && d.dersi_veren !== "Yok" ? ` · ${d.dersi_veren}` : ""}</div>
                            </div>
                            <span style={{ fontSize: 18, color: "#8fa0bc" }}>{acik ? "−" : "+"}</span>
                          </button>
                          {acik && (
                            <div style={{ padding: "0 14px 16px", fontSize: 12.5, color: "#3a3a3a", display: "grid", gap: 10 }}>
                              {d.amac && (
                                <div><b style={{ fontSize: 11.5, color: "#175cd3" }}>Dersin Amacı</b><div style={{ marginTop: 3 }}>{d.amac}</div></div>
                              )}
                              {d.icerik && (
                                <div><b style={{ fontSize: 11.5, color: "#175cd3" }}>Dersin İçeriği</b><div style={{ marginTop: 3 }}>{d.icerik}</div></div>
                              )}
                              {d.on_kosul && d.on_kosul !== "Yok" && (
                                <div><b style={{ fontSize: 11.5, color: "#175cd3" }}>Ön Koşul</b><div style={{ marginTop: 3 }}>{d.on_kosul}</div></div>
                              )}
                              {d.ogrenme_ciktilari && (
                                <div><b style={{ fontSize: 11.5, color: "#175cd3" }}>Öğrenme Çıktıları</b><div style={{ marginTop: 3 }}>{d.ogrenme_ciktilari}</div></div>
                              )}
                              {Array.isArray(d.haftalik_konular) && d.haftalik_konular.length > 0 && (
                                <div>
                                  <b style={{ fontSize: 11.5, color: "#175cd3" }}>Haftalık Ders Konuları</b>
                                  <ol style={{ margin: "5px 0 0", paddingLeft: 20 }}>
                                    {d.haftalik_konular.map((k, i) => <li key={i} style={{ marginBottom: 2 }}>{k}</li>)}
                                  </ol>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))
            )}
          </>
        )}
      </main>
    </div>
  );
}
