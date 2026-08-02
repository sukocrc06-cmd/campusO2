"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSignUp(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();

    // Admin email ile kayıt engelle
    if (cleanEmail === "suko.crc06@gmail.com") {
      setError("Bu e-posta adresi kayıt için kullanılamaz.");
      setLoading(false);
      return;
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: "student",
        },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // profiles tablosuna da yaz (trigger yoksa)
    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email: cleanEmail,
        full_name: fullName.trim(),
        role: "student",
      });
    }

    setMessage(
      "Kayıt başarılı! E-posta adresine doğrulama linki gönderdik. Lütfen e-postanı kontrol et ve onayladıktan sonra giriş yap."
    );
    setLoading(false);

    // İsteğe bağlı: 4 saniye sonra login'e yönlendir
    setTimeout(() => {
      router.push("/login");
    }, 4500);
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--bg, #f5f8fc)",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        color: "var(--ink, #0f1b33)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 22px",
          borderBottom: "1px solid var(--line, #e3ebf6)",
          background: "var(--white, #fff)",
        }}
      >
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #175cd3, #0b3b8c)",
              color: "#fff",
              fontSize: 16,
            }}
          >
            ▣
          </span>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.03em" }}>
            Campus<span style={{ color: "#175cd3" }}>O</span>
          </span>
        </a>
        <a
          href="/login"
          className="button button-secondary"
          style={{ minHeight: 40, padding: "0 16px", fontSize: 13, textDecoration: "none" }}
        >
          Giriş Yap
        </a>
      </header>

      <main
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          padding: "40px 20px",
        }}
      >
        <div
          style={{
            width: "min(420px, 100%)",
            background: "var(--white, #fff)",
            border: "1px solid var(--line, #e3ebf6)",
            borderRadius: 20,
            padding: "36px 32px",
            boxShadow: "0 18px 45px -28px rgba(15, 43, 90, 0.28)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div
              style={{
                display: "inline-grid",
                placeItems: "center",
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "linear-gradient(145deg, #fff, #e6f0ff)",
                border: "1px solid #c7deff",
                marginBottom: 14,
                fontSize: 24,
              }}
            >
              🎓
            </div>
            <h1 style={{ margin: "0 0 6px", fontSize: 24, letterSpacing: "-0.04em" }}>
              Kayıt Ol
            </h1>
            <p style={{ margin: 0, color: "var(--slate, #5b6b85)", fontSize: 14 }}>
              Öğrenci hesabı oluştur
            </p>
          </div>

          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                borderRadius: 12,
                background: "#fff4f0",
                border: "1px solid #f2c5ba",
                color: "#984333",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          {message && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                borderRadius: 12,
                background: "#effbf6",
                border: "1px solid #bde5d5",
                color: "#0b5c42",
                fontSize: 13,
                fontWeight: 600,
                lineHeight: 1.5,
              }}
            >
              {message}
            </div>
          )}

          {!message && (
            <form onSubmit={handleSignUp} style={{ display: "grid", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--slate)" }}>
                Ad Soyad
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Adın Soyadın"
                  style={{
                    height: 46,
                    padding: "0 14px",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--slate)" }}>
                E-posta
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="ornek@email.com"
                  style={{
                    height: 46,
                    padding: "0 14px",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--slate)" }}>
                Şifre
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="En az 6 karakter"
                  minLength={6}
                  style={{
                    height: 46,
                    padding: "0 14px",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="button button-primary"
                style={{ width: "100%", marginTop: 8, minHeight: 48 }}
              >
                {loading ? "Kaydediliyor…" : "Kayıt Ol"}
              </button>
            </form>
          )}

          <p style={{ marginTop: 22, textAlign: "center", fontSize: 13, color: "var(--slate)" }}>
            Zaten hesabın var mı?{" "}
            <a href="/login" style={{ color: "#175cd3", fontWeight: 700, textDecoration: "none" }}>
              Giriş Yap
            </a>
          </p>

          <p style={{ marginTop: 14, textAlign: "center", fontSize: 12, color: "var(--muted, #8fa0bc)" }}>
            Akademisyen misin? Davet linkin olmadan kayıt olamazsın.
          </p>
        </div>
      </main>
    </div>
  );
}
