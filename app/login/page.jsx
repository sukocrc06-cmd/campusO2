"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(authError.message === "Invalid login credentials"
        ? "E-posta veya şifre hatalı."
        : authError.message);
      setLoading(false);
      return;
    }

    // Rol kontrolü
    const user = data.user;
    let role = "student";

    // Sabit admin
    if (user.email === "suko.crc06@gmail.com") {
      role = "admin";
    } else {
      // profiles tablosundan rol çek
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role) role = profile.role;
    }

    setMessage("Giriş başarılı, yönlendiriliyorsunuz…");

    // Role göre yönlendir
    if (role === "admin") {
      router.push("/admin");
    } else if (role === "academician") {
      router.push("/academician");
    } else {
      router.push("/student");
    }
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
      {/* Top bar */}
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
          href="/signup"
          className="button button-secondary"
          style={{ minHeight: 40, padding: "0 16px", fontSize: 13, textDecoration: "none" }}
        >
          Kayıt Ol
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
              🔐
            </div>
            <h1 style={{ margin: "0 0 6px", fontSize: 24, letterSpacing: "-0.04em" }}>
              Giriş Yap
            </h1>
            <p style={{ margin: 0, color: "var(--slate, #5b6b85)", fontSize: 14 }}>
              CampusO hesabınla devam et
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
              }}
            >
              {message}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: "grid", gap: 14 }}>
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
                placeholder="••••••••"
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
              {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
            </button>
          </form>

          <p style={{ marginTop: 22, textAlign: "center", fontSize: 13, color: "var(--slate)" }}>
            Hesabın yok mu?{" "}
            <a href="/signup" style={{ color: "#175cd3", fontWeight: 700, textDecoration: "none" }}>
              Kayıt Ol
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
