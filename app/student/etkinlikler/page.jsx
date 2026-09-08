"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// Sosyal Etkileşim & Topluluklar > 7.4 Etkinlik Planlama.
// Her etkinlik türü kendi görsel kimliğini taşıyor — kullanıcının isteği
// üzerine ("halı saha futbol teması, film gecesi sinema/popcorn gibi").
const ETKINLIK_TURLERI = {
  hali_saha: {
    label: "Halı Saha",
    icon: "⚽",
    grad: "linear-gradient(135deg, #3ecf6e, #0f7a3d)",
    solid: "#0f7a3d",
    className: "ke2-tema-hali",
  },
  grup_calisma: {
    label: "Grup Çalışması",
    icon: "📚",
    grad: "linear-gradient(135deg, #4f8fef, #175cd3)",
    solid: "#175cd3",
    className: "ke2-tema-grup",
  },
  film_gecesi: {
    label: "Film Gecesi",
    icon: "🍿",
    grad: "linear-gradient(135deg, #2b1055, #0d0221)",
    solid: "#7c3fae",
    className: "ke2-tema-film",
    koyu: true,
  },
  diger: {
    label: "Diğer",
    icon: "🎉",
    grad: "linear-gradient(135deg, #8fa0bc, #5b6b85)",
    solid: "#5b6b85",
    className: "ke2-tema-diger",
  },
};
function turStil(tur) {
  return ETKINLIK_TURLERI[tur] || ETKINLIK_TURLERI.diger;
}

