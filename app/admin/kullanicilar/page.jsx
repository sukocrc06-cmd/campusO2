"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

const ROLE_MAP = {
  student: { label: "Öğrenci", color: "#175cd3", bg: "#e6f0ff" },
  academician: { label: "Akademisyen", color: "#22b879", bg: "#effbf6" },
  admin: { label: "Yönetici", color: "#0b3b8c", bg: "#e6f0ff" },
};

function RoleBadge({ role }) {
  const r = ROLE_MAP[role] || { label: role || "Bilinmiyor", color: "#5b6b85", bg: "#f5f8fc" };
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
        color: r.color,
        background: r.bg,
        border: `1px solid ${r.color}33`,
      }}
    >
      <i style={{ width: 7, height: 7, borderRadius: "50%", background: r.color }} />
      {r.label}
    </span>
  );
}

export default function AdminKullanicilarPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [busyEmail, setBusyEmail] = useState(null);
  const [sentEmails, setSentEmails] = useState({});

  useEffect(() => {
    async function fetchUsers() {
      if (!supabase) {
        setMessage("Hata: Kullanıcı veritabanı bağlantısı yapılandırılmamış.");
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
        .from("profiles")
        .select("id, email, full_name, role, created_at")
        .order("created_at", { ascending: false });
      if (error) setMessage("Veriler alınamadı: " + error.message);
      else setUsers(data || []);
      setLoading(false);
    }
    fetchUsers();
  }, []);

  async function handleResetPassword(email) {
    if (!supabase) return;
    setBusyEmail(email);
    setMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/sifre-sifirla`,
    });
    if (error) {
      setMessage("Hata: " + error.message);
    } else {
      setSentEmails((current) => ({ ...current, [email]: Date.now() }));
      setMessage(`${email} adresine şifre sıfırlama bağlantısı gönderildi.`);
    }
    setBusyEmail(null);
  }

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== "all" && (user.role || "student") !== roleFilter) return false;
      if (!query) return true;
      return (
        user.full_name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
      );
    });
  }, [users, search, roleFilter]);

  const counts = useMemo(() => {
    const result = { total: users.length, student: 0, academician: 0, admin: 0 };
    users.forEach((user) => {
      const role = user.role || "student";
      if (result[role] !== undefined) result[role] += 1;
    });
    return result;
  }, [users]);

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
              YÖNETİM MERKEZİ
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.02em" }}>Kullanıcı Veritabanı</div>
          </div>
        </div>
        <Link href="/?role=admin" className="button button-secondary" style={{ minHeight: 40, padding: "0 16px", fontSize: 13 }}>
          Panele dön
        </Link>
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
              👥
            </span>
            <div>
              <small style={{ color: "var(--blue-700, #175cd3)", fontSize: 10, fontWeight: 820, letterSpacing: ".14em" }}>
                KULLANICI YÖNETİMİ
              </small>
              <h1 style={{ margin: "6px 0 8px", fontSize: "clamp(20px, 3vw, 28px)", letterSpacing: "-.04em" }}>
                Tüm CampusO Kullanıcıları
              </h1>
              <p style={{ margin: 0, color: "var(--slate, #5b6b85)", fontSize: 13, lineHeight: 1.6, maxWidth: 600 }}>
                Kayıtlı öğrenci, akademisyen ve yönetici hesaplarını görüntüle; gerektiğinde şifre sıfırlama bağlantısı gönder.
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
          <strong>Not:</strong> Güvenlik nedeniyle hiçbir sistem kullanıcı şifrelerini düz metin olarak saklamaz ya da gösteremez.
          Bir kullanıcının şifresiyle ilgili sorun varsa ona şifre sıfırlama bağlantısı gönderebilirsin; kullanıcı yeni şifresini
          kendisi belirler.
        </div>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 }}>
          <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "#fff" }}>
            <small style={{ color: "var(--muted)", fontSize: 11 }}>Toplam kullanıcı</small>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{counts.total}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "#fff" }}>
            <small style={{ color: "var(--muted)", fontSize: 11 }}>Öğrenci</small>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: "#175cd3" }}>{counts.student}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "#fff" }}>
            <small style={{ color: "var(--muted)", fontSize: 11 }}>Akademisyen</small>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: "#22b879" }}>{counts.academician}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--line)", background: "#fff" }}>
            <small style={{ color: "var(--muted)", fontSize: 11 }}>Yönetici</small>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: "#0b3b8c" }}>{counts.admin}</div>
          </div>
        </section>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18, alignItems: "center" }}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="İsim veya e-posta ara…"
            style={{ height: 42, minWidth: 240, padding: "0 14px", border: "1px solid #e3ebf6", borderRadius: 11, fontSize: 13, outline: "none" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { id: "all", label: "Tümü" },
              { id: "student", label: "Öğrenci" },
              { id: "academician", label: "Akademisyen" },
              { id: "admin", label: "Yönetici" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setRoleFilter(f.id)}
                style={{
                  padding: "9px 14px",
                  borderRadius: 999,
                  border: roleFilter === f.id ? "1px solid #175cd3" : "1px solid #e3ebf6",
                  background: roleFilter === f.id ? "#175cd3" : "#fff",
                  color: roleFilter === f.id ? "#fff" : "#5b6b85",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
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
            <h2 style={{ margin: 0, fontSize: 16 }}>Kullanıcılar</h2>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{filteredUsers.length} kayıt</span>
          </div>

          {loading ? (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>Yükleniyor…</p>
          ) : filteredUsers.length === 0 ? (
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
              Kayıt bulunamadı.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Ad Soyad</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>E-posta</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Rol</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Kayıt Tarihi</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px", fontWeight: 650 }}>{user.full_name || "—"}</td>
                      <td style={{ padding: "12px", color: "var(--slate)" }}>{user.email}</td>
                      <td style={{ padding: "12px" }}><RoleBadge role={user.role} /></td>
                      <td style={{ padding: "12px", color: "var(--slate)", whiteSpace: "nowrap" }}>
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })
                          : "—"}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <button
                          onClick={() => handleResetPassword(user.email)}
                          disabled={busyEmail === user.email}
                          className="button button-secondary"
                          style={{ minHeight: 34, padding: "0 12px", fontSize: 12 }}
                        >
                          {busyEmail === user.email
                            ? "Gönderiliyor…"
                            : sentEmails[user.email]
                              ? "Tekrar gönder"
                              : "Şifre sıfırlama e-postası gönder"}
                        </button>
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
