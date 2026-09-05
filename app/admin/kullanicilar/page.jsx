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
  const [sifreAcikId, setSifreAcikId] = useState(null);
  const [sifreTaslak, setSifreTaslak] = useState("");
  const [sifreTaslak2, setSifreTaslak2] = useState("");
  const [sifreBusyId, setSifreBusyId] = useState(null);
  const [sifreBelirlenenler, setSifreBelirlenenler] = useState({});

  const [silAcikId, setSilAcikId] = useState(null);
  const [silOnayMetni, setSilOnayMetni] = useState("");
  const [silBusyId, setSilBusyId] = useState(null);

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

  function sifreBelirlemeyeBasla(user) {
    setSifreAcikId(user.id);
    setSifreTaslak("");
    setSifreTaslak2("");
    setMessage("");
  }

  async function handleSifreBelirle(user) {
    if (sifreTaslak.length < 8) {
      setMessage("Hata: Yeni şifre en az 8 karakter olmalı.");
      return;
    }
    if (sifreTaslak !== sifreTaslak2) {
      setMessage("Hata: Girdiğin iki şifre birbiriyle eşleşmiyor.");
      return;
    }
    setSifreBusyId(user.id);
    setMessage("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setMessage("Hata: Oturum bulunamadı, yeniden giriş yap.");
      setSifreBusyId(null);
      return;
    }
    try {
      const res = await fetch("/api/admin-set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId: user.id, newPassword: sifreTaslak }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage("Hata: " + (json?.error || "Şifre belirlenemedi."));
      } else {
        setMessage(`${user.email} için yeni şifre belirlendi. Şifreyi kullanıcıya güvenli bir kanaldan (yüz yüze, telefonla) ilet — burada bir daha görüntülenmeyecek.`);
        setSifreBelirlenenler((prev) => ({ ...prev, [user.id]: Date.now() }));
        setSifreAcikId(null);
        setSifreTaslak("");
        setSifreTaslak2("");
      }
    } catch (err) {
      setMessage("Hata: " + (err instanceof Error ? err.message : String(err)));
    }
    setSifreBusyId(null);
  }

  function silmeyeBasla(user) {
    setSilAcikId(user.id);
    setSilOnayMetni("");
    setMessage("");
  }

  async function handleHesapSil(user) {
    if (silOnayMetni.trim().toLowerCase() !== (user.email || "").trim().toLowerCase()) {
      setMessage("Hata: Onaylamak için kullanıcının e-posta adresini eksiksiz yazmalısın.");
      return;
    }
    setSilBusyId(user.id);
    setMessage("");
    const { error } = await supabase.rpc("campuso_admin_hesap_sil", { p_user_id: user.id });
    if (error) {
      setMessage("Hata: Hesap silinemedi: " + error.message);
    } else {
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setSilAcikId(null);
      setSilOnayMetni("");
      setMessage(`${user.full_name || user.email} hesabı kalıcı olarak silindi.`);
    }
    setSilBusyId(null);
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
          <strong>Not:</strong> Güvenlik nedeniyle hiçbir sistem kullanıcı şifrelerini düz metin olarak saklamaz ya da gösteremez —
          mevcut bir şifreyi burada "görmek" mümkün değil. Bunun yerine iki seçenek var: kullanıcıya şifre sıfırlama bağlantısı
          gönder (kendi yeni şifresini kendisi belirler), ya da yönetici olarak onun için doğrudan yeni bir şifre belirle (kullanıcının
          eski şifresi hiçbir zaman görüntülenmez/öğrenilmez — sadece üzerine yenisi yazılır). Yeni şifreyi belirledikten sonra
          kullanıcıya güvenli bir kanaldan (yüz yüze, telefonla) iletmen gerekir.
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
                        {silAcikId === user.id ? (
                          <div style={{ display: "grid", gap: 6, minWidth: 260, padding: 10, borderRadius: 10, background: "#fff4f0", border: "1px solid #f2c5ba" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#984333", lineHeight: 1.5 }}>
                              Bu hesabı ve tüm verilerini (ders kaydı, yoklama geçmişi, gönderiler vb.) KALICI olarak sileceksin. Onaylamak için e-posta adresini ({user.email}) yaz.
                            </div>
                            <input
                              autoFocus
                              value={silOnayMetni}
                              onChange={(e) => setSilOnayMetni(e.target.value)}
                              placeholder={user.email}
                              style={{ height: 32, padding: "0 10px", border: "1px solid #f2c5ba", borderRadius: 8, fontSize: 12, outline: "none" }}
                            />
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                onClick={() => handleHesapSil(user)}
                                disabled={silBusyId === user.id || silOnayMetni.trim().toLowerCase() !== (user.email || "").trim().toLowerCase()}
                                style={{ minHeight: 30, padding: "0 10px", fontSize: 11, fontWeight: 700, border: "none", background: "#c0273c", color: "#fff", borderRadius: 7, cursor: "pointer", opacity: silOnayMetni.trim().toLowerCase() !== (user.email || "").trim().toLowerCase() ? 0.5 : 1 }}
                              >
                                {silBusyId === user.id ? "Siliniyor…" : "Kalıcı Olarak Sil"}
                              </button>
                              <button
                                onClick={() => setSilAcikId(null)}
                                style={{ minHeight: 30, padding: "0 10px", fontSize: 11, fontWeight: 700, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", borderRadius: 7, cursor: "pointer" }}
                              >
                                Vazgeç
                              </button>
                            </div>
                          </div>
                        ) : sifreAcikId === user.id ? (
                          <div style={{ display: "grid", gap: 6, minWidth: 220 }}>
                            <input
                              type="password"
                              autoFocus
                              value={sifreTaslak}
                              onChange={(e) => setSifreTaslak(e.target.value)}
                              placeholder="Yeni şifre (en az 8 karakter)"
                              style={{ height: 32, padding: "0 10px", border: "1px solid #e3ebf6", borderRadius: 8, fontSize: 12, outline: "none" }}
                            />
                            <input
                              type="password"
                              value={sifreTaslak2}
                              onChange={(e) => setSifreTaslak2(e.target.value)}
                              placeholder="Yeni şifre (tekrar)"
                              style={{ height: 32, padding: "0 10px", border: "1px solid #e3ebf6", borderRadius: 8, fontSize: 12, outline: "none" }}
                            />
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                onClick={() => handleSifreBelirle(user)}
                                disabled={sifreBusyId === user.id}
                                style={{ minHeight: 30, padding: "0 10px", fontSize: 11, fontWeight: 700, border: "none", background: "#175cd3", color: "#fff", borderRadius: 7, cursor: "pointer" }}
                              >
                                {sifreBusyId === user.id ? "Kaydediliyor…" : "Kaydet"}
                              </button>
                              <button
                                onClick={() => setSifreAcikId(null)}
                                style={{ minHeight: 30, padding: "0 10px", fontSize: 11, fontWeight: 700, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", borderRadius: 7, cursor: "pointer" }}
                              >
                                Vazgeç
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
                            <button
                              onClick={() => sifreBelirlemeyeBasla(user)}
                              style={{ minHeight: 34, padding: "0 12px", fontSize: 12, fontWeight: 700, borderRadius: 10, border: "1px solid #c7deff", background: "#fff", color: "#0e4bae", cursor: "pointer" }}
                            >
                              {sifreBelirlenenler[user.id] ? "Şifreyi tekrar belirle" : "Yeni şifre belirle"}
                            </button>
                            {(user.role === "student" || user.role === "academician") && (
                              <button
                                onClick={() => silmeyeBasla(user)}
                                style={{ minHeight: 34, padding: "0 12px", fontSize: 12, fontWeight: 700, borderRadius: 10, border: "1px solid #f2c5ba", background: "#fff", color: "#984333", cursor: "pointer" }}
                              >
                                Hesabı Sil
                              </button>
                            )}
                          </div>
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
