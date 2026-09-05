"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import { OdakHalkasi, saniyeyiMMSSyapVeyaSaat, sesCal } from "../../../../lib/buyuyen-bitki";

// "Domates Saati" teması — sayfa, hero kart, halka ve butonlar o an hangi
// fazda olunduğuna göre renk değiştirir: hazır/beklemede sıcak nötr, çalışma
// sırasında canlı domates kırmızısı, molada sakinleştirici yeşil-turkuaz.
const FAZ_TEMASI = {
  hazir: {
    sayfaBg: "linear-gradient(180deg, #2a1613, #1c0f0d)",
    kartBg: "linear-gradient(160deg, #3d211a, #2a1613)",
    aksan: "#ff8a5c",
    aksanKoyu: "#e8623a",
    metin: "#ffece3",
    altMetin: "rgba(255,236,227,0.6)",
  },
  calisma: {
    sayfaBg: "linear-gradient(180deg, #3d130a, #200a06)",
    kartBg: "linear-gradient(160deg, #8a2a1a, #4f150c)",
    aksan: "#ff6b45",
    aksanKoyu: "#e04b28",
    metin: "#ffe9df",
    altMetin: "rgba(255,233,223,0.65)",
  },
  kisa_mola: {
    sayfaBg: "linear-gradient(180deg, #0f2621, #0a1815)",
    kartBg: "linear-gradient(160deg, #1f5346, #123128)",
    aksan: "#38c99a",
    aksanKoyu: "#26a37a",
    metin: "#e2f8ef",
    altMetin: "rgba(226,248,239,0.65)",
  },
  uzun_mola: {
    sayfaBg: "linear-gradient(180deg, #0f2621, #0a1815)",
    kartBg: "linear-gradient(160deg, #1f5346, #123128)",
    aksan: "#38c99a",
    aksanKoyu: "#26a37a",
    metin: "#e2f8ef",
    altMetin: "rgba(226,248,239,0.65)",
  },
};

const cardStyle = { background: "#2a1712", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 24, color: "#ffe9df" };
const btnPrimary = { minHeight: 46, padding: "0 20px", fontSize: 14, fontWeight: 800, borderRadius: 12, border: "none", background: "#ff6b45", color: "#fff", cursor: "pointer" };
const btnGhost = { minHeight: 40, padding: "0 14px", fontSize: 12.5, fontWeight: 700, borderRadius: 11, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#ffe9df", cursor: "pointer" };
const inputStyle = { height: 44, padding: "0 14px", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 11, fontSize: 13.5, outline: "none", width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.08)", color: "#ffe9df" };

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
  const tema = FAZ_TEMASI[faz] || FAZ_TEMASI.hazir;
  const halkaRenk = tema.aksan;

  const gecmisGruplu = gecmis.reduce((acc, g) => {
    const anahtar = g.konu || "Etiketsiz";
    acc[anahtar] = (acc[anahtar] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ minHeight: "100dvh", background: tema.sayfaBg, fontFamily: "system-ui, sans-serif", color: tema.metin, transition: "background 0.6s ease" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=student" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: tema.aksan, textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: tema.aksan }}>AKADEMİK YÖNETİM · BİLİMSEL ÇALIŞMA TEKNİKLERİ</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: tema.metin }}>Pomodoro Tekniği</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/student/calisma-teknikleri/aralikli-tekrar" style={{ minHeight: 40, padding: "0 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 11, border: "1px solid rgba(255,255,255,0.15)", color: tema.altMetin }}>Aralıklı Tekrar</Link>
          <Link href="/student/calisma-teknikleri/uzun-odakli" style={{ minHeight: 40, padding: "0 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 11, border: "1px solid rgba(255,255,255,0.15)", color: tema.altMetin }}>Uzun Odaklı Çalışma</Link>
        </div>
      </header>

      <main style={{ width: "min(560px, 100%)", margin: "0 auto", padding: "28px 18px 60px", display: "grid", gap: 18 }}>
        {error ? <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,99,71,0.15)", border: "1px solid rgba(255,99,71,0.4)", color: "#ffb4a0", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}

        {loading ? <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>Yükleniyor…</div> : (
          <>
            <div style={{ ...cardStyle, background: tema.kartBg, color: tema.metin, textAlign: "center", transition: "background 0.6s ease" }}>
              <div style={{ fontSize: 12, color: tema.altMetin, marginBottom: 4, fontWeight: 700 }}>
                {faz === "calisma" ? "🍅 Odaklan" : faz === "kisa_mola" ? "Kısa mola" : faz === "uzun_mola" ? "Uzun mola — 4 pomodoro tamamladın 🎉" : "Pomodoro Tekniği"}
              </div>
              <div style={{ fontSize: 12, color: tema.altMetin, marginBottom: 18, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
                25 dakikalık odaklanma aralıklarından ve ardından 5 dakikalık kısa moladan oluşur; her 4. odaklanmadan sonra 20 dakikalık uzun mola gelir.
              </div>

              <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
                <OdakHalkasi percent={yuzde} size={220} strokeWidth={12} renk={halkaRenk} izRengi="rgba(255,255,255,0.14)">
                  <div style={{ fontSize: 42, fontWeight: 800, color: tema.metin }}>{saniyeyiMMSSyapVeyaSaat(kalan)}</div>
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
                  <button type="button" style={{ ...btnPrimary, width: "100%", background: tema.aksan }} disabled={busy} onClick={baslat}>Başlat</button>
                </>
              )}
              {faz === "calisma" && (
                <>
                  {konu && <div style={{ fontSize: 12.5, fontWeight: 700, color: tema.aksan, marginBottom: 12 }}>{konu}</div>}
                  <button type="button" style={{ ...btnGhost, width: "100%" }} onClick={durdur}>Durdur</button>
                </>
              )}
              {(faz === "kisa_mola" || faz === "uzun_mola") && (
                <button type="button" style={{ ...btnGhost, width: "100%" }} onClick={molayiAtla}>Molayı Atla</button>
              )}

              <div style={{ marginTop: 16, fontSize: 11.5, color: tema.altMetin }}>Bugün tamamlanan: <b style={{ color: tema.metin }}>{pomodoroBugun}</b></div>
            </div>

            {gecmis.length > 0 && (
              <div style={cardStyle}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: "#ffe9df" }}>Bugünkü Pomodorolar</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {Object.entries(gecmisGruplu).map(([k, sayi]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <span style={{ color: k === "Etiketsiz" ? "rgba(255,233,223,0.55)" : "#ffe9df", fontWeight: 600 }}>{k}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#ff8a5c", background: "rgba(255,138,92,0.15)", padding: "3px 10px", borderRadius: 999 }}>{sayi} pomodoro</span>
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
