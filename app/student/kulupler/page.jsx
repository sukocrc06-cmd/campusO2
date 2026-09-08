"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { KULUP_KATEGORILERI, KULUP_UYELIK_DURUM, KULUP_UNVANLARI } from "../../../lib/kulup-kategoriler";

// Kampüs Vitrini yeniden tasarımı: her kategori kendi rengini/ikonunu taşıyor,
// böylece kart kapakları ve filtre çipleri anlamlı bir renk dili kuruyor.
const KATEGORI_STIL = {
  "Teknoloji": { grad: "linear-gradient(135deg, #2e75e6, #0e4bae)", solid: "#175cd3", icon: "💻" },
  "Girişimcilik": { grad: "linear-gradient(135deg, #ffb13b, #e0842a)", solid: "#c66a12", icon: "🚀" },
  "Sanat": { grad: "linear-gradient(135deg, #c56be0, #7c3fae)", solid: "#8a3fc4", icon: "🎨" },
  "Spor": { grad: "linear-gradient(135deg, #34c98a, #0f9d63)", solid: "#0f9d63", icon: "⚽" },
  "Kültür": { grad: "linear-gradient(135deg, #2bc2c2, #147f8f)", solid: "#147f8f", icon: "🎭" },
  "Bilim": { grad: "linear-gradient(135deg, #6c7bff, #3d3fb0)", solid: "#4749b8", icon: "🔬" },
  "Sosyal Sorumluluk": { grad: "linear-gradient(135deg, #ff8a7a, #d94f4f)", solid: "#d94f4f", icon: "🤝" },
  "Diğer": { grad: "linear-gradient(135deg, #8fa0bc, #5b6b85)", solid: "#5b6b85", icon: "✨" },
};
function katStil(kategori) {
  return KATEGORI_STIL[kategori] || KATEGORI_STIL["Diğer"];
}

