"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { SOSYAL_SORUMLULUK_HEDEF_SAAT, toplamOnayliSaat } from "../../../lib/sosyal-sorumluluk";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key) : null;
}

const STATUS_MAP = {
  beklemede: { label: "Beklemede", color: "#ffb13b", bg: "#fff8eb" },
  onaylandi: { label: "Onaylandı", color: "#22b879", bg: "#effbf6" },
  reddedildi: { label: "Reddedildi", color: "#ef5c63", bg: "#fff4f0" },
};

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status, color: "#5b6b85", bg: "#f5f8fc" };
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
      <i style={{ width: 7, height: 7, borderRadius: "50%", background: s.color }} />
      {s.label}
    </span>
  );
}

const inputStyle = { height: 44, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 11, fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" };
const labelStyle = { display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 700, color: "#5b6b85" };

export default function StudentSosyalSorumlulukPage() {
  const [kayitlar, setKayitlar] = useState([]);
  const [userId, setUserId] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("bilgi"); // bilgi | ekle | durum

  const [form, setForm] = useState({
    baslik: "",
    aciklama: "",
    kurum_kulup: "",
    baslangic: "",
    bitis: "",
    saat: "",
    kanit_notu: "",
  });

  function setField(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  useEffect(() => {
    async function init() {
      const supabase = getSupabase();
      if (!supabase) {
        setFetching(false);
        setError("Sosyal sorumluluk veritabanı bağlantısı henüz yapılandırılmamış.");
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setFetching(false);
        setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin.");
        return;
      }
      setUserId(session.user.id);
      const { data, error: err } = await supabase
        .from("sosyal_sorumluluk_kayitlari")
        .select("*")
        .eq("student_id", session.user.id)
        .order("created_at", { ascending: false });
      if (err) setError("Veriler alınamadı: " + err.message);
      else setKayitlar(data || []);
      setFetching(false);
    }
    init();
  }, []);

  async function handleEkle(e) {
    e.preventDefault();
    if (!userId) {
      setError("Oturum gerekli.");
      return;
    }
    if (!form.baslik.trim()) {
      setError("Faaliyet başlığı zorunludur.");
      return;
    }
    const saatSayisi = Number(form.saat);
    if (!saatSayisi || saatSayisi <= 0) {
      setError("Geçerli bir saat değeri girin.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");

    const supabase = getSupabase();
    const payload = {
      student_id: userId,
      baslik: form.baslik.trim(),
      aciklama: form.aciklama.trim() || null,
      kurum_kulup: form.kurum_kulup.trim() || null,
      baslangic_tarihi: form.baslangic || null,
      bitis_tarihi: form.bitis || null,
      saat: saatSayisi,
      kanit_notu: form.kanit_notu.trim() || null,
      onay_durumu: "beklemede",
    };

    const { error: err } = await supabase.from("sosyal_sorumluluk_kayitlari").insert([payload]);
    if (err) {
      setError("Hata: " + err.message);
    } else {
      setMessage("Faaliyet kaydın gönderildi; akademisyen onayını bekliyor.");
      setForm({ baslik: "", aciklama: "", kurum_kulup: "", baslangic: "", bitis: "", saat: "", kanit_notu: "" });
      const { data } = await supabase
        .from("sosyal_sorumluluk_kayitlari")
        .select("*")
        .eq("student_id", userId)
        .order("created_at", { ascending: false });
      setKayitlar(data || []);
      setTab("durum");
    }
    setLoading(false);
  }

  async function handleSil(id) {
    const supabase = getSupabase();
    if (!supabase) return;
    setLoading(true);
    const { error: err } = await supabase.from("sosyal_sorumluluk_kayitlari").delete().eq("id", id);
    if (err) {
      setError("Hata: " + err.message);
    } else {
      setKayitlar((current) => current.filter((k) => k.id !== id));
      setMessage("Kayıt silindi.");
    }
    setLoading(false);
  }

  const toplamSaat = useMemo(() => toplamOnayliSaat(kayitlar), [kayitlar]);
  const bekleyenSaat = useMemo(
    () => kayitlar.filter((k) => k.onay_durumu === "beklemede").reduce((sum, k) => sum + Number(k.saat || 0), 0),
    [kayitlar]
  );
  const ilerlemeYuzde = Math.min(100, Math.round((toplamSaat / SOSYAL_SORUMLULUK_HEDEF_SAAT) * 100));
  const tamamlandi = toplamSaat >= SOSYAL_SORUMLULUK_HEDEF_SAAT;

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=student" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>VOL 1-5 · SOSYAL SORUMLULUK</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Sosyal Sorumluluk Durumu</div>
          </div>
        </div>
        <Link href="/?role=student" style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid #c7deff", color: "#0e4bae" }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(900px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        <section style={{ background: "linear-gradient(135deg, #0e4bae, #175cd3)", borderRadius: 18, padding: "22px 24px", color: "#fff", marginBottom: 20 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", opacity: 0.85 }}>TOPLAM ONAYLI SAAT</div>
              <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }}>{toplamSaat} <span style={{ fontSize: 15, fontWeight: 600, opacity: 0.85 }}>/ {SOSYAL_SORUMLULUK_HEDEF_SAAT} saat</span></div>
              {bekleyenSaat > 0 && <small style={{ opacity: 0.85 }}>{bekleyenSaat} saat onay bekliyor</small>}
            </div>
            <span
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                background: tamamlandi ? "rgba(34,184,121,.25)" : "rgba(255,255,255,.18)",
                border: `1px solid ${tamamlandi ? "rgba(34,184,121,.6)" : "rgba(255,255,255,.35)"}`,
              }}
            >
              {tamamlandi ? "Hedef Tamamlandı" : "Devam Ediyor"}
            </span>
          </div>
          <div style={{ marginTop: 14, height: 10, borderRadius: 999, background: "rgba(255,255,255,.22)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${ilerlemeYuzde}%`, borderRadius: 999, background: "#fff" }} />
          </div>
        </section>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
          {[
            { id: "bilgi", label: "Nedir?" },
            { id: "ekle", label: "Faaliyet Ekle" },
            { id: "durum", label: `Kayıtlarım (${kayitlar.length})` },
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

        {tab === "bilgi" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 20, boxShadow: "0 10px 28px -22px rgba(15,43,90,.2)" }}>
              <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>Sosyal Sorumluluk Durumu nedir?</h2>
              <p style={{ margin: 0, color: "#5b6b85", fontSize: 13, lineHeight: 1.7 }}>
                Gönüllülük, toplum hizmeti, kulüp/üniversite tarafından düzenlenen sosyal sorumluluk projeleri ve etkinliklere
                katılımını buradan kaydedersin. Her kayıt danışman akademisyenin onayına gönderilir; onaylanan saatler toplam
                sosyal sorumluluk saatine eklenir. Hedef, üniversitenin ilgili yönergesine göre <strong>{SOSYAL_SORUMLULUK_HEDEF_SAAT} saat</strong> olarak
                ayarlanmıştır.
              </p>
            </div>
            <div style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 20 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Nasıl işler?</h3>
              <ul style={{ margin: 0, paddingLeft: 20, color: "#5b6b85", fontSize: 13, lineHeight: 1.7 }}>
                <li>"Faaliyet Ekle" sekmesinden katıldığın etkinliği, tarihini ve saatini gir.</li>
                <li>Kaydın "Beklemede" durumuna düşer; danışman akademisyenin incelemesini bekler.</li>
                <li>Akademisyen onaylarsa saat toplamına eklenir, reddederse gerekçesiyle birlikte görürsün.</li>
                <li>Onaylanmamış (beklemede) kayıtları istersen silip yeniden düzenleyebilirsin.</li>
              </ul>
            </div>
            <div style={{ background: "#fff8eb", border: "1px solid #f5d9a0", borderRadius: 14, padding: 16, fontSize: 13, color: "#8a5a00", lineHeight: 1.55 }}>
              <strong>Not:</strong> Hedef saat ve onay kuralları üniversitenin kendi yönergesine göre değişebilir; bu ekrandaki
              {" "}{SOSYAL_SORUMLULUK_HEDEF_SAAT} saatlik hedef örnek/varsayılan bir değerdir.
            </div>
          </div>
        )}

        {tab === "ekle" && (
          <form onSubmit={handleEkle} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 18, padding: 24, display: "grid", gap: 16, boxShadow: "0 14px 36px -26px rgba(15,43,90,.28)" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>YENİ FAALİYET</div>
              <h2 style={{ margin: "4px 0 0", fontSize: 18 }}>Sosyal sorumluluk faaliyeti ekle</h2>
            </div>

            <label style={labelStyle}>
              Faaliyet / proje başlığı *
              <input style={inputStyle} required value={form.baslik} onChange={(e) => setField("baslik", e.target.value)} placeholder="Örn. Kan bağışı kampanyası gönüllülüğü" />
            </label>

            <label style={labelStyle}>
              Açıklama
              <textarea style={{ ...inputStyle, height: 90, padding: 12, resize: "vertical" }} value={form.aciklama} onChange={(e) => setField("aciklama", e.target.value)} placeholder="Faaliyette neler yaptığını kısaca anlat" />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <label style={labelStyle}>Kurum / kulüp
                <input style={inputStyle} value={form.kurum_kulup} onChange={(e) => setField("kurum_kulup", e.target.value)} placeholder="Örn. Kızılay, Bilgi Sistemleri Kulübü" />
              </label>
              <label style={labelStyle}>Saat *
                <input style={inputStyle} type="number" min="0.5" step="0.5" required value={form.saat} onChange={(e) => setField("saat", e.target.value)} placeholder="Örn. 4" />
              </label>
              <label style={labelStyle}>Başlangıç tarihi
                <input style={inputStyle} type="date" value={form.baslangic} onChange={(e) => setField("baslangic", e.target.value)} />
              </label>
              <label style={labelStyle}>Bitiş tarihi
                <input style={inputStyle} type="date" value={form.bitis} onChange={(e) => setField("bitis", e.target.value)} />
              </label>
            </div>

            <label style={labelStyle}>
              Kanıt / belge notu
              <input style={inputStyle} value={form.kanit_notu} onChange={(e) => setField("kanit_notu", e.target.value)} placeholder="Katılım belgesi, fotoğraf linki vb. (opsiyonel)" />
            </label>

            <button
              type="submit"
              disabled={loading}
              style={{ marginTop: 4, minHeight: 48, border: "none", borderRadius: 13, background: "linear-gradient(135deg, #175cd3, #0e4bae)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.65 : 1 }}
            >
              {loading ? "Gönderiliyor…" : "Faaliyeti Gönder"}
            </button>
          </form>
        )}

        {tab === "durum" && (
          <div>
            <h2 style={{ margin: "0 0 14px", fontSize: 18 }}>Faaliyet Kayıtlarım</h2>
            {fetching ? (
              <p style={{ color: "#5b6b85" }}>Yükleniyor…</p>
            ) : kayitlar.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>
                Henüz kayıt yok. <button type="button" onClick={() => setTab("ekle")} style={{ border: "none", background: "none", color: "#175cd3", fontWeight: 700, cursor: "pointer" }}>Faaliyet ekle</button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {kayitlar.map((k) => (
                  <div key={k.id} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 14, padding: 18 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15 }}>{k.baslik}</div>
                        <div style={{ fontSize: 12, color: "#5b6b85", marginTop: 4 }}>
                          {k.kurum_kulup ? `${k.kurum_kulup} · ` : ""}{k.saat} saat
                          {k.baslangic_tarihi ? ` · ${k.baslangic_tarihi}${k.bitis_tarihi ? ` → ${k.bitis_tarihi}` : ""}` : ""}
                        </div>
                      </div>
                      <StatusBadge status={k.onay_durumu} />
                    </div>
                    {k.aciklama ? <div style={{ fontSize: 12, color: "#5b6b85", marginBottom: 8 }}>{k.aciklama}</div> : null}
                    {k.onay_durumu === "beklemede" && (
                      <button
                        onClick={() => handleSil(k.id)}
                        disabled={loading}
                        style={{ minHeight: 34, padding: "0 12px", fontSize: 12, fontWeight: 700, borderRadius: 10, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", cursor: loading ? "not-allowed" : "pointer" }}
                      >
                        Kaydı Sil
                      </button>
                    )}
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
