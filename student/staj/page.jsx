"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

const STATUS_MAP = {
  beklemede: { label: "Beklemede", color: "#ffb13b", bg: "#fff8eb" },
  akademisyen_onayladi: { label: "Akademisyen Onayladı", color: "#175cd3", bg: "#e6f0ff" },
  yonetici_onayladi: { label: "Onaylandı", color: "#22b879", bg: "#effbf6" },
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

export default function StudentStajPage() {
  const [stajlar, setStajlar] = useState([]);
  const [kurum, setKurum] = useState("");
  const [baslangic, setBaslangic] = useState("");
  const [bitis, setBitis] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setFetching(false);
        setMessage("Oturum bulunamadı. Ana sayfadan giriş yapıp tekrar deneyin.");
        return;
      }
      setUserId(session.user.id);
      const { data, error } = await supabase
        .from("stajlar")
        .select("*")
        .eq("student_id", session.user.id)
        .order("created_at", { ascending: false });
      if (error) setMessage("Veriler alınamadı: " + error.message);
      else setStajlar(data || []);
      setFetching(false);
    }
    init();
  }, []);

  async function handleBasvuru(e) {
    e.preventDefault();
    if (!userId) {
      setMessage("Oturum gerekli.");
      return;
    }
    setLoading(true);
    setMessage("");
    const { error } = await supabase.from("stajlar").insert([
      {
        student_id: userId,
        kurum_adi: kurum.trim(),
        baslangic_tarihi: baslangic,
        bitis_tarihi: bitis,
        onay_durumu: "beklemede",
      },
    ]);
    if (error) {
      setMessage("Hata: " + error.message);
    } else {
      setKurum("");
      setBaslangic("");
      setBitis("");
      setMessage("Başvurunuz başarıyla gönderildi.");
      const { data } = await supabase
        .from("stajlar")
        .select("*")
        .eq("student_id", userId)
        .order("created_at", { ascending: false });
      setStajlar(data || []);
    }
    setLoading(false);
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
          <a
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
            title="Ana sayfa"
          >
            ←
          </a>
          <div>
            <div style={{ fontSize: 11, fontWeight: 820, letterSpacing: ".12em", color: "var(--blue-700, #175cd3)" }}>
              STAJ TAKİP
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.02em" }}>Öğrenci Paneli</div>
          </div>
        </div>
        <a href="/" className="button button-secondary" style={{ minHeight: 40, padding: "0 16px", fontSize: 13 }}>
          Panele dön
        </a>
      </header>

      <main style={{ width: "min(920px, 100%)", margin: "0 auto", padding: "28px 20px 60px" }}>
        <section
          className="panel"
          style={{
            padding: "24px 28px",
            marginBottom: 18,
            border: "1px solid var(--blue-200, #c7deff)",
            borderRadius: 18,
            background:
              "radial-gradient(320px 160px at 0% 0%, rgba(230,240,255,.85), transparent 70%), var(--white, #fff)",
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
                color: "var(--blue-700, #175cd3)",
                fontSize: 24,
              }}
            >
              📋
            </span>
            <div>
              <small style={{ color: "var(--blue-700, #175cd3)", fontSize: 10, fontWeight: 820, letterSpacing: ".14em" }}>
                VOL 2 · STAJ
              </small>
              <h1 style={{ margin: "6px 0 8px", fontSize: "clamp(20px, 3vw, 28px)", letterSpacing: "-.04em" }}>
                Staj Başvuru ve Takip
              </h1>
              <p style={{ margin: 0, color: "var(--slate, #5b6b85)", fontSize: 13, lineHeight: 1.6, maxWidth: 560 }}>
                Kurum bilgisini girerek staj başvurunuzu oluşturun. Akademisyen ve yönetim onay sürecini buradan takip edin.
              </p>
            </div>
          </div>
        </section>

        {message && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 16px",
              borderRadius: 13,
              fontSize: 13,
              fontWeight: 650,
              color: message.startsWith("Hata") || message.includes("bulunamadı") ? "#984333" : "#0b5c42",
              background: message.startsWith("Hata") || message.includes("bulunamadı") ? "#fff4f0" : "#effbf6",
              border: `1px solid ${message.startsWith("Hata") || message.includes("bulunamadı") ? "#f2c5ba" : "#bde5d5"}`,
            }}
          >
            {message}
          </div>
        )}

        <section
          className="panel"
          style={{
            padding: 24,
            marginBottom: 18,
            borderRadius: 18,
            border: "1px solid var(--line, #e3ebf6)",
            background: "var(--white, #fff)",
            boxShadow: "var(--shadow, 0 18px 45px -28px rgba(15,43,90,.28))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <span
              style={{
                display: "grid",
                placeItems: "center",
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "var(--blue-100, #e6f0ff)",
                color: "var(--blue-700, #175cd3)",
                fontSize: 18,
              }}
            >
              ＋
            </span>
            <div>
              <div style={{ fontSize: 10, fontWeight: 820, letterSpacing: ".12em", color: "var(--blue-700)" }}>
                YENİ BAŞVURU
              </div>
              <h2 style={{ margin: 0, fontSize: 16, letterSpacing: "-.02em" }}>Staj başvurusu oluştur</h2>
            </div>
          </div>

          <form onSubmit={handleBasvuru} style={{ display: "grid", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--slate)" }}>
              Kurum / Şirket Adı
              <input
                type="text"
                value={kurum}
                onChange={(e) => setKurum(e.target.value)}
                required
                placeholder="Örn. ABC Teknoloji A.Ş."
                style={{
                  height: 44,
                  padding: "0 14px",
                  border: "1px solid var(--line)",
                  borderRadius: 11,
                  fontSize: 14,
                  outline: "none",
                  background: "var(--white)",
                }}
              />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--slate)" }}>
                Başlangıç Tarihi
                <input
                  type="date"
                  value={baslangic}
                  onChange={(e) => setBaslangic(e.target.value)}
                  required
                  style={{
                    height: 44,
                    padding: "0 14px",
                    border: "1px solid var(--line)",
                    borderRadius: 11,
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--slate)" }}>
                Bitiş Tarihi
                <input
                  type="date"
                  value={bitis}
                  onChange={(e) => setBitis(e.target.value)}
                  required
                  style={{
                    height: 44,
                    padding: "0 14px",
                    border: "1px solid var(--line)",
                    borderRadius: 11,
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={loading || !userId}
              className="button button-primary"
              style={{ width: "fit-content", minWidth: 160, marginTop: 4 }}
            >
              {loading ? "Gönderiliyor…" : "Başvuruyu Gönder"}
            </button>
          </form>
        </section>

        <section
          className="panel"
          style={{
            padding: 24,
            borderRadius: 18,
            border: "1px solid var(--line, #e3ebf6)",
            background: "var(--white, #fff)",
            boxShadow: "var(--shadow, 0 18px 45px -28px rgba(15,43,90,.28))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 16, letterSpacing: "-.02em" }}>Mevcut Staj Durumlarım</h2>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{stajlar.length} kayıt</span>
          </div>

          {fetching ? (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>Yükleniyor…</p>
          ) : stajlar.length === 0 ? (
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
              Henüz aktif bir staj başvurunuz bulunmuyor.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {stajlar.map((staj) => (
                <div
                  key={staj.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "14px 16px",
                    border: "1px solid var(--line)",
                    borderRadius: 14,
                    background: "var(--bg)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{staj.kurum_adi}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
                      {staj.baslangic_tarihi} → {staj.bitis_tarihi}
                    </div>
                  </div>
                  <StatusBadge status={staj.onay_durumu} />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
