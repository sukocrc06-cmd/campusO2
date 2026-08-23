"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { SOSYAL_SORUMLULUK_HEDEF_SAAT } from "../../../lib/sosyal-sorumluluk";

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

export default function AdminSosyalSorumlulukPage() {
  const [kayitlar, setKayitlar] = useState([]);
  const [profileMap, setProfileMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    async function fetchAll() {
      if (!supabase) {
        setMessage("Veriler alınamadı: Sosyal sorumluluk veritabanı bağlantısı yapılandırılmamış.");
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
        .from("sosyal_sorumluluk_kayitlari")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        setMessage("Veriler alınamadı: " + error.message);
        setLoading(false);
        return;
      }
      const rows = data || [];
      setKayitlar(rows);

      const studentIds = Array.from(new Set(rows.map((row) => row.student_id)));
      if (studentIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", studentIds);
        const map = {};
        (profiles || []).forEach((profile) => { map[profile.id] = profile; });
        setProfileMap(map);
      }
      setLoading(false);
    }
    fetchAll();
  }, []);

  const filteredKayitlar = filter === "all" ? kayitlar : kayitlar.filter((k) => k.onay_durumu === filter);

  const stats = useMemo(() => {
    const onaylanan = kayitlar.filter((k) => k.onay_durumu === "onaylandi");
    const bekleyen = kayitlar.filter((k) => k.onay_durumu === "beklemede");
    const toplamSaat = onaylanan.reduce((sum, k) => sum + Number(k.saat || 0), 0);
    const ogrenciSaatleri = {};
    onaylanan.forEach((k) => {
      ogrenciSaatleri[k.student_id] = (ogrenciSaatleri[k.student_id] || 0) + Number(k.saat || 0);
    });
    const hedefiTamamlayan = Object.values(ogrenciSaatleri).filter((saat) => saat >= SOSYAL_SORUMLULUK_HEDEF_SAAT).length;
    return {
      toplamKayit: kayitlar.length,
      bekleyen: bekleyen.length,
      toplamSaat,
      katilimciSayisi: Object.keys(ogrenciSaatleri).length,
      hedefiTamamlayan,
    };
  }, [kayitlar]);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg, #f5f8fc)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", color: "var(--ink, #0f1b33)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid var(--line, #e3ebf6)", background: "var(--white, #fff)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid var(--line, #e3ebf6)", background: "var(--bg, #f5f8fc)", color: "var(--blue-700, #175cd3)", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 820, letterSpacing: ".12em", color: "var(--blue-700, #175cd3)" }}>VOL 1-5 · SOSYAL SORUMLULUK</div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.02em" }}>Sosyal Sorumluluk Genel Bakış</div>
          </div>
        </div>
        <Link href="/" className="button button-secondary" style={{ minHeight: 40, padding: "0 16px", fontSize: 13 }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(1080px, 100%)", margin: "0 auto", padding: "28px 20px 60px" }}>
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
              <h1 style={{ margin: "6px 0 8px", fontSize: "clamp(20px, 3vw, 28px)", letterSpacing: "-.04em" }}>Kampüs Genelinde Sosyal Sorumluluk</h1>
              <p style={{ margin: 0, color: "var(--slate, #5b6b85)", fontSize: 13, lineHeight: 1.6, maxWidth: 600 }}>
                Tüm öğrencilerin sosyal sorumluluk faaliyeti kayıtlarını ve onay durumlarını görüntüle.
              </p>
            </div>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 }}>
          <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "#fff" }}>
            <small style={{ color: "var(--muted)", fontSize: 11 }}>Toplam kayıt</small>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{stats.toplamKayit}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "#fff" }}>
            <small style={{ color: "var(--muted)", fontSize: 11 }}>Onay bekleyen</small>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: "#ffb13b" }}>{stats.bekleyen}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "#fff" }}>
            <small style={{ color: "var(--muted)", fontSize: 11 }}>Katılımcı öğrenci</small>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{stats.katilimciSayisi}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "#fff" }}>
            <small style={{ color: "var(--muted)", fontSize: 11 }}>Hedefi tamamlayan</small>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: "#22b879" }}>{stats.hedefiTamamlayan}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "#fff" }}>
            <small style={{ color: "var(--muted)", fontSize: 11 }}>Toplam onaylı saat</small>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: "#175cd3" }}>{stats.toplamSaat}</div>
          </div>
        </section>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {[
            { id: "all", label: "Tümü" },
            { id: "beklemede", label: "Beklemede" },
            { id: "onaylandi", label: "Onaylandı" },
            { id: "reddedildi", label: "Reddedildi" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              style={{
                padding: "8px 14px",
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
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Kaydedildi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKayitlar.map((k) => {
                    const profile = profileMap[k.student_id];
                    return (
                      <tr key={k.id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "12px", fontWeight: 650 }}>{profile?.full_name || profile?.email || `${k.student_id?.slice(0, 8)}…`}</td>
                        <td style={{ padding: "12px" }}>
                          {k.baslik}
                          <div style={{ marginTop: 4, color: "#175cd3", fontSize: 10 }}>{k.kurum_kulup || "Kurum belirtilmedi"}</div>
                        </td>
                        <td style={{ padding: "12px", color: "var(--slate)" }}>{k.saat}</td>
                        <td style={{ padding: "12px" }}><StatusBadge status={k.onay_durumu} /></td>
                        <td style={{ padding: "12px", color: "var(--slate)", whiteSpace: "nowrap" }}>
                          {new Date(k.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}
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
