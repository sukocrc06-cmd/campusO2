"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import PeriodFilter from "../../components/PeriodFilter";
import { findRecordPeriod, loadPeriodContext, recordMatchesPeriod } from "../../../lib/academic-periods";

const STATUS_MAP = {
  beklemede: { label: "Beklemede", color: "#ffb13b", bg: "#fff8eb" },
  akademisyen_onayladi: { label: "Akademisyen Onayladı", color: "#175cd3", bg: "#e6f0ff" },
  yonetici_onayladi: { label: "Tamamlandı", color: "#22b879", bg: "#effbf6" },
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

export default function AdminStajPage() {
  const [stajlar, setStajlar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [activePeriod, setActivePeriod] = useState(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState("all");

  useEffect(() => {
    async function fetchStajlar() {
      if (!supabase) {
        setMessage("Veriler alınamadı: Staj veritabanı bağlantısı yapılandırılmamış.");
        setLoading(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email?.toLowerCase() !== "suko.crc06@gmail.com") {
        setMessage("Hata: Bu sayfa yalnız yetkili yönetici hesabıyla kullanılabilir.");
        setLoading(false);
        return;
      }

      const periodContext = await loadPeriodContext();
      setPeriods(periodContext.periods);
      setActivePeriod(periodContext.activePeriod);
      setSelectedPeriodId(periodContext.activePeriod?.id || "all");

      const { data, error } = await supabase
        .from("stajlar")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) setMessage("Veriler alınamadı: " + error.message);
      else setStajlar(data || []);
      setLoading(false);
    }
    fetchStajlar();
  }, []);

  async function handleFinalOnay(id) {
    if (!supabase) {
      setMessage("Hata: Staj veritabanı bağlantısı yapılandırılmamış.");
      return;
    }
    const record = stajlar.find((staj) => staj.id === id);
    const recordPeriod = findRecordPeriod(record, periods);
    if (recordPeriod && !recordPeriod.isOpen) {
      setMessage(`Hata: ${recordPeriod.label} dönemi kapalı; arşiv kaydı değiştirilemez.`);
      return;
    }
    setBusyId(id);
    const { error } = await supabase
      .from("stajlar")
      .update({ onay_durumu: "yonetici_onayladi" })
      .eq("id", id);
    if (error) {
      setMessage("Hata: " + error.message);
    } else {
      setStajlar((prev) =>
        prev.map((s) => (s.id === id ? { ...s, onay_durumu: "yonetici_onayladi" } : s))
      );
      setMessage("Final onayı verildi.");
    }
    setBusyId(null);
  }

  const selectedPeriod = periods.find((period) => period.id === selectedPeriodId) || null;
  const filteredStajlar = selectedPeriodId === "all"
    ? stajlar
    : stajlar.filter((staj) => recordMatchesPeriod(staj, selectedPeriod));
  const stats = {
    total: filteredStajlar.length,
    pending: filteredStajlar.filter((s) => s.onay_durumu === "beklemede").length,
    academic: filteredStajlar.filter((s) => s.onay_durumu === "akademisyen_onayladi").length,
    done: filteredStajlar.filter((s) => s.onay_durumu === "yonetici_onayladi").length,
  };

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
              STAJ TAKİP
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.02em" }}>Yönetim Final Onay</div>
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
                fontSize: 24,
              }}
            >
              👔
            </span>
            <div>
              <small style={{ color: "var(--blue-700, #175cd3)", fontSize: 10, fontWeight: 820, letterSpacing: ".14em" }}>
                VOL 2 · STAJ
              </small>
              <h1 style={{ margin: "6px 0 8px", fontSize: "clamp(20px, 3vw, 28px)", letterSpacing: "-.04em" }}>
                Staj Yönetimi
              </h1>
              <p style={{ margin: 0, color: "var(--slate, #5b6b85)", fontSize: 13, lineHeight: 1.6, maxWidth: 560 }}>
                Akademisyen onayından geçen staj başvurularına final onayını verin. Tüm süreci buradan izleyin.
              </p>
            </div>
          </div>
        </section>

        <PeriodFilter
          periods={periods}
          activePeriod={activePeriod}
          selectedId={selectedPeriodId}
          onChange={setSelectedPeriodId}
        />

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 18 }}>
          {[
            { label: "Toplam", value: stats.total, color: "var(--blue-700)" },
            { label: "Bekleyen", value: stats.pending, color: "#ffb13b" },
            { label: "Akademisyen Onaylı", value: stats.academic, color: "#175cd3" },
            { label: "Tamamlanan", value: stats.done, color: "#22b879" },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: "16px 18px",
                borderRadius: 14,
                border: "1px solid var(--line)",
                background: "var(--white)",
              }}
            >
              <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>{item.label}</div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 800, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>

        {message && (
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
        )}

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
            <h2 style={{ margin: 0, fontSize: 16 }}>Başvuru Listesi</h2>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{filteredStajlar.length} kayıt</span>
          </div>

          {loading ? (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>Yükleniyor…</p>
          ) : filteredStajlar.length === 0 ? (
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
              Kayıt yok.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Öğrenci</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Kurum</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Tarihler</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Durum</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStajlar.map((staj) => {
                    const recordPeriod = findRecordPeriod(staj, periods);
                    const periodOpen = recordPeriod?.isOpen !== false;
                    return (
                    <tr key={staj.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px", fontSize: 11, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {staj.student_id?.slice(0, 8)}…
                      </td>
                      <td style={{ padding: "12px", fontWeight: 650 }}>{staj.kurum_adi}<div style={{ marginTop: 4, color: "#175cd3", fontSize: 10 }}>{recordPeriod?.label || "Dönem bilgisi yok"}</div></td>
                      <td style={{ padding: "12px", color: "var(--slate)", whiteSpace: "nowrap" }}>
                        {staj.baslangic_tarihi} → {staj.bitis_tarihi}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <StatusBadge status={staj.onay_durumu} />
                      </td>
                      <td style={{ padding: "12px" }}>
                        {staj.onay_durumu === "akademisyen_onayladi" ? (
                          <button
                            onClick={() => handleFinalOnay(staj.id)}
                            disabled={busyId === staj.id || !periodOpen}
                            className="button button-primary"
                            style={{ minHeight: 36, padding: "0 14px", fontSize: 12 }}
                          >
                            {busyId === staj.id ? "…" : "Final Onayı Ver"}
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>
                            {staj.onay_durumu === "yonetici_onayladi" ? "Tamamlandı" : "Bekliyor"}
                          </span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
