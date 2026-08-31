"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { heroGradient } from "../../../lib/profil-secenekleri";
import { hashtagleriAyikla, REAKSIYONLAR, metniParcala, reaksiyonEmoji } from "../../../lib/kampus-duvari-yardimcilari";

function baslangicHarfi(isim) {
  return (isim || "?").trim().charAt(0).toUpperCase() || "?";
}

function zamanFormat(iso) {
  const fark = Date.now() - new Date(iso).getTime();
  const dk = Math.floor(fark / 60000);
  if (dk < 1) return "az önce";
  if (dk < 60) return `${dk} dk önce`;
  const saat = Math.floor(dk / 60);
  if (saat < 24) return `${saat} sa önce`;
  const gun = Math.floor(saat / 24);
  if (gun < 7) return `${gun} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

function Avatar({ profil, size = 36 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flex: "none", background: heroGradient(profil?.hero_renk), display: "grid", placeItems: "center", overflow: "hidden" }}>
      {profil?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profil.avatar_url} alt={profil.full_name || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ color: "#fff", fontWeight: 800, fontSize: size * 0.4 }}>{baslangicHarfi(profil?.full_name)}</span>
      )}
    </div>
  );
}

function gonderiGorselleri(g) {
  if (g.gorsel_urls && g.gorsel_urls.length > 0) return g.gorsel_urls;
  if (g.gorsel_url) return [g.gorsel_url];
  return [];
}

function Gallery({ urls, onAc }) {
  if (!urls || urls.length === 0) return null;
  const n = urls.length;
  return (
    <div className={`kd-gallery kd-gallery-${Math.min(n, 4)}`}>
      {urls.slice(0, 4).map((u, i) => (
        <button key={u + i} type="button" className="kd-gallery-item" onClick={() => onAc(i)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u} alt="" />
          {i === 3 && n > 4 ? <span className="kd-gallery-more">+{n - 4}</span> : null}
        </button>
      ))}
    </div>
  );
}

function Lightbox({ urls, index, onKapat, onIndex }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onKapat();
      if (e.key === "ArrowRight") onIndex((i) => (i + 1) % urls.length);
      if (e.key === "ArrowLeft") onIndex((i) => (i - 1 + urls.length) % urls.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [urls.length, onKapat, onIndex]);

  return (
    <div className="kd-lightbox" role="dialog" aria-modal="true" onClick={onKapat}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={urls[index]} alt="" onClick={(e) => e.stopPropagation()} />
      <button type="button" className="kd-lightbox-close" onClick={onKapat} aria-label="Kapat">✕</button>
      {urls.length > 1 && (
        <>
          <button type="button" className="kd-lightbox-nav kd-lightbox-prev" aria-label="Önceki" onClick={(e) => { e.stopPropagation(); onIndex((i) => (i - 1 + urls.length) % urls.length); }}>‹</button>
          <button type="button" className="kd-lightbox-nav kd-lightbox-next" aria-label="Sonraki" onClick={(e) => { e.stopPropagation(); onIndex((i) => (i + 1) % urls.length); }}>›</button>
        </>
      )}
    </div>
  );
}

function MentionDropdown({ sonuclar, yukleniyor, onSec }) {
  return (
    <div className="kd-mention-dropdown">
      {yukleniyor ? (
        <div className="kd-mention-empty">Aranıyor…</div>
      ) : sonuclar.length === 0 ? (
        <div className="kd-mention-empty">Eşleşen öğrenci yok</div>
      ) : (
        sonuclar.map((p) => (
          <button key={p.id} type="button" className="kd-mention-option" onClick={() => onSec(p)}>
            <Avatar profil={p} size={24} />
            <span>{p.full_name}</span>
            {p.bolum ? <small>{p.bolum}</small> : null}
          </button>
        ))
      )}
    </div>
  );
}

function ReactionBar({ gonderiId, tepkim, sayilar, onTepki }) {
  return (
    <div className="kd-reactions">
      {REAKSIYONLAR.map((r) => {
        const sayi = sayilar?.[r.tip] || 0;
        return (
          <button
            key={r.tip}
            type="button"
            className={`kd-reaction-btn${tepkim === r.tip ? " mine" : ""}`}
            title={r.label}
            onClick={() => onTepki(gonderiId, r.tip)}
          >
            {r.emoji}
            {sayi > 0 ? <small>{sayi}</small> : null}
          </button>
        );
      })}
    </div>
  );
}

export default function KampusDuvariPage() {
  const [userId, setUserId] = useState(null);
  const [viewerRole, setViewerRole] = useState(null); // "student" | "academician"
  const [kendiBolum, setKendiBolum] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [gonderiler, setGonderiler] = useState([]);
  const [profilMap, setProfilMap] = useState({});
  const [icerik, setIcerik] = useState("");
  const [gorselFiles, setGorselFiles] = useState([]);
  const [postMentions, setPostMentions] = useState([]);

  const [genisletilmis, setGenisletilmis] = useState({});
  const [yorumlarMap, setYorumlarMap] = useState({});
  const [yeniYorum, setYeniYorum] = useState({});
  const [yorumMentions, setYorumMentions] = useState({});

  const [gonderiTepkilerim, setGonderiTepkilerim] = useState({});
  const [gonderiTepkiSayilari, setGonderiTepkiSayilari] = useState({});
  const [yorumBegenilerim, setYorumBegenilerim] = useState(new Set());
  const [yorumBegeniSayilari, setYorumBegeniSayilari] = useState({});
  const [gonderiKaydedilenler, setGonderiKaydedilenler] = useState(new Set());

  const [duzenlenenGonderi, setDuzenlenenGonderi] = useState(null);
  const [duzenlenenGonderiMetin, setDuzenlenenGonderiMetin] = useState("");
  const [duzenlenenYorum, setDuzenlenenYorum] = useState(null);
  const [duzenlenenYorumMetin, setDuzenlenenYorumMetin] = useState("");

  const [aktifEtiket, setAktifEtiket] = useState(null);
  const [sadeceBolumum, setSadeceBolumum] = useState(false);
  const [sadeceKaydedilenler, setSadeceKaydedilenler] = useState(false);

  const [bildirimler, setBildirimler] = useState([]);
  const [bildirimAcik, setBildirimAcik] = useState(false);

  const [mentionAktif, setMentionAktif] = useState(null); // { hedef, sorgu, sonuclar, yukleniyor }
  const [lightbox, setLightbox] = useState(null); // { urls, index }
  const textRefs = useRef({});

  async function profilleriYukle(idler) {
    const eksik = idler.filter((id) => !profilMap[id]);
    if (eksik.length === 0) return;
    const { data } = await supabase.rpc("campuso_get_profiller", { p_user_ids: eksik });
    if (data) {
      setProfilMap((prev) => {
        const next = { ...prev };
        data.forEach((p) => { next[p.id] = p; });
        return next;
      });
    }
  }

  async function tepkileriYukle(gonderiIdler, uid) {
    if (gonderiIdler.length === 0) return;
    const { data } = await supabase.from("gonderi_begenileri").select("gonderi_id, kullanici_id, tip").in("gonderi_id", gonderiIdler);
    if (data) {
      const sayilar = {};
      const benimkiler = {};
      data.forEach((row) => {
        sayilar[row.gonderi_id] = sayilar[row.gonderi_id] || {};
        sayilar[row.gonderi_id][row.tip] = (sayilar[row.gonderi_id][row.tip] || 0) + 1;
        if (row.kullanici_id === uid) benimkiler[row.gonderi_id] = row.tip;
      });
      setGonderiTepkiSayilari(sayilar);
      setGonderiTepkilerim(benimkiler);
    }
  }

  async function kaydedilenleriYukle(uid) {
    const { data } = await supabase.from("gonderi_kaydedilenler").select("gonderi_id").eq("kullanici_id", uid);
    setGonderiKaydedilenler(new Set((data || []).map((r) => r.gonderi_id)));
  }

  async function bildirimleriYukle(uid) {
    const { data } = await supabase
      .from("kampus_duvari_bildirimleri")
      .select("*")
      .eq("kullanici_id", uid)
      .order("created_at", { ascending: false })
      .limit(20);
    setBildirimler(data || []);
    if (data) await profilleriYukle(Array.from(new Set(data.map((b) => b.olusturan_id).filter(Boolean))));
  }

  async function loadGonderiler(uid) {
    const { data, error: err } = await supabase
      .from("gonderiler")
      .select("*")
      .order("sabitlenmis", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40);
    if (err) { setError("Gönderiler alınamadı: " + err.message); return; }
    const rows = data || [];
    setGonderiler(rows);
    await profilleriYukle(Array.from(new Set(rows.map((g) => g.yazar_id))));
    await tepkileriYukle(rows.map((g) => g.id), uid);
    await kaydedilenleriYukle(uid);
  }

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("role, bolum").eq("id", session.user.id).maybeSingle();
      if (!["student", "academician"].includes(profile?.role)) { setError("Kampüs Duvarı şu an yalnız öğrenciler ve akademisyenler için açık."); setLoading(false); return; }
      setUserId(session.user.id);
      setViewerRole(profile.role);
      setKendiBolum(profile?.bolum || "");
      await profilleriYukle([session.user.id]);
      await loadGonderiler(session.user.id);
      if (profile.role === "student") await bildirimleriYukle(session.user.id);
      setLoading(false);
    }
    init();
  }, []);

  // Mention autocomplete: sorgu değiştikçe (debounce) öğrenci ara.
  useEffect(() => {
    if (!mentionAktif) return;
    let iptal = false;
    const zamanlayici = setTimeout(async () => {
      const { data } = await supabase.rpc("campuso_profil_ara", { p_sorgu: mentionAktif.sorgu, p_limit: 6 });
      if (!iptal) setMentionAktif((prev) => (prev ? { ...prev, sonuclar: data || [], yukleniyor: false } : prev));
    }, 250);
    return () => { iptal = true; clearTimeout(zamanlayici); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentionAktif?.hedef, mentionAktif?.sorgu]);

  const etiketler = useMemo(() => {
    const hepsi = new Set();
    gonderiler.forEach((g) => hashtagleriAyikla(g.icerik).forEach((h) => hepsi.add(h)));
    return Array.from(hepsi).slice(0, 20);
  }, [gonderiler]);

  const bilinenIsimSeti = useMemo(() => {
    const set = new Set();
    Object.values(profilMap).forEach((p) => { if (p?.full_name) set.add(p.full_name); });
    return set;
  }, [profilMap]);

  const gorunenGonderiler = useMemo(() => {
    return gonderiler.filter((g) => {
      if (aktifEtiket && !hashtagleriAyikla(g.icerik).includes(aktifEtiket)) return false;
      if (sadeceBolumum && kendiBolum && g.bolum !== kendiBolum) return false;
      if (sadeceKaydedilenler && !gonderiKaydedilenler.has(g.id)) return false;
      return true;
    });
  }, [gonderiler, aktifEtiket, sadeceBolumum, kendiBolum, sadeceKaydedilenler, gonderiKaydedilenler]);

  const okunmamisSayisi = bildirimler.filter((b) => !b.okundu).length;

  const gorselOnizlemeler = useMemo(() => gorselFiles.map((f) => URL.createObjectURL(f)), [gorselFiles]);
  useEffect(() => () => { gorselOnizlemeler.forEach((u) => URL.revokeObjectURL(u)); }, [gorselOnizlemeler]);

  function handleMetinDegisti(e, hedef) {
    const value = e.target.value;
    const pos = e.target.selectionStart;
    if (hedef === "post") setIcerik(value);
    else setYeniYorum((prev) => ({ ...prev, [hedef]: value }));

    const upToCursor = value.slice(0, pos);
    const eslesme = /(?:^|\s)@([^\s@]{0,30})$/.exec(upToCursor);
    if (eslesme) {
      setMentionAktif((prev) => ({
        hedef,
        sorgu: eslesme[1],
        sonuclar: prev?.hedef === hedef ? prev.sonuclar : [],
        yukleniyor: true,
      }));
    } else {
      setMentionAktif((prev) => (prev?.hedef === hedef ? null : prev));
    }
  }

  function handleMentionSec(profil) {
    if (!mentionAktif) return;
    const { hedef } = mentionAktif;
    const el = textRefs.current[hedef];
    const value = hedef === "post" ? icerik : (yeniYorum[hedef] || "");
    const pos = el ? el.selectionStart : value.length;
    const upToCursor = value.slice(0, pos);
    const degisenBaslangic = upToCursor.replace(/@([^\s@]{0,30})$/, `@${profil.full_name} `);
    const yeniDeger = degisenBaslangic + value.slice(pos);

    if (hedef === "post") {
      setIcerik(yeniDeger);
      setPostMentions((prev) => (prev.some((m) => m.id === profil.id) ? prev : [...prev, profil]));
    } else {
      setYeniYorum((prev) => ({ ...prev, [hedef]: yeniDeger }));
      setYorumMentions((prev) => {
        const liste = prev[hedef] || [];
        return { ...prev, [hedef]: liste.some((m) => m.id === profil.id) ? liste : [...liste, profil] };
      });
    }
    setMentionAktif(null);
    requestAnimationFrame(() => {
      if (el) { el.focus(); const yeniPos = degisenBaslangic.length; el.setSelectionRange(yeniPos, yeniPos); }
    });
  }

  async function bildirimleriGonder(mentions, metin, gonderiId, yorumId) {
    if (!mentions || mentions.length === 0) return;
    const hedefler = mentions.filter((m) => m.id !== userId && metin.includes(`@${m.full_name}`));
    if (hedefler.length === 0) return;
    const satirlar = hedefler.map((m) => ({ kullanici_id: m.id, tip: "etiket", gonderi_id: gonderiId, yorum_id: yorumId, olusturan_id: userId }));
    try { await supabase.from("kampus_duvari_bildirimleri").insert(satirlar); } catch { /* bildirim gönderilemedi, sessiz geç */ }
  }

  async function handlePaylas(e) {
    e.preventDefault();
    if (!icerik.trim()) { setError("Bir şeyler yazmadan paylaşamazsın."); return; }
    setBusy(true); setError("");
    const gorselUrls = [];
    for (const file of gorselFiles) {
      const ext = file.name.split(".").pop();
      const path = `${userId}/gonderi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("gonderi-gorselleri").upload(path, file);
      if (upErr) { setError("Görsel yüklenemedi: " + upErr.message); setBusy(false); return; }
      gorselUrls.push(supabase.storage.from("gonderi-gorselleri").getPublicUrl(path).data.publicUrl);
    }
    const metin = icerik.trim();
    const { data: eklenen, error: err } = await supabase
      .from("gonderiler")
      .insert([{ yazar_id: userId, icerik: metin, gorsel_urls: gorselUrls }])
      .select("id, onay_bekliyor")
      .maybeSingle();
    if (err) setError("Paylaşılamadı: " + err.message);
    else {
      setIcerik(""); setGorselFiles([]);
      await loadGonderiler(userId);
      if (eklenen?.onay_bekliyor) setError("Gönderin incelemeye alındı, onaylanana kadar yalnız sen görebilirsin.");
      if (eklenen?.id) await bildirimleriGonder(postMentions, metin, eklenen.id, null);
      setPostMentions([]);
    }
    setBusy(false);
  }

  async function handleGonderiSil(id) {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("gonderiler").delete().eq("id", id);
    if (err) setError("Silinemedi: " + err.message);
    else setGonderiler((prev) => prev.filter((g) => g.id !== id));
    setBusy(false);
  }

  function gonderiDuzenlemeyeBasla(g) {
    setDuzenlenenGonderi(g.id);
    setDuzenlenenGonderiMetin(g.icerik);
  }

  async function handleGonderiDuzenleKaydet(id) {
    const metin = duzenlenenGonderiMetin.trim();
    if (!metin) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.from("gonderiler").update({ icerik: metin }).eq("id", id);
    if (err) setError("Düzenlenemedi: " + err.message);
    else {
      setDuzenlenenGonderi(null);
      await loadGonderiler(userId);
    }
    setBusy(false);
  }

  async function handleSikayet(hedefTip, hedefId) {
    const sebep = window.prompt("Bu içeriği neden şikayet ediyorsun? (opsiyonel)") ?? "";
    const { error: err } = await supabase.from("kampus_duvari_sikayetleri").insert([{ hedef_tip: hedefTip, hedef_id: hedefId, bildiren_id: userId, sebep: sebep.trim() || null }]);
    if (err) setError("Şikayet gönderilemedi: " + err.message);
    else window.alert("Şikayetin admin'e iletildi, teşekkürler.");
  }

  async function handleGonderiTepki(gonderiId, tip) {
    const mevcut = gonderiTepkilerim[gonderiId];
    if (mevcut === tip) {
      const { error: err } = await supabase.from("gonderi_begenileri").delete().eq("gonderi_id", gonderiId).eq("kullanici_id", userId);
      if (err) { setError("İşlem başarısız: " + err.message); return; }
      setGonderiTepkilerim((prev) => { const next = { ...prev }; delete next[gonderiId]; return next; });
      setGonderiTepkiSayilari((prev) => {
        const sayilar = { ...(prev[gonderiId] || {}) };
        sayilar[tip] = Math.max(0, (sayilar[tip] || 1) - 1);
        return { ...prev, [gonderiId]: sayilar };
      });
    } else {
      const { error: err } = await supabase.from("gonderi_begenileri").upsert([{ gonderi_id: gonderiId, kullanici_id: userId, tip }], { onConflict: "gonderi_id,kullanici_id" });
      if (err) { setError("İşlem başarısız: " + err.message); return; }
      setGonderiTepkilerim((prev) => ({ ...prev, [gonderiId]: tip }));
      setGonderiTepkiSayilari((prev) => {
        const sayilar = { ...(prev[gonderiId] || {}) };
        if (mevcut) sayilar[mevcut] = Math.max(0, (sayilar[mevcut] || 1) - 1);
        sayilar[tip] = (sayilar[tip] || 0) + 1;
        return { ...prev, [gonderiId]: sayilar };
      });
    }
  }

  async function handleKaydet(gonderiId) {
    const kayitliMi = gonderiKaydedilenler.has(gonderiId);
    if (kayitliMi) {
      const { error: err } = await supabase.from("gonderi_kaydedilenler").delete().eq("gonderi_id", gonderiId).eq("kullanici_id", userId);
      if (err) { setError("İşlem başarısız: " + err.message); return; }
      setGonderiKaydedilenler((prev) => { const next = new Set(prev); next.delete(gonderiId); return next; });
    } else {
      const { error: err } = await supabase.from("gonderi_kaydedilenler").insert([{ gonderi_id: gonderiId, kullanici_id: userId }]);
      if (err) { setError("İşlem başarısız: " + err.message); return; }
      setGonderiKaydedilenler((prev) => new Set(prev).add(gonderiId));
    }
  }

  async function handleYorumBegen(yorumId) {
    const begendimMi = yorumBegenilerim.has(yorumId);
    if (begendimMi) {
      const { error: err } = await supabase.from("yorum_begenileri").delete().eq("yorum_id", yorumId).eq("kullanici_id", userId);
      if (err) { setError("İşlem başarısız: " + err.message); return; }
      setYorumBegenilerim((prev) => { const next = new Set(prev); next.delete(yorumId); return next; });
      setYorumBegeniSayilari((prev) => ({ ...prev, [yorumId]: Math.max(0, (prev[yorumId] || 1) - 1) }));
    } else {
      const { error: err } = await supabase.from("yorum_begenileri").insert([{ yorum_id: yorumId, kullanici_id: userId }]);
      if (err) { setError("İşlem başarısız: " + err.message); return; }
      setYorumBegenilerim((prev) => new Set(prev).add(yorumId));
      setYorumBegeniSayilari((prev) => ({ ...prev, [yorumId]: (prev[yorumId] || 0) + 1 }));
    }
  }

  async function yorumBegenileriniYukle(yorumIdler) {
    if (yorumIdler.length === 0) return;
    const { data } = await supabase.from("yorum_begenileri").select("yorum_id, kullanici_id").in("yorum_id", yorumIdler);
    if (data) {
      const sayilar = {};
      const benimkiler = new Set();
      data.forEach((row) => {
        sayilar[row.yorum_id] = (sayilar[row.yorum_id] || 0) + 1;
        if (row.kullanici_id === userId) benimkiler.add(row.yorum_id);
      });
      setYorumBegeniSayilari((prev) => ({ ...prev, ...sayilar }));
      setYorumBegenilerim((prev) => new Set([...prev, ...benimkiler]));
    }
  }

  async function toggleYorumlar(gonderiId) {
    const acikMi = genisletilmis[gonderiId];
    setGenisletilmis((prev) => ({ ...prev, [gonderiId]: !acikMi }));
    if (!acikMi && !yorumlarMap[gonderiId]) {
      const { data, error: err } = await supabase.from("yorumlar").select("*").eq("gonderi_id", gonderiId).order("created_at", { ascending: true });
      if (err) { setError("Yorumlar alınamadı: " + err.message); return; }
      setYorumlarMap((prev) => ({ ...prev, [gonderiId]: data || [] }));
      await profilleriYukle(Array.from(new Set((data || []).map((y) => y.yazar_id))));
      await yorumBegenileriniYukle((data || []).map((y) => y.id));
    }
  }

  async function handleYorumEkle(gonderiId, e) {
    e.preventDefault();
    const metin = (yeniYorum[gonderiId] || "").trim();
    if (!metin) return;
    setBusy(true); setError("");
    const { data: eklenen, error: err } = await supabase.from("yorumlar").insert([{ gonderi_id: gonderiId, yazar_id: userId, icerik: metin }]).select("id, onay_bekliyor").maybeSingle();
    if (err) setError("Yorum eklenemedi: " + err.message);
    else {
      setYeniYorum((prev) => ({ ...prev, [gonderiId]: "" }));
      const { data } = await supabase.from("yorumlar").select("*").eq("gonderi_id", gonderiId).order("created_at", { ascending: true });
      setYorumlarMap((prev) => ({ ...prev, [gonderiId]: data || [] }));
      if (eklenen?.onay_bekliyor) setError("Yorumun incelemeye alındı, onaylanana kadar yalnız sen görebilirsin.");
      if (eklenen?.id) await bildirimleriGonder(yorumMentions[gonderiId], metin, gonderiId, eklenen.id);
      setYorumMentions((prev) => ({ ...prev, [gonderiId]: [] }));
    }
    setBusy(false);
  }

  async function handleYorumSil(id, gonderiId) {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("yorumlar").delete().eq("id", id);
    if (err) setError("Silinemedi: " + err.message);
    else setYorumlarMap((prev) => ({ ...prev, [gonderiId]: (prev[gonderiId] || []).filter((y) => y.id !== id) }));
    setBusy(false);
  }

  function yorumDuzenlemeyeBasla(y) {
    setDuzenlenenYorum(y.id);
    setDuzenlenenYorumMetin(y.icerik);
  }

  async function handleYorumDuzenleKaydet(id, gonderiId) {
    const metin = duzenlenenYorumMetin.trim();
    if (!metin) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.from("yorumlar").update({ icerik: metin }).eq("id", id);
    if (err) setError("Düzenlenemedi: " + err.message);
    else {
      setDuzenlenenYorum(null);
      const { data } = await supabase.from("yorumlar").select("*").eq("gonderi_id", gonderiId).order("created_at", { ascending: true });
      setYorumlarMap((prev) => ({ ...prev, [gonderiId]: data || [] }));
    }
    setBusy(false);
  }

  async function handleBildirimAc() {
    setBildirimAcik((prev) => !prev);
    const okunmamislar = bildirimler.filter((b) => !b.okundu).map((b) => b.id);
    if (okunmamislar.length > 0) {
      await supabase.from("kampus_duvari_bildirimleri").update({ okundu: true }).in("id", okunmamislar);
      setBildirimler((prev) => prev.map((b) => ({ ...b, okundu: true })));
    }
  }

  return (
    <div className="kd-shell">
      <header className="kd-header">
        <div className="kd-header-left">
          <Link href={viewerRole === "academician" ? "/?role=faculty" : "/?role=student"} className="kd-back">←</Link>
          <div>
            <div className="kd-kicker">VOL 1-11 · KAMPÜS DUVARI</div>
            <div className="kd-title">Kampüs Duvarı</div>
          </div>
        </div>
        <div className="kd-header-actions">
          {viewerRole === "student" && (
          <button type="button" className="kd-icon-btn" onClick={handleBildirimAc} aria-label="Bildirimler">
            🔔
            {okunmamisSayisi > 0 && <span className="kd-icon-badge">{okunmamisSayisi}</span>}
          </button>
          )}
          {bildirimAcik && (
            <div className="kd-notif-panel">
              {bildirimler.length === 0 ? (
                <div className="kd-notif-empty">Henüz bildirim yok.</div>
              ) : bildirimler.map((b) => {
                const kimden = profilMap[b.olusturan_id];
                return (
                  <div key={b.id} className={`kd-notif-item${b.okundu ? "" : " unread"}`}>
                    <b>{kimden?.full_name || "Bir öğrenci"}</b>{" "}
                    {b.tip === "etiket" ? "seni bir paylaşımda etiketledi." : "gönderine yorum yaptı."}
                    <div className="kd-notif-time">{zamanFormat(b.created_at)}</div>
                  </div>
                );
              })}
            </div>
          )}
          <Link href={viewerRole === "academician" ? "/?role=faculty" : "/?role=student"} className="kd-return-link">Panele dön</Link>
        </div>
      </header>

      <main className="kd-main">
        {error ? <div className="kd-error">{error}</div> : null}

        {loading ? (
          <p className="kd-loading">Yükleniyor…</p>
        ) : !userId ? null : (
          <>
            {viewerRole === "academician" && (
              <div className="kd-error" style={{ background: "var(--bg)", color: "var(--muted)", border: "1px solid var(--line)" }}>
                Kampüs Duvarı'nı görüntülüyorsun. Paylaşım, yorum ve tepki verme şu an yalnızca öğrenciler için açık.
              </div>
            )}
            {viewerRole === "student" && (
            <form onSubmit={handlePaylas} className="kd-compose">
              <div className="kd-compose-row">
                <Avatar profil={profilMap[userId]} size={40} />
                <div className="kd-compose-main">
                  <div className="kd-mention-wrap">
                    <textarea
                      ref={(el) => (textRefs.current.post = el)}
                      className="kd-textarea"
                      maxLength={2000}
                      placeholder="Kampüste neler oluyor? Bir şeyler paylaş… (#etiket, @isim kullanabilirsin)"
                      value={icerik}
                      onChange={(e) => handleMetinDegisti(e, "post")}
                    />
                    {mentionAktif?.hedef === "post" && (
                      <MentionDropdown sonuclar={mentionAktif.sonuclar} yukleniyor={mentionAktif.yukleniyor} onSec={handleMentionSec} />
                    )}
                  </div>
                  {gorselOnizlemeler.length > 0 && (
                    <div className="kd-compose-previews">
                      {gorselOnizlemeler.map((u, i) => (
                        <div key={u} className="kd-compose-preview">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt="" />
                          <button type="button" aria-label="Kaldır" onClick={() => setGorselFiles((prev) => prev.filter((_, idx) => idx !== i))}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="kd-compose-footer">
                    <label className="kd-compose-image-btn">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => setGorselFiles(Array.from(e.target.files || []).slice(0, 4))}
                        hidden
                      />
                      🖼️ {gorselFiles.length > 0 ? `${gorselFiles.length} görsel seçildi` : "Görsel ekle"}
                    </label>
                    <div className="kd-compose-footer-right">
                      <span className={`kd-compose-counter${icerik.length > 1800 ? " warn" : ""}`}>{icerik.length}/2000</span>
                      <button type="submit" disabled={busy || !icerik.trim()} className="button button-primary" style={{ minHeight: 40, padding: "0 18px", fontSize: 13, opacity: busy || !icerik.trim() ? 0.6 : 1 }}>
                        {busy ? "…" : "Paylaş"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </form>
            )}

            <div className="kd-filters">
              {kendiBolum ? (
                <button type="button" className={`kd-chip${sadeceBolumum ? " active" : ""}`} onClick={() => setSadeceBolumum((prev) => !prev)}>
                  Sadece {kendiBolum}
                </button>
              ) : null}
              {viewerRole === "student" && (
              <button type="button" className={`kd-chip${sadeceKaydedilenler ? " active" : ""}`} onClick={() => setSadeceKaydedilenler((prev) => !prev)}>
                🔖 Kaydedilenler
              </button>
              )}
              {etiketler.map((etiket) => (
                <button key={etiket} type="button" className={`kd-chip${aktifEtiket === etiket ? " active" : ""}`} onClick={() => setAktifEtiket((prev) => (prev === etiket ? null : etiket))}>
                  {etiket}
                </button>
              ))}
            </div>

            {gorunenGonderiler.length === 0 ? (
              <div className="kd-empty">
                {gonderiler.length === 0 ? "Henüz gönderi yok. İlk paylaşımı sen yap!" : "Bu filtreye uyan gönderi yok."}
              </div>
            ) : (
              <div className="kd-feed">
                {gorunenGonderiler.map((g) => {
                  const yazar = profilMap[g.yazar_id];
                  const kendisiMi = g.yazar_id === userId;
                  const yorumlar = yorumlarMap[g.id] || [];
                  const gorseller = gonderiGorselleri(g);
                  const kayitliMi = gonderiKaydedilenler.has(g.id);
                  return (
                    <div key={g.id} className={`kd-card${g.sabitlenmis ? " pinned" : ""}`}>
                      {g.sabitlenmis && <div className="kd-pinned-badge">📌 SABİTLENMİŞ DUYURU</div>}
                      {kendisiMi && g.onay_bekliyor && (
                        <div className="kd-pending-badge">⏳ İncelemede — onaylanana kadar yalnız sen görüyorsun.</div>
                      )}
                      <div className="kd-post-body">
                        <Avatar profil={yazar} />
                        <div className="kd-post-main">
                          <div className="kd-post-head">
                            <b className="kd-post-name">{yazar?.full_name || "Öğrenci"}</b>
                            <span className="kd-post-time">{zamanFormat(g.created_at)}{g.updated_at ? " · düzenlendi" : ""}</span>
                          </div>
                          {duzenlenenGonderi === g.id ? (
                            <div style={{ marginTop: 6 }}>
                              <textarea className="kd-textarea" style={{ minHeight: 60 }} maxLength={2000} value={duzenlenenGonderiMetin} onChange={(e) => setDuzenlenenGonderiMetin(e.target.value)} />
                              <div className="kd-edit-actions">
                                <button type="button" className="kd-edit-save" disabled={busy} onClick={() => handleGonderiDuzenleKaydet(g.id)}>Kaydet</button>
                                <button type="button" className="kd-edit-cancel" onClick={() => setDuzenlenenGonderi(null)}>Vazgeç</button>
                              </div>
                            </div>
                          ) : (
                            <p className="kd-post-text">
                              {metniParcala(g.icerik, bilinenIsimSeti).map((parca, idx) =>
                                parca.tip === "etiket" ? <b key={idx} className="kd-mention">{parca.icerik}</b> : <span key={idx}>{parca.icerik}</span>
                              )}
                            </p>
                          )}
                          <Gallery urls={gorseller} onAc={(i) => setLightbox({ urls: gorseller, index: i })} />
                          <div className="kd-post-actions">
                            {viewerRole === "student" ? (
                              <ReactionBar gonderiId={g.id} tepkim={gonderiTepkilerim[g.id]} sayilar={gonderiTepkiSayilari[g.id]} onTepki={handleGonderiTepki} />
                            ) : (
                              Object.entries(gonderiTepkiSayilari[g.id] || {}).some(([, adet]) => adet > 0) ? (
                                <div className="kd-reactions">
                                  {Object.entries(gonderiTepkiSayilari[g.id] || {}).filter(([, adet]) => adet > 0).map(([tip, adet]) => (
                                    <span key={tip} className="kd-reaction-btn">{reaksiyonEmoji(tip)} {adet}</span>
                                  ))}
                                </div>
                              ) : null
                            )}
                            <button type="button" className="kd-link-btn comment" onClick={() => toggleYorumlar(g.id)}>
                              💬 Yorumlar {yorumlar.length > 0 ? `(${yorumlar.length})` : ""}
                            </button>
                            {viewerRole === "student" && (
                            <button type="button" className={`kd-link-btn save${kayitliMi ? " active" : ""}`} onClick={() => handleKaydet(g.id)}>
                              {kayitliMi ? "🔖 Kaydedildi" : "🔖 Kaydet"}
                            </button>
                            )}
                            {viewerRole === "student" && (kendisiMi ? (
                              <>
                                <button type="button" className="kd-link-btn" onClick={() => gonderiDuzenlemeyeBasla(g)}>Düzenle</button>
                                <button type="button" className="kd-link-btn danger" disabled={busy} onClick={() => handleGonderiSil(g.id)}>Sil</button>
                              </>
                            ) : (
                              <button type="button" className="kd-link-btn" onClick={() => handleSikayet("gonderi", g.id)}>Şikayet Et</button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {genisletilmis[g.id] && (
                        <div className="kd-comments">
                          {yorumlar.map((y) => {
                            const yYazar = profilMap[y.yazar_id];
                            const yKendisiMi = y.yazar_id === userId;
                            const yBegendimMi = yorumBegenilerim.has(y.id);
                            const yBegeniSayisi = yorumBegeniSayilari[y.id] || 0;
                            return (
                              <div key={y.id} className="kd-comment">
                                <Avatar profil={yYazar} size={26} />
                                <div className="kd-comment-bubble">
                                  <div className="kd-comment-head">
                                    <b className="kd-comment-name">{yYazar?.full_name || "Öğrenci"}</b>
                                    <span className="kd-comment-time">{zamanFormat(y.created_at)}{y.updated_at ? " · düzenlendi" : ""}</span>
                                  </div>
                                  {duzenlenenYorum === y.id ? (
                                    <div style={{ marginTop: 4 }}>
                                      <input className="kd-comment-input" maxLength={500} value={duzenlenenYorumMetin} onChange={(e) => setDuzenlenenYorumMetin(e.target.value)} />
                                      <div className="kd-edit-actions">
                                        <button type="button" className="kd-edit-save" disabled={busy} onClick={() => handleYorumDuzenleKaydet(y.id, g.id)}>Kaydet</button>
                                        <button type="button" className="kd-edit-cancel" onClick={() => setDuzenlenenYorum(null)}>Vazgeç</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="kd-comment-text">
                                      {metniParcala(y.icerik, bilinenIsimSeti).map((parca, idx) =>
                                        parca.tip === "etiket" ? <b key={idx} className="kd-mention">{parca.icerik}</b> : <span key={idx}>{parca.icerik}</span>
                                      )}
                                    </div>
                                  )}
                                  {viewerRole === "student" && (
                                  <div className="kd-comment-actions">
                                    <button type="button" className="kd-link-btn" style={{ color: yBegendimMi ? "#ef5c63" : "var(--muted)" }} onClick={() => handleYorumBegen(y.id)}>
                                      {yBegendimMi ? "❤️" : "🤍"} {yBegeniSayisi > 0 ? yBegeniSayisi : ""}
                                    </button>
                                    {yKendisiMi ? (
                                      <>
                                        <button type="button" className="kd-link-btn" onClick={() => yorumDuzenlemeyeBasla(y)}>Düzenle</button>
                                        <button type="button" className="kd-link-btn danger" disabled={busy} onClick={() => handleYorumSil(y.id, g.id)}>Sil</button>
                                      </>
                                    ) : (
                                      <button type="button" className="kd-link-btn" onClick={() => handleSikayet("yorum", y.id)}>Şikayet Et</button>
                                    )}
                                  </div>
                                  )}
                                  {viewerRole === "academician" && yBegeniSayisi > 0 && (
                                    <div className="kd-comment-actions"><span className="kd-link-btn">❤️ {yBegeniSayisi}</span></div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {viewerRole === "student" && (
                          <div className="kd-mention-wrap">
                            <form onSubmit={(e) => handleYorumEkle(g.id, e)} className="kd-comment-form">
                              <input
                                ref={(el) => (textRefs.current[g.id] = el)}
                                className="kd-comment-input"
                                placeholder="Yorum yaz… (@isim ile etiketle)"
                                maxLength={500}
                                value={yeniYorum[g.id] || ""}
                                onChange={(e) => handleMetinDegisti(e, g.id)}
                              />
                              <button type="submit" className="kd-comment-send" disabled={busy}>Gönder</button>
                            </form>
                            {mentionAktif?.hedef === g.id && (
                              <MentionDropdown sonuclar={mentionAktif.sonuclar} yukleniyor={mentionAktif.yukleniyor} onSec={handleMentionSec} />
                            )}
                          </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {lightbox && (
        <Lightbox
          urls={lightbox.urls}
          index={lightbox.index}
          onKapat={() => setLightbox(null)}
          onIndex={(fn) => setLightbox((prev) => (prev ? { ...prev, index: fn(prev.index) } : prev))}
        />
      )}
    </div>
  );
}
