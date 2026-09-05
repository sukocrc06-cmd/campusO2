"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { heroGradient } from "../../../lib/profil-secenekleri";
import { YOKLAMA_DURUMLARI, devamYuzdesiHesapla, rosterBirlestir, ekstraDahilEdilenler } from "../../../lib/yoklama";

const inputStyle = { height: 40, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 10, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };

function baslangicHarfi(isim) {
  return (isim || "?").trim().charAt(0).toUpperCase() || "?";
}

function Avatar({ profil, size = 32 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flex: "none", background: heroGradient(profil?.hero_renk), display: "grid", placeItems: "center", overflow: "hidden" }}>
      {profil?.avatar_url ? (
        <img src={profil.avatar_url} alt={profil.full_name || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ color: "#fff", fontWeight: 800, fontSize: size * 0.4 }}>{baslangicHarfi(profil?.full_name)}</span>
      )}
    </div>
  );
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Aynı hoca aynı fiziksel dersi (aynı gün/saat/ders kodu/dönem) birden fazla
// bölüme veriyorsa, ders_programi'nda birden fazla satır olarak durur (bkz.
// Ali İhsan hocanın BUS201 İstatistik 1 dersi). Dropdown'da bunları TEK,
// birleşik bir seçenek olarak gösteriyoruz; her zaman aynı (en küçük id'li)
// satırı "kanonik" seçip kullanıyoruz ki yoklama oturumları hep aynı id
// altında birikip, hangi bölüm satırının seçildiğine göre bölünmesin.
function birlesikDersGrupla(dersler) {
  const gruplar = new Map();
  (dersler || []).forEach((d) => {
    const anahtar = [d.akademisyen_id, d.ders_kodu || d.ders_adi, d.gun, d.baslangic_saat, d.bitis_saat, d.donem].join("||");
    if (!gruplar.has(anahtar)) gruplar.set(anahtar, []);
    gruplar.get(anahtar).push(d);
  });
  return Array.from(gruplar.values())
    .map((grup) => {
      const sirali = [...grup].sort((a, b) => a.id.localeCompare(b.id));
      const kanonik = sirali[0];
      const bolumler = Array.from(new Set(grup.map((d) => d.bolum).filter(Boolean)));
      return { ...kanonik, bolumEtiket: bolumler.join(" + ") };
    })
    .sort((a, b) => (a.ders_adi || "").localeCompare(b.ders_adi || "", "tr-TR"));
}

