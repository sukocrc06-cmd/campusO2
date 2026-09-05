"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

const cardStyle = { background: "#fff", border: "1px solid #e3ebf6", borderRadius: 18, padding: 24 };
const btnGhost = { minHeight: 40, padding: "0 14px", fontSize: 12.5, fontWeight: 700, borderRadius: 11, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", cursor: "pointer" };
const inputStyle = { height: 44, padding: "0 14px", border: "1px solid #e3ebf6", borderRadius: 11, fontSize: 13.5, outline: "none", width: "100%", boxSizing: "border-box" };

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
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=student" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>AKADEMİK YÖNETİM · BİLİMSEL ÇALIŞMA TEKNİKLERİ</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Aralıklı Tekrar</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/student/calisma-teknikleri/pomodoro" style={{ minHeight: 40, padding: "0 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 11, border: "1px solid #e3ebf6", color: "#5b6b85" }}>Pomodoro</Link>
          <Link href="/student/calisma-teknikleri/uzun-odakli" style={{ minHeight: 40, padding: "0 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 11, border: "1px solid #e3ebf6", color: "#5b6b85" }}>Uzun Odaklı Çalışma</Link>
        </div>
      </header>

      <main style={{ width: "min(640px, 100%)", margin: "0 auto", padding: "28px 18px 60px", display: "grid", gap: 18 }}>
        {error ? <div style={{ padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}

        {loading ? <div style={{ color: "#8fa0bc", fontSize: 13 }}>Yükleniyor…</div> : (
          <>
            <div style={cardStyle}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Yeni Tekrar Programı</div>
              <div style={{ fontSize: 12, color: "#8fa0bc", marginBottom: 16 }}>
                Unutma eğrisine göre bilgi belirli aralıklarla tekrar edilirse kalıcı hafızaya geçer. Bir konu yaz, ilk hatırlatmanın kaç gün sonra olacağını seç — program otomatik olarak 1 → 3 → 7 → 16 gün aralıklarıyla ilerler ve her aşama kişisel takvimine düşer.
              </div>
              <input style={{ ...inputStyle, marginBottom: 12 }} placeholder="Örn. BUS201 Vize Konuları" maxLength={120} value={konu} onChange={(e) => setKonu(e.target.value)} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {GUN_SECENEKLERI.map((gun) => (
                  <button key={gun} type="button" disabled={baslatBusy} onClick={() => baslat(gun)} style={{ ...btnGhost, height: 52, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#175cd3" }}>{gun}</span>
                    <span style={{ fontSize: 10 }}>gün sonra</span>
                  </button>
                ))}
              </div>
              {mesaj && <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: mesaj.includes("✓") ? "#0b8f5c" : "#c0273c" }}>{mesaj}</div>}
            </div>

            <div style={cardStyle}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Yaklaşan Tekrarlarım</div>
              <div style={{ fontSize: 12, color: "#8fa0bc", marginBottom: 16 }}>Zamanı gelen bir tekrarı tamamladığında bir sonraki aşama otomatik kurulur.</div>
              {aktifler.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "#8fa0bc", fontSize: 13, border: "1px dashed #e3ebf6", borderRadius: 12 }}>Henüz aktif bir tekrar programın yok.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {aktifler.map((p) => {
                    const fark = gunFarki(p.sonraki_tarih);
                    const zamaniGeldi = fark <= 0;
                    return (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", borderRadius: 12, border: "1px solid #e3ebf6", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{p.konu}</div>
                          <div style={{ fontSize: 11, color: "#8fa0bc", marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: "#175cd3", background: "#e6f0ff", padding: "2px 8px", borderRadius: 999 }}>{p.asama_index - 1}/4 tekrar tamamlandı</span>
                            <span>{zamaniGeldi ? "Zamanı geldi" : `${fark} gün kaldı`} · {new Date(p.sonraki_tarih + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!zamaniGeldi || tamamlanBusyId === p.id}
                          onClick={() => tamamla(p.id)}
                          style={{
                            minHeight: 36, padding: "0 14px", fontSize: 11.5, fontWeight: 800, borderRadius: 10, border: "none", cursor: zamaniGeldi ? "pointer" : "default",
                            background: zamaniGeldi ? "#175cd3" : "#eef2f9", color: zamaniGeldi ? "#fff" : "#b4c0d6",
                          }}
                        >
                          Tamamlandı
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {tamamlananlar.length > 0 && (
              <div style={cardStyle}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Tamamlanan Konular</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {tamamlananlar.map((p) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, padding: "8px 0", borderBottom: "1px solid #f0f4fa" }}>
                      <span style={{ fontWeight: 600 }}>{p.konu}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: "#0b8f5c", background: "#e7f8ef", padding: "3px 10px", borderRadius: 999 }}>4/4 tekrar ✓</span>
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
