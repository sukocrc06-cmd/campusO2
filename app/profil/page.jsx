"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { HERO_PALETI, HERO_ANAHTARLARI, heroGradient, SINIF_SECENEKLERI, ROL_ETIKET } from "../../lib/profil-secenekleri";

const inputStyle = { height: 42, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 11, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
const cardStyle = { background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 20, marginBottom: 16 };
const sectionTitleStyle = { fontSize: 13.5, fontWeight: 800, marginBottom: 14 };

const BILDIRIM_ETIKET = {
  ders_kaydi: "Ders kaydı bildirimleri",
  yorum: "Yorumlar",
  duyuru: "Duyurular",
  etiket: "Etiketlenmeler",
};

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 42, height: 24, borderRadius: 999, border: "none", cursor: disabled ? "default" : "pointer",
        background: checked ? "#175cd3" : "#dbe4f3", position: "relative", flex: "none", opacity: disabled ? 0.6 : 1,
        transition: "background 0.15s",
      }}
    >
      <span style={{ position: "absolute", top: 3, left: checked ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }} />
    </button>
  );
}

function ToggleRow({ label, desc, checked, onChange, disabled }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid #f0f4fa" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
        {desc && <div style={{ fontSize: 11.5, color: "#8fa0bc", marginTop: 2 }}>{desc}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export default function ProfilAyarlariPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("student");
  const [sonGiris, setSonGiris] = useState(null);

  const [fullName, setFullName] = useState("");
  const [bolum, setBolum] = useState("");
  const [sinif, setSinif] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [heroRenk, setHeroRenk] = useState("mavi");
  const [unvan, setUnvan] = useState("");
  const [ofisSaatleri, setOfisSaatleri] = useState("");

  const [bildirimTercihleri, setBildirimTercihleri] = useState({ ders_kaydi: true, yorum: true, duyuru: true, etiket: true });
  const [emailBildirimDersKaydi, setEmailBildirimDersKaydi] = useState(false);
  const [gizli, setGizli] = useState(false);

  const [savingProfil, setSavingProfil] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const [yeniSifre, setYeniSifre] = useState("");
  const [yeniSifreTekrar, setYeniSifreTekrar] = useState("");
  const [sifreBusy, setSifreBusy] = useState(false);
  const [sifreMesaj, setSifreMesaj] = useState("");
  const [cikisBusy, setCikisBusy] = useState(false);

  const [silOnayMetni, setSilOnayMetni] = useState("");
  const [silSifre, setSilSifre] = useState("");
  const [silBusy, setSilBusy] = useState(false);
  const [silError, setSilError] = useState("");

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }
      setUserId(session.user.id);
      setEmail(session.user.email || "");
      setSonGiris(session.user.last_sign_in_at || null);

      const { data: profile, error: pErr } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      if (pErr) { setError("Profil alınamadı: " + pErr.message); setLoading(false); return; }
      if (profile) {
        setRole(profile.role || "student");
        setFullName(profile.full_name || "");
        setBolum(profile.bolum || "");
        setSinif(profile.sinif ? String(profile.sinif) : "");
        setAvatarUrl(profile.avatar_url || "");
        setHeroRenk(profile.hero_renk || "mavi");
        setUnvan(profile.unvan || "");
        setOfisSaatleri(profile.ofis_saatleri || "");
        setBildirimTercihleri({ ders_kaydi: true, yorum: true, duyuru: true, etiket: true, ...(profile.bildirim_tercihleri || {}) });
        setEmailBildirimDersKaydi(!!profile.email_bildirim_ders_kaydi);
        setGizli(profile.gorunurluk === "gizli");
      }
      setLoading(false);
    }
    init();
  }, []);

  const sonGirisMetin = useMemo(() => {
    if (!sonGiris) return "Bilinmiyor";
    try {
      return new Date(sonGiris).toLocaleString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return "Bilinmiyor";
    }
  }, [sonGiris]);

  async function handleAvatarSec(e) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    if (file.size > 4 * 1024 * 1024) { setError("Görsel 4MB'tan küçük olmalı."); return; }
    setAvatarBusy(true); setError(""); setMessage("");
    const uzanti = (file.name.split(".").pop() || "jpg").toLowerCase();
    const yol = `${userId}/${Date.now()}.${uzanti}`;
    const { error: upErr } = await supabase.storage.from("profil-fotograflari").upload(yol, file, { upsert: true });
    if (upErr) { setError("Fotoğraf yüklenemedi: " + upErr.message); setAvatarBusy(false); return; }
    const url = supabase.storage.from("profil-fotograflari").getPublicUrl(yol).data.publicUrl;
    const { error: updErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
    if (updErr) { setError("Fotoğraf kaydedilemedi: " + updErr.message); setAvatarBusy(false); return; }
    setAvatarUrl(url);
    setMessage("Profil fotoğrafın güncellendi.");
    setAvatarBusy(false);
  }

  async function handleProfilKaydet() {
    if (!userId) return;
    setSavingProfil(true); setError(""); setMessage("");
    const guncelleme = { full_name: fullName.trim(), hero_renk: heroRenk };
    if (role === "student") {
      guncelleme.bolum = bolum || null;
      guncelleme.sinif = sinif || null;
    }
    if (role === "academician") {
      guncelleme.unvan = unvan.trim() || null;
      guncelleme.ofis_saatleri = ofisSaatleri.trim() || null;
    }
    const { error: err } = await supabase.from("profiles").update(guncelleme).eq("id", userId);
    if (err) setError("Kaydedilemedi: " + err.message);
    else setMessage("Profil bilgilerin kaydedildi.");
    setSavingProfil(false);
  }

  async function handleBildirimToggle(anahtar, deger) {
    const yeni = { ...bildirimTercihleri, [anahtar]: deger };
    setBildirimTercihleri(yeni);
    const { error: err } = await supabase.from("profiles").update({ bildirim_tercihleri: yeni }).eq("id", userId);
    if (err) setError("Bildirim tercihi kaydedilemedi: " + err.message);
  }

  async function handleEmailBildirimToggle(deger) {
    setEmailBildirimDersKaydi(deger);
    const { error: err } = await supabase.from("profiles").update({ email_bildirim_ders_kaydi: deger }).eq("id", userId);
    if (err) setError("Tercih kaydedilemedi: " + err.message);
  }

  async function handleGizlilikToggle(deger) {
    setGizli(deger);
    const { error: err } = await supabase.from("profiles").update({ gorunurluk: deger ? "gizli" : "herkese_acik" }).eq("id", userId);
    if (err) setError("Görünürlük kaydedilemedi: " + err.message);
  }

  async function handleSifreDegistir() {
    setSifreMesaj(""); setError("");
    if (yeniSifre.length < 6) { setSifreMesaj("Şifre en az 6 karakter olmalı."); return; }
    if (yeniSifre !== yeniSifreTekrar) { setSifreMesaj("Şifreler eşleşmiyor."); return; }
    setSifreBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: yeniSifre });
    setSifreBusy(false);
    if (err) setSifreMesaj("Şifre değiştirilemedi: " + err.message);
    else { setSifreMesaj("Şifren güncellendi."); setYeniSifre(""); setYeniSifreTekrar(""); }
  }

  async function handleTumCihazlardanCikis() {
    setCikisBusy(true); setError("");
    const { error: err } = await supabase.auth.signOut({ scope: "global" });
    setCikisBusy(false);
    if (err) { setError("Çıkış yapılamadı: " + err.message); return; }
    window.location.href = "/";
  }

  const silOnayGecerli = ["sil", "sıl"].includes(silOnayMetni.trim().toLocaleLowerCase("tr-TR"));

  async function handleHesabiSil() {
    setSilError("");
    if (!silOnayGecerli) { setSilError('Onaylamak için kutuya büyük harflerle "SİL" yaz.'); return; }
    if (!silSifre) { setSilError("Şifreni tekrar girmen gerekiyor."); return; }
    setSilBusy(true);
    const { error: girisErr } = await supabase.auth.signInWithPassword({ email, password: silSifre });
    if (girisErr) { setSilError("Şifre yanlış. Hesap silinmedi."); setSilBusy(false); return; }
    const { error: silErr } = await supabase.rpc("campuso_hesabimi_sil");
    if (silErr) { setSilError("Hesap silinemedi: " + silErr.message); setSilBusy(false); return; }
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={`/?role=${role === "academician" ? "faculty" : role}`} style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>PROFİL AYARLARI</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Hesabım</div>
          </div>
        </div>
      </header>

      <main style={{ width: "min(680px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        {error ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}
        {message ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#e3faf0", border: "1px solid #b7e9d2", color: "#0b6b46", fontSize: 13, fontWeight: 600 }}>{message}</div> : null}

        {loading ? (
          <p style={{ color: "#5b6b85" }}>Yükleniyor…</p>
        ) : (
          <>
            {/* Profil kartı */}
            <section style={cardStyle}>
              <div style={sectionTitleStyle}>Profil</div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
                <div style={{ width: 76, height: 76, borderRadius: "50%", background: heroGradient(heroRenk), display: "grid", placeItems: "center", overflow: "hidden", flex: "none" }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={fullName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ color: "#fff", fontWeight: 800, fontSize: 28 }}>{(fullName || "?").trim().charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#175cd3", cursor: "pointer", padding: "8px 14px", borderRadius: 10, border: "1px solid #c7deff" }}>
                  {avatarBusy ? "Yükleniyor…" : "Fotoğraf değiştir"}
                  <input type="file" accept="image/*" onChange={handleAvatarSec} disabled={avatarBusy} style={{ display: "none" }} />
                </label>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#5b6b85", marginBottom: 8 }}>Hero kapak rengi</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {HERO_ANAHTARLARI.map((k) => (
                    <button key={k} type="button" onClick={() => setHeroRenk(k)} title={HERO_PALETI[k].label}
                      style={{ width: 30, height: 30, borderRadius: "50%", background: HERO_PALETI[k].gradient, border: heroRenk === k ? "3px solid #0f1b33" : "1px solid #e3ebf6", cursor: "pointer" }} />
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#5b6b85", display: "flex", flexDirection: "column", gap: 5 }}>Ad Soyad
                  <input style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </label>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#5b6b85", display: "flex", flexDirection: "column", gap: 5 }}>E-posta
                  <input style={{ ...inputStyle, background: "#f5f8fc", color: "#8fa0bc" }} value={email} disabled />
                </label>
                {role === "student" && (
                  <>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: "#5b6b85", display: "flex", flexDirection: "column", gap: 5 }}>Bölüm
                      <input style={inputStyle} value={bolum} onChange={(e) => setBolum(e.target.value)} placeholder="Örn. İşletme" />
                    </label>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: "#5b6b85", display: "flex", flexDirection: "column", gap: 5 }}>Sınıf
                      <select style={inputStyle} value={sinif} onChange={(e) => setSinif(e.target.value)}>
                        <option value="">Seç…</option>
                        {SINIF_SECENEKLERI.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </label>
                  </>
                )}
                {role === "academician" && (
                  <>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: "#5b6b85", display: "flex", flexDirection: "column", gap: 5 }}>Unvan
                      <input style={inputStyle} value={unvan} onChange={(e) => setUnvan(e.target.value)} placeholder="Örn. Dr. Öğr. Üyesi" />
                    </label>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: "#5b6b85", display: "flex", flexDirection: "column", gap: 5, gridColumn: "1 / -1" }}>Ofis / danışmanlık saatleri
                      <input style={inputStyle} value={ofisSaatleri} onChange={(e) => setOfisSaatleri(e.target.value)} placeholder="Örn. Çarşamba 14:00–16:00, B Blok 204" />
                    </label>
                  </>
                )}
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#5b6b85", display: "flex", flexDirection: "column", gap: 5 }}>Rol
                  <span style={{ fontSize: 11.5, fontWeight: 800, padding: "9px 12px", borderRadius: 10, background: "#eef5ff", color: "#0e4bae", width: "fit-content" }}>{ROL_ETIKET[role] || role}</span>
                </div>
              </div>

              <button onClick={handleProfilKaydet} disabled={savingProfil} className="button button-primary" style={{ marginTop: 16, minHeight: 40, padding: "0 18px", fontSize: 12.5 }}>{savingProfil ? "Kaydediliyor…" : "Profili Kaydet"}</button>
            </section>

            {/* Bildirim tercihleri */}
            <section style={cardStyle}>
              <div style={sectionTitleStyle}>Bildirim Tercihleri</div>
              {Object.keys(BILDIRIM_ETIKET).map((k) => (
                <ToggleRow key={k} label={BILDIRIM_ETIKET[k]} checked={!!bildirimTercihleri[k]} onChange={(v) => handleBildirimToggle(k, v)} />
              ))}
              {role === "academician" && (
                <ToggleRow
                  label="Yeni ders kaydını e-postama da gönder"
                  desc="Bir öğrenci dersine kayıt olduğunda uygulama içi bildirime ek olarak e-posta da alırsın."
                  checked={emailBildirimDersKaydi}
                  onChange={handleEmailBildirimToggle}
                />
              )}
            </section>

            {/* Gizlilik */}
            <section style={cardStyle}>
              <div style={sectionTitleStyle}>Gizlilik</div>
              <ToggleRow
                label="Profilimi gizle"
                desc="Açarsan, kampüs duvarı etiketleme aramasında ve akademisyenlerin elle öğrenci ekleme aramasında görünmezsin. Kayıtlı olduğun derslerde ve QR yoklamada bu ayardan etkilenmeden normal şekilde görünmeye devam edersin."
                checked={gizli}
                onChange={handleGizlilikToggle}
              />
            </section>

            {/* Oturum ve güvenlik */}
            <section style={cardStyle}>
              <div style={sectionTitleStyle}>Oturum ve Güvenlik</div>
              <div style={{ fontSize: 12.5, color: "#5b6b85", marginBottom: 14 }}>Son giriş: <b style={{ color: "#0f1b33" }}>{sonGirisMetin}</b></div>

              <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#5b6b85", display: "flex", flexDirection: "column", gap: 5 }}>Yeni şifre
                  <input type="password" style={inputStyle} value={yeniSifre} onChange={(e) => setYeniSifre(e.target.value)} placeholder="En az 6 karakter" />
                </label>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#5b6b85", display: "flex", flexDirection: "column", gap: 5 }}>Yeni şifre (tekrar)
                  <input type="password" style={inputStyle} value={yeniSifreTekrar} onChange={(e) => setYeniSifreTekrar(e.target.value)} />
                </label>
                {sifreMesaj && <div style={{ fontSize: 12, fontWeight: 700, color: sifreMesaj.includes("güncellendi") ? "#0b6b46" : "#984333" }}>{sifreMesaj}</div>}
                <button onClick={handleSifreDegistir} disabled={sifreBusy} style={{ minHeight: 38, padding: "0 16px", fontSize: 12.5, fontWeight: 700, borderRadius: 10, border: "1px solid #c7deff", background: "#fff", color: "#0e4bae", cursor: "pointer", width: "fit-content" }}>{sifreBusy ? "…" : "Şifreyi Değiştir"}</button>
              </div>

              <div style={{ paddingTop: 14, borderTop: "1px solid #f0f4fa" }}>
                <button onClick={handleTumCihazlardanCikis} disabled={cikisBusy} style={{ minHeight: 38, padding: "0 16px", fontSize: 12.5, fontWeight: 700, borderRadius: 10, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", cursor: "pointer" }}>{cikisBusy ? "…" : "Tüm cihazlardan çıkış yap"}</button>
              </div>
            </section>

            {/* Danger Zone */}
            <section style={{ ...cardStyle, border: "1px solid #f2c5ba", background: "#fffaf8" }}>
              <div style={{ ...sectionTitleStyle, color: "#984333" }}>⚠️ Danger Zone</div>
              <p style={{ fontSize: 12.5, color: "#984333", marginBottom: 14, lineHeight: 1.6 }}>
                Hesabını sildiğinde profilin, ders kayıtların, yoklama geçmişin, kişisel takvimin, kulüp üyeliklerin ve kampüs duvarı gönderilerin/yorumların <b>kalıcı olarak ve anında</b> silinir. Bu işlem GERİ ALINAMAZ.
                {role === "academician" && " Verdiğin dersler silinmez, sadece \"akademisyen atanmamış\" duruma döner — öğrencilerin ders kayıtları ve geçmiş yoklamaları korunur."}
              </p>
              <div style={{ display: "grid", gap: 10, maxWidth: 360 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#984333", display: "flex", flexDirection: "column", gap: 5 }}>Onaylamak için "SİL" yaz
                  <input style={{ ...inputStyle, border: "1px solid #f2c5ba" }} value={silOnayMetni} onChange={(e) => setSilOnayMetni(e.target.value)} placeholder="SİL" />
                </label>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#984333", display: "flex", flexDirection: "column", gap: 5 }}>Şifreni tekrar gir
                  <input type="password" style={{ ...inputStyle, border: "1px solid #f2c5ba" }} value={silSifre} onChange={(e) => setSilSifre(e.target.value)} />
                </label>
                {silError && <div style={{ fontSize: 12, fontWeight: 700, color: "#984333" }}>{silError}</div>}
                <button
                  onClick={handleHesabiSil}
                  disabled={silBusy || !silOnayGecerli || !silSifre}
                  style={{ minHeight: 42, padding: "0 16px", fontSize: 13, fontWeight: 800, borderRadius: 10, border: "none", background: !silOnayGecerli || !silSifre ? "#f2c5ba" : "#c0273c", color: "#fff", cursor: !silOnayGecerli || !silSifre ? "not-allowed" : "pointer" }}
                >
                  {silBusy ? "Siliniyor…" : "Hesabımı Kalıcı Olarak Sil"}
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
