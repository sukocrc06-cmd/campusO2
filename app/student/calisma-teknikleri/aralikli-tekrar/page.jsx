"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

// "Hafıza Zinciri" teması — koyu indigo/mor palet, unutma eğrisi/hafıza
// temasına daha uygun. 1→3→7→16 gün ilerlemesi artık bir rozet yerine
// AsamaCizelgesi ile görsel bir adım çizelgesi olarak gösteriliyor.
const AKSAN = "#8b7cf6";
const AKSAN_KOYU = "#6f5ce0";
const METIN = "#ece9fb";
const ALT_METIN = "rgba(236,233,251,0.6)";

const cardStyle = { background: "#211a3f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 24, color: METIN };
const btnGhost = { minHeight: 40, padding: "0 14px", fontSize: 12.5, fontWeight: 700, borderRadius: 11, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", color: METIN, cursor: "pointer" };
const inputStyle = { height: 44, padding: "0 14px", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 11, fontSize: 13.5, outline: "none", width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", color: METIN };

const GUN_SECENEKLERI = [1, 3, 7];
const GUN_DIZISI = [1, 3, 7, 16];

function bugunIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function gunFarki(tarihStr) {
  const hedef = new Date(tarihStr + "T00:00:00");
  const fark = Math.round((hedef.getTime() - bugunIso().getTime()) / 86400000);
  return fark;
}

// Bir konunun 1 → 3 → 7 → 16 gün zincirindeki ilerlemesini görsel bir adım
// çizelgesi olarak çizer: tamamlanan aşamalar dolu mor daire (✓), o an
// beklenen aşama parlayan/büyük bir halka, henüz gelmemiş aşamalar soluk.
function AsamaCizelgesi({ asamaIndex, tamamlandiMi = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
      {GUN_DIZISI.map((gun, i) => {
        const asamaNo = i + 1;
        const tamam = tamamlandiMi || asamaNo < asamaIndex;
        const aktif = !tamamlandiMi && asamaNo === asamaIndex;
        const sonMu = i === GUN_DIZISI.length - 1;
        return (
          <div key={gun} style={{ display: "flex", alignItems: "center", flex: sonMu ? "none" : 1 }}>
            <div
              title={`${gun} gün`}
              style={{
                width: aktif ? 22 : 16, height: aktif ? 22 : 16, borderRadius: "50%", flex: "none",
                display: "grid", placeItems: "center", fontSize: 8, fontWeight: 800,
                background: tamam ? AKSAN : aktif ? AKSAN_KOYU : "rgba(255,255,255,0.12)",
                boxShadow: aktif ? "0 0 0 4px rgba(139,124,246,0.28)" : "none",
                color: tamam || aktif ? "#fff" : "rgba(236,233,251,0.4)",
              }}
            >
              {tamam ? "✓" : gun}
            </div>
            {!sonMu && <div style={{ flex: 1, height: 2, background: tamam ? AKSAN : "rgba(255,255,255,0.12)", margin: "0 3px" }} />}
          </div>
        );
      })}
    </div>
  );
}

export default function AralikliTekrarPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState(null);

  const [konu, setKonu] = useState("");
  const [baslatBusy, setBaslatBusy] = useState(false);
  const [mesaj, setMesaj] = useState("");

  const [programlar, setProgramlar] = useState([]);
  const [tamamlanBusyId, setTamamlaBusyId] = useState(null);

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }
      setUserId(session.user.id);
      await listeyiYenile(session.user.id);
      setLoading(false);
    }
    init();
  }, []);

  async function listeyiYenile(uid) {
    const { data } = await supabase.from("tekrar_programlari").select("*").eq("kullanici_id", uid).order("tamamlandi_mi", { ascending: true }).order("sonraki_tarih", { ascending: true });
    setProgramlar(data || []);
  }

  const { aktifler, tamamlananlar } = useMemo(() => {
    const aktifler = programlar.filter((p) => !p.tamamlandi_mi);
    const tamamlananlar = programlar.filter((p) => p.tamamlandi_mi);
    return { aktifler, tamamlananlar };
  }, [programlar]);

  async function baslat(gun) {
    if (!konu.trim()) { setMesaj("Önce bir konu ya da ders adı yaz."); return; }
    setBaslatBusy(true);
    setMesaj("");
    const { error: hataMsg } = await supabase.rpc("campuso_tekrar_programi_baslat", { p_konu: konu.trim(), p_gun: gun });
    setBaslatBusy(false);
    if (hataMsg) { setMesaj(hataMsg.message); return; }
    const tarih = new Date(Date.now() + gun * 86400000).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
    setMesaj(`Hatırlatıcı ${tarih} tarihine kişisel takvimine eklendi. ✓`);
    setKonu("");
    await listeyiYenile(userId);
  }

  async function tamamla(id) {
    setTamamlaBusyId(id);
    const { error: hataMsg } = await supabase.rpc("campuso_tekrar_tamamla", { p_program_id: id });
    setTamamlaBusyId(null);
    if (hataMsg) { setError(hataMsg.message); return; }
    await listeyiYenile(userId);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(180deg, #1a1533, #120e24)", fontFamily: "system-ui, sans-serif", color: METIN }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=student" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: AKSAN, textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: AKSAN }}>AKADEMİK YÖNETİM · BİLİMSEL ÇALIŞMA TEKNİKLERİ</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: METIN }}>Aralıklı Tekrar</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/student/calisma-teknikleri/pomodoro" style={{ minHeight: 40, padding: "0 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 11, border: "1px solid rgba(255,255,255,0.15)", color: ALT_METIN }}>Pomodoro</Link>
          <Link href="/student/calisma-teknikleri/uzun-odakli" style={{ minHeight: 40, padding: "0 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 11, border: "1px solid rgba(255,255,255,0.15)", color: ALT_METIN }}>Uzun Odaklı Çalışma</Link>
        </div>
      </header>

      <main style={{ width: "min(640px, 100%)", margin: "0 auto", padding: "28px 18px 60px", display: "grid", gap: 18 }}>
        {error ? <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,99,71,0.15)", border: "1px solid rgba(255,99,71,0.4)", color: "#ffb4a0", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}

        {loading ? <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>Yükleniyor…</div> : (
          <>
            <div style={cardStyle}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Yeni Tekrar Programı</div>
              <div style={{ fontSize: 12, color: ALT_METIN, marginBottom: 16 }}>
                Unutma eğrisine göre bilgi belirli aralıklarla tekrar edilirse kalıcı hafızaya geçer. Bir konu yaz, ilk hatırlatmanın kaç gün sonra olacağını seç — program otomatik olarak 1 → 3 → 7 → 16 gün aralıklarıyla ilerler ve her aşama kişisel takvimine düşer.
              </div>
              <input style={{ ...inputStyle, marginBottom: 12 }} placeholder="Örn. BUS201 Vize Konuları" maxLength={120} value={konu} onChange={(e) => setKonu(e.target.value)} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {GUN_SECENEKLERI.map((gun) => (
                  <button key={gun} type="button" disabled={baslatBusy} onClick={() => baslat(gun)} style={{ ...btnGhost, height: 52, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: AKSAN }}>{gun}</span>
                    <span style={{ fontSize: 10, color: METIN }}>gün sonra</span>
                  </button>
                ))}
              </div>
              {mesaj && <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: mesaj.includes("✓") ? "#38c99a" : "#ff9d9d" }}>{mesaj}</div>}
            </div>

            <div style={cardStyle}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Yaklaşan Tekrarlarım</div>
              <div style={{ fontSize: 12, color: ALT_METIN, marginBottom: 16 }}>Zamanı gelen bir tekrarı tamamladığında bir sonraki aşama otomatik kurulur.</div>
              {aktifler.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: ALT_METIN, fontSize: 13, border: "1px dashed rgba(255,255,255,0.18)", borderRadius: 12 }}>Henüz aktif bir tekrar programın yok.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {aktifler.map((p) => {
                    const fark = gunFarki(p.sonraki_tarih);
                    const zamaniGeldi = fark <= 0;
                    return (
                      <div key={p.id} style={{ display: "grid", gap: 10, padding: "14px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: METIN }}>{p.konu}</div>
                            <div style={{ fontSize: 11, color: ALT_METIN, marginTop: 2 }}>
                              {zamaniGeldi ? "Zamanı geldi" : `${fark} gün kaldı`} · {new Date(p.sonraki_tarih + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={!zamaniGeldi || tamamlanBusyId === p.id}
                            onClick={() => tamamla(p.id)}
                            style={{
                              minHeight: 36, padding: "0 14px", fontSize: 11.5, fontWeight: 800, borderRadius: 10, border: "none", cursor: zamaniGeldi ? "pointer" : "default", flex: "none",
                              background: zamaniGeldi ? AKSAN : "rgba(255,255,255,0.08)", color: zamaniGeldi ? "#fff" : "rgba(236,233,251,0.4)",
                            }}
                          >
                            Tamamlandı
                          </button>
                        </div>
                        <AsamaCizelgesi asamaIndex={p.asama_index} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {tamamlananlar.length > 0 && (
              <div style={cardStyle}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Tamamlanan Konular</div>
                <div style={{ display: "grid", gap: 10 }}>
                  {tamamlananlar.map((p) => (
                    <div key={p.id} style={{ display: "grid", gap: 8, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
                        <span style={{ fontWeight: 600, color: METIN }}>{p.konu}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: "#38c99a", background: "rgba(56,201,154,0.15)", padding: "3px 10px", borderRadius: 999 }}>4/4 tekrar ✓</span>
                      </div>
                      <AsamaCizelgesi asamaIndex={5} tamamlandiMi />
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
