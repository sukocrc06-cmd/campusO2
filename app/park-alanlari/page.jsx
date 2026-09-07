"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

// Kampüs Yaşamı > Park Alanları (3.5: Otopark doluluk göstergesi, park
// noktası detayları). AYBÜ'nün resmi kaynaklarında kampüs genelinde "606
// araçlık açık otopark" olduğu bilgisi var ama sensörlü/akıllı bir otopark
// sistemine dair hiçbir kaynak yok (Kampüs Hizmetleri'ndeki araştırmayla
// aynı sonuç) — bu yüzden doluluk oranı gerçek sensör verisi yerine
// ÖĞRENCİ BİLDİRİMLİ CANLI TAHMİN ile hesaplanıyor: son ~90 dakikadaki
// "Boş/Orta/Dolu" bildirimlerinin zaman ağırlıklı ortalaması alınıyor (en
// yeni bildirim en yüksek ağırlıkta) ve her zaman "X dk önce bildirildi"
// şeffaflığıyla gösteriliyor — hiçbir zaman "kesin doluluk" diye sunulmuyor.
// Yeterli bildirim yoksa "Henüz canlı bildirim yok, ilk bildiren sen ol"
// durumu gösteriliyor. Sunucu tarafında hız sınırlama yok; kullanıcı
// başına birkaç dakikalık yumuşak bir bekleme localStorage ile uygulanıyor.
const BILDIRIM_PENCERESI_DK = 90;
const TEKRAR_BILDIRIM_BEKLEME_DK = 5;
const DURUM_DEGER = { bos: 0, orta: 0.5, dolu: 1 };
const DURUM_META = {
  bos: { etiket: "Boş", emoji: "🟢", renk: "#34d399" },
  orta: { etiket: "Orta Yoğun", emoji: "🟡", renk: "#ffbf5a" },
  dolu: { etiket: "Dolu", emoji: "🔴", renk: "#ff6a6a" },
};

function dolulukHesapla(bildirimler) {
  const simdi = Date.now();
  let toplamAgirlik = 0;
  let toplamDeger = 0;
  let enSonZaman = null;
  for (const b of bildirimler) {
    const dk = (simdi - new Date(b.created_at).getTime()) / 60000;
    if (dk > BILDIRIM_PENCERESI_DK) continue;
    const agirlik = Math.max(0, 1 - dk / BILDIRIM_PENCERESI_DK);
    toplamAgirlik += agirlik;
    toplamDeger += agirlik * (DURUM_DEGER[b.durum] ?? 0.5);
    if (enSonZaman === null || new Date(b.created_at).getTime() > enSonZaman) enSonZaman = new Date(b.created_at).getTime();
  }
  if (toplamAgirlik === 0) return { durum: null, enSonDk: null, bildirimSayisi: 0 };
  const ortalama = toplamDeger / toplamAgirlik;
  const durum = ortalama < 0.34 ? "bos" : ortalama < 0.66 ? "orta" : "dolu";
  const enSonDk = enSonZaman ? Math.round((simdi - enSonZaman) / 60000) : null;
  return { durum, enSonDk, bildirimSayisi: bildirimler.filter((b) => (simdi - new Date(b.created_at).getTime()) / 60000 <= BILDIRIM_PENCERESI_DK).length };
}

