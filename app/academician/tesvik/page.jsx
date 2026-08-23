"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import {
  TESVIK_CATEGORIES,
  TESVIK_MIN_TOTAL,
  TESVIK_MIN_CATEGORY_COUNT,
  emptyTesvikCounts,
  calculateTesvik,
} from "../../../lib/tesvik-categories";

function EligibilityBadge({ eligible }) {
  const s = eligible
    ? { label: "Eşiği karşılıyor", color: "#22b879", bg: "#effbf6" }
    : { label: "Eşiğin altında", color: "#ffb13b", bg: "#fff8eb" };
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

const inputStyle = {
  height: 40,
  padding: "0 10px",
  border: "1px solid var(--line, #e3ebf6)",
  borderRadius: 10,
  fontSize: 13,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

export default function AcademicianTesvikPage() {
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("hesapla"); // hesapla | gecmis
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [yil, setYil] = useState(String(new Date().getFullYear()));
  const [counts, setCounts] = useState(emptyTesvikCounts());
  const [records, setRecords] = useState([]);

  const calc = useMemo(() => calculateTesvik(counts), [counts]);

  useEffect(() => {
    async function init() {
      if (!supabase) {
        setMessage("Hata: Teşvik veritabanı bağlantısı henüz yapılandırılmamış.");
        setLoading(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage("Hata: Bu sayfa için akademisyen oturumu gereklidir.");
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();
      if (profile?.role !== "academician") {
        setMessage("Hata: Bu sayfa yalnız yetkili akademisyen hesabıyla kullanılabilir.");
        setLoading(false);
        return;
      }
      setUserId(session.user.id);
      const { data, error } = await supabase
        .from("tesvik_hesaplamalari")
        .select("*")
        .eq("academician_id", session.user.id)
        .order("created_at", { ascending: false });
      if (error) setMessage("Veriler alınamadı: " + error.message);
      else setRecords(data || []);
      setLoading(false);
    }
    init();
  }, []);

  function setCount(key, value) {
    const numeric = value === "" ? 0 : Math.max(0, Math.floor(Number(value) || 0));
    setCounts((current) => ({ ...current, [key]: numeric }));
  }

  async function handleKaydet(event) {
    event.preventDefault();
    if (!userId) {
      setMessage("Hata: Oturum gerekli.");
      return;
    }
    if (calc.totalPoints <= 0) {
      setMessage("Hata: Kaydetmeden önce en az bir kategoriye değer girin.");
      return;
    }
    if (!yil.trim()) {
      setMessage("Hata: Yıl bilgisi zorunludur.");
      return;
    }
    setBusy(true);
    setMessage("");
    const payload = {
      academician_id: userId,
      yil: yil.trim(),
      kategoriler: counts,
      toplam_puan: calc.totalPoints,
      kategori_sayisi: calc.categoryCount,
    };
    const { error } = await supabase.from("tesvik_hesaplamalari").insert([payload]);
    if (error) {
      setMessage("Hata: " + error.message);
    } else {
      setMessage("Hesaplama kaydedildi.");
      const { data } = await supabase
        .from("tesvik_hesaplamalari")
        .select("*")
        .eq("academician_id", userId)
        .order("created_at", { ascending: false });
      setRecords(data || []);
      setTab("gecmis");
    }
    setBusy(false);
  }

  async function handleSil(id) {
    setBusyId(id);
    const { error } = await supabase.from("tesvik_hesaplamalari").delete().eq("id", id);
    if (error) {
      setMessage("Hata: " + error.message);
    } else {
      setRecords((current) => current.filter((record) => record.id !== id));
      setMessage("Kayıt silindi.");
    }
    setBusyId(null);
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--bg, #f5f8fc)",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        color: "var(--ink, #0f1b33)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "14px 22px",
          borderBottom: "1px solid var(--line, #e3ebf6)",
          background: "var(--white, #fff)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href="/"
            style={{
              display: "grid",
              placeItems: "center",
              width: 38,
              height: 38,
              borderRadius: 11,
              border: "1px solid var(--line, #e3ebf6)",
              background: "var(--bg, #f5f8fc)",
              color: "var(--blue-700, #175cd3)",
              textDecoration: "none",
            }}
          >
            ←
          </Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 820, letterSpacing: ".12em", color: "var(--blue-700, #175cd3)" }}>
              VOL 1-4 · TEŞVİK
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.02em" }}>Akademik Teşvik Hesaplama Robotu</div>
          </div>
        </div>
        <Link href="/" className="button button-secondary" style={{ minHeight: 40, padding: "0 16px", fontSize: 13 }}>
          Panele dön
        </Link>
      </header>

      <main style={{ width: "min(980px, 100%)", margin: "0 auto", padding: "28px 20px 60px" }}>
        <section
          style={{
            padding: "24px 28px",
            marginBottom: 18,
            border: "1px solid var(--blue-200, #c7deff)",
            borderRadius: 18,
            background: "radial-gradient(320px 160px at 0% 0%, rgba(230,240,255,.85), transparent 70%), var(--white, #fff)",
            boxShadow: "var(--shadow, 0 18px 45px -28px rgba(15,43,90,.28))",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
            <span
              style={{
                display: "grid",
                placeItems: "center",
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "linear-gradient(145deg, #fff, var(--blue-100, #e6f0ff))",
                border: "1px solid var(--blue-200, #c7deff)",
                fontSize: 24,
              }}
            >
              🧮
            </span>
            <div>
              <small style={{ color: "var(--blue-700, #175cd3)", fontSize: 10, fontWeight: 820, letterSpacing: ".14em" }}>
                VOL 1-4
              </small>
              <h1 style={{ margin: "6px 0 8px", fontSize: "clamp(20px, 3vw, 28px)", letterSpacing: "-.04em" }}>
                Akademik Teşvik Hesaplama Robotu
              </h1>
              <p style={{ margin: 0, color: "var(--slate, #5b6b85)", fontSize: 13, lineHeight: 1.6, maxWidth: 600 }}>
                Yayın, atıf, proje ve diğer akademik faaliyetlerini gir; toplam teşvik puanını anında gör ve hesaplamalarını kaydet.
              </p>
            </div>
          </div>
        </section>

        <div
          style={{
            marginBottom: 18,
            padding: "12px 14px",
            borderRadius: 12,
            background: "#fff8eb",
            border: "1px solid #f5d9a0",
            color: "#8a5a00",
            fontSize: 12,
            lineHeight: 1.55,
          }}
        >
          <strong>Not:</strong> Bu araç YÖK Akademik Teşvik Ödeneği Yönetmeliği&apos;nin basitleştirilmiş bir modelidir; puanlar
          yaklaşık değerlerdir. Resmî başvuru için üniversitenin ilan ettiği güncel puan cetvelini esas alın.
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
          {[
            { id: "hesapla", label: "Hesaplama Robotu" },
            { id: "gecmis", label: `Geçmiş Hesaplamalarım (${records.length})` },
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

        {message ? (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 16px",
              borderRadius: 13,
              fontSize: 13,
              fontWeight: 650,
              color: message.startsWith("Hata") ? "#984333" : "#0b5c42",
              background: message.startsWith("Hata") ? "#fff4f0" : "#effbf6",
              border: `1px solid ${message.startsWith("Hata") ? "#f2c5ba" : "#bde5d5"}`,
            }}
          >
            {message}
          </div>
        ) : null}

        {tab === "hesapla" && (
          <form onSubmit={handleKaydet} style={{ display: "grid", gap: 16 }}>
            <section
              style={{
                position: "sticky",
                top: 12,
                zIndex: 2,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                padding: "18px 22px",
                borderRadius: 16,
                background: "linear-gradient(135deg, #0e4bae, #175cd3)",
                color: "#fff",
                boxShadow: "0 18px 40px -22px rgba(14,75,174,.55)",
              }}
            >
              <div>
                <small style={{ opacity: .85, fontSize: 10, fontWeight: 800, letterSpacing: ".12em" }}>TOPLAM PUAN</small>
                <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.1 }}>{calc.totalPoints}</div>
                <small style={{ opacity: .85 }}>{calc.categoryCount} farklı kategoriden puan · asgari {TESVIK_MIN_TOTAL} puan / {TESVIK_MIN_CATEGORY_COUNT} kategori</small>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <EligibilityBadge eligible={calc.eligible} />
                <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 700, color: "#e6f0ff" }}>
                  Yıl
                  <input
                    value={yil}
                    onChange={(event) => setYil(event.target.value)}
                    style={{ height: 38, width: 90, padding: "0 10px", borderRadius: 9, border: "1px solid rgba(255,255,255,.4)", background: "rgba(255,255,255,.12)", color: "#fff", outline: "none" }}
                    maxLength={4}
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    minHeight: 42,
                    padding: "0 18px",
                    borderRadius: 12,
                    border: "none",
                    background: "#fff",
                    color: "#0e4bae",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: busy ? "not-allowed" : "pointer",
                    opacity: busy ? .7 : 1,
                  }}
                >
                  {busy ? "Kaydediliyor…" : "Hesaplamayı Kaydet"}
                </button>
              </div>
            </section>

            <section
              style={{
                padding: 22,
                borderRadius: 18,
                border: "1px solid var(--line, #e3ebf6)",
                background: "var(--white, #fff)",
                boxShadow: "var(--shadow, 0 18px 45px -28px rgba(15,43,90,.28))",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{ margin: 0, fontSize: 16 }}>Faaliyet Kategorileri</h2>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{TESVIK_CATEGORIES.length} kategori</span>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {calc.rows.map((row) => (
                  <div
                    key={row.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0,1fr) 90px 110px 100px",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 4px",
                      borderBottom: "1px solid var(--line, #e3ebf6)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 650, fontSize: 13 }}>{row.label}</div>
                      <small style={{ color: "var(--muted)", fontSize: 11 }}>Birim puan: {row.point}</small>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={row.count}
                      onChange={(event) => setCount(row.key, event.target.value)}
                      style={inputStyle}
                    />
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{row.point} puan / {row.unit}</span>
                    <strong style={{ textAlign: "right", color: row.subtotal > 0 ? "#175cd3" : "var(--muted)" }}>{row.subtotal}</strong>
                  </div>
                ))}
              </div>
            </section>
          </form>
        )}

        {tab === "gecmis" && (
          <section
            style={{
              padding: 24,
              borderRadius: 18,
              border: "1px solid var(--line, #e3ebf6)",
              background: "var(--white, #fff)",
              boxShadow: "var(--shadow, 0 18px 45px -28px rgba(15,43,90,.28))",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Kaydedilmiş Hesaplamalar</h2>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{records.length} kayıt</span>
            </div>
            {loading ? (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>Yükleniyor…</p>
            ) : records.length === 0 ? (
              <div
                style={{
                  display: "grid",
                  placeItems: "center",
                  minHeight: 120,
                  border: "1px dashed var(--line)",
                  borderRadius: 14,
                  background: "var(--bg)",
                  color: "var(--muted)",
                  fontSize: 13,
                }}
              >
                Henüz kaydedilmiş bir hesaplama yok.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                      <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Yıl</th>
                      <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Toplam Puan</th>
                      <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Kategori</th>
                      <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Kaydedildi</th>
                      <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "12px", fontWeight: 650 }}>{record.yil}</td>
                        <td style={{ padding: "12px", color: "#175cd3", fontWeight: 800 }}>{record.toplam_puan}</td>
                        <td style={{ padding: "12px", color: "var(--slate)" }}>{record.kategori_sayisi} kategori</td>
                        <td style={{ padding: "12px", color: "var(--slate)", whiteSpace: "nowrap" }}>
                          {new Date(record.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}
                        </td>
                        <td style={{ padding: "12px" }}>
                          <button
                            onClick={() => handleSil(record.id)}
                            disabled={busyId === record.id}
                            style={{
                              minHeight: 34,
                              padding: "0 12px",
                              fontSize: 12,
                              fontWeight: 700,
                              borderRadius: 10,
                              border: "1px solid #f2c5ba",
                              background: "#fff4f0",
                              color: "#984333",
                              cursor: busyId === record.id ? "not-allowed" : "pointer",
                            }}
                          >
                            {busyId === record.id ? "…" : "Sil"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
