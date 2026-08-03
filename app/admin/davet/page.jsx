"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import emailjs from "@emailjs/browser";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

// EmailJS — Vercel env varsa onu kullan, yoksa aşağıdaki değerler
const EMAILJS_SERVICE = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || "service_r8bspvz";
const EMAILJS_TEMPLATE = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || "template_6o1q2wm";
const EMAILJS_PUBLIC = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || "BQOuVLYDOiQvWyzMc";

function randomToken() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let t = "";
  for (let i = 0; i < 32; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

export default function AdminDavetPage() {
  const [email, setEmail] = useState("");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [userId, setUserId] = useState(null);
  const [origin, setOrigin] = useState("");

  async function loadInvites(supabase) {
    const { data, error: err } = await supabase
      .from("invitations")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    else setList(data || []);
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    async function init() {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Oturum gerekli. Admin olarak giriş yapın.");
        return;
      }
      if (session.user.email !== "suko.crc06@gmail.com") {
        setError("Bu sayfa sadece admin içindir.");
        return;
      }
      setUserId(session.user.id);
      await loadInvites(supabase);
    }
    init();
  }, []);

  async function handleInvite(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const clean = email.trim().toLowerCase();
    if (!clean) {
      setError("Email gerekli.");
      setLoading(false);
      return;
    }

    const supabase = getSupabase();
    const token = randomToken();
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    const inviteLink = `${origin || "https://campus-o2.vercel.app"}/invite/${token}`;

    const { error: err } = await supabase.from("invitations").insert([
      {
        email: clean,
        token,
        role: "academician",
        invited_by: userId,
        expires_at: expires.toISOString(),
      },
    ]);

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    // EmailJS ile mail gönder
    try {
      await emailjs.send(
        EMAILJS_SERVICE,
        EMAILJS_TEMPLATE,
        {
          email: clean,
          to_email: clean,
          invite_link: inviteLink,
        },
        EMAILJS_PUBLIC
      );
      setMessage("Davet oluşturuldu ve e-posta gönderildi: " + clean);
    } catch (mailErr) {
      setMessage(
        "Davet kaydı oluştu ama mail gönderilemedi. Linki elle kopyalayın: " + inviteLink
      );
      console.error(mailErr);
    }

    setEmail("");
    await loadInvites(supabase);
    setLoading(false);
  }

  function inviteLink(token) {
    return `${origin}/invite/${token}`;
  }

  async function copyLink(token) {
    try {
      await navigator.clipboard.writeText(inviteLink(token));
      setMessage("Link panoya kopyalandı.");
    } catch {
      setMessage(inviteLink(token));
    }
  }

  async function resendMail(inv) {
    setLoading(true);
    setError("");
    const link = inviteLink(inv.token);
    try {
      await emailjs.send(
        EMAILJS_SERVICE,
        EMAILJS_TEMPLATE,
        {
          email: inv.email,
          to_email: inv.email,
          invite_link: link,
        },
        EMAILJS_PUBLIC
      );
      setMessage("Mail tekrar gönderildi: " + inv.email);
    } catch (e) {
      setError("Mail gönderilemedi. Linki kopyalayıp elle gönderin.");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <a href="/?role=admin" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
          <span style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #175cd3, #0b3b8c)", color: "#fff" }}>▣</span>
          <span style={{ fontWeight: 800, fontSize: 17 }}>Campus<span style={{ color: "#175cd3" }}>O</span></span>
        </a>
        <a href="/?role=admin" style={{ fontSize: 13, fontWeight: 700, color: "#175cd3", textDecoration: "none" }}>← Yönetici Paneli</a>
      </header>

      <main style={{ width: "min(720px, 100%)", margin: "0 auto", padding: "28px 20px 60px" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>YÖNETİM</div>
          <h1 style={{ margin: "6px 0 0", fontSize: 26, letterSpacing: "-0.03em" }}>Akademisyen Davet</h1>
          <p style={{ margin: "8px 0 0", color: "#5b6b85", fontSize: 14 }}>
            E-posta yaz → davet oluşur → hoca otomatik mail alır → linkle kayıt olur.
          </p>
        </div>

        {error ? (
          <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div>
        ) : null}
        {message ? (
          <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#effbf6", border: "1px solid #bde5d5", color: "#0b5c42", fontSize: 13, fontWeight: 600, wordBreak: "break-all" }}>{message}</div>
        ) : null}

        <form onSubmit={handleInvite} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 18, padding: 24, marginBottom: 28, boxShadow: "0 12px 32px -24px rgba(15,43,90,.25)" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#5b6b85" }}>
            Akademisyen E-posta
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="akademisyen@universite.edu.tr"
              style={{ height: 46, padding: "0 14px", border: "1px solid #e3ebf6", borderRadius: 12, fontSize: 14, outline: "none" }}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            style={{ marginTop: 14, minHeight: 46, padding: "0 20px", border: "none", borderRadius: 12, background: "linear-gradient(135deg, #175cd3, #0e4bae)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Gönderiliyor…" : "Davet Oluştur ve Mail Gönder"}
          </button>
        </form>

        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Davetler</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {list.length === 0 ? (
            <div style={{ padding: 24, borderRadius: 14, border: "1px dashed #e3ebf6", background: "#fff", color: "#8fa0bc", fontSize: 13, textAlign: "center" }}>
              Henüz davet yok.
            </div>
          ) : (
            list.map((inv) => {
              const used = Boolean(inv.used_at);
              const expired = new Date(inv.expires_at) < new Date();
              return (
                <div key={inv.id} style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 14, padding: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{inv.email}</div>
                    <div style={{ fontSize: 12, color: "#5b6b85", marginTop: 4 }}>
                      {used ? "Kullanıldı" : expired ? "Süresi doldu" : "Bekliyor"} · {new Date(inv.created_at).toLocaleString("tr-TR")}
                    </div>
                  </div>
                  {!used && !expired ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => copyLink(inv.token)} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #c7deff", background: "#e6f0ff", color: "#0e4bae", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        Linki Kopyala
                      </button>
                      <button type="button" onClick={() => resendMail(inv)} disabled={loading} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #e3ebf6", background: "#fff", color: "#5b6b85", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        Tekrar Mail
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