function ParkKarti({ park, bildirimler, kullaniciId, index, onBildir }) {
  const { durum, enSonDk, bildirimSayisi } = dolulukHesapla(bildirimler);
  const meta = durum ? DURUM_META[durum] : null;
  const parkRenk = park.renk || "#5be0c2";
  const [gonderBusy, setGonderBusy] = useState(false);
  const [bekleme, setBekleme] = useState(0);

  useEffect(() => {
    function bekleyiKontrolEt() {
      if (typeof window === "undefined") return;
      const son = Number(window.localStorage.getItem(`kh_park_bildirim_${park.id}`) || 0);
      const kalanDk = TEKRAR_BILDIRIM_BEKLEME_DK - (Date.now() - son) / 60000;
      setBekleme(kalanDk > 0 ? Math.ceil(kalanDk) : 0);
    }
    bekleyiKontrolEt();
    const t = setInterval(bekleyiKontrolEt, 15000);
    return () => clearInterval(t);
  }, [park.id]);

  async function gonder(yeniDurum) {
    if (!kullaniciId || bekleme > 0 || gonderBusy) return;
    setGonderBusy(true);
    const { error } = await supabase.from("kampus_park_bildirimleri").insert({ park_id: park.id, kullanici_id: kullaniciId, durum: yeniDurum });
    setGonderBusy(false);
    if (!error) {
      if (typeof window !== "undefined") window.localStorage.setItem(`kh_park_bildirim_${park.id}`, String(Date.now()));
      setBekleme(TEKRAR_BILDIRIM_BEKLEME_DK);
      onBildir();
    }
  }

  return (
    <section
      style={{
        border: `1px solid ${parkRenk}55`,
        borderLeft: `4px solid ${parkRenk}`,
        borderRadius: 18,
        background: "rgba(255,255,255,0.045)",
        backdropFilter: "blur(10px)",
        padding: "20px 22px",
        opacity: 0,
        animation: `paBelir 0.5s ease ${(index * 0.08).toFixed(2)}s forwards`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#f4f8ff" }}>🅿️ {park.ad}</div>
          {park.aciklama && <div style={{ fontSize: 12, color: "rgba(232,238,252,0.55)", marginTop: 4, lineHeight: 1.5 }}>{park.aciklama}</div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8, fontSize: 11.5, color: "rgba(232,238,252,0.6)" }}>
            {park.kapasite != null && <span>🚗 {park.kapasite} kapasite</span>}
            {park.engelli_kontenjan > 0 && <span>♿ {park.engelli_kontenjan} engelli kontenjanı</span>}
          </div>
        </div>
        <div
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "10px 16px", borderRadius: 14,
            background: meta ? `${meta.renk}1e` : "rgba(255,255,255,0.05)", border: `1px solid ${meta ? meta.renk + "55" : "rgba(255,255,255,0.12)"}`, minWidth: 120,
          }}
        >
          {meta ? (
            <>
              <div style={{ fontSize: 20 }}>{meta.emoji}</div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: meta.renk }}>{meta.etiket}</div>
              <div style={{ fontSize: 10, color: "rgba(232,238,252,0.5)" }}>{enSonDk === 0 ? "az önce" : `${enSonDk} dk önce`} · {bildirimSayisi} bildirim</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 20 }}>❔</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(232,238,252,0.55)", textAlign: "center" }}>Henüz canlı bildirim yok</div>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(232,238,252,0.5)", marginBottom: 8 }}>ŞU AN DURUMU GÖRDÜN MÜ? BİLDİR:</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(DURUM_META).map(([k, m]) => (
            <button
              key={k}
              type="button"
              disabled={!kullaniciId || bekleme > 0 || gonderBusy}
              onClick={() => gonder(k)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999,
                fontSize: 12, fontWeight: 700, color: m.renk, background: `${m.renk}18`, border: `1px solid ${m.renk}55`,
                cursor: !kullaniciId || bekleme > 0 || gonderBusy ? "not-allowed" : "pointer",
                opacity: !kullaniciId || bekleme > 0 || gonderBusy ? 0.5 : 1,
              }}
            >
              {m.emoji} {m.etiket}
            </button>
          ))}
        </div>
        {bekleme > 0 && <div style={{ fontSize: 11, color: "rgba(232,238,252,0.45)", marginTop: 8 }}>Bildirdiğin için teşekkürler — {bekleme} dk sonra tekrar bildirebilirsin.</div>}
      </div>

      <Link
        href={`/kampus-haritasi?park=${park.id}`}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4, marginTop: 14,
          fontSize: 11.5, fontWeight: 800, color: parkRenk, textDecoration: "none",
          padding: "6px 12px", borderRadius: 999, background: `${parkRenk}18`, border: `1px solid ${parkRenk}55`,
        }}
      >
        🗺️ Haritada Gör
      </Link>
    </section>
  );
}