function zamanFormatla(zaman) {
  if (!zaman) return null;
  try {
    const d = new Date(zaman);
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" }) + " · " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

function haritaLinki(konum) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(konum)}`;
}

const inputStyle = { height: 44, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 11, fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" };
const labelStyle = { display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 700, color: "#5b6b85" };

function AnimatedCounter({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{display}</>;
}

function SkeletonKart() {
  return (
    <div style={{ borderRadius: 20, border: "1px solid #e3ebf6", background: "#fff", overflow: "hidden" }}>
      <div className="ke2-shimmer" style={{ height: 64 }} />
      <div style={{ padding: 16 }}>
        <div className="ke2-shimmer" style={{ height: 14, width: "70%", borderRadius: 6, marginBottom: 10 }} />
        <div className="ke2-shimmer" style={{ height: 10, width: "90%", borderRadius: 6, marginBottom: 6 }} />
        <div className="ke2-shimmer" style={{ height: 10, width: "50%", borderRadius: 6 }} />
      </div>
    </div>
  );
}

function EtkinlikKarti({ ilan, index, benimMi, katildimMi, katilimSayisi, katilimAdlari, adlarAcikMi, onAdlarAc, busy, onIlgileniyorum, onIptalEt }) {
  const stil = turStil(ilan.tur);
  const dolu = ilan.kontenjan != null && katilimSayisi >= ilan.kontenjan;
  const yuzde = ilan.kontenjan ? Math.min(100, Math.round((katilimSayisi / ilan.kontenjan) * 100)) : null;
  const zamanMetni = zamanFormatla(ilan.zaman);

  return (
    <div className={`ke2-kart ${stil.className}`} style={{ "--i": index, border: "1px solid #e3ebf6", borderRadius: 20, overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column" }}>
      <div className="ke2-kart-header" style={{ background: stil.grad, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
        {stil.koyu ? (
          <div className="ke2-yildizlar" aria-hidden="true">
            {Array.from({ length: 7 }).map((_, i) => <span key={i} className="ke2-yildiz" style={{ "--yi": i }} />)}
          </div>
        ) : null}
        {ilan.tur === "hali_saha" ? <div className="ke2-cim-cizgi" aria-hidden="true" /> : null}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
          <span className="ke2-tur-ikon" style={{ fontSize: 26 }}>{stil.icon}</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: "rgba(255,255,255,.82)" }}>{stil.label.toUpperCase()}</div>
            {zamanMetni ? <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff" }}>{zamanMetni}</div> : <div style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,.7)" }}>Tarih belirtilmedi</div>}
          </div>
        </div>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{ilan.baslik}</div>
        {ilan.aciklama ? <div style={{ fontSize: 12.5, color: "#5b6b85", marginTop: 6, lineHeight: 1.6 }}>{ilan.aciklama}</div> : null}

        {ilan.konum ? (
          <a href={haritaLinki(ilan.konum)} target="_blank" rel="noopener noreferrer" className="ke2-link-chip" style={{ marginTop: 10, display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: stil.solid, textDecoration: "none" }}>
            📍 {ilan.konum} · Haritada Gör ↗
          </a>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          {ilan.ucretli ? (
            <span style={{ fontSize: 11, fontWeight: 800, color: "#c65d1f", background: "#fff4e0", padding: "4px 10px", borderRadius: 999 }}>
              ₺{Number(ilan.ucret_tutari || 0).toLocaleString("tr-TR")}
            </span>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 800, color: "#0b5c42", background: "#effbf6", padding: "4px 10px", borderRadius: 999 }}>Ücretsiz</span>
          )}
          {dolu ? <span style={{ fontSize: 11, fontWeight: 800, color: "#984333", background: "#fff4f0", padding: "4px 10px", borderRadius: 999 }}>Kontenjan Doldu</span> : null}
        </div>

        {ilan.kontenjan ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 6, borderRadius: 999, background: "#eef2f9", overflow: "hidden" }}>
              <div className="ke2-kontenjan-bar" style={{ height: "100%", width: `${yuzde}%`, background: stil.grad, borderRadius: 999 }} />
            </div>
            <div style={{ fontSize: 10.5, color: "#8fa0bc", marginTop: 4 }}>{katilimSayisi} / {ilan.kontenjan} kişi</div>
          </div>
        ) : null}

        <div style={{ marginTop: "auto", paddingTop: 14 }}>
          <button type="button" onClick={onAdlarAc} style={{ border: "none", background: "none", padding: 0, fontSize: 11.5, fontWeight: 700, color: "#5b6b85", cursor: "pointer" }}>
            {katilimSayisi === 0 ? "Henüz ilgilenen yok" : `${katilimSayisi} kişi ilgileniyor ${adlarAcikMi ? "▲" : "▼"}`}
          </button>
          {adlarAcikMi && katilimAdlari.length > 0 ? (
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 5 }}>
              {katilimAdlari.map((ad, i) => (
                <span key={i} style={{ fontSize: 10.5, fontWeight: 700, color: stil.solid, background: `${stil.solid}14`, padding: "3px 9px", borderRadius: 999 }}>{ad}</span>
              ))}
            </div>
          ) : null}

          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            {benimMi ? (
              <button type="button" onClick={onIptalEt} disabled={busy} style={{ minHeight: 38, padding: "0 14px", fontSize: 12, fontWeight: 700, borderRadius: 10, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", cursor: "pointer", width: "100%" }}>
                İlanı İptal Et
              </button>
            ) : (
              <button
                type="button"
                onClick={onIlgileniyorum}
                disabled={busy || (dolu && !katildimMi)}
                className="ke2-btn-ilgi"
                style={{
                  minHeight: 38, padding: "0 14px", fontSize: 12.5, fontWeight: 800, borderRadius: 10, border: "none", cursor: dolu && !katildimMi ? "not-allowed" : "pointer", width: "100%",
                  color: katildimMi ? stil.solid : "#fff",
                  background: katildimMi ? `${stil.solid}17` : stil.grad,
                  opacity: dolu && !katildimMi ? 0.55 : 1,
                }}
              >
                {katildimMi ? "✓ İlgileniyorsun" : dolu ? "Kontenjan Doldu" : "İlgileniyorum"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IlanOlusturModal({ acik, onClose, onOlustur, busy, form, setForm }) {
  if (!acik) return null;
  return (
    <div className="ke2-modal-backdrop" onClick={onClose}>
      <div className="ke2-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #eef3fa", display: "flex", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Yeni Etkinlik İlanı</div>
          <button type="button" onClick={onClose} style={{ marginLeft: "auto", width: 30, height: 30, borderRadius: 9, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#5b6b85", cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ padding: 22, display: "grid", gap: 14, maxHeight: "72vh", overflowY: "auto" }}>
          <div>
            <div style={labelStyle}>Etkinlik türü</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              {Object.entries(ETKINLIK_TURLERI).map(([key, t]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, tur: key }))}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 12, border: form.tur === key ? `2px solid ${t.solid}` : "1px solid #e3ebf6", background: form.tur === key ? `${t.solid}14` : "#fff", color: form.tur === key ? t.solid : "#5b6b85", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                >
                  <span>{t.icon}</span>{t.label}
                </button>
              ))}
            </div>
          </div>

          <label style={labelStyle}>Başlık
            <input style={inputStyle} value={form.baslik} onChange={(e) => setForm((f) => ({ ...f, baslik: e.target.value }))} placeholder="örn. Cuma Akşamı Halı Saha" />
          </label>

          <label style={labelStyle}>Açıklama (opsiyonel)
            <textarea style={{ ...inputStyle, height: 70, padding: 10, resize: "vertical" }} value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} placeholder="Detayları anlat…" />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <label style={labelStyle}>Tarih / saat
              <input type="datetime-local" style={inputStyle} value={form.zaman} onChange={(e) => setForm((f) => ({ ...f, zaman: e.target.value }))} />
            </label>
            <label style={labelStyle}>Konum
              <input style={inputStyle} value={form.konum} onChange={(e) => setForm((f) => ({ ...f, konum: e.target.value }))} placeholder="örn. Kapalı Spor Salonu" />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <label style={labelStyle}>Kontenjan (opsiyonel)
              <input type="number" min={1} style={inputStyle} value={form.kontenjan} onChange={(e) => setForm((f) => ({ ...f, kontenjan: e.target.value }))} placeholder="Sınırsız" />
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#5b6b85" }}>Ücret</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10, height: 44 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "#5b6b85", cursor: "pointer" }}>
                  <input type="checkbox" checked={form.ucretli} onChange={(e) => setForm((f) => ({ ...f, ucretli: e.target.checked }))} />
                  Ücretli
                </label>
                {form.ucretli ? (
                  <input type="number" min={0} style={{ ...inputStyle, height: 36, width: 100 }} value={form.ucret_tutari} onChange={(e) => setForm((f) => ({ ...f, ucret_tutari: e.target.value }))} placeholder="₺" />
                ) : null}
              </div>
            </div>
          </div>

          <button type="button" onClick={onOlustur} disabled={busy || !form.baslik.trim()} className="ke2-btn-ilgi" style={{ minHeight: 46, borderRadius: 12, border: "none", background: turStil(form.tur).grad, color: "#fff", fontWeight: 800, fontSize: 14, cursor: busy ? "default" : "pointer" }}>
            {busy ? "Yayınlanıyor…" : "İlanı Yayınla"}
          </button>
        </div>
      </div>
    </div>
  );
}

const BOS_FORM = { tur: "hali_saha", baslik: "", aciklama: "", zaman: "", konum: "", kontenjan: "", ucretli: false, ucret_tutari: "" };

export default function EtkinlikPlanlamaSayfasi() {
  const [userId, setUserId] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [ilanlar, setIlanlar] = useState([]);
  const [katilimlar, setKatilimlar] = useState([]); // tüm etkinlik_katilimcilari (public sayım için)
  const [turFilter, setTurFilter] = useState("all");
  const [modalAcik, setModalAcik] = useState(false);
  const [form, setForm] = useState(BOS_FORM);
  const [acikAdlar, setAcikAdlar] = useState({}); // ilan_id -> string[] (yüklenmiş adlar)
  const [acikAdlarGorunur, setAcikAdlarGorunur] = useState({}); // ilan_id -> bool

  async function loadAll(uid) {
    const [{ data: iData, error: iErr }, { data: kData, error: kErr }] = await Promise.all([
      supabase.from("etkinlik_ilanlari").select("*").eq("durum", "acik").order("zaman", { ascending: true, nullsFirst: false }),
      supabase.from("etkinlik_katilimcilari").select("ilan_id, student_id"),
    ]);
    if (iErr) setError("İlanlar alınamadı: " + iErr.message);
    else setIlanlar(iData || []);
    if (kErr) setError((prev) => prev || "Katılımlar alınamadı: " + kErr.message);
    else setKatilimlar(kData || []);
  }

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setFetching(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setFetching(false); return; }
      setUserId(session.user.id);
      await loadAll(session.user.id);
      setFetching(false);
    }
    init();
  }, []);

  const katilimSayilari = useMemo(() => {
    const map = {};
    katilimlar.forEach((k) => { map[k.ilan_id] = (map[k.ilan_id] || 0) + 1; });
    return map;
  }, [katilimlar]);

  const benimKatildiklarim = useMemo(() => new Set(katilimlar.filter((k) => k.student_id === userId).map((k) => k.ilan_id)), [katilimlar, userId]);

  const gorunenIlanlar = turFilter === "all" ? ilanlar : ilanlar.filter((i) => i.tur === turFilter);

  const buHaftaSayisi = useMemo(() => {
    const simdi = Date.now();
    const haftaSonra = simdi + 7 * 24 * 60 * 60 * 1000;
    return ilanlar.filter((i) => i.zaman && new Date(i.zaman).getTime() >= simdi && new Date(i.zaman).getTime() <= haftaSonra).length;
  }, [ilanlar]);

  async function handleIlgileniyorum(ilan) {
    if (!userId) return;
    setBusy(true); setError("");
    const zatenKatildi = benimKatildiklarim.has(ilan.id);
    const { error: err } = zatenKatildi
      ? await supabase.from("etkinlik_katilimcilari").delete().eq("ilan_id", ilan.id).eq("student_id", userId)
      : await supabase.from("etkinlik_katilimcilari").insert([{ ilan_id: ilan.id, student_id: userId }]);
    if (err) setError("İşlem başarısız: " + err.message);
    else await loadAll(userId);
    setBusy(false);
  }

  async function handleIptalEt(ilanId) {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("etkinlik_ilanlari").update({ durum: "iptal" }).eq("id", ilanId);
    if (err) setError("İptal edilemedi: " + err.message);
    else await loadAll(userId);
    setBusy(false);
  }

  async function handleAdlarAc(ilanId) {
    setAcikAdlarGorunur((m) => ({ ...m, [ilanId]: !m[ilanId] }));
    if (!acikAdlar[ilanId]) {
      const { data } = await supabase.rpc("campuso_etkinlik_katilimcilari", { p_ilan_id: ilanId });
      setAcikAdlar((m) => ({ ...m, [ilanId]: (data || []).map((r) => r.full_name || "Öğrenci") }));
    }
  }

  async function handleIlanOlustur() {
    if (!userId || !form.baslik.trim()) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.from("etkinlik_ilanlari").insert([{
      olusturan_id: userId,
      tur: form.tur,
      baslik: form.baslik.trim(),
      aciklama: form.aciklama.trim() || null,
      zaman: form.zaman ? new Date(form.zaman).toISOString() : null,
      konum: form.konum.trim() || null,
      kontenjan: form.kontenjan ? Number(form.kontenjan) : null,
      ucretli: form.ucretli,
      ucret_tutari: form.ucretli && form.ucret_tutari ? Number(form.ucret_tutari) : null,
    }]);
    if (err) setError("İlan yayınlanamadı: " + err.message);
    else { setModalAcik(false); setForm(BOS_FORM); await loadAll(userId); }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <style>{`
        @keyframes ke2CardIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ke2Shimmer { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
        @keyframes ke2Bounce { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-4px) rotate(-8deg); } }
        @keyframes ke2Float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes ke2Wiggle { 0%,100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
        @keyframes ke2Twinkle { 0%,100% { opacity: .15; transform: scale(.7); } 50% { opacity: 1; transform: scale(1.1); } }
        @keyframes ke2BarGrow { from { width: 0; } }
        @keyframes ke2BlobDrift { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-14px, 12px) scale(1.06); } }
        @keyframes ke2ModalIn { from { opacity: 0; transform: scale(.94) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes ke2BackdropIn { from { opacity: 0; } to { opacity: 1; } }

        .ke2-kart { animation: ke2CardIn .45s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i,0) * 50ms); transition: transform .2s ease, box-shadow .2s ease; }
        .ke2-kart:hover { transform: translateY(-5px); box-shadow: 0 22px 44px -26px rgba(15,43,90,.35); }

        .ke2-tema-hali .ke2-tur-ikon { display: inline-block; animation: ke2Bounce 1.8s ease-in-out infinite; }
        .ke2-cim-cizgi { position: absolute; inset: 0; background: repeating-linear-gradient(120deg, rgba(255,255,255,.08) 0 14px, transparent 14px 28px); }

        .ke2-tema-grup .ke2-tur-ikon { display: inline-block; animation: ke2Float 2.4s ease-in-out infinite; }

        .ke2-tema-film .ke2-tur-ikon { display: inline-block; animation: ke2Wiggle 2.2s ease-in-out infinite; }
        .ke2-tema-film .ke2-kart-header { box-shadow: inset 0 0 0 1px rgba(255,209,102,.25); }
        .ke2-yildizlar { position: absolute; inset: 0; }
        .ke2-yildiz { position: absolute; width: 3px; height: 3px; border-radius: 50%; background: #ffe9a8; top: calc(15% + (var(--yi) * 11%)); left: calc(8% + (var(--yi) * 13%)); animation: ke2Twinkle 1.6s ease-in-out infinite; animation-delay: calc(var(--yi) * .22s); }

        .ke2-kontenjan-bar { animation: ke2BarGrow .6s cubic-bezier(.2,.8,.2,1); }

        .ke2-hero-blob { position: absolute; width: 200px; height: 200px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,.15), transparent 70%); top: -60px; right: -30px; animation: ke2BlobDrift 9s ease-in-out infinite; pointer-events: none; }

        .ke2-shimmer { background: linear-gradient(90deg, #eef2f9 25%, #f8fafd 37%, #eef2f9 63%); background-size: 400px 100%; animation: ke2Shimmer 1.4s ease infinite; }

        .ke2-link-chip { transition: transform .15s ease; }
        .ke2-link-chip:hover { transform: translateY(-1px); }

        .ke2-btn-ilgi { transition: filter .15s ease, transform .15s ease; }
        .ke2-btn-ilgi:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
        .ke2-btn-ilgi:active:not(:disabled) { transform: translateY(0) scale(.98); }

        .ke2-chip { transition: transform .15s ease; }
        .ke2-chip:hover { transform: translateY(-1px); }

        .ke2-modal-backdrop { position: fixed; inset: 0; background: rgba(10,20,40,.45); backdrop-filter: blur(3px); display: grid; place-items: center; z-index: 60; padding: 16px; animation: ke2BackdropIn .18s ease; }
        .ke2-modal { width: min(520px, 100%); max-height: 90vh; background: #fff; border-radius: 20px; overflow: hidden; box-shadow: 0 30px 70px -20px rgba(8,20,50,.45); animation: ke2ModalIn .22s cubic-bezier(.2,.8,.2,1); display: flex; flex-direction: column; }
      `}</style>

      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=student" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>SOSYAL ETKİLEŞİM &amp; TOPLULUKLAR</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Etkinlik Planlama</div>
          </div>
        </div>
        <Link href="/?role=student" style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid #c7deff", color: "#0e4bae" }}>Panele dön</Link>
      </header>

      <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg, var(--blue-700, #175cd3), var(--blue-950, #08275f))", padding: "26px 18px 22px" }}>
        <div className="ke2-hero-blob" />
        <div style={{ position: "relative", width: "min(1000px, 100%)", margin: "0 auto" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 10 }}>
            <span>🎉</span> Halı Saha, Grup Çalışması, Film Gecesi…
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.78)", marginTop: 6, maxWidth: 560, lineHeight: 1.6 }}>
            Kampüste bir etkinlik mi düzenliyorsun? İlanını aç, ilgilenenler tek tıkla katılsın.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, marginTop: 18, maxWidth: 420 }}>
            {[
              { label: "Aktif İlan", value: ilanlar.length },
              { label: "Bu Hafta", value: buHaftaSayisi },
              { label: "Sen İlgileniyorsun", value: benimKatildiklarim.size },
            ].map((s) => (
              <div key={s.label} style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 14, padding: "10px 8px", textAlign: "center", backdropFilter: "blur(4px)" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}><AnimatedCounter value={s.value} /></div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.72)", fontWeight: 700, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <main style={{ width: "min(1000px, 100%)", margin: "0 auto", padding: "22px 18px 60px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" onClick={() => setTurFilter("all")} className="ke2-chip" style={{ padding: "7px 14px", borderRadius: 999, border: turFilter === "all" ? "1px solid #175cd3" : "1px solid #e3ebf6", background: turFilter === "all" ? "#175cd3" : "#fff", color: turFilter === "all" ? "#fff" : "#5b6b85", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>Tümü</button>
            {Object.entries(ETKINLIK_TURLERI).map(([key, t]) => {
              const active = turFilter === key;
              return (
                <button key={key} type="button" onClick={() => setTurFilter(key)} className="ke2-chip" style={{ padding: "7px 14px", borderRadius: 999, border: active ? `1px solid ${t.solid}` : "1px solid #e3ebf6", background: active ? t.grad : "#fff", color: active ? "#fff" : "#5b6b85", fontWeight: 700, fontSize: 11.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span>{t.icon}</span>{t.label}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setModalAcik(true)} className="ke2-btn-ilgi" style={{ minHeight: 40, padding: "0 16px", fontSize: 12.5, fontWeight: 800, borderRadius: 12, border: "none", color: "#fff", background: "linear-gradient(135deg, #2e75e6, #175cd3)", cursor: "pointer" }}>
            + İlan Oluştur
          </button>
        </div>

        {error ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}

        {fetching ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonKart key={i} />)}
          </div>
        ) : gorunenIlanlar.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>
            Bu türde henüz ilan yok. İlk ilanı sen aç!
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {gorunenIlanlar.map((ilan, i) => (
              <EtkinlikKarti
                key={ilan.id}
                ilan={ilan}
                index={i}
                benimMi={ilan.olusturan_id === userId}
                katildimMi={benimKatildiklarim.has(ilan.id)}
                katilimSayisi={katilimSayilari[ilan.id] || 0}
                katilimAdlari={acikAdlar[ilan.id] || []}
                adlarAcikMi={!!acikAdlarGorunur[ilan.id]}
                onAdlarAc={() => handleAdlarAc(ilan.id)}
                busy={busy}
                onIlgileniyorum={() => handleIlgileniyorum(ilan)}
                onIptalEt={() => handleIptalEt(ilan.id)}
              />
            ))}
          </div>
        )}
      </main>

      <IlanOlusturModal acik={modalAcik} onClose={() => setModalAcik(false)} onOlustur={handleIlanOlustur} busy={busy} form={form} setForm={setForm} />
    </div>
  );
}
