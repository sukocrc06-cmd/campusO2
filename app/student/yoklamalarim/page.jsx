"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { YOKLAMA_DURUMLARI, devamYuzdesiHesapla } from "../../../lib/yoklama";

export default function OgrenciYoklamalarimPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [kayitlar, setKayitlar] = useState([]);
  const [oturumMap, setOturumMap] = useState({});
  const [dersMap, setDersMap] = useState({});
  const [acikDers, setAcikDers] = useState(null);

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }

      const { data: k, error: kErr } = await supabase.from("yoklama_kayitlari").select("*").eq("ogrenci_id", session.user.id);
      if (kErr) { setError("Yoklama kayıtların alınamadı: " + kErr.message); setLoading(false); return; }
      setKayitlar(k || []);

      const oturumIdler = Array.from(new Set((k || []).map((row) => row.oturum_id)));
      if (oturumIdler.length > 0) {
        const { data: oturumlar } = await supabase.from("yoklama_oturumlari").select("*").in("id", oturumIdler);
        const oMap = {};
        (oturumlar || []).forEach((o) => { oMap[o.id] = o; });
        setOturumMap(oMap);

        const dersIdler = Array.from(new Set((oturumlar || []).map((o) => o.ders_programi_id)));
        if (dersIdler.length > 0) {
          const { data: dersler } = await supabase.from("ders_programi").select("*").in("id", dersIdler);
          const dMap = {};
          (dersler || []).forEach((d) => { dMap[d.id] = d; });
          setDersMap(dMap);
        }
      }

      setLoading(false);
    }
    init();
  }, []);

  const dersBazliOzet = useMemo(() => {
    const gruplu = new Map();
    kayitlar.forEach((k) => {
      const oturum = oturumMap[k.oturum_id];
      if (!oturum) return;
      const ders = dersMap[oturum.ders_programi_id];
      if (!ders) return;
      if (!gruplu.has(ders.id)) gruplu.set(ders.id, { ders, kayitlar: [] });
      gruplu.get(ders.id).kayitlar.push({ ...k, tarih: oturum.tarih });
    });
    return Array.from(gruplu.values())
      .map((g) => ({ ...g, yuzde: devamYuzdesiHesapla(g.kayitlar), kayitlar: g.kayitlar.sort((a, b) => b.tarih.localeCompare(a.tarih)) }))
      .sort((a, b) => (a.ders.ders_adi || "").localeCompare(b.ders.ders_adi || "", "tr"));
  }, [kayitlar, oturumMap, dersMap]);

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=student" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>VOL 1-12 · YOKLAMA TAKİBİ</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Yoklamalarım</div>
          </div>
        </div>
        <Link href="/?role=student" style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid #c7deff", color: "#0e4bae" }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(700px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        {error ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}

        {loading ? (
          <p style={{ color: "#5b6b85" }}>Yükleniyor…</p>
        ) : dersBazliOzet.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>
            Henüz senin için işlenmiş bir yoklama kaydı yok.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {dersBazliOzet.map(({ ders, kayitlar, yuzde }) => {
              const esik = ders.asgari_devam_yuzdesi ?? 70;
              const dusukMu = yuzde !== null && yuzde < esik;
              const acik = acikDers === ders.id;
              return (
                <div key={ders.id} style={{ background: "#fff", border: dusukMu ? "1px solid #f2c5ba" : "1px solid #e3ebf6", borderRadius: 16, padding: 16 }}>
                  <button type="button" onClick={() => setAcikDers(acik ? null : ders.id)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{ders.ders_adi} {ders.ders_kodu ? <span style={{ fontWeight: 500, color: "#5b6b85" }}>({ders.ders_kodu})</span> : null}</div>
                      <div style={{ fontSize: 11.5, color: "#8fa0bc", marginTop: 2 }}>{kayitlar.length} oturum · asgari %{esik}</div>
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 800, color: dusukMu ? "#c0273c" : "#0b8f5c" }}>{yuzde !== null ? `%${yuzde}` : "—"}</span>
                  </button>
                  {dusukMu && <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 700, color: "#984333" }}>⚠️ Devam oranın asgari eşiğin altında.</div>}
                  {acik && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e3ebf6", display: "grid", gap: 6 }}>
                      {kayitlar.map((k) => {
                        const d = YOKLAMA_DURUMLARI[k.durum] || YOKLAMA_DURUMLARI.yok;
                        return (
                          <div key={k.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
                            <span>{new Date(k.tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}</span>
                            <span style={{ fontSize: 10.5, fontWeight: 800, color: d.color, background: d.bg, padding: "3px 10px", borderRadius: 999 }}>{d.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