function StatusBadge({ status }) {
  const s = KULUP_UYELIK_DURUM[status] || { label: status, color: "#5b6b85", bg: "#f5f8fc" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 11px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.color}33`,
      }}
    >
      <i className={status === "beklemede" ? "ke-pulse-dot" : ""} style={{ width: 7, height: 7, borderRadius: "50%", background: s.color }} />
      {s.label}
    </span>
  );
}

function AnimatedCounter({ value, duration = 900 }) {
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

const inputStyle = { height: 44, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 11, fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" };
const labelStyle = { display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 700, color: "#5b6b85" };

function SkeletonCard() {
  return (
    <div style={{ borderRadius: 20, border: "1px solid #e3ebf6", background: "#fff", overflow: "hidden" }}>
      <div className="ke-shimmer" style={{ height: 78 }} />
      <div style={{ padding: "34px 18px 18px" }}>
        <div className="ke-shimmer" style={{ height: 14, width: "60%", borderRadius: 6, marginBottom: 10 }} />
        <div className="ke-shimmer" style={{ height: 10, width: "90%", borderRadius: 6, marginBottom: 6 }} />
        <div className="ke-shimmer" style={{ height: 10, width: "70%", borderRadius: 6 }} />
      </div>
    </div>
  );
}

function ClubCard({ k, uyelik, kurul, index, onKatilAc }) {
  const stil = katStil(k.kategori);
  return (
    <div
      className="ke-card"
      style={{ "--i": index, background: "#fff", border: "1px solid #e3ebf6", borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      <div style={{ height: 78, background: stil.grad, position: "relative" }}>
        <div className="ke-card-cover-glow" />
      </div>
      <div style={{ padding: "0 18px 18px", marginTop: -34, display: "flex", flexDirection: "column", flex: 1 }}>
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 18,
            border: "3px solid #fff",
            background: k.logo_url ? "#f5f8fc" : stil.grad,
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            boxShadow: "0 10px 22px -12px rgba(15,43,90,.45)",
            flex: "none",
          }}
        >
          {k.logo_url ? <img src={k.logo_url} alt={k.ad} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 26 }}>{stil.icon}</span>}
        </div>

        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800, fontSize: 15.5 }}>{k.ad}</div>
        </div>
        {k.kategori ? (
          <span style={{ marginTop: 6, alignSelf: "flex-start", fontSize: 10, fontWeight: 700, color: stil.solid, background: `${stil.solid}17`, padding: "3px 10px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span>{stil.icon}</span>{k.kategori}
          </span>
        ) : null}

        {k.aciklama ? <div style={{ fontSize: 12.5, color: "#5b6b85", marginTop: 10, lineHeight: 1.6, flex: 1 }}>{k.aciklama}</div> : <div style={{ flex: 1 }} />}

        {k.website_url ? (
          <a href={k.website_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: stil.solid, fontWeight: 700, textDecoration: "none" }}>
            Kulübün kendi sitesi ↗
          </a>
        ) : null}

        {kurul.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[...kurul].sort((a, b) => (a.unvan === "Başkan" ? -1 : b.unvan === "Başkan" ? 1 : 0)).slice(0, 4).map((m) => (
              <span key={m.student_id} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, background: "#f5f8fc", border: "1px solid #e3ebf6", fontSize: 10.5 }}>
                <b>{m.full_name}</b>
                <span style={{ color: stil.solid, fontWeight: 700 }}>{m.unvan || "Yönetici"}</span>
              </span>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #eef3fa", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          {!uyelik ? (
            <button type="button" onClick={() => onKatilAc(k)} className="ke-btn-join" style={{ minHeight: 40, padding: "0 18px", fontSize: 12.5, fontWeight: 800, borderRadius: 12, border: "none", color: "#fff", background: stil.grad, cursor: "pointer", width: "100%" }}>
              Kulübe Katıl →
            </button>
          ) : (
            <StatusBadge status={uyelik.durum} />
          )}
        </div>
      </div>
    </div>
  );
}

function KatilModal({ kulup, onClose, onGonder, busy, motivasyon, setMotivasyon, ilgiAlani, setIlgiAlani }) {
  if (!kulup) return null;
  const stil = katStil(kulup.kategori);
  return (
    <div className="ke-modal-backdrop" onClick={onClose}>
      <div className="ke-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ height: 64, background: stil.grad, borderRadius: "20px 20px 0 0", display: "flex", alignItems: "center", padding: "0 20px", gap: 12 }}>
          <span style={{ fontSize: 24 }}>{stil.icon}</span>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{kulup.ad}</div>
          <button type="button" onClick={onClose} style={{ marginLeft: "auto", width: 30, height: 30, borderRadius: 9, border: "none", background: "rgba(255,255,255,.22)", color: "#fff", fontSize: 15, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#5b6b85", marginBottom: 10, letterSpacing: "0.06em" }}>KATILIM FORMU</div>
          <div style={{ display: "grid", gap: 10 }}>
            <label style={labelStyle}>
              Neden katılmak istiyorsun? (opsiyonel)
              <textarea style={{ ...inputStyle, height: 70, padding: 10, resize: "vertical" }} placeholder="Kısaca anlat…" value={motivasyon} onChange={(e) => setMotivasyon(e.target.value)} />
            </label>
            <label style={labelStyle}>
              Hangi alanda katkı sağlamak istersin? (opsiyonel)
              <input style={{ ...inputStyle, height: 42 }} placeholder="örn. Etkinlik, Tasarım, Sosyal medya" value={ilgiAlani} onChange={(e) => setIlgiAlani(e.target.value)} />
            </label>
            <button onClick={onGonder} disabled={busy} className="ke-btn-join" style={{ minHeight: 44, padding: "0 18px", fontSize: 13, fontWeight: 800, borderRadius: 12, border: "none", color: "#fff", background: stil.grad, cursor: busy ? "default" : "pointer", marginTop: 4 }}>
              {busy ? "Gönderiliyor…" : "Başvuruyu Gönder"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudentKuluplerPage() {
  const [userId, setUserId] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("kulupler"); // kulupler | uyelikler | yonetim

  const [kulupler, setKulupler] = useState([]);
  const [uyelikler, setUyelikler] = useState([]); // kendi üyelikleri
  const [kategoriFilter, setKategoriFilter] = useState("all");
  const [kurulMap, setKurulMap] = useState({}); // kulup_id -> [{student_id, full_name, unvan, rol}]

  const [katilModalKulup, setKatilModalKulup] = useState(null);
  const [modalMotivasyon, setModalMotivasyon] = useState("");
  const [modalIlgiAlani, setModalIlgiAlani] = useState("");
  const [basariPop, setBasariPop] = useState(null); // { ad } | null

  const [yonetilenKulup, setYonetilenKulup] = useState(null);
  const [yonetimUyeler, setYonetimUyeler] = useState([]);
  const [profileMap, setProfileMap] = useState({});
  const [editForm, setEditForm] = useState({ ad: "", aciklama: "", kategori: "", website_url: "" });
  const [logoFile, setLogoFile] = useState(null);
  const [unvanTaslak, setUnvanTaslak] = useState({});

  async function loadKurul() {
    const { data } = await supabase.rpc("campuso_kulup_kurulu");
    const map = {};
    (data || []).forEach((row) => {
      map[row.kulup_id] = map[row.kulup_id] || [];
      map[row.kulup_id].push(row);
    });
    setKurulMap(map);
  }

  async function loadAll(uid) {
    const [{ data: kData, error: kErr }, { data: uData, error: uErr }] = await Promise.all([
      supabase.from("kulupler").select("*").order("ad", { ascending: true }),
      supabase.from("kulup_uyelikleri").select("*").eq("student_id", uid),
    ]);
    if (kErr) setError("Kulüpler alınamadı: " + kErr.message);
    else setKulupler(kData || []);
    if (uErr) setError((prev) => prev || "Üyelikler alınamadı: " + uErr.message);
    else setUyelikler(uData || []);
    await loadKurul();

    const yonetici = (uData || []).find((u) => u.rol === "yonetici" && u.durum === "aktif");
    if (yonetici) {
      const kulup = (kData || []).find((k) => k.id === yonetici.kulup_id);
      if (kulup) {
        setYonetilenKulup(kulup);
        setEditForm({ ad: kulup.ad, aciklama: kulup.aciklama || "", kategori: kulup.kategori || KULUP_KATEGORILERI[0], website_url: kulup.website_url || "" });
        await loadYonetimUyeler(kulup.id);
      }
    }
  }

  async function loadYonetimUyeler(kulupId) {
    const { data, error: err } = await supabase.from("kulup_uyelikleri").select("*").eq("kulup_id", kulupId).order("created_at", { ascending: false });
    if (err) { setError("Üye listesi alınamadı: " + err.message); return; }
    const rows = data || [];
    setYonetimUyeler(rows);
    const ids = Array.from(new Set(rows.map((r) => r.student_id)));
    if (ids.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      const map = {};
      (profiles || []).forEach((p) => { map[p.id] = p; });
      setProfileMap(map);
    }
  }

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Kulüp veritabanı bağlantısı yapılandırılmamış."); setFetching(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setFetching(false); return; }
      setUserId(session.user.id);
      await loadAll(session.user.id);
      setFetching(false);
    }
    init();
  }, []);

  const uyelikMap = useMemo(() => {
    const map = {};
    uyelikler.forEach((u) => { map[u.kulup_id] = u; });
    return map;
  }, [uyelikler]);

  const gorunenKulupler = kategoriFilter === "all" ? kulupler : kulupler.filter((k) => k.kategori === kategoriFilter);
  const kategoriSayisi = useMemo(() => new Set(kulupler.map((k) => k.kategori).filter(Boolean)).size, [kulupler]);
  const aktifUyelikSayisi = useMemo(() => uyelikler.filter((u) => u.durum === "aktif").length, [uyelikler]);

  function katilAc(kulup) {
    setKatilModalKulup(kulup);
    setModalMotivasyon("");
    setModalIlgiAlani("");
  }

  async function handleKatil() {
    if (!userId || !katilModalKulup) return;
    const kulupId = katilModalKulup.id;
    const kulupAd = katilModalKulup.ad;
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("kulup_uyelikleri").insert([{
      kulup_id: kulupId,
      student_id: userId,
      rol: "uye",
      durum: "beklemede",
      motivasyon: modalMotivasyon.trim() || null,
      ilgi_alani: modalIlgiAlani.trim() || null,
    }]);
    if (err) {
      setError("Başvuru gönderilemedi: " + err.message);
    } else {
      setKatilModalKulup(null);
      setBasariPop({ ad: kulupAd });
      setTimeout(() => setBasariPop(null), 2400);
      await loadAll(userId);
    }
    setBusy(false);
  }

  async function handleBaskanYap(studentId) {
    if (!yonetilenKulup) return;
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("kulupler").update({ baskan_id: studentId }).eq("id", yonetilenKulup.id);
    if (err) { setError("Başkan atanamadı: " + err.message); setBusy(false); return; }
    const uyelik = yonetimUyeler.find((u) => u.student_id === studentId);
    if (uyelik && (uyelik.rol !== "yonetici" || uyelik.unvan !== "Başkan")) {
      await supabase.from("kulup_uyelikleri").update({ rol: "yonetici", unvan: "Başkan" }).eq("id", uyelik.id);
    }
    setMessage("Başkan atandı.");
    await loadAll(userId);
    setBusy(false);
  }

  async function handleUnvanKaydet(uyelikId) {
    const unvan = (unvanTaslak[uyelikId] || "").trim();
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("kulup_uyelikleri").update({ unvan: unvan || null }).eq("id", uyelikId);
    if (err) setError("Unvan kaydedilemedi: " + err.message);
    else { setMessage("Unvan güncellendi."); await loadYonetimUyeler(yonetilenKulup.id); }
    setBusy(false);
  }

  async function handleVazgec(uyelikId) {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("kulup_uyelikleri").delete().eq("id", uyelikId);
    if (err) setError("Hata: " + err.message);
    else { setMessage("Başvuru geri çekildi."); await loadAll(userId); }
    setBusy(false);
  }

  async function handleAyril(uyelikId) {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("kulup_uyelikleri").update({ durum: "ayrildi" }).eq("id", uyelikId);
    if (err) setError("Hata: " + err.message);
    else { setMessage("Kulüpten ayrıldın."); await loadAll(userId); }
    setBusy(false);
  }

  async function handleYonetimKaydet(e) {
    e.preventDefault();
    if (!yonetilenKulup) return;
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("kulupler").update({ ad: editForm.ad.trim(), aciklama: editForm.aciklama.trim() || null, kategori: editForm.kategori, website_url: editForm.website_url.trim() || null }).eq("id", yonetilenKulup.id);
    if (err) setError("Güncellenemedi: " + err.message);
    else { setMessage("Kulüp bilgileri güncellendi."); await loadAll(userId); }
    setBusy(false);
  }

  async function handleLogoUpload() {
    if (!logoFile || !yonetilenKulup) return;
    setBusy(true); setError(""); setMessage("");
    const ext = logoFile.name.split(".").pop();
    const path = `${yonetilenKulup.id}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("kulup-logolari").upload(path, logoFile, { upsert: true });
    if (upErr) { setError("Logo yüklenemedi: " + upErr.message); setBusy(false); return; }
    const { data: pub } = supabase.storage.from("kulup-logolari").getPublicUrl(path);
    const { error: updErr } = await supabase.from("kulupler").update({ logo_url: pub.publicUrl }).eq("id", yonetilenKulup.id);
    if (updErr) setError("Logo kaydedilemedi: " + updErr.message);
    else { setMessage("Logo güncellendi."); setLogoFile(null); await loadAll(userId); }
    setBusy(false);
  }

  async function handleYonetimKarar(uyelikId, karar) {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("kulup_uyelikleri").update({ durum: karar }).eq("id", uyelikId);
    if (err) setError("Hata: " + err.message);
    else { setMessage(karar === "aktif" ? "Üyelik onaylandı." : "Üyelik reddedildi."); await loadYonetimUyeler(yonetilenKulup.id); }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <style>{`
        @keyframes keBlobDrift { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-16px, 14px) scale(1.08); } }
        @keyframes keBlobDrift2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(18px, -10px) scale(1.05); } }
        @keyframes keCardIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes keShimmer { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
        @keyframes kePulse { 0% { box-shadow: 0 0 0 0 rgba(255,177,59,.55); } 70% { box-shadow: 0 0 0 7px rgba(255,177,59,0); } 100% { box-shadow: 0 0 0 0 rgba(255,177,59,0); } }
        @keyframes keModalIn { from { opacity: 0; transform: scale(.92) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes keBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes keCheckPop { 0% { transform: scale(0.3); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes keChipPop { from { transform: scale(.9); } to { transform: scale(1); } }

        .ke-hero-blob-a { position: absolute; width: 220px; height: 220px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,.16), transparent 70%); top: -70px; right: -40px; animation: keBlobDrift 9s ease-in-out infinite; pointer-events: none; }
        .ke-hero-blob-b { position: absolute; width: 160px; height: 160px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,.13), transparent 70%); bottom: -60px; left: 8%; animation: keBlobDrift2 11s ease-in-out infinite; pointer-events: none; }

        .ke-card { animation: keCardIn .5s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i, 0) * 55ms); transition: transform .22s cubic-bezier(.2,.8,.2,1), box-shadow .22s ease; }
        .ke-card:hover { transform: translateY(-6px); box-shadow: 0 24px 48px -26px rgba(15,43,90,.35); }
        .ke-card-cover-glow { position: absolute; inset: 0; background: radial-gradient(120px 60px at 20% 0%, rgba(255,255,255,.35), transparent 70%); }

        .ke-shimmer { background: linear-gradient(90deg, #eef2f9 25%, #f8fafd 37%, #eef2f9 63%); background-size: 400px 100%; animation: keShimmer 1.4s ease infinite; }

        .ke-pulse-dot { animation: kePulse 1.8s infinite; }

        .ke-modal-backdrop { position: fixed; inset: 0; background: rgba(10,20,40,.45); backdrop-filter: blur(3px); display: grid; place-items: center; z-index: 60; padding: 16px; animation: keBackdropIn .18s ease; }
        .ke-modal { width: min(420px, 100%); background: #fff; border-radius: 20px; overflow: hidden; box-shadow: 0 30px 70px -20px rgba(8,20,50,.45); animation: keModalIn .22s cubic-bezier(.2,.8,.2,1); }

        .ke-btn-join { transition: filter .15s ease, transform .15s ease; }
        .ke-btn-join:hover { filter: brightness(1.08); transform: translateY(-1px); }

        .ke-chip { transition: transform .15s ease, background .15s ease, color .15s ease, border-color .15s ease; }
        .ke-chip:hover { transform: translateY(-1px); }
        .ke-chip.active { animation: keChipPop .2s ease; }

        .ke-tab { transition: background .18s ease, color .18s ease, transform .12s ease; }
        .ke-tab:active { transform: scale(.97); }

        .ke-success-pop { animation: keCheckPop .32s cubic-bezier(.2,.9,.3,1.3); }

        @media (max-width: 640px) {
          .ke-stats { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=student" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>VOL 1-6 · KULÜPLER</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Öğrenci Kulüpleri</div>
          </div>
        </div>
        <Link href="/?role=student" style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid #c7deff", color: "#0e4bae" }}>Panele dön</Link>
      </header>

      {/* HERO — Kampüs Vitrini */}
      <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg, var(--blue-700, #175cd3), var(--blue-950, #08275f))", padding: "30px 18px 26px" }}>
        <div className="ke-hero-blob-a" />
        <div className="ke-hero-blob-b" />
        <div style={{ position: "relative", width: "min(1000px, 100%)", margin: "0 auto" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: "rgba(255,255,255,.72)", marginBottom: 6 }}>SOSYAL ETKİLEŞİM &amp; TOPLULUKLAR</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 10 }}>
            <span>🎓</span> Üniversite Resmî Kulüpleri
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.78)", marginTop: 6, maxWidth: 520, lineHeight: 1.6 }}>
            Kampüsteki resmî kulüpleri keşfet, profillerine göz at ve dilediğine tek tıkla üyelik başvurusu gönder.
          </div>

          <div className="ke-stats" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, marginTop: 20, maxWidth: 480 }}>
            {[
              { label: "Kulüp", value: kulupler.length },
              { label: "Kategori", value: kategoriSayisi },
              { label: "Senin Üyeliğin", value: aktifUyelikSayisi },
            ].map((s) => (
              <div key={s.label} style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 14, padding: "12px 10px", textAlign: "center", backdropFilter: "blur(4px)" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}><AnimatedCounter value={s.value} /></div>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.72)", fontWeight: 700, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <main style={{ width: "min(1000px, 100%)", margin: "0 auto", padding: "22px 18px 60px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
          {[
            { id: "kulupler", label: "Kulüpler" },
            { id: "uyelikler", label: `Üyeliklerim (${uyelikler.length})` },
            ...(yonetilenKulup ? [{ id: "yonetim", label: `${yonetilenKulup.ad} · Yönetim` }] : []),
          ].map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className="ke-tab" style={{ padding: "10px 16px", borderRadius: 999, border: tab === t.id ? "1px solid #175cd3" : "1px solid #e3ebf6", background: tab === t.id ? "linear-gradient(135deg, #2e75e6, #175cd3)" : "#fff", color: tab === t.id ? "#fff" : "#5b6b85", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>

        {error ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}
        {message ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#effbf6", border: "1px solid #bde5d5", color: "#0b5c42", fontSize: 13, fontWeight: 600 }}>{message}</div> : null}

        {fetching ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <>
            {tab === "kulupler" && (
              <div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                  <button type="button" onClick={() => setKategoriFilter("all")} className={`ke-chip ${kategoriFilter === "all" ? "active" : ""}`} style={{ padding: "7px 14px", borderRadius: 999, border: kategoriFilter === "all" ? "1px solid #175cd3" : "1px solid #e3ebf6", background: kategoriFilter === "all" ? "#175cd3" : "#fff", color: kategoriFilter === "all" ? "#fff" : "#5b6b85", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>Tümü</button>
                  {KULUP_KATEGORILERI.map((k) => {
                    const stil = katStil(k);
                    const active = kategoriFilter === k;
                    return (
                      <button key={k} type="button" onClick={() => setKategoriFilter(k)} className={`ke-chip ${active ? "active" : ""}`} style={{ padding: "7px 14px", borderRadius: 999, border: active ? `1px solid ${stil.solid}` : "1px solid #e3ebf6", background: active ? stil.grad : "#fff", color: active ? "#fff" : "#5b6b85", fontWeight: 700, fontSize: 11.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span>{stil.icon}</span>{k}
                      </button>
                    );
                  })}
                </div>

                {gorunenKulupler.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>Bu kategoride kulüp bulunamadı.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                    {gorunenKulupler.map((k, i) => (
                      <ClubCard key={k.id} k={k} uyelik={uyelikMap[k.id]} kurul={kurulMap[k.id] || []} index={i} onKatilAc={katilAc} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "uyelikler" && (
              <div>
                {uyelikler.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>
                    Henüz bir kulübe başvurmadın. <button type="button" onClick={() => setTab("kulupler")} style={{ border: "none", background: "none", color: "#175cd3", fontWeight: 700, cursor: "pointer" }}>Kulüplere göz at</button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {uyelikler.map((u) => {
                      const k = kulupler.find((x) => x.id === u.kulup_id);
                      const stil = katStil(k?.kategori);
                      return (
                        <div key={u.id} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 14, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 11, background: stil.grad, display: "grid", placeItems: "center", fontSize: 17, flex: "none" }}>{stil.icon}</div>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 14 }}>{k?.ad || "Kulüp"}</div>
                              <div style={{ fontSize: 11, color: "#5b6b85", marginTop: 3 }}>{k?.kategori}</div>
                            </div>
                          </div>
                          <StatusBadge status={u.durum} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === "yonetim" && yonetilenKulup && (
              <div>
                <section style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 18, padding: 22, marginBottom: 20, display: "grid", gridTemplateColumns: "auto 1fr", gap: 20 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 88, height: 88, borderRadius: 16, border: "1px solid #e3ebf6", background: "#f5f8fc", display: "grid", placeItems: "center", overflow: "hidden" }}>
                      {yonetilenKulup.logo_url ? <img src={yonetilenKulup.logo_url} alt={yonetilenKulup.ad} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 30 }}>🎓</span>}
                    </div>
                    <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} style={{ fontSize: 11, width: 130 }} />
                    <button type="button" onClick={handleLogoUpload} disabled={!logoFile || busy} style={{ minHeight: 32, padding: "0 12px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid #c7deff", background: "#fff", color: "#0e4bae", cursor: !logoFile || busy ? "not-allowed" : "pointer", opacity: !logoFile || busy ? 0.5 : 1 }}>
                      Logoyu Kaydet
                    </button>
                  </div>
                  <form onSubmit={handleYonetimKaydet} style={{ display: "grid", gap: 12 }}>
                    <label style={labelStyle}>Kulüp adı
                      <input style={inputStyle} value={editForm.ad} onChange={(e) => setEditForm((f) => ({ ...f, ad: e.target.value }))} />
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                      <label style={labelStyle}>Kategori
                        <select style={inputStyle} value={editForm.kategori} onChange={(e) => setEditForm((f) => ({ ...f, kategori: e.target.value }))}>
                          {KULUP_KATEGORILERI.map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </label>
                      <label style={labelStyle}>Kulübün kendi sitesi
                        <input style={inputStyle} value={editForm.website_url} onChange={(e) => setEditForm((f) => ({ ...f, website_url: e.target.value }))} placeholder="https://ornekklup.vercel.app" />
                      </label>
                    </div>
                    <label style={labelStyle}>Açıklama
                      <textarea style={{ ...inputStyle, height: 70, padding: 12, resize: "vertical" }} value={editForm.aciklama} onChange={(e) => setEditForm((f) => ({ ...f, aciklama: e.target.value }))} />
                    </label>
                    <button type="submit" disabled={busy} className="button button-primary" style={{ minHeight: 42, padding: "0 18px", width: "fit-content" }}>{busy ? "…" : "Bilgileri Kaydet"}</button>
                  </form>
                </section>

                <section style={{ padding: 18, borderRadius: 16, border: "1px solid #c7deff", background: "#f4f8ff", marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#0e4bae", marginBottom: 8 }}>YÖNETİM KURULU</div>
                  {(() => {
                    const kurul = yonetimUyeler.filter((u) => u.durum === "aktif" && (u.rol === "yonetici" || u.unvan));
                    if (kurul.length === 0) return <div style={{ fontSize: 12.5, color: "#5b6b85" }}>Henüz kurul üyesi atanmadı. Aşağıdaki üye listesinden "Başkan Yap" veya unvan atayarak kurulu oluşturabilirsin.</div>;
                    const sirali = [...kurul].sort((a, b) => (a.unvan === "Başkan" ? -1 : b.unvan === "Başkan" ? 1 : 0));
                    return (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {sirali.map((u) => (
                          <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#fff", border: "1px solid #c7deff", fontSize: 12 }}>
                            <b>{profileMap[u.student_id]?.full_name || profileMap[u.student_id]?.email || "Üye"}</b>
                            <span style={{ color: "#0e4bae", fontWeight: 700 }}>{u.unvan || "Yönetici"}</span>
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </section>

                <section style={{ padding: 22, borderRadius: 18, border: "1px solid #e3ebf6", background: "#fff", boxShadow: "0 18px 45px -28px rgba(15,43,90,.28)" }}>
                  <h2 style={{ margin: "0 0 14px", fontSize: 16 }}>Üyeler</h2>
                  {yonetimUyeler.length === 0 ? (
                    <div style={{ display: "grid", placeItems: "center", minHeight: 100, border: "1px dashed #e3ebf6", borderRadius: 14, background: "#f5f8fc", color: "#8fa0bc", fontSize: 13 }}>Henüz üye yok.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {yonetimUyeler.map((u) => {
                        const p = profileMap[u.student_id];
                        const baskanMi = yonetilenKulup.baskan_id === u.student_id;
                        return (
                          <div key={u.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", border: baskanMi ? "1px solid #ffd58a" : "1px solid #e3ebf6", borderRadius: 12 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>
                                {p?.full_name || p?.email || `${u.student_id?.slice(0, 8)}…`}
                                {baskanMi && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: "#c65d1f", background: "#fff4e0", padding: "2px 8px", borderRadius: 999 }}>📌 BAŞKAN</span>}
                                {!baskanMi && u.rol === "yonetici" && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: "#175cd3", background: "#e6f0ff", padding: "2px 8px", borderRadius: 999 }}>{u.unvan || "YÖNETİCİ"}</span>}
                              </div>
                              {u.motivasyon ? <div style={{ fontSize: 12, color: "#5b6b85", marginTop: 4, maxWidth: 420 }}>{u.motivasyon}</div> : null}
                              {u.ilgi_alani ? <div style={{ fontSize: 11.5, color: "#0e4bae", marginTop: 3, maxWidth: 420 }}>İlgi alanı: {u.ilgi_alani}</div> : null}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <StatusBadge status={u.durum} />
                              {u.durum === "beklemede" && (
                                <>
                                  <button onClick={() => handleYonetimKarar(u.id, "aktif")} disabled={busy} className="button button-primary" style={{ minHeight: 34, padding: "0 12px", fontSize: 12 }}>Onayla</button>
                                  <button onClick={() => handleYonetimKarar(u.id, "reddedildi")} disabled={busy} style={{ minHeight: 34, padding: "0 12px", fontSize: 12, fontWeight: 700, borderRadius: 10, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", cursor: "pointer" }}>Reddet</button>
                                </>
                              )}
                              {u.durum === "aktif" && (
                                <>
                                  <select
                                    value={unvanTaslak[u.id] ?? (u.unvan || "")}
                                    onChange={(e) => setUnvanTaslak((prev) => ({ ...prev, [u.id]: e.target.value }))}
                                    style={{ height: 34, fontSize: 11.5, borderRadius: 8, border: "1px solid #e3ebf6", padding: "0 6px" }}
                                  >
                                    <option value="">— Unvan yok —</option>
                                    {KULUP_UNVANLARI.map((unvan) => <option key={unvan} value={unvan}>{unvan}</option>)}
                                  </select>
                                  <button onClick={() => handleUnvanKaydet(u.id)} disabled={busy} style={{ minHeight: 34, padding: "0 10px", fontSize: 11.5, fontWeight: 700, borderRadius: 8, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", cursor: "pointer" }}>Unvanı Kaydet</button>
                                  {!baskanMi && (
                                    <button onClick={() => handleBaskanYap(u.student_id)} disabled={busy} style={{ minHeight: 34, padding: "0 12px", fontSize: 12, fontWeight: 700, borderRadius: 10, border: "1px solid #ffd58a", background: "#fff8eb", color: "#c65d1f", cursor: "pointer" }}>
                                      Başkan Yap
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </main>

      <KatilModal
        kulup={katilModalKulup}
        onClose={() => setKatilModalKulup(null)}
        onGonder={handleKatil}
        busy={busy}
        motivasyon={modalMotivasyon}
        setMotivasyon={setModalMotivasyon}
        ilgiAlani={modalIlgiAlani}
        setIlgiAlani={setModalIlgiAlani}
      />

      {basariPop && (
        <div style={{ position: "fixed", left: "50%", bottom: 26, transform: "translateX(-50%)", zIndex: 70 }}>
          <div className="ke-success-pop" style={{ display: "flex", alignItems: "center", gap: 10, background: "#0f1b33", color: "#fff", padding: "12px 18px", borderRadius: 14, boxShadow: "0 20px 40px -18px rgba(0,0,0,.5)", fontSize: 13, fontWeight: 700 }}>
            <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#22b879", display: "grid", placeItems: "center", fontSize: 13 }}>✓</span>
            {basariPop.ad} için başvurun gönderildi!
          </div>
        </div>
      )}
    </div>
  );
}