export default function ParkAlanlariPage() {
  const [parklar, setParklar] = useState([]);
  const [bildirimlerParkBazli, setBildirimlerParkBazli] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleHref, setRoleHref] = useState("/");
  const [kullaniciId, setKullaniciId] = useState(null);

  async function bildirimleriYenile(parkIdler) {
    if (parkIdler.length === 0) return;
    const cutoff = new Date(Date.now() - BILDIRIM_PENCERESI_DK * 60000).toISOString();
    const { data } = await supabase
      .from("kampus_park_bildirimleri")
      .select("park_id, durum, created_at")
      .in("park_id", parkIdler)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false });
    const gruplu = {};
    for (const b of data || []) (gruplu[b.park_id] = gruplu[b.park_id] || []).push(b);
    setBildirimlerParkBazli(gruplu);
  }

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }
      setKullaniciId(session.user.id);

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
      const isAcademician = session.user.email?.toLowerCase() !== "suko.crc06@gmail.com" && profile?.role === "academician";
      setRoleHref(isAcademician ? "/?role=faculty" : "/?role=student");

      const { data, error: err } = await supabase
        .from("kampus_park_alanlari")
        .select("*")
        .eq("aktif", true)
        .order("sira", { ascending: true })
        .order("created_at", { ascending: true });

      if (err) { setError("Park alanları alınamadı: " + err.message); setLoading(false); return; }
      setParklar(data || []);
      setLoading(false);
      await bildirimleriYenile((data || []).map((p) => p.id));
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(165deg, #0e1c38 0%, #0a1428 45%, #050a16 100%)", fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <style>{`
        @keyframes paBelir {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(8,14,28,0.72)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={roleHref} style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#9cc4ff", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#7fb2ff" }}>KAMPÜS YAŞAMI · PARK ALANLARI</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f4f8ff" }}>Otopark Doluluk Durumu</div>
          </div>
        </div>
        <Link href={roleHref} style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid rgba(127,178,255,0.35)", color: "#9cc4ff", background: "rgba(91,157,255,0.08)" }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(880px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(91,157,255,0.08)", border: "1px solid rgba(127,178,255,0.25)", color: "rgba(232,238,252,0.75)", fontSize: 12, lineHeight: 1.6, marginBottom: 18 }}>
          ℹ️ Doluluk göstergesi kampüste gerçek bir sensör sisteminden değil, öğrencilerin son {BILDIRIM_PENCERESI_DK} dakika içinde gönderdiği canlı bildirimlerden hesaplanıyor. Ne kadar çok kişi bildirirse o kadar güvenilir olur — sen de gördüğünü bildir!
        </div>

        {error ? (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,138,92,0.1)", border: "1px solid rgba(255,138,92,0.3)", color: "#ffb59a", fontSize: 13, fontWeight: 600 }}>{error}</div>
        ) : loading ? (
          <p style={{ color: "rgba(232,238,252,0.6)" }}>Yükleniyor…</p>
        ) : parklar.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", border: "1px dashed rgba(255,255,255,0.14)", borderRadius: 16, background: "rgba(255,255,255,0.03)", color: "rgba(232,238,252,0.5)", fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🅿️</div>
            Henüz park alanı eklenmedi.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {parklar.map((p, i) => (
              <ParkKarti
                key={p.id}
                park={p}
                bildirimler={bildirimlerParkBazli[p.id] || []}
                kullaniciId={kullaniciId}
                index={i}
                onBildir={() => bildirimleriYenile(parklar.map((x) => x.id))}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
