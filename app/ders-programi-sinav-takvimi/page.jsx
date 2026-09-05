"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { GUNLER } from "../../lib/ders-sinav-excel";
import {
  dersProgramindanIcsUret,
  sinavTakvimindenIcsUret,
  icsIndir,
  sinavCakismalariniBul,
  yaklasanDersiBul,
  yaklasanSinaviBul,
  gunFarkiMetni,
} from "../../lib/ders-sinav-kisisel";
import { TAKVIM_TURLERI, AY_ADLARI, GUN_KISALTMALARI, tarihIso, bugunIso, ayIzgarasiUret } from "../../lib/kisisel-takvim";

const inputStyle = { height: 42, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 11, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };

const SINAV_RENK = {
  "Vize": { color: "#175cd3", bg: "#e6f0ff" },
  "Final": { color: "#0e4bae", bg: "#dbe9ff" },
  "Bütünleme": { color: "#ffb13b", bg: "#fff8eb" },
};

// Bir günde birden fazla etkinlik türü varsa hücrenin tamamını dolduracak
// "baskın" türü belirlemek için öncelik sırası (en dikkat gerektirenden aza).
const TUR_ONCELIK = ["sinav", "proje", "sunum", "ders", "diger"];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}


export default function DersSinavTakvimiPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleHref, setRoleHref] = useState("/");
  const [tab, setTab] = useState("ders"); // ders | sinav
  const [userId, setUserId] = useState(null);
  const [isAcademician, setIsAcademician] = useState(false);
  const [kendiAdi, setKendiAdi] = useState("");
  const [aktifDonem, setAktifDonem] = useState("bahar");

  // Akademik Yönetim > Sınav Bilgileri gibi dış bağlantılar ?tab=sinav ile
  // doğrudan sınav sekmesini açabilsin diye URL'den okunuyor.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("tab") === "sinav") setTab("sinav");
  }, []);

  const [dersListe, setDersListe] = useState([]);
  const [sinavListe, setSinavListe] = useState([]);
  const [kisiselMap, setKisiselMap] = useState({}); // `${hedef_tip}:${hedef_id}` -> {gizli, not_metni}

  const [kayitliIdSet, setKayitliIdSet] = useState(new Set());
  const [gizlenenleriGoster, setGizlenenleriGoster] = useState(false);
  const [suruklenenDersId, setSuruklenenDersId] = useState(null);
  const [saatDuzenlemeAcik, setSaatDuzenlemeAcik] = useState(null); // ders id
  const [saatTaslak, setSaatTaslak] = useState({ baslangic: "", bitis: "" });

  const [notAcik, setNotAcik] = useState(null); // `${hedef_tip}:${hedef_id}`
  const [notTaslak, setNotTaslak] = useState("");
  const [busy, setBusy] = useState(false);

  const bugunTarih = new Date();
  const [takvimEtkinlikleri, setTakvimEtkinlikleri] = useState([]);
  const [takvimYil, setTakvimYil] = useState(bugunTarih.getFullYear());
  const [takvimAy, setTakvimAy] = useState(bugunTarih.getMonth());
  const [secilenGun, setSecilenGun] = useState(bugunIso());
  const [yeniTur, setYeniTur] = useState("ders");
  const [yeniBaslik, setYeniBaslik] = useState("");
  const [yeniSaat, setYeniSaat] = useState("");

  async function takvimEtkinlikleriYukle(uid) {
    const { data } = await supabase.from("kisisel_takvim_etkinlikleri").select("*").eq("kullanici_id", uid).order("saat", { ascending: true });
    setTakvimEtkinlikleri(data || []);
  }

  async function kisiselleriYukle(uid) {
    const { data } = await supabase.from("ders_sinav_kisisel").select("*").eq("kullanici_id", uid);
    const map = {};
    (data || []).forEach((row) => { map[`${row.hedef_tip}:${row.hedef_id}`] = row; });
    setKisiselMap(map);
  }

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }

      const { data: profile } = await supabase.from("profiles").select("role, bolum, sinif, full_name").eq("id", session.user.id).maybeSingle();
      const akademisyenMi = session.user.email?.toLowerCase() !== "suko.crc06@gmail.com" && profile?.role === "academician";
      setIsAcademician(akademisyenMi);
      setRoleHref(akademisyenMi ? "/?role=faculty" : "/?role=student");
      setUserId(session.user.id);
      setKendiAdi(profile?.full_name || "");

      // Sabit bir sıralama şart: akademisyen görünümünde ortak (çoklu bölüm)
      // dersler ders koduna göre gruplanıp tek karta indirgeniyor
      // (dersleriBirlestir/sinavlariBirlestir) — sıralama olmadan Postgres
      // satır sırası garanti edilmediği için, grubun "temsilci" satırı her
      // sayfa yüklemesinde değişebilir ve bu da kişisel gizleme/sürükleme
      // tercihlerinin (ders_sinav_kisisel, akademisyen_id_manuel) tutarsız
      // görünmesine yol açabilirdi.
      const { data: donemSatiri } = await supabase.from("aktif_donem").select("donem").eq("id", true).maybeSingle();
      const guncelDonem = donemSatiri?.donem || "bahar";
      setAktifDonem(guncelDonem);

      const [{ data: d, error: dErr }, { data: s, error: sErr }, { data: k, error: kErr }] = await Promise.all([
        supabase.from("ders_programi").select("*").eq("donem", guncelDonem).order("ders_kodu").order("bolum").order("id"),
        supabase.from("sinav_takvimi").select("*").eq("donem", guncelDonem).order("ders_kodu").order("bolum").order("id"),
        akademisyenMi ? Promise.resolve({ data: [] }) : supabase.from("ders_kayitlari").select("ders_programi_id").eq("ogrenci_id", session.user.id),
      ]);
      if (dErr) setError("Ders programı alınamadı: " + dErr.message);
      else setDersListe(d || []);
      if (sErr) setError((prev) => prev || "Sınav takvimi alınamadı: " + sErr.message);
      else setSinavListe(s || []);
      if (kErr) setError((prev) => prev || "Kayıtlı derslerin alınamadı: " + kErr.message);
      else setKayitliIdSet(new Set((k || []).map((row) => row.ders_programi_id)));

      await kisiselleriYukle(session.user.id);
      await takvimEtkinlikleriYukle(session.user.id);
      setLoading(false);
    }
    init();
  }, []);

  function hocaEslesiyorMu(hocaAdi) {
    if (!kendiAdi || !hocaAdi) return false;
    return hocaAdi.toLocaleLowerCase("tr-TR").includes(kendiAdi.toLocaleLowerCase("tr-TR")) || kendiAdi.toLocaleLowerCase("tr-TR").includes(hocaAdi.toLocaleLowerCase("tr-TR"));
  }

  // Aynı ders bazen birden fazla bölüme birlikte veriliyor (örn. "İşletme +
  // Uluslararası Ticaret" ortak oturumu) — bu durumda ders_programi'nde aynı
  // gün/saat/hoca için birden fazla satır bulunur (her bölüm için bir satır),
  // çünkü öğrenci tarafı bölüm/sınıfa göre filtreleniyor. Akademisyenin kendi
  // takviminde bu aynı dersin iki kez görünmesini istemiyoruz; bu yüzden
  // akademisyen görünümünde gün+saat+ders kodu+hoca aynı olan satırları tek
  // karta indirip bölüm adlarını birleştiriyoruz.
  function dersleriBirlestir(liste) {
    const gruplar = new Map();
    liste.forEach((d) => {
      const anahtar = [d.ders_kodu || d.ders_adi, d.gun, d.baslangic_saat, d.bitis_saat, (d.hoca_adi || "").toLocaleLowerCase("tr-TR")].join("|");
      const mevcut = gruplar.get(anahtar);
      if (!mevcut) gruplar.set(anahtar, { ...d, _bolumler: new Set([d.bolum].filter(Boolean)), _idler: [d.id] });
      else { if (d.bolum) mevcut._bolumler.add(d.bolum); mevcut._idler.push(d.id); }
    });
    return Array.from(gruplar.values()).map((d) => ({ ...d, bolum: Array.from(d._bolumler).join(" + ") }));
  }

  function sinavlariBirlestir(liste) {
    const gruplar = new Map();
    liste.forEach((s) => {
      const anahtar = [s.ders_kodu || s.ders_adi, s.tarih, s.saat, (s.hoca_adi || "").toLocaleLowerCase("tr-TR")].join("|");
      const mevcut = gruplar.get(anahtar);
      if (!mevcut) gruplar.set(anahtar, { ...s, _bolumler: new Set([s.bolum].filter(Boolean)) });
      else if (s.bolum) mevcut._bolumler.add(s.bolum);
    });
    return Array.from(gruplar.values()).map((s) => ({ ...s, bolum: Array.from(s._bolumler).join(" + ") }));
  }

  const temelFiltrelenmisDers = useMemo(() => {
    if (isAcademician) {
      const liste = dersListe.filter((d) => hocaEslesiyorMu(d.hoca_adi));
      return dersleriBirlestir(liste);
    }
    return dersListe.filter((d) => kayitliIdSet.has(d.id));
  }, [dersListe, kayitliIdSet, isAcademician, kendiAdi]);

  // Öğrenci için sınav takvimi, kayıtlı olduğu derslerin ders kodu + bölüm
  // eşleşmesine göre gösterilir (sinav_takvimi satırları doğrudan bir
  // ders_programi id'sine bağlı değil, yalnızca ders_kodu/bolum taşıyor).
  const kayitliDersKoduBolum = useMemo(() => {
    if (isAcademician) return new Set();
    return new Set(
      dersListe.filter((d) => kayitliIdSet.has(d.id) && d.ders_kodu).map((d) => `${d.ders_kodu}||${d.bolum}`)
    );
  }, [dersListe, kayitliIdSet, isAcademician]);

  const temelFiltrelenmisSinav = useMemo(() => {
    let liste = isAcademician
      ? sinavListe.filter((s) => hocaEslesiyorMu(s.hoca_adi))
      : sinavListe.filter((s) => kayitliDersKoduBolum.has(`${s.ders_kodu}||${s.bolum}`));
    if (isAcademician) liste = sinavlariBirlestir(liste);
    return [...liste].sort((a, b) => (a.tarih + a.saat).localeCompare(b.tarih + b.saat));
  }, [sinavListe, kayitliDersKoduBolum, isAcademician, kendiAdi]);

  const filtrelenmisDers = useMemo(() => {
    if (gizlenenleriGoster) return temelFiltrelenmisDers;
    return temelFiltrelenmisDers.filter((d) => !kisiselMap[`ders:${d.id}`]?.gizli);
  }, [temelFiltrelenmisDers, kisiselMap, gizlenenleriGoster]);

  const filtrelenmisSinav = useMemo(() => {
    if (gizlenenleriGoster) return temelFiltrelenmisSinav;
    return temelFiltrelenmisSinav.filter((s) => !kisiselMap[`sinav:${s.id}`]?.gizli);
  }, [temelFiltrelenmisSinav, kisiselMap, gizlenenleriGoster]);

  const cakisanSinavlar = useMemo(() => sinavCakismalariniBul(filtrelenmisSinav), [filtrelenmisSinav]);
  const yaklasanDers = useMemo(() => yaklasanDersiBul(filtrelenmisDers), [filtrelenmisDers]);
  const yaklasanSinav = useMemo(() => yaklasanSinaviBul(filtrelenmisSinav), [filtrelenmisSinav]);

  const gunlukProgram = useMemo(() => {
    const map = new Map(GUNLER.map((g) => [g, []]));
    filtrelenmisDers.forEach((d) => { if (map.has(d.gun)) map.get(d.gun).push(d); });
    map.forEach((list) => list.sort((a, b) => (a.baslangic_saat || "99:99").localeCompare(b.baslangic_saat || "99:99")));
    return map;
  }, [filtrelenmisDers]);

  const bugun = todayIso();
  const secimTamam = true;

  async function handleGizleAc(hedefTip, hedefId) {
    const anahtar = `${hedefTip}:${hedefId}`;
    const mevcut = kisiselMap[anahtar];
    setBusy(true);
    if (mevcut) {
      const { error: err } = await supabase.from("ders_sinav_kisisel").update({ gizli: !mevcut.gizli }).eq("id", mevcut.id);
      if (!err) setKisiselMap((prev) => ({ ...prev, [anahtar]: { ...mevcut, gizli: !mevcut.gizli } }));
    } else {
      const { data, error: err } = await supabase.from("ders_sinav_kisisel").insert([{ kullanici_id: userId, hedef_tip: hedefTip, hedef_id: hedefId, gizli: true }]).select().maybeSingle();
      if (!err && data) setKisiselMap((prev) => ({ ...prev, [anahtar]: data }));
    }
    setBusy(false);
  }

  async function handleDersGunDegistir(ders, yeniGun) {
    if (!isAcademician || busy) return;
    const idler = ders._idler && ders._idler.length ? ders._idler : [ders.id];
    if (ders.gun === yeniGun) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.from("ders_programi").update({ gun: yeniGun }).in("id", idler);
    if (err) {
      setError("Ders günü değiştirilemedi: " + err.message);
    } else {
      setDersListe((prev) => prev.map((d) => (idler.includes(d.id) ? { ...d, gun: yeniGun } : d)));
    }
    setBusy(false);
  }

  function saatDuzenlemeyeBasla(ders) {
    setSaatDuzenlemeAcik(ders.id);
    setSaatTaslak({ baslangic: ders.baslangic_saat || "", bitis: ders.bitis_saat || "" });
  }

  async function handleSaatKaydet(ders) {
    if (!saatTaslak.baslangic || !saatTaslak.bitis) { setError("Başlangıç ve bitiş saati gerekli."); return; }
    const idler = ders._idler && ders._idler.length ? ders._idler : [ders.id];
    setBusy(true); setError("");
    const { error: err } = await supabase.from("ders_programi").update({ baslangic_saat: saatTaslak.baslangic, bitis_saat: saatTaslak.bitis }).in("id", idler);
    if (err) {
      setError("Saat güncellenemedi: " + err.message);
    } else {
      setDersListe((prev) => prev.map((d) => (idler.includes(d.id) ? { ...d, baslangic_saat: saatTaslak.baslangic, bitis_saat: saatTaslak.bitis } : d)));
      setSaatDuzenlemeAcik(null);
    }
    setBusy(false);
  }

  function notDuzenlemeyeBasla(hedefTip, hedefId) {
    const anahtar = `${hedefTip}:${hedefId}`;
    setNotAcik(anahtar);
    setNotTaslak(kisiselMap[anahtar]?.not_metni || "");
  }

  async function handleNotKaydet(hedefTip, hedefId) {
    const anahtar = `${hedefTip}:${hedefId}`;
    const mevcut = kisiselMap[anahtar];
    setBusy(true);
    if (mevcut) {
      const { error: err } = await supabase.from("ders_sinav_kisisel").update({ not_metni: notTaslak.trim() || null }).eq("id", mevcut.id);
      if (!err) setKisiselMap((prev) => ({ ...prev, [anahtar]: { ...mevcut, not_metni: notTaslak.trim() || null } }));
    } else if (notTaslak.trim()) {
      const { data, error: err } = await supabase.from("ders_sinav_kisisel").insert([{ kullanici_id: userId, hedef_tip: hedefTip, hedef_id: hedefId, not_metni: notTaslak.trim() }]).select().maybeSingle();
      if (!err && data) setKisiselMap((prev) => ({ ...prev, [anahtar]: data }));
    }
    setNotAcik(null);
    setBusy(false);
  }

  function handleIcsIndir(tur) {
    if (tur === "ders") icsIndir(dersProgramindanIcsUret(filtrelenmisDers), "campuso-ders-programim.ics");
    else icsIndir(sinavTakvimindenIcsUret(filtrelenmisSinav), "campuso-sinav-takvimim.ics");
  }

  const takvimGunEtkinlikleri = useMemo(() => {
    const map = new Map();
    takvimEtkinlikleri.forEach((e) => {
      if (!map.has(e.tarih)) map.set(e.tarih, []);
      map.get(e.tarih).push(e);
    });
    return map;
  }, [takvimEtkinlikleri]);

  const takvimIzgara = useMemo(() => ayIzgarasiUret(takvimYil, takvimAy), [takvimYil, takvimAy]);
  const secilenGunEtkinlikleri = takvimGunEtkinlikleri.get(secilenGun) || [];

  function ayDegistir(fark) {
    let yeniAy = takvimAy + fark;
    let yeniYil = takvimYil;
    if (yeniAy < 0) { yeniAy = 11; yeniYil -= 1; }
    if (yeniAy > 11) { yeniAy = 0; yeniYil += 1; }
    setTakvimAy(yeniAy);
    setTakvimYil(yeniYil);
  }

  async function handleEtkinlikEkle(e) {
    e.preventDefault();
    if (!yeniBaslik.trim()) return;
    setBusy(true); setError("");
    const { data, error: err } = await supabase.from("kisisel_takvim_etkinlikleri").insert([{
      kullanici_id: userId, tarih: secilenGun, tur: yeniTur, baslik: yeniBaslik.trim(), saat: yeniSaat || null,
    }]).select().maybeSingle();
    if (err) setError("Etkinlik eklenemedi: " + err.message);
    else if (data) { setTakvimEtkinlikleri((prev) => [...prev, data]); setYeniBaslik(""); setYeniSaat(""); }
    setBusy(false);
  }

  async function handleEtkinlikSil(id) {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("kisisel_takvim_etkinlikleri").delete().eq("id", id);
    if (err) setError("Silinemedi: " + err.message);
    else setTakvimEtkinlikleri((prev) => prev.filter((e) => e.id !== id));
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={roleHref} style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>VOL 1-8 · DERS VE SINAV TAKVİMİ</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Ders Programı & Sınav Takvimi</span>
              <span style={{ fontSize: 10.5, fontWeight: 800, padding: "3px 8px", borderRadius: 999, background: "#e3faf0", color: "#0b8f5c" }}>{aktifDonem === "guz" ? "Güz Dönemi" : "Bahar Dönemi"}</span>
            </div>
          </div>
        </div>
        <Link href={roleHref} style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid #c7deff", color: "#0e4bae" }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(900px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        {error ? (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{error}</div>
        ) : null}

        {!loading && secimTamam && (yaklasanDers || yaklasanSinav) && (
          <section style={{ background: "linear-gradient(135deg, #0e4bae, #175cd3)", borderRadius: 16, padding: 18, marginBottom: 18, color: "#fff", display: "grid", gap: 6 }}>
            {yaklasanDers && yaklasanDers.farkDk < 60 * 24 * 2 ? (
              <div style={{ fontSize: 13, fontWeight: 700 }}>📚 {yaklasanDers.farkDk < 0 ? "" : yaklasanDers.farkDk < 60 ? `${yaklasanDers.farkDk} dk sonra` : gunFarkiMetni(new Date(yaklasanDers.tarih))} — {yaklasanDers.ders.ders_adi} ({yaklasanDers.ders.baslangic_saat}{yaklasanDers.ders.derslik ? `, ${yaklasanDers.ders.derslik}` : ""})</div>
            ) : null}
            {yaklasanSinav ? (
              <div style={{ fontSize: 13, fontWeight: 700 }}>📝 {gunFarkiMetni(new Date(yaklasanSinav.tarih))} — {yaklasanSinav.sinav.sinav_turu}: {yaklasanSinav.sinav.ders_adi} ({yaklasanSinav.sinav.saat})</div>
            ) : null}
          </section>
        )}

        {!isAcademician && (
          <section style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: "14px 18px", marginBottom: 20, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "#5b6b85" }}>
              {kayitliIdSet.size > 0
                ? `${kayitliIdSet.size} derse kayıtlısın. Ders programın ve sınav takvimin bunlara göre gösteriliyor.`
                : "Henüz hiç ders eklemedin — ders programın ve sınav takvimin şu an boş görünüyor."}
            </span>
            <Link href="/student/ders-kayit" style={{ minHeight: 36, padding: "0 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 10, background: "#175cd3", color: "#fff" }}>
              {kayitliIdSet.size > 0 ? "Ders Ekle/Çıkar" : "Ders Seç →"}
            </Link>
          </section>
        )}

        {isAcademician && (
          <section style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: "14px 18px", marginBottom: 20, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, color: "#8fa0bc" }}>Öğretim üyesi adınla eşleşen ders/sınavlar otomatik listelenir. Ders kartını gün sütunları arasında sürükleyip bırakarak günü değiştirebilir, saatine tıklayarak saatini düzenleyebilirsiniz.</span>
          </section>
        )}

        {loading ? (
          <p style={{ color: "#5b6b85" }}>Yükleniyor…</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" onClick={() => setTab("ders")} style={{ padding: "10px 18px", borderRadius: 999, border: tab === "ders" ? "1px solid #175cd3" : "1px solid #e3ebf6", background: tab === "ders" ? "#175cd3" : "#fff", color: tab === "ders" ? "#fff" : "#5b6b85", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Ders Programı</button>
              <button type="button" onClick={() => setTab("sinav")} style={{ padding: "10px 18px", borderRadius: 999, border: tab === "sinav" ? "1px solid #175cd3" : "1px solid #e3ebf6", background: tab === "sinav" ? "#175cd3" : "#fff", color: tab === "sinav" ? "#fff" : "#5b6b85", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                Sınav Takvimi {filtrelenmisSinav.length > 0 ? `(${filtrelenmisSinav.length})` : ""}
              </button>
              <button type="button" onClick={() => setTab("takvim")} style={{ padding: "10px 18px", borderRadius: 999, border: tab === "takvim" ? "1px solid #175cd3" : "1px solid #e3ebf6", background: tab === "takvim" ? "#175cd3" : "#fff", color: tab === "takvim" ? "#fff" : "#5b6b85", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                🗓️ Takvimim {takvimEtkinlikleri.length > 0 ? `(${takvimEtkinlikleri.length})` : ""}
              </button>
              <div style={{ flex: 1 }} />
              {tab !== "takvim" && (
                <>
                  <button type="button" onClick={() => setGizlenenleriGoster((p) => !p)} style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>
                    {gizlenenleriGoster ? "Gizlenenleri Gizle" : "Gizlenenleri Göster"}
                  </button>
                  <button type="button" onClick={() => handleIcsIndir(tab)} style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #c7deff", background: "#fff", color: "#0e4bae", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>
                    📅 Takvime Aktar (.ics)
                  </button>
                </>
              )}
            </div>

            {tab === "takvim" && (
              <section>
                <div style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 18, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <button type="button" onClick={() => ayDegistir(-1)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e3ebf6", background: "#fff", cursor: "pointer", fontSize: 14 }}>←</button>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{AY_ADLARI[takvimAy]} {takvimYil}</div>
                    <button type="button" onClick={() => ayDegistir(1)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e3ebf6", background: "#fff", cursor: "pointer", fontSize: 14 }}>→</button>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                    {Object.entries(TAKVIM_TURLERI).map(([anahtar, tur]) => (
                      <div key={anahtar} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#5b6b85" }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: tur.color, display: "inline-block" }} />
                        {tur.label}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
                    {GUN_KISALTMALARI.map((g) => (
                      <div key={g} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 800, color: "#8fa0bc" }}>{g}</div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                    {takvimIzgara.flat().map((gun, idx) => {
                      if (gun === null) return <div key={idx} />;
                      const iso = tarihIso(takvimYil, takvimAy, gun);
                      const etkinlikler = takvimGunEtkinlikleri.get(iso) || [];
                      const buGunMu = iso === bugunIso();
                      const seciliMi = iso === secilenGun;
                      const baskinTur = etkinlikler.length ? (TUR_ONCELIK.find((t) => etkinlikler.some((e) => e.tur === t)) || etkinlikler[0].tur) : null;
                      const digerTurler = baskinTur ? Array.from(new Set(etkinlikler.map((e) => e.tur))).filter((t) => t !== baskinTur) : [];
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSecilenGun(iso)}
                          style={{
                            minHeight: 56, borderRadius: 10, padding: "6px 4px", textAlign: "left", cursor: "pointer",
                            border: seciliMi ? "2px solid #175cd3" : baskinTur ? "1px solid transparent" : buGunMu ? "1px solid #175cd3" : "1px solid #e3ebf6",
                            outline: buGunMu ? "2px solid #175cd3" : "none", outlineOffset: -2,
                            background: baskinTur ? TAKVIM_TURLERI[baskinTur].color : seciliMi ? "#eef5ff" : "#fff",
                            display: "flex", flexDirection: "column", gap: 3,
                          }}
                        >
                          <span style={{ fontSize: 11, fontWeight: buGunMu || baskinTur ? 800 : 600, color: baskinTur ? "#fff" : buGunMu ? "#175cd3" : "#0f1b33" }}>{gun}</span>
                          {digerTurler.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                              {digerTurler.slice(0, 3).map((t) => (
                                <span key={t} style={{ width: 6, height: 6, borderRadius: "50%", background: TAKVIM_TURLERI[t]?.color || "#8fa0bc", border: "1px solid #fff", display: "inline-block" }} />
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>
                    {new Date(secilenGun).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", weekday: "long" })}
                  </div>

                  {secilenGunEtkinlikleri.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: "#8fa0bc", marginBottom: 14 }}>Bu tarihte henüz bir etkinlik yok.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
                      {secilenGunEtkinlikleri.map((e) => {
                        const tur = TAKVIM_TURLERI[e.tur] || TAKVIM_TURLERI.diger;
                        return (
                          <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: tur.bg, flexWrap: "wrap" }}>
                            <div>
                              <span style={{ fontSize: 10.5, fontWeight: 800, color: tur.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{tur.label}</span>
                              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{e.baslik}{e.saat ? <span style={{ fontWeight: 500, color: "#5b6b85" }}> · {e.saat}</span> : null}</div>
                            </div>
                            <button onClick={() => handleEtkinlikSil(e.id)} disabled={busy} style={{ minHeight: 26, padding: "0 10px", fontSize: 10.5, fontWeight: 700, borderRadius: 7, border: "1px solid #f2c5ba", background: "#fff", color: "#984333", cursor: "pointer" }}>Sil</button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <form onSubmit={handleEtkinlikEkle} style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
                    <select style={inputStyle} value={yeniTur} onChange={(e) => setYeniTur(e.target.value)}>
                      {Object.entries(TAKVIM_TURLERI).map(([anahtar, tur]) => <option key={anahtar} value={anahtar}>{tur.label}</option>)}
                    </select>
                    <input style={{ ...inputStyle, gridColumn: "span 2" }} placeholder="Örn. Financial Data Analysis sunumu" maxLength={140} value={yeniBaslik} onChange={(e) => setYeniBaslik(e.target.value)} />
                    <input style={inputStyle} type="time" value={yeniSaat} onChange={(e) => setYeniSaat(e.target.value)} />
                    <button type="submit" disabled={busy || !yeniBaslik.trim()} className="button button-primary" style={{ minHeight: 42, padding: "0 16px", fontSize: 12.5 }}>Ekle</button>
                  </form>
                </div>
              </section>
            )}

            {tab === "ders" && secimTamam && (
              filtrelenmisDers.length === 0 ? (
                <div style={{ padding: 28, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>
                  {isAcademician ? "Sana atanmış bir ders bulunamadı." : (
                    <>Henüz kayıtlı dersin yok. <Link href="/student/ders-kayit" style={{ color: "#175cd3", fontWeight: 700 }}>Ders Kayıt'tan seç →</Link></>
                  )}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                  {GUNLER.map((gun) => (
                    <div
                      key={gun}
                      onDragOver={isAcademician ? (e) => { e.preventDefault(); } : undefined}
                      onDrop={isAcademician ? (e) => {
                        e.preventDefault();
                        const surukleneD = filtrelenmisDers.find((d) => d.id === suruklenenDersId);
                        if (surukleneD) handleDersGunDegistir(surukleneD, gun);
                        setSuruklenenDersId(null);
                      } : undefined}
                      style={{ background: "#fff", border: suruklenenDersId ? "1px dashed #175cd3" : "1px solid #e3ebf6", borderRadius: 14, padding: 12, minHeight: 80 }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: "#175cd3", marginBottom: 8 }}>{gun.toUpperCase()}</div>
                      {gunlukProgram.get(gun).length === 0 ? (
                        <div style={{ fontSize: 11, color: "#c3cee0" }}>—</div>
                      ) : (
                        <div style={{ display: "grid", gap: 8 }}>
                          {gunlukProgram.get(gun).map((d) => {
                            const anahtar = `ders:${d.id}`;
                            const kisisel = kisiselMap[anahtar];
                            return (
                              <div
                                key={d.id}
                                draggable={isAcademician}
                                onDragStart={isAcademician ? () => setSuruklenenDersId(d.id) : undefined}
                                onDragEnd={isAcademician ? () => setSuruklenenDersId(null) : undefined}
                                style={{ padding: "8px 10px", borderRadius: 10, background: kisisel?.gizli ? "#f5f8fc" : "#f5f8fc", border: "1px solid #e3ebf6", opacity: kisisel?.gizli ? 0.5 : suruklenenDersId === d.id ? 0.4 : 1, cursor: isAcademician ? "grab" : "default" }}
                              >
                                {saatDuzenlemeAcik === d.id ? (
                                  <div style={{ display: "grid", gap: 5 }}>
                                    <div style={{ display: "flex", gap: 5 }}>
                                      <input type="time" style={{ ...inputStyle, height: 28, fontSize: 10.5, padding: "0 6px" }} value={saatTaslak.baslangic} onChange={(e) => setSaatTaslak((p) => ({ ...p, baslangic: e.target.value }))} />
                                      <input type="time" style={{ ...inputStyle, height: 28, fontSize: 10.5, padding: "0 6px" }} value={saatTaslak.bitis} onChange={(e) => setSaatTaslak((p) => ({ ...p, bitis: e.target.value }))} />
                                    </div>
                                    <div style={{ display: "flex", gap: 6 }}>
                                      <button onClick={() => handleSaatKaydet(d)} disabled={busy} style={{ fontSize: 9.5, fontWeight: 700, border: "none", background: "#175cd3", color: "#fff", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>Kaydet</button>
                                      <button onClick={() => setSaatDuzenlemeAcik(null)} style={{ fontSize: 9.5, fontWeight: 700, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>Vazgeç</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    style={{ fontSize: 11, fontWeight: 700, color: d.baslangic_saat && d.bitis_saat ? "#0e4bae" : "#8fa0bc", cursor: isAcademician ? "pointer" : "default" }}
                                    onClick={isAcademician ? () => saatDuzenlemeyeBasla(d) : undefined}
                                    title={isAcademician ? "Saati düzenlemek için tıklayın" : undefined}
                                  >
                                    {d.baslangic_saat && d.bitis_saat ? `${d.baslangic_saat}–${d.bitis_saat}` : "Saat girilmedi"}{isAcademician ? " ✎" : ""}
                                  </div>
                                )}
                                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>{d.ders_adi}</div>
                                {(d.derslik || d.hoca_adi) && (
                                  <div style={{ fontSize: 10, color: "#5b6b85", marginTop: 2 }}>{[d.derslik, d.hoca_adi].filter(Boolean).join(" · ")}</div>
                                )}
                                {kisisel?.not_metni && notAcik !== anahtar && (
                                  <div style={{ fontSize: 10, color: "#8a5a12", background: "#fff8ec", borderRadius: 6, padding: "3px 6px", marginTop: 5 }}>📌 {kisisel.not_metni}</div>
                                )}
                                {notAcik === anahtar ? (
                                  <div style={{ marginTop: 5 }}>
                                    <input style={{ ...inputStyle, height: 28, fontSize: 10.5 }} maxLength={500} value={notTaslak} onChange={(e) => setNotTaslak(e.target.value)} placeholder="Kişisel not…" />
                                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                      <button onClick={() => handleNotKaydet("ders", d.id)} disabled={busy} style={{ fontSize: 9.5, fontWeight: 700, border: "none", background: "#175cd3", color: "#fff", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>Kaydet</button>
                                      <button onClick={() => setNotAcik(null)} style={{ fontSize: 9.5, fontWeight: 700, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>Vazgeç</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
                                    <button onClick={() => notDuzenlemeyeBasla("ders", d.id)} style={{ fontSize: 9.5, fontWeight: 700, border: "none", background: "none", color: "#175cd3", cursor: "pointer", padding: 0 }}>{kisisel?.not_metni ? "Notu Düzenle" : "Not Ekle"}</button>
                                    <button onClick={() => handleGizleAc("ders", d.id)} disabled={busy} title={isAcademician ? "Bu ders adınla otomatik eşleşti ama size ait değilse listeden çıkarabilirsiniz" : undefined} style={{ fontSize: 9.5, fontWeight: 700, border: "none", background: "none", color: "#8fa0bc", cursor: "pointer", padding: 0 }}>
                                      {kisisel?.gizli ? "Tekrar Göster" : isAcademician ? "Bu ders bana ait değil, çıkar" : "Gizle"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === "sinav" && secimTamam && (
              filtrelenmisSinav.length === 0 ? (
                <div style={{ padding: 28, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>
                  {isAcademician ? "Sana atanmış bir sınav bulunamadı." : (
                    <>Kayıtlı derslerin için henüz sınav girilmemiş. <Link href="/student/ders-kayit" style={{ color: "#175cd3", fontWeight: 700 }}>Ders Kayıt'tan seç →</Link></>
                  )}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {filtrelenmisSinav.map((s) => {
                    const anahtar = `sinav:${s.id}`;
                    const kisisel = kisiselMap[anahtar];
                    const gecmisMi = s.tarih < bugun;
                    const cakisiyorMu = cakisanSinavlar.has(s.id);
                    const renk = SINAV_RENK[s.sinav_turu] || { color: "#5b6b85", bg: "#f5f8fc" };
                    return (
                      <div key={s.id} style={{ background: "#fff", border: cakisiyorMu ? "1px solid #ef5c63" : "1px solid #e3ebf6", borderRadius: 14, padding: 16, opacity: gecmisMi ? 0.55 : kisisel?.gizli ? 0.5 : 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 14 }}>{s.ders_adi} {s.ders_kodu ? <span style={{ fontWeight: 500, color: "#5b6b85" }}>({s.ders_kodu})</span> : null}</div>
                            <div style={{ fontSize: 12, color: "#5b6b85", marginTop: 4 }}>
                              {new Date(s.tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })} · {s.saat} {s.derslik ? `· ${s.derslik}` : ""} {s.hoca_adi ? `· ${s.hoca_adi}` : ""}
                            </div>
                            {cakisiyorMu && <div style={{ fontSize: 11, fontWeight: 800, color: "#ef5c63", marginTop: 4 }}>⚠️ Başka bir sınavla çakışıyor!</div>}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 800, color: renk.color, background: renk.bg, padding: "5px 12px", borderRadius: 999 }}>{s.sinav_turu}</span>
                        </div>
                        {kisisel?.not_metni && notAcik !== anahtar && (
                          <div style={{ fontSize: 11, color: "#8a5a12", background: "#fff8ec", borderRadius: 8, padding: "5px 10px", marginTop: 8 }}>📌 {kisisel.not_metni}</div>
                        )}
                        {notAcik === anahtar ? (
                          <div style={{ marginTop: 8 }}>
                            <input style={{ ...inputStyle, height: 32, fontSize: 12 }} maxLength={500} value={notTaslak} onChange={(e) => setNotTaslak(e.target.value)} placeholder="Kişisel not…" />
                            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                              <button onClick={() => handleNotKaydet("sinav", s.id)} disabled={busy} style={{ fontSize: 11, fontWeight: 700, border: "none", background: "#175cd3", color: "#fff", borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>Kaydet</button>
                              <button onClick={() => setNotAcik(null)} style={{ fontSize: 11, fontWeight: 700, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>Vazgeç</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                            <button onClick={() => notDuzenlemeyeBasla("sinav", s.id)} style={{ fontSize: 11, fontWeight: 700, border: "none", background: "none", color: "#175cd3", cursor: "pointer", padding: 0 }}>{kisisel?.not_metni ? "Notu Düzenle" : "Not Ekle"}</button>
                            <button onClick={() => handleGizleAc("sinav", s.id)} disabled={busy} style={{ fontSize: 11, fontWeight: 700, border: "none", background: "none", color: "#8fa0bc", cursor: "pointer", padding: 0 }}>
                              {kisisel?.gizli ? "Tekrar Göster" : isAcademician ? "Bu sınav bana ait değil, çıkar" : "Gizle"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </>
        )}
      </main>
    </div>
  );
}
