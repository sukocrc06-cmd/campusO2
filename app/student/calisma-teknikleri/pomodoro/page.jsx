"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import { OdakHalkasi, saniyeyiMMSSyapVeyaSaat, sesCal } from "../../../../lib/buyuyen-bitki";

const cardStyle = { background: "#fff", border: "1px solid #e3ebf6", borderRadius: 18, padding: 24 };
const btnPrimary = { minHeight: 46, padding: "0 20px", fontSize: 14, fontWeight: 800, borderRadius: 12, border: "none", background: "#175cd3", color: "#fff", cursor: "pointer" };
const btnGhost = { minHeight: 40, padding: "0 14px", fontSize: 12.5, fontWeight: 700, borderRadius: 11, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", cursor: "pointer" };
const inputStyle = { height: 44, padding: "0 14px", border: "1px solid #e3ebf6", borderRadius: 11, fontSize: 13.5, outline: "none", width: "100%", boxSizing: "border-box" };

const CALISMA_SANIYE = 1500; // 25 dk
const KISA_MOLA_SANIYE = 300; // 5 dk
const UZUN_MOLA_SANIYE = 1200; // 20 dk — her 4 pomodoroda bir

function bugunBaslangicISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function PomodoroPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState(null);

  const [konu, setKonu] = useState("");
  const [faz, setFaz] = useState("hazir"); // hazir | calisma | kisa_mola | uzun_mola
  const [oturum, setOturum] = useState(null); // DB satırı, sadece 'calisma' fazında
  const [molaBitis, setMolaBitis] = useState(null); // Date.now() + ms, sadece mola fazlarında
  const [kalan, setKalan] = useState(CALISMA_SANIYE);
  const [busy, setBusy] = useState(false);
  const [pomodoroBugun, setPomodoroBugun] = useState(0);
  const [gecmis, setGecmis] = useState([]);
  const kilit = useRef(false);

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }
      const uid = session.user.id;
      setUserId(uid);

      const { data: aktif } = await supabase.from("calisma_oturumlari").select("*").eq("kullanici_id", uid).eq("tur", "pomodoro").eq("durum", "devam_ediyor").maybeSingle();
      if (aktif) { setOturum(aktif); setFaz("calisma"); if (aktif.konu) setKonu(aktif.konu); }

      await gecmisiYenile(uid);
      setLoading(false);
    }
    init();
  }, []);

  async function gecmisiYenile(uid) {
    const { data } = await supabase.from("calisma_oturumlari").select("id, konu, tamamlanma_at")
      .eq("kullanici_id", uid).eq("tur", "pomodoro").eq("durum", "tamamlandi")
      .gte("tamamlanma_at", bugunBaslangicISO()).order("tamamlanma_at", { ascending: false });
    setGecmis(data || []);
    setPomodoroBugun((data || []).length);
  }

  // --- Çalışma sayaç (DB'ye bağlı, sunucu zamanına göre) ---
  useEffect(() => {
    if (faz !== "calisma" || !oturum) return;
    const bitis = new Date(oturum.bitis_zamani_planlanan).getTime();
    async function tik() {
      const k = Math.max(0, Math.round((bitis - Date.now()) / 1000));
      setKalan(k);
      if (k <= 0 && !kilit.current) {
        kilit.current = true;
        const { error: hataMsg } = await supabase.from("calisma_oturumlari").update({ durum: "tamamlandi" }).eq("id", oturum.id);
        kilit.current = false;
        if (!hataMsg) {
          const yeniSayi = pomodoroBugun + 1;
          await gecmisiYenile(userId);
          const uzunMu = yeniSayi % 4 === 0;
          sesCal(uzunMu ? "kutlama" : "bildirim");
          setOturum(null);
          setMolaBitis(Date.now() + (uzunMu ? UZUN_MOLA_SANIYE : KISA_MOLA_SANIYE) * 1000);
          setFaz(uzunMu ? "uzun_mola" : "kisa_mola");
        }
      }
    }
    tik();
    const id = setInterval(tik, 1000);
    return () => clearInterval(id);
  }, [faz, oturum?.id]);

  // --- Mola sayaç (istemci taraflı, DB gerektirmez) ---
  useEffect(() => {
    if ((faz !== "kisa_mola" && faz !== "uzun_mola") || !molaBitis) return;
    function tik() {
      const k = Math.max(0, Math.round((molaBitis - Date.now()) / 1000));
      setKalan(k);
      if (k <= 0) {
        sesCal("bildirim");
        setFaz("hazir");
        setKalan(CALISMA_SANIYE);
        setMolaBitis(null);
      }
    }
    tik();
    const id = setInterval(tik, 1000);
    return () => clearInterval(id);
  }, [faz, molaBitis]);

  async function baslat() {
    if (!userId) return;
    setBusy(true);
    setError("");
    // İlk kullanıcı etkileşimiyle ses bağlamını "ısındır" (tarayıcı otomatik
    // oynatma kısıtlamasını aşmak için) — burada gerçek ses çalınmaz.
    const { data, error: hataMsg } = await supabase.from("calisma_oturumlari")
      .insert({ kullanici_id: userId, tur: "pomodoro", hedef_saniye: CALISMA_SANIYE, konu: konu.trim() || null })
      .select().single();
    setBusy(false);
    if (hataMsg) { setError(hataMsg.message); return; }
    setOturum(data);
    setFaz("calisma");
  }

  async function durdur() {
    if (!oturum) return;
    await supabase.from("calisma_oturumlari").update({ durum: "iptal" }).eq("id", oturum.id);
    setOturum(null);
    setFaz("hazir");
    setKalan(CALISMA_SANIYE);
  }

  function molayiAtla() {
    setFaz("hazir");
    setKalan(CALISMA_SANIYE);
    setMolaBitis(null);
  }

  const hedefSaniye = faz === "calisma" ? CALISMA_SANIYE : faz === "uzun_mola" ? UZUN_MOLA_SANIYE : faz === "kisa_mola" ? KISA_MOLA_SANIYE : CALISMA_SANIYE;
  const yuzde = faz === "hazir" ? 0 : Math.min(100, Math.max(0, 100 * (1 - kalan / hedefSaniye)));
  const halkaRenk = faz === "uzun_mola" ? "#0b8f5c" : faz === "kisa_mola" ? "#0b8f5c" : "#175cd3";

  const gecmisGruplu = gecmis.reduce((acc, g) => {
    const anahtar = g.konu || "Etiketsiz";
    acc[anahtar] = (acc[anahtar] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=student" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>AKADEMİK YÖNETİM · BİLİMSEL ÇALIŞMA TEKNİKLERİ</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Pomodoro Tekniği</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/student/calisma-teknikleri/aralikli-tekrar" style={{ minHeight: 40, padding: "0 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 11, border: "1px solid #e3ebf6", color: "#5b6b85" }}>Aralıklı Tekrar</Link>
          <Link href="/student/calisma-teknikleri/uzun-odakli" style={{ minHeight: 40, padding: "0 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 11, border: "1px solid #e3ebf6", color: "#5b6b85" }}>Uzun Odaklı Çalışma</Link>
        </div>
      </header>

      <main style={{ width: "min(560px, 100%)", margin: "0 auto", padding: "28px 18px 60px", display: "grid", gap: 18 }}>
        {error ? <div style={{ padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}

        {loading ? <div style={{ color: "#8fa0bc", fontSize: 13 }}>Yükleniyor…</div> : (
          <>
            <div style={{ ...cardStyle, textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#8fa0bc", marginBottom: 4 }}>
                {faz === "calisma" ? "Odaklan" : faz === "kisa_mola" ? "Kısa mola" : faz === "uzun_mola" ? "Uzun mola — 4 pomodoro tamamladın 🎉" : "Pomodoro Tekniği"}
              </div>
              <div style={{ fontSize: 12, color: "#8fa0bc", marginBottom: 18, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
                25 dakikalık odaklanma aralıklarından ve ardından 5 dakikalık kısa moladan oluşur; her 4. odaklanmadan sonra 20 dakikalık uzun mola gelir.
              </div>

              <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
                <OdakHalkasi percent={yuzde} size={220} strokeWidth={12} renk={halkaRenk}>
                  <div style={{ fontSize: 42, fontWeight: 800 }}>{saniyeyiMMSSyapVeyaSaat(kalan)}</div>
                </OdakHalkasi>
              </div>

              {faz === "hazir" && (
                <>
                  <input
                    style={{ ...inputStyle, marginBottom: 14, textAlign: "center" }}
                    placeholder="Ne üzerinde çalışıyorsun? (opsiyonel)"
                    maxLength={120}
                    value={konu}
                    onChange={(e) => setKonu(e.target.value)}
                  />
                  <button type="button" style={{ ...btnPrimary, width: "100%" }} disabled={busy} onClick={baslat}>Başlat</button>
                </>
              )}
              {faz === "calisma" && (
                <>
                  {konu && <div style={{ fontSize: 12.5, fontWeight: 700, color: "#175cd3", marginBottom: 12 }}>{konu}</div>}
                  <button type="button" style={{ ...btnGhost, width: "100%" }} onClick={durdur}>Durdur</button>
                </>
              )}
              {(faz === "kisa_mola" || faz === "uzun_mola") && (
                <button type="button" style={{ ...btnGhost, width: "100%" }} onClick={molayiAtla}>Molayı Atla</button>
              )}

              <div style={{ marginTop: 16, fontSize: 11.5, color: "#8fa0bc" }}>Bugün tamamlanan: <b style={{ color: "#0f1b33" }}>{pomodoroBugun}</b></div>
            </div>

            {gecmis.length > 0 && (
              <div style={cardStyle}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Bugünkü Pomodorolar</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {Object.entries(gecmisGruplu).map(([k, sayi]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, padding: "8px 0", borderBottom: "1px solid #f0f4fa" }}>
                      <span style={{ color: k === "Etiketsiz" ? "#8fa0bc" : "#0f1b33", fontWeight: 600 }}>{k}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#175cd3", background: "#e6f0ff", padding: "3px 10px", borderRadius: 999 }}>{sayi} pomodoro</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
