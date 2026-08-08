"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token;

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      if (!token) {
        setError("Geçersiz davet linki.");
        setLoading(false);
        return;
      }
      const supabase = getSupabase();
      const { data, error: err } = await supabase
        .rpc("campuso_get_invitation", { invite_token: token });
      const invitation = data?.[0] || null;

      if (err || !invitation) {
        setError("Davet bulunamadı, kullanılmış veya süresi dolmuş.");
        setLoading(false);
        return;
      }
      setInvite(invitation);
      setLoading(false);
    }
    load();
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!invite) return;
    setSubmitting(true);
    setError("");
    setMessage("");

    const supabase = getSupabase();

    const { data, error: authError } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          invitation_token: token,
        },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (authError) {
      // Kullanıcı zaten varsa giriş + rol güncelle
      if (authError.message?.toLowerCase().includes("already") || authError.message?.toLowerCase().includes("registered")) {
        setError("Bu email zaten kayıtlı. Giriş yapın; admin rolünüzü akademisyen yapabilir.");
        setSubmitting(false);
        return;
      }
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    setMessage(data.session
      ? "Kayıt tamam. Akademisyen paneline yönlendiriliyorsunuz…"
      : "Kayıt tamam. E-postanı doğruladıktan sonra giriş yapabilirsin.");
    setTimeout(() => {
      router.push(data.session ? "/?role=faculty" : "/login");
    }, 1500);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
          <span style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #175cd3, #0b3b8c)", color: "#fff" }}>▣</span>
          <span style={{ fontWeight: 800, fontSize: 17 }}>Campus<span style={{ color: "#175cd3" }}>O</span></span>
        </Link>
      </header>

      <main style={{ flex: 1, display: "grid", placeItems: "center", padding: "40px 20px" }}>
        <div style={{ width: "min(420px, 100%)", background: "#fff", border: "1px solid #e3ebf6", borderRadius: 20, padding: "36px 32px", boxShadow: "0 18px 45px -28px rgba(15,43,90,.28)" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>👨‍🏫</div>
            <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Akademisyen Daveti</h1>
            <p style={{ margin: 0, color: "#5b6b85", fontSize: 14 }}>Davet linkinizle hesabınızı oluşturun</p>
          </div>

          {loading ? (
            <p style={{ textAlign: "center", color: "#5b6b85" }}>Kontrol ediliyor…</p>
          ) : error ? (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>
              {error}
              <div style={{ marginTop: 12 }}>
                <a href="/login" style={{ color: "#175cd3", fontWeight: 700 }}>Giriş Yap</a>
              </div>
            </div>
          ) : message ? (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "#effbf6", border: "1px solid #bde5d5", color: "#0b5c42", fontSize: 13, fontWeight: 600 }}>{message}</div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#5b6b85" }}>
                E-posta
                <input type="email" value={invite?.email || ""} disabled style={{ height: 46, padding: "0 14px", border: "1px solid #e3ebf6", borderRadius: 12, fontSize: 14, background: "#f5f8fc" }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#5b6b85" }}>
                Ad Soyad
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Adınız Soyadınız" style={{ height: 46, padding: "0 14px", border: "1px solid #e3ebf6", borderRadius: 12, fontSize: 14 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#5b6b85" }}>
                Şifre
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="En az 6 karakter" style={{ height: 46, padding: "0 14px", border: "1px solid #e3ebf6", borderRadius: 12, fontSize: 14 }} />
              </label>
              <button type="submit" disabled={submitting} style={{ marginTop: 6, minHeight: 48, border: "none", borderRadius: 13, background: "linear-gradient(135deg, #175cd3, #0e4bae)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1 }}>
                {submitting ? "Kaydediliyor…" : "Hesabı Oluştur"}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
