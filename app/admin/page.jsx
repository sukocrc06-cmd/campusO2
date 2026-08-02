"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

export default function AdminPanel() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      // Sadece admin email
      if (session.user.email !== "suko.crc06@gmail.com") {
        router.replace("/student");
        return;
      }
      setUser(session.user);
      setLoading(false);
    }
    check();
  }, [router]);

  async function handleLogout() {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#f5f8fc", fontFamily: "system-ui" }}>
        Yükleniyor…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
          <span style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #175cd3, #0b3b8c)", color: "#fff", fontSize: 16 }}>▣</span>
          <span style={{ fontWeight: 800, fontSize: 17 }}>Campus<span style={{ color: "#175cd3" }}>O</span></span>
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#175cd3", background: "#e6f0ff", padding: "4px 10px", borderRadius: 999 }}>ADMIN</span>
          <span style={{ fontSize: 13, color: "#5b6b85" }}>{user?.email}</span>
          <button onClick={handleLogout} style={{ padding: "8px 14px", borderRadius: 11, border: "1px solid #e3ebf6", background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Çıkış
          </button>
        </div>
      </header>

      <main style={{ width: "min(960px, 100%)", margin: "0 auto", padding: "28px 20px 60px" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>YÖNETİM PANELİ</div>
          <h1 style={{ margin: "6px 0 0", fontSize: 28, letterSpacing: "-0.04em" }}>Yönetici Paneli</h1>
          <p style={{ margin: "8px 0 0", color: "#5b6b85", fontSize: 14 }}>Sistem yönetimi ve onay süreçleri</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          <a href="/admin/staj" style={{ textDecoration: "none", color: "inherit", padding: 24, borderRadius: 18, border: "1px solid #c7deff", background: "radial-gradient(280px 140px at 0% 0%, rgba(230,240,255,.9), transparent 70%), #fff", boxShadow: "0 18px 45px -28px rgba(15,43,90,.2)" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>👔</div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>STAJ</div>
            <h2 style={{ margin: "6px 0 8px", fontSize: 18 }}>Staj Final Onay</h2>
            <p style={{ margin: 0, fontSize: 13, color: "#5b6b85", lineHeight: 1.5 }}>Akademisyen onayından geçen başvurulara final onayı ver</p>
          </a>

          <div style={{ padding: 24, borderRadius: 18, border: "1px dashed #e3ebf6", background: "#fff" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>✉️</div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: "#8fa0bc" }}>YAKINDA</div>
            <h2 style={{ margin: "6px 0 8px", fontSize: 18, color: "#8fa0bc" }}>Akademisyen Davet</h2>
            <p style={{ margin: 0, fontSize: 13, color: "#8fa0bc" }}>Davet sistemi eklenecek</p>
          </div>
        </div>
      </main>
    </div>
  );
}