export default function AkademisyenYoklamaPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState(null);

  const [dersler, setDersler] = useState([]);
  const [secilenDersId, setSecilenDersId] = useState("");
  const [esikTaslak, setEsikTaslak] = useState(70);

  const [tarih, setTarih] = useState(todayIso());
  const [varsayilanRoster, setVarsayilanRoster] = useState([]);
  const [overrideler, setOverrideler] = useState([]);
  const [ekProfilMap, setEkProfilMap] = useState({});
  const [oturumId, setOturumId] = useState(null);
  const [kayitDurumlari, setKayitDurumlari] = useState({}); // ogrenci_id -> durum

  const [tumKayitlar, setTumKayitlar] = useState([]); // dersin tüm oturumlarına ait tüm kayıtlar (istatistik için)
  const [oturumGecmisi, setOturumGecmisi] = useState([]);
  const [qrOturumIdSeti, setQrOturumIdSeti] = useState(new Set());

  const [aramaMetni, setAramaMetni] = useState("");
  const [aramaSonuc, setAramaSonuc] = useState([]);

  const birlesikDersler = useMemo(() => birlesikDersGrupla(dersler), [dersler]);
  const secilenDers = dersler.find((d) => d.id === secilenDersId) || null;

  async function derslerYukle(uid) {
    const { data: donemSatiri } = await supabase.from("aktif_donem").select("donem").eq("id", true).maybeSingle();
    const guncelDonem = donemSatiri?.donem || "bahar";
    const { data, error: err } = await supabase.from("ders_programi").select("*").eq("akademisyen_id", uid).eq("donem", guncelDonem).order("ders_adi");
    if (err) { setError("Derslerin alınamadı: " + err.message); return; }
    setDersler(data || []);
    const birlesik = birlesikDersGrupla(data || []);
    if (birlesik.length > 0 && !secilenDersId) setSecilenDersId(birlesik[0].id);
  }

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
      if (profile?.role !== "academician") { setError("Bu sayfa yalnız akademisyenler içindir."); setLoading(false); return; }
      setUserId(session.user.id);
      await derslerYukle(session.user.id);
      setLoading(false);
    }
    init();
  }, []);

  async function dersDetaylariniYukle(ders) {
    if (!ders) return;
    setEsikTaslak(ders.asgari_devam_yuzdesi ?? 70);

    const [{ data: varsayilan }, { data: over }] = await Promise.all([
      supabase.rpc("campuso_ders_kayitli_ogrenciler", { p_ders_id: ders.id }),
      supabase.from("yoklama_ogrenci_override").select("*").eq("ders_programi_id", ders.id),
    ]);
    setVarsayilanRoster(varsayilan || []);
    setOverrideler(over || []);

    const ekstralar = ekstraDahilEdilenler(over || [], new Set((varsayilan || []).map((v) => v.id)));
    if (ekstralar.length > 0) {
      const { data: ekProfiller } = await supabase.rpc("campuso_get_profiller", { p_user_ids: ekstralar.map((e) => e.ogrenci_id) });
      const map = {};
      (ekProfiller || []).forEach((p) => { map[p.id] = p; });
      setEkProfilMap(map);
    } else {
      setEkProfilMap({});
    }

    const { data: tumOturumlar } = await supabase.from("yoklama_oturumlari").select("*").eq("ders_programi_id", ders.id).order("tarih", { ascending: false });
    setOturumGecmisi(tumOturumlar || []);
    const oturumIdler = (tumOturumlar || []).map((o) => o.id);
    if (oturumIdler.length > 0) {
      const [{ data: kayitlar }, { data: qrOturumlar }] = await Promise.all([
        supabase.from("yoklama_kayitlari").select("*").in("oturum_id", oturumIdler),
        supabase.from("yoklama_qr_oturumlari").select("oturum_id").in("oturum_id", oturumIdler),
      ]);
      setTumKayitlar(kayitlar || []);
      setQrOturumIdSeti(new Set((qrOturumlar || []).map((q) => q.oturum_id)));
    } else {
      setTumKayitlar([]);
      setQrOturumIdSeti(new Set());
    }
  }

  useEffect(() => {
    if (secilenDers) dersDetaylariniYukle(secilenDers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secilenDersId]);

  async function oturumVeKayitlariYukle() {
    if (!secilenDers) return;
    const { data: oturum } = await supabase.from("yoklama_oturumlari").select("*").eq("ders_programi_id", secilenDers.id).eq("tarih", tarih).maybeSingle();
    if (oturum) {
      setOturumId(oturum.id);
      const { data: kayitlar } = await supabase.from("yoklama_kayitlari").select("*").eq("oturum_id", oturum.id);
      const map = {};
      (kayitlar || []).forEach((k) => { map[k.ogrenci_id] = k.durum; });
      setKayitDurumlari(map);
    } else {
      setOturumId(null);
      setKayitDurumlari({});
    }
  }

  useEffect(() => {
    oturumVeKayitlariYukle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secilenDersId, tarih]);

  const roster = useMemo(() => {
    const temel = rosterBirlestir(varsayilanRoster, overrideler);
    const ekstralar = ekstraDahilEdilenler(overrideler, new Set(varsayilanRoster.map((v) => v.id))).map((e) => ekProfilMap[e.ogrenci_id]).filter(Boolean);
    return [...temel, ...ekstralar].sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "", "tr"));
  }, [varsayilanRoster, overrideler, ekProfilMap]);

  const devamsizOgrenciler = useMemo(() => {
    if (!secilenDers) return [];
    const gruplu = new Map();
    tumKayitlar.forEach((k) => {
      if (!gruplu.has(k.ogrenci_id)) gruplu.set(k.ogrenci_id, []);
      gruplu.get(k.ogrenci_id).push(k);
    });
    const esik = secilenDers.asgari_devam_yuzdesi ?? 70;
    const sonuc = [];
    gruplu.forEach((kayitlar, ogrenciId) => {
      const yuzde = devamYuzdesiHesapla(kayitlar);
      if (yuzde !== null && yuzde < esik) {
        const profil = roster.find((r) => r.id === ogrenciId);
        sonuc.push({ ogrenciId, yuzde, profil });
      }
    });
    return sonuc.sort((a, b) => a.yuzde - b.yuzde);
  }, [tumKayitlar, secilenDers, roster]);

  async function handleEsikKaydet() {
    if (!secilenDers) return;
    setBusy(true); setError(""); setMessage("");
    const { error: err } = await supabase.from("ders_programi").update({ asgari_devam_yuzdesi: Number(esikTaslak) }).eq("id", secilenDers.id);
    if (err) setError("Eşik kaydedilemedi: " + err.message);
    else { setMessage("Devam eşiği güncellendi."); await derslerYukle(userId); }
    setBusy(false);
  }

  function handleDurumDegistir(ogrenciId, durum) {
    setKayitDurumlari((prev) => ({ ...prev, [ogrenciId]: durum }));
  }

  async function handleYoklamaKaydet() {
    if (!secilenDers) return;
    setBusy(true); setError(""); setMessage("");
    let oturum = oturumId;
    if (!oturum) {
      const { data, error: err } = await supabase.from("yoklama_oturumlari").insert([{ ders_programi_id: secilenDers.id, tarih, olusturan_id: userId }]).select().maybeSingle();
      if (err) { setError("Oturum oluşturulamadı: " + err.message); setBusy(false); return; }
      oturum = data.id;
      setOturumId(oturum);
    }
    const satirlar = roster.map((ogrenci) => ({ oturum_id: oturum, ogrenci_id: ogrenci.id, durum: kayitDurumlari[ogrenci.id] || "yok" }));
    const { error: err } = await supabase.from("yoklama_kayitlari").upsert(satirlar, { onConflict: "oturum_id,ogrenci_id" });
    if (err) setError("Yoklama kaydedilemedi: " + err.message);
    else { setMessage("Yoklama kaydedildi."); await dersDetaylariniYukle(secilenDers); }
    setBusy(false);
  }

  async function handeOgrenciCikar(ogrenciId) {
    if (!secilenDers) return;
    setBusy(true); setError("");
    const mevcutOverride = overrideler.find((o) => o.ogrenci_id === ogrenciId);
    if (mevcutOverride) {
      await supabase.from("yoklama_ogrenci_override").update({ dahil: false }).eq("id", mevcutOverride.id);
    } else {
      await supabase.from("yoklama_ogrenci_override").insert([{ ders_programi_id: secilenDers.id, ogrenci_id: ogrenciId, dahil: false }]);
    }
    await dersDetaylariniYukle(secilenDers);
    setBusy(false);
  }

  async function handleOgrenciEkle(ogrenciId) {
    if (!secilenDers) return;
    setBusy(true); setError("");
    const mevcutOverride = overrideler.find((o) => o.ogrenci_id === ogrenciId);
    if (mevcutOverride) {
      await supabase.from("yoklama_ogrenci_override").update({ dahil: true }).eq("id", mevcutOverride.id);
    } else {
      await supabase.from("yoklama_ogrenci_override").insert([{ ders_programi_id: secilenDers.id, ogrenci_id: ogrenciId, dahil: true }]);
    }
    setAramaMetni(""); setAramaSonuc([]);
    await dersDetaylariniYukle(secilenDers);
    setBusy(false);
  }

  async function handleAra(metin) {
    setAramaMetni(metin);
    if (!metin.trim()) { setAramaSonuc([]); return; }
    const { data } = await supabase.rpc("campuso_profil_ara", { p_arama: metin.trim() });
    setAramaSonuc((data || []).filter((p) => p.role === "student"));
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=faculty" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>VOL 1-12 · YOKLAMA TAKİBİ</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Yoklama Al</div>
          </div>
        </div>
        <Link href="/?role=faculty" style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid #c7deff", color: "#0e4bae" }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(760px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        {error ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}
        {message ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#effbf6", border: "1px solid #bde5d5", color: "#0b5c42", fontSize: 13, fontWeight: 600 }}>{message}</div> : null}

        {loading ? (
          <p style={{ color: "#5b6b85" }}>Yükleniyor…</p>
        ) : dersler.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>
            Sana atanmış bir ders bulunamadı. Admin'den ders programında bu dersin öğretim üyesi olarak seni atamasını iste.
          </div>
        ) : (
          <>
            <section style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 18, marginBottom: 16, display: "grid", gap: 12, gridTemplateColumns: "2fr 1fr" }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#5b6b85", display: "flex", flexDirection: "column", gap: 5 }}>Ders
                <select style={inputStyle} value={secilenDersId} onChange={(e) => setSecilenDersId(e.target.value)}>
                  {birlesikDersler.map((d) => <option key={d.id} value={d.id}>{d.ders_adi} — {d.bolumEtiket}{d.sinif ? ` / ${d.sinif}. sınıf` : ""}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#5b6b85", display: "flex", flexDirection: "column", gap: 5 }}>Tarih
                <input style={inputStyle} type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} />
              </label>
            </section>

            {secilenDers && (
              <section style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#5b6b85" }}>Asgari devam yüzdesi:</span>
                <input type="number" min={0} max={100} value={esikTaslak} onChange={(e) => setEsikTaslak(e.target.value)} style={{ width: 70, height: 32, padding: "0 8px", border: "1px solid #e3ebf6", borderRadius: 8, fontSize: 12.5 }} />
                <button onClick={handleEsikKaydet} disabled={busy} style={{ minHeight: 32, padding: "0 12px", fontSize: 11.5, fontWeight: 700, borderRadius: 8, border: "none", background: "#175cd3", color: "#fff", cursor: "pointer" }}>Kaydet</button>
              </section>
            )}

            {devamsizOgrenciler.length > 0 && (
              <section style={{ background: "#fff4f0", border: "1px solid #f2c5ba", borderRadius: 16, padding: 18, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#984333", marginBottom: 10 }}>⚠️ Eşiğin altında ({devamsizOgrenciler.length})</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {devamsizOgrenciler.map((d) => (
                    <div key={d.ogrenciId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                      <Avatar profil={d.profil} size={24} />
                      <b>{d.profil?.full_name || "Öğrenci"}</b>
                      <span style={{ color: "#984333", fontWeight: 700 }}>%{d.yuzde}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 18, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>Yoklama — {new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}</div>
                <button onClick={handleYoklamaKaydet} disabled={busy || roster.length === 0} className="button button-primary" style={{ minHeight: 38, padding: "0 16px", fontSize: 12.5 }}>{busy ? "…" : "Yoklamayı Kaydet"}</button>
              </div>

              {roster.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "#8fa0bc" }}>Bu derse henüz kayıt yaptıran öğrenci yok. Öğrenciler Ders Kayıt sayfasından bu dersi seçtiğinde burada otomatik görünür — ya da aşağıdan öğrenci arayıp elle ekleyebilirsin.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {roster.map((ogrenci) => {
                    const durum = kayitDurumlari[ogrenci.id] || "yok";
                    return (
                      <div key={ogrenci.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "#f5f8fc", flexWrap: "wrap" }}>
                        <Avatar profil={ogrenci} />
                        <b style={{ fontSize: 12.5, flex: 1, minWidth: 120 }}>{ogrenci.full_name || "Öğrenci"}</b>
                        <div style={{ display: "flex", gap: 4 }}>
                          {Object.entries(YOKLAMA_DURUMLARI).map(([anahtar, d]) => (
                            <button key={anahtar} type="button" onClick={() => handleDurumDegistir(ogrenci.id, anahtar)} style={{ fontSize: 10.5, fontWeight: 700, padding: "5px 9px", borderRadius: 7, cursor: "pointer", border: durum === anahtar ? `1px solid ${d.color}` : "1px solid #e3ebf6", background: durum === anahtar ? d.bg : "#fff", color: durum === anahtar ? d.color : "#8fa0bc" }}>{d.label}</button>
                          ))}
                        </div>
                        <button type="button" onClick={() => handeOgrenciCikar(ogrenci.id)} disabled={busy} style={{ fontSize: 10.5, border: "none", background: "none", color: "#8fa0bc", cursor: "pointer", fontWeight: 700 }}>Çıkar</button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #e3ebf6" }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#5b6b85" }}>Derse kayıtlı olmayan bir öğrenciyi elle ekle (isimle ara)
                  <input style={{ ...inputStyle, marginTop: 6 }} value={aramaMetni} onChange={(e) => handleAra(e.target.value)} placeholder="İsim yaz…" />
                </label>
                {aramaSonuc.length > 0 && (
                  <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    {aramaSonuc.map((p) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        <Avatar profil={p} size={24} />
                        <span style={{ flex: 1 }}>{p.full_name}</span>
                        <button onClick={() => handleOgrenciEkle(p.id)} disabled={busy} style={{ fontSize: 10.5, fontWeight: 700, padding: "4px 10px", borderRadius: 7, border: "1px solid #c7deff", background: "#fff", color: "#0e4bae", cursor: "pointer" }}>Ekle</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {oturumGecmisi.length > 0 && (
              <section style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Geçmiş Oturumlar</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {oturumGecmisi.map((o) => {
                    const kayitlar = tumKayitlar.filter((k) => k.oturum_id === o.id);
                    const varSayisi = kayitlar.filter((k) => k.durum === "var").length;
                    return (
                      <button key={o.id} type="button" onClick={() => setTarih(o.tarih)} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, border: "1px solid #e3ebf6", background: o.tarih === tarih ? "#eef5ff" : "#fff", fontSize: 12, cursor: "pointer", textAlign: "left" }}>
                        <span>{new Date(o.tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })}</span>
                        <span style={{ color: "#8fa0bc" }}>{varSayisi}/{kayitlar.length} var{qrOturumIdSeti.has(o.id) ? " · 📷 QR" : ""}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
