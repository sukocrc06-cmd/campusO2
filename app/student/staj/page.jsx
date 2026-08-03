"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

const STATUS_MAP = {
  beklemede: { label: "Beklemede", color: "#ffb13b", bg: "#fff8eb" },
  akademisyen_onayladi: { label: "Akademisyen Onayladı", color: "#175cd3", bg: "#e6f0ff" },
  yonetici_onayladi: { label: "Onaylandı", color: "#22b879", bg: "#effbf6" },
  reddedildi: { label: "Reddedildi", color: "#ef5c63", bg: "#fff4f0" },
};

const STAJ_TIPLERI = [
  { id: "yurt_ici_ozel", label: "Yurt İçi Özel Sektör Stajı" },
  { id: "ulusal", label: "Ulusal Staj" },
  { id: "yurt_disi", label: "Yurt Dışı Staj (Erasmus dahil)" },
];

const BELGELER = {
  yurt_ici_ozel: [
    { id: "kabul", title: "Staj Kabul Belgesi", desc: "Firma tarafından doldurulup imzalanmış kabul yazısı", zorunlu: true },
    { id: "ucret_fonu", title: "Staj Ücretlerine İşsizlik Katkı Fonu Belgesi", desc: "Öğrenci ve firma karşılıklı imzalar; kamu kurumlarında gerekmez", zorunlu: true },
    { id: "sicil", title: "Staj Sicil Fişi", desc: "Staj sonrası, el yazısı, fotoğraflı, kapalı mühürlü zarfta", zorunlu: true, asama: "sonrasi" },
    { id: "defter", title: "Staj Defteri (20 gün, İngilizce)", desc: "Tüm sayfalar staj sorumlusunca kaşelenip imzalanmalı", zorunlu: true, asama: "sonrasi" },
  ],
  ulusal: [
    { id: "ekran", title: "Staj Kabulü Ekran Görüntüsü", desc: "Ulusal staj sisteminden kabul ekran görüntüsü", zorunlu: true },
    { id: "kabul", title: "Staj Kabul Yazısı", desc: "Sistem/kurum kabul belgesi", zorunlu: true },
    { id: "sicil", title: "Staj Sicil Fişi", desc: "Staj sonrası kapalı mühürlü zarf", zorunlu: true, asama: "sonrasi" },
    { id: "defter", title: "Staj Defteri", desc: "20 iş günü, imzalı kaşeli", zorunlu: true, asama: "sonrasi" },
  ],
  yurt_disi: [
    { id: "kabul", title: "Staj Kabul Yazısı", desc: "Yurt dışı / Erasmus kabul belgesi", zorunlu: true },
    { id: "sicil", title: "Staj Sicil Fişi", desc: "Staj sonrası teslim", zorunlu: true, asama: "sonrasi" },
    { id: "defter", title: "Staj Defteri", desc: "20 iş günü, imzalı kaşeli", zorunlu: true, asama: "sonrasi" },
  ],
};

