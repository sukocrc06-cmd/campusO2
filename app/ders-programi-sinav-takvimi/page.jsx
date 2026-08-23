"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { GUNLER } from "../../lib/ders-sinav-excel";

const inputStyle = { height: 42, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 11, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
const labelStyle = { display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 700, color: "#5b6b85" };

const SINAV_RENK = {
  "Vize": { color: "#175cd3", bg: "#e6f0ff" },
  "Final": { color: "#0e4bae", bg: "#dbe9ff" },
  "Bütünleme": { color: "#ffb13b", bg: "#fff8eb" },
};

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DersSinavTakvimiPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleHref, setRoleHref] = useState("/");
  const [tab, setTab] = useState("ders"); // ders | sinav

  const [dersListe, setDersListe] = useState([]);
  const [sinavListe, setSinavListe] = useState([]);

  const [bolumler, setBolumler] = useState([]);
  const [siniflar, setSiniflar] = useState([]);
  const [secilenBolum, setSecilenBolum] = useState("");
  const [secilenSinif, setSecilenSinif] = useState("");

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
      const isAcademician = session.user.email?.toLowerCase() !== "suko.crc06@gmail.com" && profile?.role === "academician";
      setRoleHref(isAcademician ? "/?role=faculty" : "/?role=student");

      const [{ data: d, error: dErr }, { data: s, error: sErr }] = await Promise.all([
        supabase.from("ders_programi").select("*"),
        supabase.from("sinav_takvimi").select("*"),
      ]);
      if (dErr) setError("Ders programı alınamadı: " + dErr.message);
      else setDersListe(d || []);
      if (sErr) setError((prev) => prev || "Sınav takvimi alınamadı: " + sErr.message);
      else setSinavListe(s || []);

      const bolumSet = new Set([...(d || []).map((r) => r.bolum), ...(s || []).map((r) => r.bolum)]);
      const bolumDizi = Array.from(bolumSet).filter(Boolean).sort();
      setBolumler(bolumDizi);
      if (bolumDizi.length === 1) setSecilenBolum(bolumDizi[0]);

      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (!secilenBolum) { setSiniflar([]); setSecilenSinif(""); return; }
    const sinifSet = new Set([
      ...dersListe.filter((r) => r.bolum === secilenBolum).map((r) => r.sinif),
      ...sinavListe.filter((r) => r.bolum === secilenBolum).map((r) => r.sinif),
    ]);
    const sinifDizi = Array.from(sinifSet).filter(Boolean).sort();
    setSiniflar(sinifDizi);
    if (sinifDizi.length === 1) setSecilenSinif(sinifDizi[0]);
    else setSecilenSinif("");
  }, [secilenBolum, dersListe, sinavListe]);

  const filtrelenmisDers = useMemo(
    () => dersListe.filter((d) => d.bolum === secilenBolum && d.sinif === secilenSinif),
    [dersListe, secilenBolum, secilenSinif],
  );
  const filtrelenmisSinav = useMemo(
    () => sinavListe
      .filter((s) => s.bolum === secilenBolum && s.sinif === secilenSinif)
      .sort((a, b) => (a.tarih + a.saat).localeCompare(b.tarih + b.saat)),
    [sinavListe, secilenBolum, secilenSinif],
  );

  const gunlukProgram = useMemo(() => {
    const map = new Map(GUNLER.map((g) => [g, []]));
    filtrelenmisDers.forEach((d) => { if (map.has(d.gun)) map.get(d.gun).push(d); });
    map.forEach((list) => list.sort((a, b) => a.baslangic_saat.localeCompare(b.baslangic_saat)));
    return map;
  }, [filtrelenmisDers]);

  const bugun = todayIso();
  const secimTamam = secilenBolum && secilenSinif;

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={roleHref} style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>VOL 1-8 · DERS VE SINAV TAKVİMİ</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Ders Programı & Sınav Takvimi</div>
          </div>
        </div>
        <Link href={roleHref} style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid #c7deff", color: "#0e4bae" }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(900px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        {error ? (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{error}</div>
        ) : null}

        <section style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 18, marginBottom: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <label style={labelStyle}>Bölüm
            <select style={inputStyle} value={secilenBolum} onChange={(e) => setSecilenBolum(e.target.value)}>
              <option value="">Seçiniz…</option>
              {bolumler.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Sınıf
            <select style={inputStyle} value={secilenSinif} onChange={(e) => setSecilenSinif(e.target.value)} disabled={!secilenBolum}>
              <option value="">Seçiniz…</option>
              {siniflar.map((s) => <option key={s} value={s}>{s}. sınıf</option>)}
            </select>
          </label>
        </section>

        {loading ? (
          <p style={{ color: "#5b6b85" }}>Yükleniyor…</p>
        ) : !secimTamam ? (
          <div style={{ padding: 32, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>
            {bolumler.length === 0 ? "Henüz ders programı veya sınav takvimi verisi yok." : "Programı görmek için bölüm ve sınıf seç."}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              <button type="button" onClick={() => setTab("ders")} style={{ padding: "10px 18px", borderRadius: 999, border: tab === "ders" ? "1px solid #175cd3" : "1px solid #e3ebf6", background: tab === "ders" ? "#175cd3" : "#fff", color: tab === "ders" ? "#fff" : "#5b6b85", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Ders Programı</button>
              <button type="button" onClick={() => setTab("sinav")} style={{ padding: "10px 18px", borderRadius: 999, border: tab === "sinav" ? "1px solid #175cd3" : "1px solid #e3ebf6", background: tab === "sinav" ? "#175cd3" : "#fff", color: tab === "sinav" ? "#fff" : "#5b6b85", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                Sınav Takvimi {filtrelenmisSinav.length > 0 ? `(${filtrelenmisSinav.length})` : ""}
              </button>
            </div>

            {tab === "ders" && (
              filtrelenmisDers.length === 0 ? (
                <div style={{ padding: 28, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>Bu bölüm/sınıf için ders programı girilmemiş.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                  {GUNLER.map((gun) => (
                    <div key={gun} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 14, padding: 12, minHeight: 80 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: "#175cd3", marginBottom: 8 }}>{gun.toUpperCase()}</div>
                      {gunlukProgram.get(gun).length === 0 ? (
                        <div style={{ fontSize: 11, color: "#c3cee0" }}>—</div>
                      ) : (
                        <div style={{ display: "grid", gap: 8 }}>
                          {gunlukProgram.get(gun).map((d) => (
                            <div key={d.id} style={{ padding: "8px 10px", borderRadius: 10, background: "#f5f8fc", border: "1px solid #e3ebf6" }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#0e4bae" }}>{d.baslangic_saat}–{d.bitis_saat}</div>
                              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>{d.ders_adi}</div>
                              {(d.derslik || d.hoca_adi) && (
                                <div style={{ fontSize: 10, color: "#5b6b85", marginTop: 2 }}>{[d.derslik, d.hoca_adi].filter(Boolean).join(" · ")}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === "sinav" && (
              filtrelenmisSinav.length === 0 ? (
                <div style={{ padding: 28, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>Bu bölüm/sınıf için sınav takvimi girilmemiş.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {filtrelenmisSinav.map((s) => {
                    const gecmisMi = s.tarih < bugun;
                    const renk = SINAV_RENK[s.sinav_turu] || { color: "#5b6b85", bg: "#f5f8fc" };
                    return (
                      <div key={s.id} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 14, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", opacity: gecmisMi ? 0.55 : 1 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14 }}>{s.ders_adi} {s.ders_kodu ? <span style={{ fontWeight: 500, color: "#5b6b85" }}>({s.ders_kodu})</span> : null}</div>
                          <div style={{ fontSize: 12, color: "#5b6b85", marginTop: 4 }}>
                            {new Date(s.tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })} · {s.saat} {s.derslik ? `· ${s.derslik}` : ""}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: renk.color, background: renk.bg, padding: "5px 12px", borderRadius: 999 }}>{s.sinav_turu}</span>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </>
        )}
      </main>
    </div>
  );
}
