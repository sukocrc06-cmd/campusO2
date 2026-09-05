"use client";

import Link from "next/link";

// Bilimsel Çalışma Teknikleri artık Akademik Yönetim menüsünde 3 ayrı sayfa
// olarak listeleniyor (Pomodoro, Aralıklı Tekrar, Uzun Odaklı Çalışma).
// Bu sayfa yalnızca eski linkler/yer imleri için küçük bir yönlendirme
// merkezi olarak kalıyor.
const TEKNIKLER = [
  { title: "Pomodoro Tekniği", desc: "25dk odaklan, 5dk mola — döngüsel çalışma", href: "/student/calisma-teknikleri/pomodoro" },
  { title: "Aralıklı Tekrar", desc: "1 → 3 → 7 → 16 gün tekrar zinciri", href: "/student/calisma-teknikleri/aralikli-tekrar" },
  { title: "Uzun Odaklı Çalışma", desc: "Büyüyen bitki eşliğinde derin odak", href: "/student/calisma-teknikleri/uzun-odakli" },
];

export default function CalismaTeknikleriHubPage() {
  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <Link href="/?role=student" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>AKADEMİK YÖNETİM</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Bilimsel Çalışma Teknikleri</div>
        </div>
      </header>
      <main style={{ width: "min(560px, 100%)", margin: "0 auto", padding: "28px 18px 60px", display: "grid", gap: 12 }}>
        {TEKNIKLER.map((t) => (
          <Link key={t.href} href={t.href} style={{ textDecoration: "none", color: "inherit", background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{t.title}</div>
              <div style={{ fontSize: 12, color: "#8fa0bc", marginTop: 3 }}>{t.desc}</div>
            </div>
            <span style={{ fontSize: 18, color: "#8fa0bc" }}>→</span>
          </Link>
        ))}
      </main>
    </div>
  );
}
