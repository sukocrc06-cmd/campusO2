"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

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

export default function AcademicianSosyalSorumlulukPage() {
  const [kayitlar, setKayitlar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState("beklemede"); // beklemede | all

  useEffect(() => {
    async function fetchAll() {
      if (!supabase) {
        setMessage("Hata: Sosyal sorumluluk veritabanı bağlantısı yapılandırılmamış.");
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

      const { data, error } = await supabase
        .from("sosyal_sorumluluk_kayitlari")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) setMessage("Veriler alınamadı: " + error.message);
      else setKayitlar(data || []);
      setLoading(false);
    }
    fetchAll();
  }, []);

  async function handleKarar(id, karar) {
    setBusyId(id);
    const { error } = await supabase
      .from("sosyal_sorumluluk_kayitlari")
      .update({ onay_durumu: karar })
      .eq("id", id);
    if (error) {
      setMessage("Hata: " + error.message);
    } else {
      setKayitlar((prev) => prev.map((k) => (k.id === id ? { ...k, onay_durumu: karar } : k)));
      setMessage(karar === "onaylandi" ? "Faaliyet onaylandı." : "Faaliyet reddedildi.");
    }
    setBusyId(null);
  }

  const filteredKayitlar = filter === "beklemede" ? kayitlar.filter((k) => k.onay_durumu === "beklemede") : kayitlar;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg, #f5f8fc)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", color: "var(--ink, #0f1b33)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid var(--line, #e3ebf6)", background: "var(--white, #fff)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid var(--line, #e3ebf6)", background: "var(--bg, #f5f8fc)", color: "var(--blue-700, #175cd3)", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 820, letterSpacing: ".12em", color: "var(--blue-700, #175cd3)" }}>VOL 1-5 · SOSYAL SORUMLULUK</div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.02em" }}>Sosyal Sorumluluk Onayları</div>
          </div>
        </div>
        <Link href="/" className="button button-secondary" style={{ minHeight: 40, padding: "0 16px", fontSize: 13 }}>Panele dön</Link>
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
            <span style={{ display: "grid", placeItems: "center", width: 56, height: 56, borderRadius: 16, background: "linear-gradient(145deg, #fff, var(--blue-100, #e6f0ff))", border: "1px solid var(--blue-200, #c7deff)", fontSize: 24 }}>🤝</span>
            <div>
              <small style={{ color: "var(--blue-700, #175cd3)", fontSize: 10, fontWeight: 820, letterSpacing: ".14em" }}>VOL 1-5</small>
              <h1 style={{ margin: "6px 0 8px", fontSize: "clamp(20px, 3vw, 28px)", letterSpacing: "-.04em" }}>Sosyal Sorumluluk Onayları</h1>
              <p style={{ margin: 0, color: "var(--slate, #5b6b85)", fontSize: 13, lineHeight: 1.6, maxWidth: 560 }}>
                Öğrencilerin gönderdiği sosyal sorumluluk faaliyeti kayıtlarını incele, onayla veya reddet.
              </p>
            </div>
          </div>
        </section>

        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {[
            { id: "beklemede", label: "Bekleyenler" },
            { id: "all", label: "Tümü" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              style={{
                padding: "9px 16px",
                borderRadius: 999,
                border: filter === f.id ? "1px solid #175cd3" : "1px solid #e3ebf6",
                background: filter === f.id ? "#175cd3" : "#fff",
                color: filter === f.id ? "#fff" : "#5b6b85",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {message && (
          <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 13, fontSize: 13, fontWeight: 650, color: message.startsWith("Hata") ? "#984333" : "#0b5c42", background: message.startsWith("Hata") ? "#fff4f0" : "#effbf6", border: `1px solid ${message.startsWith("Hata") ? "#f2c5ba" : "#bde5d5"}` }}>
            {message}
          </div>
        )}

        <section style={{ padding: 24, borderRadius: 18, border: "1px solid var(--line, #e3ebf6)", background: "var(--white, #fff)", boxShadow: "var(--shadow, 0 18px 45px -28px rgba(15,43,90,.28))" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Faaliyet Kayıtları</h2>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{filteredKayitlar.length} kayıt</span>
          </div>

          {loading ? (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>Yükleniyor…</p>
          ) : filteredKayitlar.length === 0 ? (
            <div style={{ display: "grid", placeItems: "center", minHeight: 120, border: "1px dashed var(--line)", borderRadius: 14, background: "var(--bg)", color: "var(--muted)", fontSize: 13 }}>
              Kayıt bulunamadı.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Öğrenci</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Faaliyet</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Saat</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Durum</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKayitlar.map((k) => (
                    <tr key={k.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px", fontSize: 11, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>{k.student_id?.slice(0, 8)}…</td>
                      <td style={{ padding: "12px", fontWeight: 650 }}>
                        {k.baslik}
                        <div style={{ marginTop: 4, color: "#175cd3", fontSize: 10 }}>{k.kurum_kulup || "Kurum belirtilmedi"}</div>
                      </td>
                      <td style={{ padding: "12px", color: "var(--slate)", whiteSpace: "nowrap" }}>{k.saat} saat</td>
                      <td style={{ padding: "12px" }}><StatusBadge status={k.onay_durumu} /></td>
                      <td style={{ padding: "12px" }}>
                        {k.onay_durumu === "beklemede" ? (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => handleKarar(k.id, "onaylandi")}
                              disabled={busyId === k.id}
                              className="button button-primary"
                              style={{ minHeight: 36, padding: "0 12px", fontSize: 12 }}
                            >
                              {busyId === k.id ? "…" : "Onayla"}
                            </button>
                            <button
                              onClick={() => handleKarar(k.id, "reddedildi")}
                              disabled={busyId === k.id}
                              style={{ minHeight: 36, padding: "0 12px", fontSize: 12, fontWeight: 700, borderRadius: 11, border: "1px solid #f2c5ba", background: "#fff4f0", color: "#984333", cursor: "pointer" }}
                            >
                              Reddet
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
