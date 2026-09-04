"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

const inputStyle = { height: 42, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 11, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };

export default function OgrenciDersKayitPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState(null);
  const [aktifDonem, setAktifDonem] = useState("bahar");

  const [dersListe, setDersListe] = useState([]);
  const [kayitliIdSet, setKayitliIdSet] = useState(new Set());

  const [profilBolum, setProfilBolum] = useState("");
  const [secilenBolum, setSecilenBolum] = useState("");
  const [aramaMetni, setAramaMetni] = useState("");
  const [sadeceKayitli, setSadeceKayitli] = useState(false);

  async function verileriYukle(uid) {
    const { data: donemSatiri } = await supabase.from("aktif_donem").select("donem").eq("id", true).maybeSingle();
    const guncelDonem = donemSatiri?.donem || "bahar";
    setAktifDonem(guncelDonem);

    const [{ data: d, error: dErr }, { data: k, error: kErr }] = await Promise.all([
      supabase.from("ders_programi").select("*").eq("donem", guncelDonem).order("bolum").order("ders_kodu"),
      supabase.from("ders_kayitlari").select("ders_programi_id").eq("ogrenci_id", uid),
    ]);
    if (dErr) setError("Ders programı alınamadı: " + dErr.message);
    else setDersListe(d || []);
    if (kErr) setError((prev) => prev || "Kayıtların alınamadı: " + kErr.message);
    else setKayitliIdSet(new Set((k || []).map((row) => row.ders_programi_id)));
  }

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("role, bolum, sinif").eq("id", session.user.id).maybeSingle();
      if (profile?.role !== "student") { setError("Bu sayfa yalnız öğrenciler içindir."); setLoading(false); return; }
      setUserId(session.user.id);
      setProfilBolum(profile?.bolum || "");
      setSecilenBolum(profile?.bolum || "");
      await verileriYukle(session.user.id);
      setLoading(false);
    }
    init();
  }, []);

  const bolumSecenekleri = useMemo(() => {
    const set = new Set(dersListe.map((d) => d.bolum).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr-TR"));
  }, [dersListe]);

  const gorunenListe = useMemo(() => {
    const arama = aramaMetni.trim().toLocaleLowerCase("tr-TR");
    return dersListe
      .filter((d) => !secilenBolum || d.bolum === secilenBolum)
      .filter((d) => !sadeceKayitli || kayitliIdSet.has(d.id))
      .filter((d) => {
        if (!arama) return true;
        const hedef = [d.ders_adi, d.ders_kodu, d.hoca_adi, d.bolum].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR");
        return hedef.includes(arama);
      })
      .sort((a, b) => (a.ders_adi || "").localeCompare(b.ders_adi || "", "tr-TR"));
  }, [dersListe, secilenBolum, aramaMetni, sadeceKayitli, kayitliIdSet]);

  const kayitliSayisi = kayitliIdSet.size;

  async function handleEkle(ders) {
    if (!userId || busy) return;
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("ders_kayitlari").insert([{ ogrenci_id: userId, ders_programi_id: ders.id, donem: aktifDonem }]);
    if (err) {
      setError("Ders eklenemedi: " + err.message);
    } else {
      setKayitliIdSet((prev) => new Set(prev).add(ders.id));
      setMessage(`"${ders.ders_adi}" ders programına eklendi${ders.hoca_adi ? ` — ${ders.hoca_adi} hocaya bildirim gitti.` : "."}`);
    }
    setBusy(false);
  }

  async function handleCikar(ders) {
    if (!userId || busy) return;
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("ders_kayitlari").delete().eq("ogrenci_id", userId).eq("ders_programi_id", ders.id);
    if (err) {
      setError("Dersten çıkılamadı: " + err.message);
    } else {
      setKayitliIdSet((prev) => { const next = new Set(prev); next.delete(ders.id); return next; });
      setMessage(`"${ders.ders_adi}" ders programından çıkarıldı.`);
    }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=student" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>DERS KAYIT</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Bu Dönem Aldığın Dersler</span>
              <span style={{ fontSize: 10.5, fontWeight: 800, padding: "3px 8px", borderRadius: 999, background: "#e3faf0", color: "#0b8f5c" }}>{aktifDonem === "guz" ? "Güz Dönemi" : "Bahar Dönemi"}</span>
            </div>
          </div>
        </div>
        <Link href="/ders-programi-sinav-takvimi" style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid #c7deff", color: "#0e4bae" }}>Ders Programıma git</Link>
      </header>

      <main style={{ width: "min(760px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        <div style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 16, marginBottom: 18, fontSize: 12.5, color: "#5b6b85", lineHeight: 1.6 }}>
          Ders programın ve sınav takvimin, burada seçtiğin derslere göre oluşur. Bir dersi eklediğinde o dersin hocasına bildirim gider ve QR/Yoklama Takibi listesinde otomatik görünürsün.
        </div>

        {error ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}
        {message ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#e3faf0", border: "1px solid #b7e9d2", color: "#0b6b46", fontSize: 13, fontWeight: 600 }}>{message}</div> : null}

        {loading ? (
          <p style={{ color: "#5b6b85" }}>Yükleniyor…</p>
        ) : (
          <>
            <section style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 18, marginBottom: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 700, color: "#5b6b85" }}>Bölüm
                <select style={inputStyle} value={secilenBolum} onChange={(e) => setSecilenBolum(e.target.value)}>
                  <option value="">Tüm bölümler</option>
                  {bolumSecenekleri.map((b) => <option key={b} value={b}>{b}{b === profilBolum ? " (benim bölümüm)" : ""}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 700, color: "#5b6b85" }}>Ders/hoca ara
                <input style={inputStyle} placeholder="Örn. Credit Analysis, Ali İhsan…" value={aramaMetni} onChange={(e) => setAramaMetni(e.target.value)} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 700, color: "#5b6b85", marginTop: "auto", marginBottom: 10 }}>
                <input type="checkbox" checked={sadeceKayitli} onChange={(e) => setSadeceKayitli(e.target.checked)} />
                Yalnızca kayıtlı derslerimi göster ({kayitliSayisi})
              </label>
            </section>

            {gorunenListe.length === 0 ? (
              <div style={{ padding: 28, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>
                {sadeceKayitli ? "Henüz hiç ders eklemedin." : "Arama/filtreyle eşleşen ders bulunamadı."}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {gorunenListe.map((d) => {
                  const kayitli = kayitliIdSet.has(d.id);
                  return (
                    <div key={d.id} style={{ background: "#fff", border: kayitli ? "1px solid #b7e9d2" : "1px solid #e3ebf6", borderRadius: 14, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{d.ders_adi} {d.ders_kodu ? <span style={{ fontWeight: 500, color: "#5b6b85" }}>({d.ders_kodu})</span> : null}</div>
                        <div style={{ fontSize: 12, color: "#5b6b85", marginTop: 4 }}>
                          {d.bolum} · {d.sinif}. sınıf{d.gun ? ` · ${d.gun}` : ""}{d.baslangic_saat && d.bitis_saat ? ` ${d.baslangic_saat}–${d.bitis_saat}` : ""}{d.derslik ? ` · ${d.derslik}` : ""}
                        </div>
                        {d.hoca_adi && <div style={{ fontSize: 12, color: "#8fa0bc", marginTop: 2 }}>{d.hoca_adi}</div>}
                      </div>
                      <button
                        type="button"
                        onClick={() => (kayitli ? handleCikar(d) : handleEkle(d))}
                        disabled={busy}
                        style={{
                          minHeight: 36, padding: "0 16px", fontSize: 12.5, fontWeight: 700, borderRadius: 10, cursor: "pointer",
                          border: kayitli ? "1px solid #f2c5ba" : "1px solid #175cd3",
                          background: kayitli ? "#fff" : "#175cd3",
                          color: kayitli ? "#984333" : "#fff",
                        }}
                      >
                        {kayitli ? "Kayıtlı ✓ — Çıkar" : "Ekle"}
                      </button>
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
