"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { TESVIK_MIN_TOTAL, TESVIK_MIN_CATEGORY_COUNT } from "../../../lib/tesvik-categories";

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

export default function AdminTesvikPage() {
  const [records, setRecords] = useState([]);
  const [profileMap, setProfileMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedYear, setSelectedYear] = useState("all");

  useEffect(() => {
    async function fetchAll() {
      if (!supabase) {
        setMessage("Veriler alınamadı: Teşvik veritabanı bağlantısı yapılandırılmamış.");
        setLoading(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email?.toLowerCase() !== "suko.crc06@gmail.com") {
        setMessage("Hata: Bu sayfa yalnız yetkili yönetici hesabıyla kullanılabilir.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("tesvik_hesaplamalari")
        .select("*")
        .order("toplam_puan", { ascending: false });
      if (error) {
        setMessage("Veriler alınamadı: " + error.message);
        setLoading(false);
        return;
      }
      const rows = data || [];
      setRecords(rows);

      const academicianIds = Array.from(new Set(rows.map((row) => row.academician_id)));
      if (academicianIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", academicianIds);
        const map = {};
        (profiles || []).forEach((profile) => { map[profile.id] = profile; });
        setProfileMap(map);
      }
      setLoading(false);
    }
    fetchAll();
  }, []);

  const years = useMemo(() => {
    const unique = Array.from(new Set(records.map((record) => record.yil))).sort((a, b) => b.localeCompare(a));
    return unique;
  }, [records]);

  const filteredRecords = selectedYear === "all"
    ? records
    : records.filter((record) => record.yil === selectedYear);

  const eligibleCount = filteredRecords.filter((record) => record.toplam_puan >= TESVIK_MIN_TOTAL && record.kategori_sayisi >= TESVIK_MIN_CATEGORY_COUNT).length;

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
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.02em" }}>Akademik Teşvik Genel Bakış</div>
          </div>
        </div>
        <Link href="/" className="button button-secondary" style={{ minHeight: 40, padding: "0 16px", fontSize: 13 }}>
          Panele dön
        </Link>
      </header>

      <main style={{ width: "min(1040px, 100%)", margin: "0 auto", padding: "28px 20px 60px" }}>
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
              🏆
            </span>
            <div>
              <small style={{ color: "var(--blue-700, #175cd3)", fontSize: 10, fontWeight: 820, letterSpacing: ".14em" }}>
                VOL 1-4
              </small>
              <h1 style={{ margin: "6px 0 8px", fontSize: "clamp(20px, 3vw, 28px)", letterSpacing: "-.04em" }}>
                Akademisyenlerin Teşvik Hesaplamaları
              </h1>
              <p style={{ margin: 0, color: "var(--slate, #5b6b85)", fontSize: 13, lineHeight: 1.6, maxWidth: 600 }}>
                Akademisyenlerin kendi kaydettikleri teşvik puan hesaplamalarını görüntüle.
              </p>
            </div>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 }}>
          <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "#fff" }}>
            <small style={{ color: "var(--muted)", fontSize: 11 }}>Toplam kayıt</small>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{filteredRecords.length}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "#fff" }}>
            <small style={{ color: "var(--muted)", fontSize: 11 }}>Eşiği karşılayan</small>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: "#22b879" }}>{eligibleCount}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "#fff" }}>
            <small style={{ color: "var(--muted)", fontSize: 11 }}>Ortalama puan</small>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
              {filteredRecords.length ? Math.round(filteredRecords.reduce((sum, record) => sum + Number(record.toplam_puan || 0), 0) / filteredRecords.length) : 0}
            </div>
          </div>
        </section>

        {years.length > 1 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
            <button
              type="button"
              onClick={() => setSelectedYear("all")}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: selectedYear === "all" ? "1px solid #175cd3" : "1px solid #e3ebf6",
                background: selectedYear === "all" ? "#175cd3" : "#fff",
                color: selectedYear === "all" ? "#fff" : "#5b6b85",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Tüm yıllar
            </button>
            {years.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => setSelectedYear(year)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: selectedYear === year ? "1px solid #175cd3" : "1px solid #e3ebf6",
                  background: selectedYear === year ? "#175cd3" : "#fff",
                  color: selectedYear === year ? "#fff" : "#5b6b85",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {year}
              </button>
            ))}
          </div>
        )}

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
            <h2 style={{ margin: 0, fontSize: 16 }}>Hesaplamalar</h2>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{filteredRecords.length} kayıt</span>
          </div>

          {loading ? (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>Yükleniyor…</p>
          ) : filteredRecords.length === 0 ? (
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
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Akademisyen</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Yıl</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Toplam Puan</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Kategori</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Durum</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Kaydedildi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => {
                    const profile = profileMap[record.academician_id];
                    const eligible = record.toplam_puan >= TESVIK_MIN_TOTAL && record.kategori_sayisi >= TESVIK_MIN_CATEGORY_COUNT;
                    return (
                      <tr key={record.id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "12px", fontWeight: 650 }}>
                          {profile?.full_name || profile?.email || `${record.academician_id?.slice(0, 8)}…`}
                        </td>
                        <td style={{ padding: "12px", color: "var(--slate)" }}>{record.yil}</td>
                        <td style={{ padding: "12px", color: "#175cd3", fontWeight: 800 }}>{record.toplam_puan}</td>
                        <td style={{ padding: "12px", color: "var(--slate)" }}>{record.kategori_sayisi}</td>
                        <td style={{ padding: "12px" }}><EligibilityBadge eligible={eligible} /></td>
                        <td style={{ padding: "12px", color: "var(--slate)", whiteSpace: "nowrap" }}>
                          {new Date(record.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}
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
