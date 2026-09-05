"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import { BuyuyenBitki, Konfeti, bitkiTuruBelirle, saniyeyiMMSSyapVeyaSaat, saniyeyiOkunurMetneYap, sesCal } from "../../../../lib/buyuyen-bitki";

// Sayfa tamamen "koyu orman" temasına geçti (kullanıcı isteğiyle) — üstteki
// büyüyen bitki kartıyla aynı koyu yeşil paleti artık header ve alttaki
// "Bitki Koleksiyonun" / "Bu Hafta" kartlarına da yayılıyor.
const cardStyle = { background: "#17281d", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 24, color: "#eafaf0" };
const btnPrimary = { minHeight: 46, padding: "0 20px", fontSize: 14, fontWeight: 800, borderRadius: 12, border: "none", background: "#2f9e58", color: "#fff", cursor: "pointer" };
const btnGhost = { minHeight: 40, padding: "0 14px", fontSize: 12.5, fontWeight: 700, borderRadius: 11, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", color: "#bfe6c8", cursor: "pointer" };
const inputStyle = { height: 44, padding: "0 14px", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 11, fontSize: 13.5, outline: "none", width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", color: "#eafaf0" };

const BITKI_TUR_SIRASI = [
  { tur: "cicek", ad: "Çiçek", esikSaat: 0 },
  { tur: "bonsai", ad: "Bonsai", esikSaat: 2 },
  { tur: "fidan", ad: "Fidan", esikSaat: 8 },
  { tur: "meyve", ad: "Meyve Ağacı", esikSaat: 24 },
];

function yediGunOncesiISO() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function UzunOdakliCalismaPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState(null);

  const [konu, setKonu] = useState("");
  const [dakika, setDakika] = useState(45);
  const [busy, setBusy] = useState(false);
  const [oturum, setOturum] = useState(null);
  const [kalan, setKalan] = useState(0);
  const [kutlama, setKutlama] = useState(false);
  const [konfetiAktif, setKonfetiAktif] = useState(false);

  const [toplamSaniye, setToplamSaniye] = useState(0);
  const [hasatSayisi, setHasatSayisi] = useState(0);
  const [gecmis, setGecmis] = useState([]);
  const kilit = useRef(false);

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }
      const uid = session.user.id;
      setUserId(uid);

      const { data: profil } = await supabase.from("profiles").select("tamamlanan_odak_oturumu_sayisi, toplam_odak_saniyesi").eq("id", uid).maybeSingle();
      setHasatSayisi(profil?.tamamlanan_odak_oturumu_sayisi || 0);
      setToplamSaniye(profil?.toplam_odak_saniyesi || 0);

      const { data: aktif } = await supabase.from("calisma_oturumlari").select("*").eq("kullanici_id", uid).eq("tur", "uzun_odakli").eq("durum", "devam_ediyor").maybeSingle();
      if (aktif) { setOturum(aktif); if (aktif.konu) setKonu(aktif.konu); }

      await gecmisiYenile(uid);
      setLoading(false);
    }
    init();
  }, []);

  async function gecmisiYenile(uid) {
    const { data } = await supabase.from("calisma_oturumlari").select("id, konu, hedef_saniye, tamamlanma_at")
      .eq("kullanici_id", uid).eq("tur", "uzun_odakli").eq("durum", "tamamlandi")
      .gte("tamamlanma_at", yediGunOncesiISO()).order("tamamlanma_at", { ascending: false });
    setGecmis(data || []);
  }

  useEffect(() => {
    if (!oturum) return;
    const bitis = new Date(oturum.bitis_zamani_planlanan).getTime();
    async function tik() {
      const k = Math.max(0, Math.round((bitis - Date.now()) / 1000));
      setKalan(k);
      if (k <= 0 && !kilit.current) {
        kilit.current = true;
        const { error: hataMsg } = await supabase.from("calisma_oturumlari").update({ durum: "tamamlandi" }).eq("id", oturum.id);
        kilit.current = false;
        if (!hataMsg) {
          sesCal("kutlama");
          setKonfetiAktif(true);
          setTimeout(() => setKonfetiAktif(false), 2000);
          setToplamSaniye((t) => t + oturum.hedef_saniye);
          setHasatSayisi((n) => n + 1);
          await gecmisiYenile(userId);
          setOturum(null);
          setKutlama(true);
        }
      }
    }
    tik();
    const id = setInterval(tik, 1000);
    return () => clearInterval(id);
  }, [oturum?.id]);

  async function baslat() {
    if (!userId) return;
    const dk = Math.max(5, Math.min(240, Math.round(Number(dakika) || 0)));
    setBusy(true);
    setError("");
    const { data, error: hataMsg } = await supabase.from("calisma_oturumlari")
      .insert({ kullanici_id: userId, tur: "uzun_odakli", hedef_saniye: dk * 60, konu: konu.trim() || null })
      .select().single();
    setBusy(false);
    if (hataMsg) { setError(hataMsg.message); return; }
    setKutlama(false);
    setOturum(data);
  }

  async function iptal() {
    if (!oturum) return;
    await supabase.from("calisma_oturumlari").update({ durum: "iptal" }).eq("id", oturum.id);
    setOturum(null);
  }

  const yuzde = oturum ? Math.min(100, Math.max(0, 100 * (1 - kalan / Math.max(1, (new Date(oturum.bitis_zamani_planlanan) - new Date(oturum.baslangic_at)) / 1000)))) : 0;
  const bitkiTuru = bitkiTuruBelirle(toplamSaniye);
  const suankiSiraIndex = BITKI_TUR_SIRASI.findIndex((t) => t.tur === bitkiTuru.tur);
  const sonrakiTur = BITKI_TUR_SIRASI[suankiSiraIndex + 1];
  const bugunToplamSaniyeHafta = gecmis.reduce((acc, g) => acc + g.hedef_saniye, 0);

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(180deg, #0f1f16, #0b160f)", fontFamily: "system-ui, sans-serif", color: "#eafaf0" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "#14261b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=student" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "#9fe0ae", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#8fd6a0" }}>AKADEMİK YÖNETİM · BİLİMSEL ÇALIŞMA TEKNİKLERİ</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#eafaf0" }}>Uzun Odaklı Çalışma</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/student/calisma-teknikleri/pomodoro" style={{ minHeight: 40, padding: "0 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 11, border: "1px solid rgba(255,255,255,0.15)", color: "#bfe6c8" }}>Pomodoro</Link>
          <Link href="/student/calisma-teknikleri/aralikli-tekrar" style={{ minHeight: 40, padding: "0 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 11, border: "1px solid rgba(255,255,255,0.15)", color: "#bfe6c8" }}>Aralıklı Tekrar</Link>
        </div>
      </header>

      <main style={{ width: "min(640px, 100%)", margin: "0 auto", padding: "28px 18px 60px", display: "grid", gap: 18 }}>
        {error ? <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,99,71,0.12)", border: "1px solid rgba(255,99,71,0.4)", color: "#ffb4a0", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}

        {loading ? <div style={{ color: "rgba(234,250,240,0.6)", fontSize: 13 }}>Yükleniyor…</div> : (
          <>
            <div style={{ ...cardStyle, background: "linear-gradient(180deg, #1c3324, #14261b)", color: "#eafaf0", border: "none", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", position: "relative", overflow: "hidden" }}>
              {konfetiAktif && <Konfeti />}
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "#bfe6c8", alignSelf: "flex-start" }}>ŞU ANKİ BİTKİN: {bitkiTuru.ad.toUpperCase()}</div>

              <div style={{ margin: "14px 0" }}>
                <BuyuyenBitki percent={yuzde} tamamlandi={kutlama} size={130} dark tur={bitkiTuru.tur} />
              </div>

              {kutlama ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 800, margin: "4px 0 4px" }}>🌼 Bitki olgunlaştı!</div>
                  <div style={{ fontSize: 12, color: "#bfe6c8", marginBottom: 14 }}>{hasatSayisi}. bitkini yetiştirdin. Emeğin için tebrikler.</div>
                  <button type="button" style={{ ...btnPrimary, width: "100%" }} onClick={() => setKutlama(false)}>Yeni Tohum Ek</button>
                </>
              ) : oturum ? (
                <>
                  {konu && <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>{konu}</div>}
                  <div style={{ fontSize: 34, fontWeight: 800, margin: "6px 0 4px" }}>{saniyeyiMMSSyapVeyaSaat(kalan)}</div>
                  <div style={{ fontSize: 11.5, color: "#bfe6c8", marginBottom: 14 }}>Filizin büyüyor, odağını dağıtma.</div>
                  <button type="button" style={{ ...btnGhost, width: "100%", background: "transparent", color: "#eafaf0", border: "1px solid rgba(255,255,255,0.35)" }} onClick={iptal}>Durdur / Vazgeç</button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: "#bfe6c8", margin: "10px 0" }}>Bir süre seç, tohumu ek — süre bitince filiz tam olgunlaşsın.</div>
                  <input
                    style={{ ...inputStyle, marginBottom: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.25)", color: "#eafaf0" }}
                    placeholder="Ne üzerinde çalışıyorsun? (opsiyonel)"
                    maxLength={120}
                    value={konu}
                    onChange={(e) => setKonu(e.target.value)}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, width: "100%" }}>
                    <input
                      type="number" min={5} max={240} step={5} value={dakika}
                      onChange={(e) => setDakika(e.target.value)}
                      style={{ ...inputStyle, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.25)", color: "#eafaf0", textAlign: "center" }}
                    />
                    <span style={{ fontSize: 12, color: "#bfe6c8", whiteSpace: "nowrap" }}>dakika</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 14, width: "100%" }}>
                    {[25, 60, 120].map((d) => (
                      <button key={d} type="button" onClick={() => setDakika(d)} style={{ ...btnGhost, flex: 1, background: "transparent", color: "#eafaf0", border: "1px solid rgba(255,255,255,0.25)", minHeight: 32, fontSize: 11.5 }}>
                        {d < 60 ? `${d} dk` : `${d / 60} sa`}
                      </button>
                    ))}
                  </div>
                  <button type="button" style={{ ...btnPrimary, width: "100%" }} disabled={busy} onClick={baslat}>Tohumu Ek, Başlat</button>
                </>
              )}
            </div>

            <div style={cardStyle}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, color: "#eafaf0" }}>Bitki Koleksiyonun</div>
              <div style={{ fontSize: 12, color: "rgba(234,250,240,0.55)", marginBottom: 16 }}>Toplam odak süren arttıkça yeni bitki türleri açılır.</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
                {BITKI_TUR_SIRASI.map((t, i) => {
                  const acik = i <= suankiSiraIndex;
                  return (
                    <div key={t.tur} style={{ textAlign: "center", opacity: acik ? 1 : 0.35 }}>
                      <BuyuyenBitki percent={100} tamamlandi size={56} tur={t.tur} dark />
                      <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 2, color: "#eafaf0" }}>{t.ad}</div>
                      <div style={{ fontSize: 9.5, color: "rgba(234,250,240,0.55)" }}>{t.esikSaat} sa+</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, color: "rgba(234,250,240,0.7)" }}>
                Toplam odak süren: <b style={{ color: "#eafaf0" }}>{saniyeyiOkunurMetneYap(toplamSaniye)}</b>
                {sonrakiTur && (
                  <> · <b>{sonrakiTur.ad}</b>'a ulaşmak için <b>{saniyeyiOkunurMetneYap(Math.max(0, sonrakiTur.esikSaat * 3600 - toplamSaniye))}</b> daha odaklanmalısın.</>
                )}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, color: "#eafaf0" }}>Bu Hafta</div>
              <div style={{ fontSize: 12, color: "rgba(234,250,240,0.55)", marginBottom: 16 }}>Son 7 gündeki tamamlanmış oturumların. Toplam: <b style={{ color: "#eafaf0" }}>{saniyeyiOkunurMetneYap(bugunToplamSaniyeHafta)}</b></div>
              {gecmis.length === 0 ? (
                <div style={{ padding: 18, textAlign: "center", color: "rgba(234,250,240,0.55)", fontSize: 13, border: "1px dashed rgba(255,255,255,0.18)", borderRadius: 12 }}>Bu hafta henüz tamamlanmış bir oturumun yok.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {gecmis.map((g) => (
                    <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#eafaf0" }}>
                      <span>
                        <b>{g.konu || "Etiketsiz"}</b>
                        <span style={{ color: "rgba(234,250,240,0.55)", marginLeft: 6 }}>{new Date(g.tamamlanma_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}</span>
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#9fe0ae", background: "rgba(159,224,174,0.15)", padding: "3px 10px", borderRadius: 999 }}>{Math.round(g.hedef_saniye / 60)} dk</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
