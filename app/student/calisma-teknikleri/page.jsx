"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { BuyuyenBitki, saniyeyiMMSSyapVeyaSaat } from "../../../lib/buyuyen-bitki";

const cardStyle = { background: "#fff", border: "1px solid #e3ebf6", borderRadius: 18, padding: 20 };
const btnPrimary = { minHeight: 44, padding: "0 18px", fontSize: 13.5, fontWeight: 800, borderRadius: 12, border: "none", background: "#175cd3", color: "#fff", cursor: "pointer" };
const btnGhost = { minHeight: 40, padding: "0 14px", fontSize: 12.5, fontWeight: 700, borderRadius: 11, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", cursor: "pointer" };
const inputStyle = { height: 42, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 11, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };

const POMODORO_SANIYE = 1500;
const GUN_SECENEKLERI = [1, 3, 7];

function bugunBaslangicISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function CalismaTeknikleriPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState(null);

  // Pomodoro
  const [pomodoroOturum, setPomodoroOturum] = useState(null);
  const [pomodoroKalan, setPomodoroKalan] = useState(POMODORO_SANIYE);
  const [pomodoroBusy, setPomodoroBusy] = useState(false);
  const [pomodoroBugun, setPomodoroBugun] = useState(0);
  const pomodoroKilit = useRef(false);

  // Aralıklı Tekrar
  const [tekrarKonu, setTekrarKonu] = useState("");
  const [tekrarBusy, setTekrarBusy] = useState(false);
  const [tekrarMesaj, setTekrarMesaj] = useState("");

  // Uzun Odaklı Çalışma
  const [uzunOturum, setUzunOturum] = useState(null);
  const [uzunKalan, setUzunKalan] = useState(0);
  const [uzunDakika, setUzunDakika] = useState(45);
  const [uzunBusy, setUzunBusy] = useState(false);
  const [kutlama, setKutlama] = useState(false);
  const [hasatSayisi, setHasatSayisi] = useState(0);
  const uzunKilit = useRef(false);

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }
      const uid = session.user.id;
      setUserId(uid);

      const { data: profil } = await supabase.from("profiles").select("tamamlanan_odak_oturumu_sayisi").eq("id", uid).maybeSingle();
      setHasatSayisi(profil?.tamamlanan_odak_oturumu_sayisi || 0);

      const { data: aktifOturumlar } = await supabase.from("calisma_oturumlari").select("*").eq("kullanici_id", uid).eq("durum", "devam_ediyor");
      (aktifOturumlar || []).forEach((o) => {
        if (o.tur === "pomodoro") setPomodoroOturum(o);
        if (o.tur === "uzun_odakli") setUzunOturum(o);
      });

      const { count } = await supabase.from("calisma_oturumlari").select("id", { count: "exact", head: true })
        .eq("kullanici_id", uid).eq("tur", "pomodoro").eq("durum", "tamamlandi").gte("tamamlanma_at", bugunBaslangicISO());
      setPomodoroBugun(count || 0);

      setLoading(false);
    }
    init();
  }, []);

  // --- Pomodoro sayaç ---
  useEffect(() => {
    if (!pomodoroOturum) return;
    const bitis = new Date(pomodoroOturum.bitis_zamani_planlanan).getTime();
    async function tik() {
      const kalan = Math.max(0, Math.round((bitis - Date.now()) / 1000));
      setPomodoroKalan(kalan);
      if (kalan <= 0 && !pomodoroKilit.current) {
        pomodoroKilit.current = true;
        const { error: hataMsg } = await supabase.from("calisma_oturumlari").update({ durum: "tamamlandi" }).eq("id", pomodoroOturum.id);
        pomodoroKilit.current = false;
        if (!hataMsg) {
          setPomodoroOturum(null);
          setPomodoroKalan(POMODORO_SANIYE);
          setPomodoroBugun((n) => n + 1);
        }
      }
    }
    tik();
    const id = setInterval(tik, 1000);
    return () => clearInterval(id);
  }, [pomodoroOturum?.id]);

  async function pomodoroBaslat() {
    if (!userId) return;
    setPomodoroBusy(true);
    const { data, error: hataMsg } = await supabase.from("calisma_oturumlari")
      .insert({ kullanici_id: userId, tur: "pomodoro", hedef_saniye: POMODORO_SANIYE })
      .select().single();
    setPomodoroBusy(false);
    if (hataMsg) { setError(hataMsg.message); return; }
    setPomodoroOturum(data);
  }

  async function pomodoroIptal() {
    if (!pomodoroOturum) return;
    await supabase.from("calisma_oturumlari").update({ durum: "iptal" }).eq("id", pomodoroOturum.id);
    setPomodoroOturum(null);
    setPomodoroKalan(POMODORO_SANIYE);
  }

  // --- Uzun Odaklı Çalışma sayaç ---
  useEffect(() => {
    if (!uzunOturum) return;
    const bitis = new Date(uzunOturum.bitis_zamani_planlanan).getTime();
    async function tik() {
      const kalan = Math.max(0, Math.round((bitis - Date.now()) / 1000));
      setUzunKalan(kalan);
      if (kalan <= 0 && !uzunKilit.current) {
        uzunKilit.current = true;
        const { error: hataMsg } = await supabase.from("calisma_oturumlari").update({ durum: "tamamlandi" }).eq("id", uzunOturum.id);
        uzunKilit.current = false;
        if (!hataMsg) {
          setUzunOturum(null);
          setKutlama(true);
          setHasatSayisi((n) => n + 1);
        }
      }
    }
    tik();
    const id = setInterval(tik, 1000);
    return () => clearInterval(id);
  }, [uzunOturum?.id]);

  async function uzunBaslat() {
    if (!userId) return;
    const dakika = Math.max(5, Math.min(240, Math.round(Number(uzunDakika) || 0)));
    setUzunBusy(true);
    const { data, error: hataMsg } = await supabase.from("calisma_oturumlari")
      .insert({ kullanici_id: userId, tur: "uzun_odakli", hedef_saniye: dakika * 60 })
      .select().single();
    setUzunBusy(false);
    if (hataMsg) { setError(hataMsg.message); return; }
    setKutlama(false);
    setUzunOturum(data);
  }

  async function uzunIptal() {
    if (!uzunOturum) return;
    await supabase.from("calisma_oturumlari").update({ durum: "iptal" }).eq("id", uzunOturum.id);
    setUzunOturum(null);
  }

  async function tekrarEkle(gun) {
    if (!tekrarKonu.trim()) { setTekrarMesaj("Önce bir konu ya da ders adı yaz."); return; }
    setTekrarBusy(true);
    setTekrarMesaj("");
    const { error: hataMsg } = await supabase.rpc("campuso_tekrar_hatirlatici_ekle", { p_konu: tekrarKonu.trim(), p_gun: gun });
    setTekrarBusy(false);
    if (hataMsg) { setTekrarMesaj(hataMsg.message); return; }
    const tarih = new Date(Date.now() + gun * 86400000).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
    setTekrarMesaj(`Hatırlatıcı ${tarih} tarihine kişisel takvimine eklendi. ✓`);
    setTekrarKonu("");
  }

  const uzunYuzde = uzunOturum ? Math.min(100, Math.max(0, 100 * (1 - uzunKalan / Math.max(1, (new Date(uzunOturum.bitis_zamani_planlanan) - new Date(uzunOturum.baslangic_at)) / 1000)))) : 0;

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=student" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>ÇALIŞMA TEKNİKLERİ</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Günlük Yaşam Asistanı</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, fontWeight: 700, color: "#5b6b85" }}>
          🌻 {hasatSayisi} bitki yetiştirdin
        </div>
      </header>

      <main style={{ width: "min(1080px, 100%)", margin: "0 auto", padding: "24px 18px 60px", display: "grid", gap: 18 }}>
        {error ? <div style={{ padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}
        {loading ? <div style={{ color: "#8fa0bc", fontSize: 13 }}>Yükleniyor…</div> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, alignItems: "stretch" }}>

            {/* Pomodoro */}
            <div style={cardStyle}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Pomodoro Tekniği</div>
              <div style={{ fontSize: 12, color: "#8fa0bc", marginBottom: 18 }}>
                Pomodoro Tekniği, kısa süreli ama yoğun odaklanmalarla çalışmayı sağlayan bir yöntemdir: 25 dakikalık odaklanma aralıklarından ve ardından 5 dakikalık kısa molalardan oluşur.
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: "0.02em", margin: "10px 0" }}>
                  {saniyeyiMMSSyapVeyaSaat(pomodoroOturum ? pomodoroKalan : POMODORO_SANIYE)}
                </div>
                {pomodoroOturum ? (
                  <button type="button" style={{ ...btnGhost, width: "100%" }} onClick={pomodoroIptal}>Durdur</button>
                ) : (
                  <button type="button" style={{ ...btnPrimary, width: "100%" }} disabled={pomodoroBusy} onClick={pomodoroBaslat}>Başlat</button>
                )}
                <div style={{ marginTop: 12, fontSize: 11.5, color: "#8fa0bc" }}>Bugün tamamlanan: <b style={{ color: "#0f1b33" }}>{pomodoroBugun}</b></div>
              </div>
            </div>

            {/* Aralıklı Tekrar */}
            <div style={cardStyle}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Aralıklı Tekrar</div>
              <div style={{ fontSize: 12, color: "#8fa0bc", marginBottom: 16 }}>
                Unutma eğrisine göre bilgi belirli aralıklarla tekrar edilirse kalıcı hafızaya geçer. Bir konu yaz, kaç gün sonra hatırlatılmasını istediğini seç — kişisel takvimine otomatik düşsün.
              </div>
              <input style={{ ...inputStyle, marginBottom: 12 }} placeholder="Örn. BUS201 Vize Konuları" maxLength={120} value={tekrarKonu} onChange={(e) => setTekrarKonu(e.target.value)} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {GUN_SECENEKLERI.map((gun) => (
                  <button key={gun} type="button" disabled={tekrarBusy} onClick={() => tekrarEkle(gun)} style={{ ...btnGhost, flexDirection: "column", height: 52, display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#175cd3" }}>{gun}</span>
                    <span style={{ fontSize: 10 }}>{gun === 1 ? "gün" : "gün"}</span>
                  </button>
                ))}
              </div>
              {tekrarMesaj && <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: tekrarMesaj.includes("✓") ? "#0b8f5c" : "#c0273c" }}>{tekrarMesaj}</div>}
            </div>

            {/* Uzun Odaklı Çalışma */}
            <div style={{ ...cardStyle, background: "linear-gradient(180deg, #1c3324, #14261b)", color: "#eafaf0", border: "none", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gridColumn: "span 1" }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14, alignSelf: "flex-start" }}>Uzun Odaklı Çalışma</div>

              <BuyuyenBitki percent={uzunYuzde} tamamlandi={kutlama} size={120} dark />

              {kutlama ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 800, margin: "14px 0 4px" }}>🌼 Bitki olgunlaştı!</div>
                  <div style={{ fontSize: 12, color: "#bfe6c8", marginBottom: 14 }}>{hasatSayisi}. bitkini yetiştirdin. Emeğin için tebrikler.</div>
                  <button type="button" style={{ ...btnPrimary, width: "100%" }} onClick={() => setKutlama(false)}>Yeni Tohum Ek</button>
                </>
              ) : uzunOturum ? (
                <>
                  <div style={{ fontSize: 34, fontWeight: 800, margin: "14px 0 4px" }}>{saniyeyiMMSSyapVeyaSaat(uzunKalan)}</div>
                  <div style={{ fontSize: 11.5, color: "#bfe6c8", marginBottom: 14 }}>Filizin büyüyor, odağını dağıtma.</div>
                  <button type="button" style={{ ...btnGhost, width: "100%", background: "transparent", color: "#eafaf0", border: "1px solid rgba(255,255,255,0.35)" }} onClick={uzunIptal}>Durdur / Vazgeç</button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: "#bfe6c8", margin: "14px 0 10px" }}>Bir süre seç, tohumu ek — süre bitince filiz tam çiçek açsın.</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, width: "100%" }}>
                    <input
                      type="number" min={5} max={240} step={5} value={uzunDakika}
                      onChange={(e) => setUzunDakika(e.target.value)}
                      style={{ ...inputStyle, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.25)", color: "#eafaf0", textAlign: "center" }}
                    />
                    <span style={{ fontSize: 12, color: "#bfe6c8", whiteSpace: "nowrap" }}>dakika</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                    {[25, 60, 120].map((d) => (
                      <button key={d} type="button" onClick={() => setUzunDakika(d)} style={{ ...btnGhost, flex: 1, background: "transparent", color: "#eafaf0", border: "1px solid rgba(255,255,255,0.25)", minHeight: 32, fontSize: 11.5 }}>
                        {d < 60 ? `${d} dk` : `${d / 60} sa`}
                      </button>
                    ))}
                  </div>
                  <button type="button" style={{ ...btnPrimary, width: "100%" }} disabled={uzunBusy} onClick={uzunBaslat}>Tohumu Ek, Başlat</button>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