const SUREC_ADIMLARI = [
  {
    id: "oncesi",
    title: "Başvuru Öncesi",
    items: [
      "2. sınıf yazından itibaren zorunlu staj yapılabilir",
      "Başvuru tarihlerini İşletme Fakültesi web sitesinden kontrol edin",
      "Staj yeri yerine Dönem Projesi düşünüyorsanız staj komisyonu üyesiyle görüşün",
      "AYBU İşletme Fakültesi staj sekmesini ayrıntılı okuyun",
    ],
  },
  {
    id: "basvuru",
    title: "Başvuru Dönemi",
    items: [
      "Staj yapacağınız kurumu kendiniz bulun",
      "Belgeleri eksiksiz doldurup online yükleyin",
      "Staj süresi tam 20 iş günü olmalı",
      "Daha uzun staj için firmadan açıklama yazısı + danışman onayı gerekir",
    ],
  },
  {
    id: "staj",
    title: "Staj Dönemi",
    items: [
      "Başlamadan 1 hafta önce OBS’den işe giriş bildirgenizi alın",
      "İlk iş gününde bildirgenizi yanınızda bulundurun",
      "20 günlük staj defterini İngilizce tutun; her sayfa imza/kaşe alsın",
    ],
  },
  {
    id: "sonrasi",
    title: "Staj Sonrası",
    items: [
      "Sicil fişini el yazısıyla doldurtun, vesikalık fotoğraf yapıştırın",
      "Kapalı mühürlü zarfta komisyon üyesine teslim edin (açılmamış olmalı)",
      "Staj defteri + sicil fişini elden teslim edin",
      "Sonraki Güz döneminde STAJ dersini seçin (not BŞ → 240 AKTS’ye dahil)",
    ],
  },
];

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status, color: "#5b6b85", bg: "#f5f8fc" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.color}33` }}>
      <i style={{ width: 7, height: 7, borderRadius: "50%", background: s.color }} />
      {s.label}
    </span>
  );
}

const inputStyle = { height: 44, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 11, fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" };
const labelStyle = { display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 700, color: "#5b6b85" };

export default function StudentStajPage() {
  const [stajlar, setStajlar] = useState([]);
  const [userId, setUserId] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("surec"); // surec | basvuru | belgeler | durum

  const [stajTipi, setStajTipi] = useState("yurt_ici_ozel");
  const [form, setForm] = useState({
    kurum: "",
    baslangic: "",
    bitis: "",
    bolum: "",
    ogrenci_no: "",
    tc_kimlik: "",
    telefon: "",
    eposta: "",
    firma_adres: "",
    firma_telefon: "",
    staj_sorumlusu: "",
    calisilacak_birim: "",
    faaliyet_alani: "",
    cumartesi: false,
  });

  function setField(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  useEffect(() => {
    async function init() {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setFetching(false);
        setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin.");
        return;
      }
      setUserId(session.user.id);
      if (session.user.email) setField("eposta", session.user.email);
      const { data, error: err } = await supabase
        .from("stajlar")
        .select("*")
        .eq("student_id", session.user.id)
        .order("created_at", { ascending: false });
      if (err) setError("Veriler alınamadı: " + err.message);
      else setStajlar(data || []);
      setFetching(false);
    }
    init();
  }, []);

  async function handleBasvuru(e) {
    e.preventDefault();
    if (!userId) {
      setError("Oturum gerekli.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");

    const supabase = getSupabase();
    const payload = {
      student_id: userId,
      kurum_adi: form.kurum.trim(),
      baslangic_tarihi: form.baslangic,
      bitis_tarihi: form.bitis,
      onay_durumu: "beklemede",
      staj_tipi: stajTipi,
      bolum: form.bolum.trim() || null,
      ogrenci_no: form.ogrenci_no.trim() || null,
      tc_kimlik: form.tc_kimlik.trim() || null,
      telefon: form.telefon.trim() || null,
      eposta: form.eposta.trim() || null,
      firma_adres: form.firma_adres.trim() || null,
      firma_telefon: form.firma_telefon.trim() || null,
      staj_sorumlusu: form.staj_sorumlusu.trim() || null,
      calisilacak_birim: form.calisilacak_birim.trim() || null,
      faaliyet_alani: form.faaliyet_alani.trim() || null,
      cumartesi_calisma: form.cumartesi,
      toplam_gun: 20,
      belgeler: {},
    };

    const { error: err } = await supabase.from("stajlar").insert([payload]);
    if (err) {
      setError("Hata: " + err.message);
    } else {
      setMessage("Başvurunuz gönderildi. Belgeleri hazırlayıp staj sürecini takip edin.");
      setForm((f) => ({ ...f, kurum: "", baslangic: "", bitis: "", firma_adres: "", firma_telefon: "", staj_sorumlusu: "", calisilacak_birim: "", faaliyet_alani: "" }));
      const { data } = await supabase.from("stajlar").select("*").eq("student_id", userId).order("created_at", { ascending: false });
      setStajlar(data || []);
      setTab("durum");
    }
    setLoading(false);
  }

  const belgeler = BELGELER[stajTipi] || BELGELER.yurt_ici_ozel;

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/?role=student" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</a>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>VOL 2 · STAJ</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Staj Başvuru ve Takip</div>
          </div>
        </div>
        <a href="/?role=student" style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid #c7deff", color: "#0e4bae" }}>Panele dön</a>
      </header>

      <main style={{ width: "min(900px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
          {[
            { id: "surec", label: "Süreç Şeması" },
            { id: "belgeler", label: "Zorunlu Belgeler" },
            { id: "basvuru", label: "Başvuru Formu" },
            { id: "durum", label: "Başvurularım" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding: "10px 16px",
                borderRadius: 999,
                border: tab === t.id ? "1px solid #175cd3" : "1px solid #e3ebf6",
                background: tab === t.id ? "#175cd3" : "#fff",
                color: tab === t.id ? "#fff" : "#5b6b85",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}
        {message ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#effbf6", border: "1px solid #bde5d5", color: "#0b5c42", fontSize: 13, fontWeight: 600 }}>{message}</div> : null}

        {/* SÜREÇ */}
        {tab === "surec" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ background: "linear-gradient(135deg, #0e4bae, #175cd3)", borderRadius: 18, padding: "22px 24px", color: "#fff" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", opacity: 0.85 }}>AYBU İŞLETME FAKÜLTESİ</div>
              <h1 style={{ margin: "6px 0 8px", fontSize: 22, letterSpacing: "-0.03em" }}>Staj İşleyiş Takip Şeması</h1>
              <p style={{ margin: 0, fontSize: 13, opacity: 0.9, lineHeight: 1.5 }}>
                Mezuniyet için staj veya dönem projesinin başarıyla tamamlanması zorunludur. Süreç 4 aşamadan oluşur.
              </p>
            </div>

            {SUREC_ADIMLARI.map((adim, i) => (
              <div key={adim.id} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 20, boxShadow: "0 10px 28px -22px rgba(15,43,90,.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span style={{ width: 32, height: 32, borderRadius: 10, background: "#e6f0ff", color: "#175cd3", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 14 }}>{i + 1}</span>
                  <h2 style={{ margin: 0, fontSize: 17 }}>{adim.title}</h2>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, color: "#5b6b85", fontSize: 13, lineHeight: 1.7 }}>
                  {adim.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}

            <div style={{ background: "#fff8eb", border: "1px solid #f5d9a0", borderRadius: 14, padding: 16, fontSize: 13, color: "#8a5a00", lineHeight: 1.55 }}>
              <strong>Önemli:</strong> Staj sicil fişi kapalı zarfta, mühürlü ve imzalı teslim edilmelidir. Açılmış veya eksik onaylı belgeler stajın geçersiz sayılmasına yol açar.
            </div>
          </div>
        )}

        {/* BELGELER */}
        {tab === "belgeler" && (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#5b6b85", marginBottom: 8 }}>Staj tipine göre belgeler</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {STAJ_TIPLERI.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setStajTipi(t.id)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 10,
                      border: stajTipi === t.id ? "1px solid #175cd3" : "1px solid #e3ebf6",
                      background: stajTipi === t.id ? "#e6f0ff" : "#f5f8fc",
                      color: stajTipi === t.id ? "#0e4bae" : "#5b6b85",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {(BELGELER[stajTipi] || []).map((b) => (
              <div key={b.id} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 14, padding: 18, display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, background: "#e6f0ff", display: "grid", placeItems: "center", fontSize: 18, flexShrink: 0 }}>📄</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: 15 }}>{b.title}</h3>
                    {b.zorunlu ? <span style={{ fontSize: 10, fontWeight: 800, color: "#ef5c63", background: "#fff4f0", padding: "2px 8px", borderRadius: 999 }}>ZORUNLU</span> : null}
                    {b.asama === "sonrasi" ? <span style={{ fontSize: 10, fontWeight: 700, color: "#5b6b85", background: "#f5f8fc", padding: "2px 8px", borderRadius: 999 }}>STAJ SONRASI</span> : <span style={{ fontSize: 10, fontWeight: 700, color: "#175cd3", background: "#e6f0ff", padding: "2px 8px", borderRadius: 999 }}>BAŞVURU</span>}
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "#5b6b85", lineHeight: 1.5 }}>{b.desc}</p>
                </div>
              </div>
            ))}

            <div style={{ fontSize: 12, color: "#8fa0bc", lineHeight: 1.5 }}>
              * Yabancı öğrenciler çalışma izin muafiyeti için ayrıca Mali İşler ile görüşmelidir.
              <br />
              * Kamu kurumlarında staj yapan öğrenciler için İşsizlik Katkı Fonu belgesi gerekmez.
            </div>
          </div>
        )}

        {/* BAŞVURU FORMU */}
        {tab === "basvuru" && (
          <form onSubmit={handleBasvuru} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 18, padding: 24, display: "grid", gap: 16, boxShadow: "0 14px 36px -26px rgba(15,43,90,.28)" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>YENİ BAŞVURU</div>
              <h2 style={{ margin: "4px 0 0", fontSize: 18 }}>Staj başvurusu oluştur</h2>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#5b6b85" }}>Staj Kabul Belgesi bilgilerine uygun alanlar</p>
            </div>

            <label style={labelStyle}>
              Staj tipi
              <select value={stajTipi} onChange={(e) => setStajTipi(e.target.value)} style={inputStyle}>
                {STAJ_TIPLERI.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <label style={labelStyle}>Ad Soyad / Öğrenci bilgisi (formda)
                <input style={inputStyle} value={form.bolum} onChange={(e) => setField("bolum", e.target.value)} placeholder="Bölüm" />
              </label>
              <label style={labelStyle}>Öğrenci No
                <input style={inputStyle} value={form.ogrenci_no} onChange={(e) => setField("ogrenci_no", e.target.value)} placeholder="Öğrenci numarası" />
              </label>
              <label style={labelStyle}>T.C. Kimlik No
                <input style={inputStyle} value={form.tc_kimlik} onChange={(e) => setField("tc_kimlik", e.target.value)} placeholder="11 haneli" maxLength={11} />
              </label>
              <label style={labelStyle}>Telefon
                <input style={inputStyle} value={form.telefon} onChange={(e) => setField("telefon", e.target.value)} placeholder="05xx..." />
              </label>
              <label style={labelStyle}>E-posta
                <input style={inputStyle} type="email" value={form.eposta} onChange={(e) => setField("eposta", e.target.value)} />
              </label>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid #e3ebf6", margin: "4px 0" }} />

            <label style={labelStyle}>
              Firma / Kurum Adı *
              <input style={inputStyle} required value={form.kurum} onChange={(e) => setField("kurum", e.target.value)} placeholder="Staj yapılacak işyeri" />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <label style={labelStyle}>Faaliyet alanı
                <input style={inputStyle} value={form.faaliyet_alani} onChange={(e) => setField("faaliyet_alani", e.target.value)} />
              </label>
              <label style={labelStyle}>Çalışılacak birim
                <input style={inputStyle} value={form.calisilacak_birim} onChange={(e) => setField("calisilacak_birim", e.target.value)} />
              </label>
              <label style={labelStyle}>Staj sorumlusu (Ad Soyad / Ünvan)
                <input style={inputStyle} value={form.staj_sorumlusu} onChange={(e) => setField("staj_sorumlusu", e.target.value)} />
              </label>
              <label style={labelStyle}>Firma telefon
                <input style={inputStyle} value={form.firma_telefon} onChange={(e) => setField("firma_telefon", e.target.value)} />
              </label>
            </div>

            <label style={labelStyle}>
              Firma adres
              <input style={inputStyle} value={form.firma_adres} onChange={(e) => setField("firma_adres", e.target.value)} />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={labelStyle}>Başlangıç tarihi *
                <input style={inputStyle} type="date" required value={form.baslangic} onChange={(e) => setField("baslangic", e.target.value)} />
              </label>
              <label style={labelStyle}>Bitiş tarihi *
                <input style={inputStyle} type="date" required value={form.bitis} onChange={(e) => setField("bitis", e.target.value)} />
              </label>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, color: "#5b6b85", cursor: "pointer" }}>
              <input type="checkbox" checked={form.cumartesi} onChange={(e) => setField("cumartesi", e.target.checked)} />
              Cumartesi günleri çalışılacak
            </label>

            <div style={{ fontSize: 12, color: "#8fa0bc" }}>Toplam staj süresi: <strong>20 iş günü</strong> (belgelerde bu süre esas alınır)</div>

            <button
              type="submit"
              disabled={loading}
              style={{ marginTop: 4, minHeight: 48, border: "none", borderRadius: 13, background: "linear-gradient(135deg, #175cd3, #0e4bae)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.65 : 1 }}
            >
              {loading ? "Gönderiliyor…" : "Başvuruyu Gönder"}
            </button>
          </form>
        )}

        {/* DURUM */}
        {tab === "durum" && (
          <div>
            <h2 style={{ margin: "0 0 14px", fontSize: 18 }}>Mevcut Staj Durumlarım</h2>
            {fetching ? (
              <p style={{ color: "#5b6b85" }}>Yükleniyor…</p>
            ) : stajlar.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>
                Henüz başvuru yok. <button type="button" onClick={() => setTab("basvuru")} style={{ border: "none", background: "none", color: "#175cd3", fontWeight: 700, cursor: "pointer" }}>Başvuru formuna git</button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {stajlar.map((s) => (
                  <div key={s.id} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 14, padding: 18 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15 }}>{s.kurum_adi}</div>
                        <div style={{ fontSize: 12, color: "#5b6b85", marginTop: 4 }}>
                          {s.baslangic_tarihi} → {s.bitis_tarihi}
                          {s.staj_tipi ? ` · ${STAJ_TIPLERI.find((t) => t.id === s.staj_tipi)?.label || s.staj_tipi}` : ""}
                        </div>
                      </div>
                      <StatusBadge status={s.onay_durumu} />
                    </div>
                    {s.staj_sorumlusu ? <div style={{ fontSize: 12, color: "#5b6b85" }}>Sorumlu: {s.staj_sorumlusu}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
