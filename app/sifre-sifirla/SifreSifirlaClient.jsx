"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

export default function SifreSifirlaClient() {
  const router = useRouter();
  const [status, setStatus] = useState("checking"); // checking | ready | invalid | success
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const supabase = getSupabase();
    let settled = false;

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        settled = true;
        setStatus("ready");
      }
    });

    // detectSessionInUrl işler işlemez oturum zaten kurulmuş olabilir;
    // PASSWORD_RECOVERY olayını kaçırmışsak burada yakalayalım.
    const timer = window.setTimeout(async () => {
      if (settled) return;
      const { data: { session } } = await supabase.auth.getSession();
      setStatus(session ? "ready" : "invalid");
    }, 800);

    return () => {
      window.clearTimeout(timer);
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMsg("");
    if (password.length < 6) {
      setErrorMsg("Şifre en az 6 karakter olmalı.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Şifreler eşleşmiyor.");
      return;
    }
    setLoading(true);
    const supabase = getSupabase();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    await supabase.auth.signOut();
    setStatus("success");
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
          <span style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #175cd3, #0b3b8c)", color: "#fff", fontSize: 16 }}>▣</span>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.03em" }}>Campus<span style={{ color: "#175cd3" }}>O</span></span>
        </Link>
      </header>

      <main style={{ flex: 1, display: "grid", placeItems: "center", padding: "40px 20px" }}>
        <div style={{ width: "min(420px, 100%)", background: "#fff", border: "1px solid #e3ebf6", borderRadius: 20, padding: "36px 32px", boxShadow: "0 18px 45px -28px rgba(15, 43, 90, 0.28)" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ display: "inline-grid", placeItems: "center", width: 56, height: 56, borderRadius: 16, background: "linear-gradient(145deg, #fff, #e6f0ff)", border: "1px solid #c7deff", marginBottom: 14, fontSize: 24 }}>🔑</div>
            <h1 style={{ margin: "0 0 6px", fontSize: 24, letterSpacing: "-0.04em" }}>Şifreni Sıfırla</h1>
            <p style={{ margin: 0, color: "#5b6b85", fontSize: 14 }}>CampusO hesabın için yeni bir şifre belirle</p>
          </div>

          {status === "checking" && (
            <p style={{ textAlign: "center", color: "#5b6b85", fontSize: 13 }}>Sıfırlama bağlantın doğrulanıyor…</p>
          )}

          {status === "invalid" && (
            <div>
              <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>
                Bu bağlantı geçersiz veya süresi dolmuş. Yönetici panelinden yeni bir sıfırlama bağlantısı istemen gerekiyor.
              </div>
              <Link href="/login" style={{ display: "block", textAlign: "center", color: "#175cd3", fontWeight: 700, textDecoration: "none", fontSize: 13 }}>
                Giriş sayfasına dön
              </Link>
            </div>
          )}

          {status === "ready" && (
            <>
              {errorMsg ? (
                <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{errorMsg}</div>
              ) : null}
              <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#5b6b85" }}>
                  Yeni şifre
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="En az 6 karakter" minLength={6} style={{ height: 46, padding: "0 14px", border: "1px solid #e3ebf6", borderRadius: 12, fontSize: 14, outline: "none" }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#5b6b85" }}>
                  Yeni şifre (tekrar)
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Şifreni tekrar yaz" minLength={6} style={{ height: 46, padding: "0 14px", border: "1px solid #e3ebf6", borderRadius: 12, fontSize: 14, outline: "none" }} />
                </label>
                <button type="submit" disabled={loading} style={{ width: "100%", marginTop: 8, minHeight: 48, border: "none", borderRadius: 13, color: "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", background: "linear-gradient(135deg, #175cd3, #0e4bae)", opacity: loading ? 0.6 : 1 }}>
                  {loading ? "Kaydediliyor…" : "Şifreyi Güncelle"}
                </button>
              </form>
            </>
          )}

          {status === "success" && (
            <div>
              <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#effbf6", border: "1px solid #bde5d5", color: "#0b5c42", fontSize: 13, fontWeight: 600 }}>
                Şifren güncellendi. Artık yeni şifrenle giriş yapabilirsin.
              </div>
              <button
                onClick={() => router.push("/login")}
                style={{ width: "100%", minHeight: 48, border: "none", borderRadius: 13, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg, #175cd3, #0e4bae)" }}
              >
                Giriş sayfasına git
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
