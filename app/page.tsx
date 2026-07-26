"use client";

import { useEffect, useMemo, useState } from "react";

type Role = "student" | "faculty";
type View =
  | "home"
  | "courses"
  | "exams"
  | "academic"
  | "attendance"
  | "social"
  | "map"
  | "messages"
  | "acadex"
  | "approvals"
  | "publications"
  | "incentive";

type IconName =
  | "home"
  | "book"
  | "calendar"
  | "briefcase"
  | "qr"
  | "users"
  | "map"
  | "message"
  | "spark"
  | "check"
  | "file"
  | "award"
  | "bell"
  | "search"
  | "arrow"
  | "switch"
  | "menu"
  | "close"
  | "graduation"
  | "clock"
  | "chevron";

const studentNav: { id: View; label: string; icon: IconName }[] = [
  { id: "home", label: "Ana Sayfa", icon: "home" },
  { id: "courses", label: "Derslerim", icon: "book" },
  { id: "exams", label: "Sınav Takvimi", icon: "calendar" },
  { id: "academic", label: "Akademik İşlemler", icon: "briefcase" },
  { id: "attendance", label: "QR Yoklama", icon: "qr" },
  { id: "social", label: "Sosyal Kampüs", icon: "users" },
  { id: "map", label: "CampusOMap", icon: "map" },
  { id: "messages", label: "Mesajlar", icon: "message" },
  { id: "acadex", label: "Acadex", icon: "spark" },
];

const facultyNav: { id: View; label: string; icon: IconName }[] = [
  { id: "home", label: "Ana Sayfa", icon: "home" },
  { id: "courses", label: "Derslerim", icon: "book" },
  { id: "attendance", label: "Yoklama", icon: "qr" },
  { id: "exams", label: "Sınav Takvimi", icon: "calendar" },
  { id: "messages", label: "Mesajlar", icon: "message" },
  { id: "approvals", label: "Onay Merkezi", icon: "check" },
  { id: "acadex", label: "Acadex", icon: "spark" },
  { id: "publications", label: "Yayınlarım", icon: "file" },
  { id: "incentive", label: "Akademik Teşvik", icon: "award" },
];

const viewTitles: Record<View, string> = {
  home: "Genel Bakış",
  courses: "Dersler",
  exams: "Sınav Takvimi",
  academic: "Akademik İşlemler",
  attendance: "QR Yoklama",
  social: "Sosyal Kampüs",
  map: "CampusOMap",
  messages: "Mesajlar",
  acadex: "Acadex",
  approvals: "Onay Merkezi",
  publications: "Yayınlarım",
  incentive: "Akademik Teşvik",
};

const studentCourses = [
  { code: "BUS-202", name: "İşletme İçin İstatistik II", time: "Pzt · 10.00", progress: 72, tone: "blue" },
  { code: "BUS-210", name: "Pazarlamaya Giriş", time: "Sal · 13.30", progress: 58, tone: "teal" },
  { code: "BF-202", name: "Finansal Yönetim", time: "Çar · 09.30", progress: 81, tone: "navy" },
];

const facultyCourses = [
  { code: "MIS-800", name: "Araştırma Yöntemleri", meta: "32 öğrenci · Pzt 10.00", tone: "blue" },
  { code: "MIS-301", name: "Veritabanı Sistemleri", meta: "48 öğrenci · Sal 13.00", tone: "teal" },
  { code: "MIS-410", name: "Sistem Analizi", meta: "41 öğrenci · Çar 09.00", tone: "navy" },
];

const allStudentCourses = [
  { code: "BUS-202", name: "İşletme İçin İstatistik II", instructor: "Dr. Ali İhsan Çetin", schedule: "Pazartesi · 10.00–11.50", room: "B Blok · 204", progress: 72, color: "blue" },
  { code: "BUS-210", name: "Pazarlamaya Giriş", instructor: "Doç. Dr. Selin Ergün", schedule: "Salı · 13.30–15.20", room: "A Blok · 105", progress: 58, color: "teal" },
  { code: "BF-202", name: "Finansal Yönetim", instructor: "Dr. Onur Taş", schedule: "Çarşamba · 09.30–11.20", room: "B Blok · 204", progress: 81, color: "navy" },
  { code: "BUS-204", name: "Örgütsel Davranış", instructor: "Dr. Ece Yalçın", schedule: "Perşembe · 10.00–11.50", room: "C Blok · 301", progress: 66, color: "purple" },
  { code: "ENG-202", name: "Akademik İngilizce IV", instructor: "Öğr. Gör. Mary Stone", schedule: "Perşembe · 14.00–15.50", room: "Yabancı Diller · 12", progress: 74, color: "cyan" },
  { code: "BF-204", name: "Bankacılığa Giriş", instructor: "Dr. Gökhan Ak", schedule: "Cuma · 09.00–10.50", room: "B Blok · 108", progress: 63, color: "orange" },
  { code: "TİT-102", name: "Türk İnkılap Tarihi II", instructor: "Dr. Cem Öz", schedule: "Cuma · 11.00–11.50", room: "Çevrim içi", progress: 89, color: "indigo" },
  { code: "BF-312", name: "Firma Analizi ve Değerleme", instructor: "Dr. Nur Tamer", schedule: "Cuma · 14.00–15.50", room: "A Blok · 203", progress: 69, color: "green" },
];

const transcriptRows = [
  ["BUS-103", "İşletme Matematiği", "Z", "4", "AA"],
  ["BUS-105", "Muhasebe I", "Z", "4", "AA"],
  ["BUS-107", "İşletmeye Giriş", "Z", "4", "BA"],
  ["İTB-101", "İktisada Giriş I", "S", "4", "BA"],
  ["ENG-101", "Akademik İngilizce I", "Z", "4", "CC"],
  ["TDL-101", "Türk Dili I", "S", "1", "DC"],
];

const facultyCourseDetails = [
  { code: "MIS-800", name: "Araştırma Yöntemleri", students: 32, schedule: "Pazartesi · 10.00", room: "A204", attendance: 91 },
  { code: "MIS-301", name: "Veritabanı Sistemleri", students: 48, schedule: "Salı · 13.00", room: "B106", attendance: 87 },
  { code: "MIS-410", name: "Sistem Analizi", students: 41, schedule: "Çarşamba · 09.00", room: "A103", attendance: 94 },
  { code: "MIS-215", name: "YBS'ye Giriş", students: 63, schedule: "Perşembe · 11.00", room: "Konferans 2", attendance: 83 },
];

const initialOpportunities = [
  { id: "opp-1", title: "Yapay Zeka ile Öğrenci Başarı Tahmini", owner: "Dr. Ali İhsan Çetin", type: "Tez", deadline: "18 Ağustos", match: 96, description: "Öğrenci performans verileriyle erken uyarı modeli geliştirme çalışması." },
  { id: "opp-2", title: "Blockchain Tabanlı Diploma Doğrulama", owner: "Dr. Onur Taş", type: "Araştırma", deadline: "30 Ağustos", match: 88, description: "Akademik belgeler için doğrulanabilir ve güvenli kayıt mimarisi." },
  { id: "opp-3", title: "Bilgi Sistemleri Alan Araştırması", owner: "Doç. Dr. Selin Ergün", type: "Gönüllü", deadline: "12 Eylül", match: 81, description: "Kampüs dijitalleşme olgunluğunu ölçen saha araştırması." },
];

type Opportunity = (typeof initialOpportunities)[number];
type ApprovalStatus = "pending" | "approved" | "rejected";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-7h6v7" /></>,
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
    qr: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 19v2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" /><path d="M9 3v15M15 6v15" /></>,
    message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8M8 13h5" /></>,
    spark: <><path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z" /></>,
    check: <><path d="m5 12 4 4L19 6" /><circle cx="12" cy="12" r="9" /></>,
    file: <><path d="M6 2h9l5 5v15H6Z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></>,
    award: <><circle cx="12" cy="8" r="5" /><path d="m8.5 12-1 9 4.5-3 4.5 3-1-9" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    switch: <><path d="m7 7-4 4 4 4M3 11h13a4 4 0 0 1 4 4v1" /><path d="m17 3 4 4-4 4M21 7H8a4 4 0 0 0-4 4" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    graduation: <><path d="m2 10 10-5 10 5-10 5Z" /><path d="M6 12v5c3 2 9 2 12 0v-5M22 10v6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className={`brand ${inverse ? "brand-inverse" : ""}`}>
      <span className="brand-mark"><Icon name="graduation" size={23} /></span>
      <span className="brand-word">Campus<span>O</span></span>
    </div>
  );
}

function Landing({ onEnter }: { onEnter: (role: Role) => void }) {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <Brand />
        <div className="landing-links" aria-label="Ana bağlantılar">
          <a href="#platform">Platform</a>
          <a href="#modules">Modüller</a>
          <a href="#acadex">Acadex</a>
        </div>
        <button className="button button-ghost" onClick={() => onEnter("student")}>
          Sisteme giriş <Icon name="arrow" size={17} />
        </button>
      </nav>

      <section className="hero" id="platform">
        <div className="hero-copy">
          <div className="eyebrow"><span /> Kampüsün dijital işletim sistemi</div>
          <h1>Kampüsteki her iş,<br /><em>tek bir yerde.</em></h1>
          <p>
            Derslerden yoklamaya, akademik süreçlerden sosyal yaşama kadar
            öğrencileri ve akademisyenleri aynı akıllı kampüs deneyiminde buluşturur.
          </p>
          <div className="hero-actions">
            <button className="button button-primary" onClick={() => onEnter("student")}>
              Öğrenci panelini keşfet <Icon name="arrow" size={18} />
            </button>
            <button className="button button-secondary" onClick={() => onEnter("faculty")}>
              Akademisyen görünümü
            </button>
          </div>
          <div className="hero-trust">
            <div className="trust-avatars"><span>BU</span><span>Aİ</span><span>EY</span></div>
            <p><strong>Tek oturum, iki deneyim.</strong><br />Rolüne göre kişiselleşen kampüs.</p>
          </div>
        </div>

        <div className="hero-product" aria-label="CampusO öğrenci paneli ön izlemesi">
          <div className="product-glow" />
          <div className="product-window">
            <div className="mini-sidebar">
              <Brand inverse />
              <div className="mini-nav">
                <span className="active"><Icon name="home" size={17} /></span>
                <span><Icon name="book" size={17} /></span>
                <span><Icon name="calendar" size={17} /></span>
                <span><Icon name="message" size={17} /></span>
              </div>
              <span className="mini-avatar">BU</span>
            </div>
            <div className="mini-main">
              <div className="mini-top"><span>Merhaba, Barış 👋</span><span className="mini-bell"><Icon name="bell" size={15} /></span></div>
              <div className="mini-id-card">
                <div><small>GENEL NOT ORTALAMASI</small><strong>2,50</strong><span>/ 4.00</span></div>
                <div className="mini-progress"><i /></div>
                <p>İşletme Fakültesi · YBS</p>
              </div>
              <div className="mini-grid">
                <div><span className="mini-icon blue"><Icon name="book" size={16} /></span><b>Derslerim</b><small>8 aktif ders</small></div>
                <div><span className="mini-icon teal"><Icon name="qr" size={16} /></span><b>QR Yoklama</b><small>MIS-800</small></div>
                <div><span className="mini-icon coral"><Icon name="spark" size={16} /></span><b>Acadex</b><small>3 yeni fırsat</small></div>
              </div>
              <div className="mini-event"><span>12</span><div><b>Kariyer Günleri</b><small>12 Temmuz · 13.00</small></div><i><Icon name="chevron" size={15} /></i></div>
            </div>
          </div>
          <div className="floating-chip chip-one"><Icon name="check" size={16} /><span><b>Yoklama tamamlandı</b><small>32 / 32 öğrenci</small></span></div>
          <div className="floating-chip chip-two"><Icon name="spark" size={16} /><span><b>Yeni Acadex eşleşmesi</b><small>%94 ortak ilgi alanı</small></span></div>
        </div>
      </section>

      <section className="feature-strip" id="modules">
        <div><Icon name="book" /><span><b>Akademik yaşam</b><small>Ders, not ve sınav süreçleri</small></span></div>
        <div><Icon name="qr" /><span><b>Akıllı yoklama</b><small>Hızlı ve güvenli QR takibi</small></span></div>
        <div id="acadex"><Icon name="spark" /><span><b>Acadex ağı</b><small>Danışman, araştırma ve yayın</small></span></div>
        <div><Icon name="users" /><span><b>Sosyal kampüs</b><small>Kulüpler, etkinlikler ve yaşam</small></span></div>
      </section>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: IconName;
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <article className="stat-card">
      <span className={`stat-icon ${tone}`}><Icon name={icon} size={20} /></span>
      <div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div>
    </article>
  );
}

function StudentDashboard({ navigate }: { navigate: (view: View) => void }) {
  return (
    <div className="dashboard-page">
      <section className="welcome-banner student-banner">
        <div>
          <span className="banner-kicker">2026 · Güz dönemi</span>
          <h2>Merhaba Barış, kampüse hoş geldin.</h2>
          <p>Bugünkü derslerini, yaklaşan işlerini ve kampüs gündemini senin için bir araya getirdik.</p>
        </div>
        <div className="gpa-orbit"><span>GNO</span><strong>2,50</strong><small>/ 4,00</small></div>
      </section>

      <section className="stat-grid">
        <StatCard icon="book" label="Aktif ders" value="8" detail="Bu dönem" tone="blue" />
        <StatCard icon="clock" label="Yaklaşan sınav" value="3" detail="Önümüzdeki 14 gün" tone="coral" />
        <StatCard icon="check" label="Katılım oranı" value="%92" detail="+4% geçen aya göre" tone="green" />
        <StatCard icon="spark" label="Acadex eşleşmesi" value="12" detail="3 yeni fırsat" tone="teal" />
      </section>

      <div className="content-grid">
        <section className="panel panel-wide">
          <div className="section-heading">
            <div><span>AKADEMİK</span><h3>Bugünkü dersler</h3></div>
            <button onClick={() => navigate("courses")}>Tümünü gör <Icon name="arrow" size={15} /></button>
          </div>
          <div className="course-list">
            {studentCourses.map((course) => (
              <button className="course-row" key={course.code} onClick={() => navigate("courses")}>
                <span className={`course-code ${course.tone}`}>{course.code}</span>
                <span className="course-info"><b>{course.name}</b><small>{course.time} · B Blok 204</small></span>
                <span className="course-progress"><i style={{ width: `${course.progress}%` }} /><small>%{course.progress}</small></span>
                <Icon name="chevron" size={17} />
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div><span>TAKVİM</span><h3>Yaklaşanlar</h3></div>
            <button aria-label="Sınav takvimini aç" onClick={() => navigate("exams")}><Icon name="calendar" size={17} /></button>
          </div>
          <div className="timeline">
            <button onClick={() => navigate("exams")}><time><b>02</b>Tem</time><span><b>BUS-202 Final Sınavı</b><small>10.00 · A Blok 103</small></span><i className="red" /></button>
            <button onClick={() => navigate("exams")}><time><b>03</b>Tem</time><span><b>BF-202 Proje Teslimi</b><small>23.59 · CampusO</small></span><i className="blue" /></button>
            <button onClick={() => navigate("social")}><time><b>12</b>Tem</time><span><b>Kariyer Günleri</b><small>13.00 · Konferans Salonu</small></span><i className="amber" /></button>
          </div>
        </section>

        <section className="panel quick-panel">
          <div className="section-heading"><div><span>KISAYOLLAR</span><h3>Hızlı erişim</h3></div></div>
          <div className="quick-actions">
            <button onClick={() => navigate("attendance")}><span className="coral"><Icon name="qr" /></span><b>QR Yoklama</b><small>Derse katıl</small></button>
            <button onClick={() => navigate("academic")}><span className="blue"><Icon name="briefcase" /></span><b>Staj İşlemleri</b><small>Başvurunu yönet</small></button>
            <button onClick={() => navigate("map")}><span className="teal"><Icon name="map" /></span><b>CampusOMap</b><small>Kampüste yolunu bul</small></button>
            <button onClick={() => navigate("acadex")}><span className="navy"><Icon name="spark" /></span><b>Acadex</b><small>Araştırmacı keşfet</small></button>
          </div>
        </section>
      </div>
    </div>
  );
}

function FacultyDashboard({ navigate }: { navigate: (view: View) => void }) {
  return (
    <div className="dashboard-page">
      <section className="welcome-banner faculty-banner">
        <div>
          <span className="banner-kicker">2026 · Güz dönemi</span>
          <h2>İyi günler, Dr. Ali İhsan Çetin.</h2>
          <p>Dersleriniz, bekleyen talepler ve akademik performansınız tek merkezde hazır.</p>
        </div>
        <div className="faculty-total"><strong>184</strong><span>kayıtlı öğrenci</span><small>4 aktif ders</small></div>
      </section>

      <section className="stat-grid">
        <StatCard icon="book" label="Aktif ders" value="4" detail="184 öğrenci" tone="blue" />
        <StatCard icon="check" label="Bekleyen talep" value="4" detail="2 referans · 2 staj" tone="coral" />
        <StatCard icon="file" label="Toplam yayın" value="18" detail="342 atıf" tone="teal" />
        <StatCard icon="award" label="Teşvik puanı" value="742" detail="+86 bu dönem" tone="green" />
      </section>

      <div className="content-grid">
        <section className="panel panel-wide">
          <div className="section-heading">
            <div><span>DERS YÖNETİMİ</span><h3>Bugünkü program</h3></div>
            <button onClick={() => navigate("courses")}>Tüm dersler <Icon name="arrow" size={15} /></button>
          </div>
          <div className="course-list">
            {facultyCourses.map((course, index) => (
              <button className="course-row" key={course.code} onClick={() => navigate("courses")}>
                <span className={`course-code ${course.tone}`}>{course.code}</span>
                <span className="course-info"><b>{course.name}</b><small>{course.meta}</small></span>
                <span className="student-count"><Icon name="users" size={16} /> {course.meta.split(" ")[0]}</span>
                <span className={`live-pill ${index === 0 ? "live" : ""}`}>{index === 0 ? "Şimdi" : "Yakında"}</span>
                <Icon name="chevron" size={17} />
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div><span>ONAY MERKEZİ</span><h3>Bekleyen talepler</h3></div>
            <button onClick={() => navigate("approvals")}>4 talep</button>
          </div>
          <div className="request-preview">
            <button onClick={() => navigate("approvals")}><span className="avatar blue">EY</span><span><b>Ece Yıldız</b><small>Referans mektubu</small></span><i>Bugün</i></button>
            <button onClick={() => navigate("approvals")}><span className="avatar teal">MK</span><span><b>Mert Kelemci</b><small>Staj kabul formu</small></span><i>Dün</i></button>
            <button onClick={() => navigate("approvals")}><span className="avatar navy">CÖ</span><span><b>Ceren Öz</b><small>Staj sigorta belgesi</small></span><i>Dün</i></button>
          </div>
        </section>

        <section className="panel quick-panel">
          <div className="section-heading"><div><span>KISAYOLLAR</span><h3>Hızlı işlemler</h3></div></div>
          <div className="quick-actions">
            <button onClick={() => navigate("attendance")}><span className="coral"><Icon name="qr" /></span><b>Yoklama Başlat</b><small>QR kodu oluştur</small></button>
            <button onClick={() => navigate("messages")}><span className="blue"><Icon name="message" /></span><b>Mesajlar</b><small>4 yeni konuşma</small></button>
            <button onClick={() => navigate("publications")}><span className="teal"><Icon name="file" /></span><b>Yayın Ekle</b><small>Akademik profili güncelle</small></button>
            <button onClick={() => navigate("acadex")}><span className="navy"><Icon name="spark" /></span><b>Fırsat Paylaş</b><small>Öğrencilerle buluş</small></button>
          </div>
        </section>
      </div>
    </div>
  );
}

function ModuleHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="module-header">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children && <div className="module-header-actions">{children}</div>}
    </header>
  );
}

function CoursesModule({
  role,
  navigate,
}: {
  role: Role;
  navigate: (view: View) => void;
}) {
  const [studentTab, setStudentTab] = useState<"current" | "transcript">("current");
  const [query, setQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(role === "student" ? "BUS-202" : "MIS-800");

  const filteredStudentCourses = allStudentCourses.filter((course) =>
    `${course.code} ${course.name} ${course.instructor}`.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr"))
  );
  const selectedStudent = allStudentCourses.find((course) => course.code === selectedCourse) ?? allStudentCourses[0];
  const selectedFaculty = facultyCourseDetails.find((course) => course.code === selectedCourse) ?? facultyCourseDetails[0];

  return (
    <div className="module-page">
      <ModuleHeader
        eyebrow={role === "student" ? "AKADEMİK YAŞAM" : "DERS YÖNETİMİ"}
        title={role === "student" ? "Derslerim" : "Verdiğim Dersler"}
        description={role === "student"
          ? "Ders programın, ilerleme durumun ve geçmiş dönem sonuçların tek ekranda."
          : "Ders içeriklerini, sınıf listelerini ve katılım durumunu tek merkezden yönet."}
      >
        {role === "student" ? (
          <label className="module-search">
            <Icon name="search" size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ders ara..." aria-label="Ders ara" />
          </label>
        ) : (
          <button className="button button-primary" onClick={() => navigate("attendance")}>
            <Icon name="qr" size={17} /> Yoklama başlat
          </button>
        )}
      </ModuleHeader>

      {role === "student" ? (
        <>
          <div className="module-tabs" role="tablist" aria-label="Ders görünümü">
            <button className={studentTab === "current" ? "active" : ""} onClick={() => setStudentTab("current")}>Bu dönem <span>8</span></button>
            <button className={studentTab === "transcript" ? "active" : ""} onClick={() => setStudentTab("transcript")}>Transkript</button>
          </div>

          {studentTab === "current" ? (
            <>
              <div className="course-module-grid">
                {filteredStudentCourses.map((course) => (
                  <button
                    key={course.code}
                    className={`course-module-card ${selectedCourse === course.code ? "selected" : ""}`}
                    onClick={() => setSelectedCourse(course.code)}
                  >
                    <span className={`course-card-top ${course.color}`}>
                      <i>{course.code}</i>
                      <Icon name="book" size={25} />
                    </span>
                    <span className="course-card-copy">
                      <b>{course.name}</b>
                      <small>{course.instructor}</small>
                      <span><Icon name="clock" size={14} /> {course.schedule}</span>
                      <span><Icon name="map" size={14} /> {course.room}</span>
                    </span>
                    <span className="card-progress">
                      <span><i style={{ width: `${course.progress}%` }} /></span>
                      <small>%{course.progress} tamamlandı</small>
                    </span>
                  </button>
                ))}
              </div>

              <section className="course-detail panel">
                <div className={`detail-code ${selectedStudent.color}`}>{selectedStudent.code}</div>
                <div className="detail-copy">
                  <span>SEÇİLİ DERS</span>
                  <h3>{selectedStudent.name}</h3>
                  <p>{selectedStudent.instructor} · {selectedStudent.schedule} · {selectedStudent.room}</p>
                </div>
                <div className="detail-metrics">
                  <span><b>12</b><small>Ders notu</small></span>
                  <span><b>4</b><small>Ödev</small></span>
                  <span><b>%92</b><small>Katılım</small></span>
                </div>
                <button className="button button-secondary">Ders alanına git <Icon name="arrow" size={16} /></button>
              </section>
            </>
          ) : (
            <section className="table-panel panel">
              <div className="table-summary">
                <div><span>GENEL NOT ORTALAMASI</span><strong>2,50</strong><small>/ 4,00</small></div>
                <div><span>TAMAMLANAN AKTS</span><strong>112</strong><small>/ 240</small></div>
                <div><span>BAŞARILI DERS</span><strong>29</strong><small>ders</small></div>
              </div>
              <div className="data-table transcript-table">
                <div className="data-head"><span>Kod</span><span>Ders</span><span>Tür</span><span>AKTS</span><span>Not</span></div>
                {transcriptRows.map((row) => (
                  <div className="data-row" key={row[0]}>
                    <b>{row[0]}</b><span>{row[1]}</span><span>{row[2]}</span><span>{row[3]}</span><span className="grade-badge">{row[4]}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="faculty-courses-layout">
          <section className="faculty-course-list panel">
            <div className="section-heading"><div><span>2026 GÜZ</span><h3>Dersler</h3></div><b>4 ders</b></div>
            {facultyCourseDetails.map((course) => (
              <button key={course.code} className={selectedCourse === course.code ? "active" : ""} onClick={() => setSelectedCourse(course.code)}>
                <span className="faculty-course-code">{course.code}</span>
                <span><b>{course.name}</b><small>{course.schedule} · {course.room}</small></span>
                <i>{course.students}</i>
                <Icon name="chevron" size={16} />
              </button>
            ))}
          </section>

          <section className="roster-panel panel">
            <div className="roster-heading">
              <div><span>{selectedFaculty.code}</span><h3>{selectedFaculty.name}</h3><p>{selectedFaculty.students} öğrenci · Ortalama katılım %{selectedFaculty.attendance}</p></div>
              <button className="button button-primary" onClick={() => navigate("attendance")}><Icon name="qr" size={16} /> Yoklama</button>
            </div>
            <div className="roster-stats">
              <span><b>{selectedFaculty.students}</b><small>Kayıtlı</small></span>
              <span><b>%{selectedFaculty.attendance}</b><small>Katılım</small></span>
              <span><b>6</b><small>İçerik</small></span>
              <span><b>2</b><small>Ödev</small></span>
            </div>
            <div className="data-table roster-table">
              <div className="data-head"><span>Öğrenci</span><span>Numara</span><span>Katılım</span><span>Durum</span></div>
              {[
                ["Barış Uysal", "19030411049", "%92", "Düzenli"],
                ["Alptunga A. Ulutaş", "19030411031", "%76", "Takip"],
                ["Mert Kelemci", "19030411027", "%100", "Düzenli"],
                ["Ceren Öz", "19030411018", "%88", "Düzenli"],
                ["Ece Yıldız", "19030411052", "%95", "Düzenli"],
              ].map((row) => (
                <div className="data-row" key={row[1]}>
                  <span className="student-cell"><i className="avatar blue">{row[0].split(" ").map((part) => part[0]).slice(0, 2).join("")}</i><b>{row[0]}</b></span>
                  <span>{row[1]}</span><span>{row[2]}</span><span className={row[3] === "Takip" ? "status-warning" : "status-success"}>{row[3]}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ExamsModule({ role, onToast }: { role: Role; onToast: (message: string) => void }) {
  const examEvents = role === "student"
    ? [
        { day: 2, type: "exam", title: "BUS-202 Final Sınavı", time: "10.00", room: "A Blok · 103", note: "Hesap makinesi getirilebilir." },
        { day: 3, type: "assignment", title: "BF-202 Proje Teslimi", time: "23.59", room: "CampusO", note: "Grup raporu PDF olarak teslim edilecek." },
        { day: 6, type: "exam", title: "ENG-202 Final Sınavı", time: "11.00", room: "Yabancı Diller · 12", note: "Sözlük kullanımı serbest." },
        { day: 8, type: "exam", title: "BF-312 Vize Sınavı", time: "14.00", room: "B Blok · 201", note: "Dört ünite kapsam dahilinde." },
        { day: 12, type: "event", title: "Kariyer Günleri", time: "13.00", room: "Konferans Salonu", note: "Katılım tüm öğrencilere açık." },
      ]
    : [
        { day: 2, type: "exam", title: "MIS-800 Final Sınavı", time: "10.00", room: "A Blok · 103", note: "Gözetmen: Dr. Ali İhsan Çetin" },
        { day: 3, type: "assignment", title: "MIS-301 Proje Son Günü", time: "23.59", room: "CampusO", note: "48 öğrencinin teslimi bekleniyor." },
        { day: 6, type: "exam", title: "MIS-410 Final Sınavı", time: "09.00", room: "B Blok · 201", note: "Gözetmen: Dr. Ali İhsan Çetin" },
        { day: 9, type: "assignment", title: "Not Girişi Son Tarihi", time: "17.00", room: "ÖBS", note: "MIS-301 dönem sonu notları." },
        { day: 12, type: "event", title: "Fakülte Kurulu Toplantısı", time: "13.00", room: "Kurul Salonu", note: "Gündem: 2026–2027 ders planları." },
      ];
  const [selectedDay, setSelectedDay] = useState(2);
  const selectedEvent = examEvents.find((event) => event.day === selectedDay) ?? examEvents[0];
  const calendarDays = Array.from({ length: 35 }, (_, index) => index < 2 ? null : index - 1);

  return (
    <div className="module-page">
      <ModuleHeader
        eyebrow="AKADEMİK TAKVİM"
        title="Sınav ve Etkinlik Takvimi"
        description={role === "student" ? "Sınavlarını, teslimlerini ve kampüs etkinliklerini kaçırma." : "Sınav görevlerini, teslim tarihlerini ve fakülte etkinliklerini yönet."}
      >
        <button className="button button-secondary" onClick={() => onToast("Takvim bağlantısı kopyalandı.")}><Icon name="calendar" size={17} /> Takvimime ekle</button>
      </ModuleHeader>

      <div className="calendar-layout">
        <section className="calendar-panel panel">
          <div className="calendar-title"><div><span>2026</span><h3>Temmuz</h3></div><span className="calendar-nav"><button aria-label="Önceki ay">‹</button><button aria-label="Sonraki ay">›</button></span></div>
          <div className="calendar-grid">
            {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((day) => <b key={day}>{day}</b>)}
            {calendarDays.map((day, index) => {
              const event = examEvents.find((item) => item.day === day);
              return day ? (
                <button key={day} className={`${event ? `has-event ${event.type}` : ""} ${selectedDay === day ? "selected" : ""}`} onClick={() => event && setSelectedDay(day)}>
                  <span>{day}</span>{event && <i />}
                </button>
              ) : <span key={`empty-${index}`} />;
            })}
          </div>
          <div className="calendar-legend"><span><i className="exam" />Sınav</span><span><i className="assignment" />Teslim / Son tarih</span><span><i className="event" />Etkinlik</span></div>
        </section>

        <aside className="event-detail-panel panel">
          <span className={`event-type ${selectedEvent.type}`}>{selectedEvent.type === "exam" ? "SINAV" : selectedEvent.type === "assignment" ? "TESLİM" : "ETKİNLİK"}</span>
          <div className="event-date"><strong>{String(selectedEvent.day).padStart(2, "0")}</strong><span>Temmuz<br />2026</span></div>
          <h3>{selectedEvent.title}</h3>
          <p>{selectedEvent.note}</p>
          <div className="event-facts">
            <span><Icon name="clock" size={17} /><b>{selectedEvent.time}</b><small>Saat</small></span>
            <span><Icon name="map" size={17} /><b>{selectedEvent.room}</b><small>Konum</small></span>
          </div>
          <button className="button button-primary" onClick={() => onToast(`${selectedEvent.title} için hatırlatıcı oluşturuldu.`)}>Hatırlatıcı oluştur</button>
        </aside>
      </div>

      <section className="agenda-panel panel">
        <div className="section-heading"><div><span>TEMMUZ 2026</span><h3>Yaklaşan program</h3></div></div>
        <div className="agenda-list">
          {examEvents.map((event) => (
            <button key={`${event.day}-${event.title}`} onClick={() => setSelectedDay(event.day)} className={selectedDay === event.day ? "active" : ""}>
              <time><b>{String(event.day).padStart(2, "0")}</b><small>TEM</small></time>
              <i className={event.type} />
              <span><b>{event.title}</b><small>{event.time} · {event.room}</small></span>
              <span className={`agenda-tag ${event.type}`}>{event.type === "exam" ? "Sınav" : event.type === "assignment" ? "Teslim" : "Etkinlik"}</span>
              <Icon name="chevron" size={16} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function AcademicModule({ onToast }: { onToast: (message: string) => void }) {
  const processes = [
    { id: "internship", title: "Staj İşlemleri", description: "Başvuru, belge ve danışman onay süreci", icon: "briefcase" as IconName, progress: 67, step: "Danışman onayı bekleniyor", tone: "blue" },
    { id: "adaptation", title: "İntibak İşlemleri", description: "Ders eşleştirme ve muafiyet başvuruları", icon: "check" as IconName, progress: 100, step: "Tamamlandı", tone: "teal" },
    { id: "graduation", title: "Mezuniyet Kontrolü", description: "AKTS, zorunlu ders ve mezuniyet şartları", icon: "graduation" as IconName, progress: 47, step: "112 / 240 AKTS", tone: "navy" },
    { id: "erasmus", title: "Değişim Programları", description: "Erasmus+, Farabi ve Mevlana başvuruları", icon: "map" as IconName, progress: 25, step: "Başvuru dönemi açık", tone: "orange" },
  ];
  const [activeProcess, setActiveProcess] = useState(processes[0]);

  return (
    <div className="module-page">
      <ModuleHeader eyebrow="ÖĞRENCİ İŞLERİ" title="Akademik İşlemler" description="Başvuru ve belgelerini fakülteye gitmeden, adım adım takip et." />
      <div className="process-grid">
        {processes.map((process) => (
          <button key={process.id} className={`process-card panel ${activeProcess.id === process.id ? "active" : ""}`} onClick={() => setActiveProcess(process)}>
            <span className={`process-icon ${process.tone}`}><Icon name={process.icon} size={22} /></span>
            <span className="process-copy"><b>{process.title}</b><small>{process.description}</small></span>
            <span className="process-progress"><i><em style={{ width: `${process.progress}%` }} /></i><small>%{process.progress}</small></span>
            <span className="process-step">{process.step}</span>
          </button>
        ))}
      </div>
      <section className="process-detail panel">
        <div className="process-detail-head">
          <span className={`process-icon ${activeProcess.tone}`}><Icon name={activeProcess.icon} size={22} /></span>
          <div><span>AKTİF SÜREÇ</span><h3>{activeProcess.title}</h3><p>{activeProcess.description}</p></div>
          <button className="button button-secondary" onClick={() => onToast(`${activeProcess.title} dosyası görüntüleniyor.`)}><Icon name="file" size={16} /> Belgelerim</button>
        </div>
        <div className="process-steps">
          {[
            ["Başvuru oluşturuldu", "12 Haziran · 14.32", "done"],
            ["Belgeler kontrol edildi", "14 Haziran · 09.18", "done"],
            ["Danışman değerlendirmesi", "İşlem devam ediyor", "current"],
            ["Fakülte onayı", "Danışman onayından sonra", "waiting"],
          ].map((step, index) => (
            <div className={step[2]} key={step[0]}>
              <span>{step[2] === "done" ? <Icon name="check" size={15} /> : index + 1}</span>
              <b>{step[0]}</b><small>{step[1]}</small>
            </div>
          ))}
        </div>
        <div className="info-banner"><Icon name="bell" size={18} /><span><b>Bilgilendirme</b><small>Danışmanın işlemi tamamladığında CampusO sana anında bildirim gönderecek.</small></span></div>
      </section>
    </div>
  );
}

function AttendanceModule({ role, onToast }: { role: Role; onToast: (message: string) => void }) {
  const [scanned, setScanned] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!sessionActive || count >= 32) return;
    const timer = window.setInterval(() => setCount((current) => Math.min(32, current + 2)), 650);
    return () => window.clearInterval(timer);
  }, [sessionActive, count]);

  function scanAttendance() {
    setScanned(true);
    onToast("MIS-800 yoklamasına başarıyla katıldın.");
  }

  return (
    <div className="module-page">
      <ModuleHeader
        eyebrow="AKILLI KATILIM"
        title={role === "student" ? "QR Yoklama" : "Yoklama Yönetimi"}
        description={role === "student" ? "Dersin QR kodunu okut, katılımın anında kaydedilsin." : "Tek kullanımlık QR koduyla hızlı, güvenli ve takip edilebilir yoklama başlat."}
      />
      {role === "student" ? (
        <div className="attendance-layout">
          <section className="scanner-panel panel">
            <div className={`scan-viewport ${scanned ? "success" : ""}`}>
              {scanned ? (
                <div className="scan-success"><span><Icon name="check" size={35} /></span><h3>Yoklama tamamlandı</h3><p>MIS-800 · Araştırma Yöntemleri</p></div>
              ) : (
                <>
                  <span className="scan-corner top-left" /><span className="scan-corner top-right" />
                  <span className="scan-corner bottom-left" /><span className="scan-corner bottom-right" />
                  <div className="scan-line" />
                  <div className="qr-art" aria-hidden="true" />
                </>
              )}
            </div>
            <button className="button button-primary scan-action" onClick={scanAttendance} disabled={scanned}>
              <Icon name={scanned ? "check" : "qr"} size={18} /> {scanned ? "Katılım kaydedildi" : "QR kodunu okut"}
            </button>
            <p className="privacy-note"><Icon name="check" size={14} /> Kod yalnızca ders süresince geçerlidir ve konum verisi saklanmaz.</p>
          </section>
          <aside className="active-class-card panel">
            <span className="live-indicator"><i /> ŞİMDİ DEVAM EDİYOR</span>
            <span className="class-symbol"><Icon name="book" size={25} /></span>
            <h3>MIS-800</h3><p>Araştırma Yöntemleri</p>
            <div><span><Icon name="clock" size={16} /><b>10.00–11.50</b><small>Ders saati</small></span><span><Icon name="map" size={16} /><b>A Blok · 204</b><small>Derslik</small></span></div>
            <small className="instructor">Dr. Ali İhsan Çetin</small>
          </aside>
          <section className="attendance-history panel">
            <div className="section-heading"><div><span>GEÇMİŞ</span><h3>Son katılımların</h3></div><b>%92 dönem ortalaması</b></div>
            {[
              ["BUS-202", "İşletme İçin İstatistik II", "24 Haziran · 10.02", "Katıldı"],
              ["BF-202", "Finansal Yönetim", "23 Haziran · 09.31", "Katıldı"],
              ["BUS-210", "Pazarlamaya Giriş", "22 Haziran · 13.42", "Geç"],
            ].map((row) => <div key={row[0]}><span className="course-code blue">{row[0]}</span><span><b>{row[1]}</b><small>{row[2]}</small></span><i className={row[3] === "Geç" ? "late" : ""}>{row[3]}</i></div>)}
          </section>
        </div>
      ) : (
        <div className="faculty-attendance-layout">
          <section className="qr-session panel">
            <span className={`session-status ${sessionActive ? "active" : ""}`}><i /> {sessionActive ? "YOKLAMA AKTİF" : "OTURUM HAZIR"}</span>
            <h3>MIS-800 · Araştırma Yöntemleri</h3><p>A Blok 204 · 10.00–11.50</p>
            <div className={`generated-qr ${sessionActive ? "visible" : ""}`}><div className="qr-art" /></div>
            <div className="attendance-counter"><strong>{count}</strong><span>/ 32 öğrenci</span><i><em style={{ width: `${count / 32 * 100}%` }} /></i></div>
            <button className="button button-primary" onClick={() => { setSessionActive(!sessionActive); if (!sessionActive) onToast("QR yoklama oturumu başlatıldı."); }}>
              <Icon name={sessionActive ? "close" : "qr"} size={17} /> {sessionActive ? "Oturumu durdur" : "Yoklamayı başlat"}
            </button>
          </section>
          <section className="live-roster panel">
            <div className="section-heading"><div><span>CANLI LİSTE</span><h3>Katılım durumu</h3></div><b>{count} / 32</b></div>
            {[
              ["Barış Uysal", "19030411049", 1],
              ["Mert Kelemci", "19030411027", 4],
              ["Ceren Öz", "19030411018", 8],
              ["Ece Yıldız", "19030411052", 12],
              ["Kerem Aydın", "19030411014", 16],
            ].map((student) => {
              const joined = count >= Number(student[2]);
              return <div key={String(student[1])}><span className="avatar blue">{String(student[0]).split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span><b>{student[0]}</b><small>{student[1]}</small></span><i className={joined ? "joined" : ""}>{joined ? "Katıldı" : "Bekleniyor"}</i></div>;
            })}
          </section>
        </div>
      )}
    </div>
  );
}

function SocialModule({ onToast }: { onToast: (message: string) => void }) {
  const [tab, setTab] = useState<"clubs" | "events" | "journals" | "food">("clubs");
  const [joined, setJoined] = useState<string[]>(["MIS Society"]);
  const clubs = [
    ["MIS Society", "Teknoloji ve bilişim", "MIS", "blue"],
    ["AYBÜ Girişimcilik", "Girişim ve inovasyon", "AG", "teal"],
    ["Tiyatro Topluluğu", "Sahne sanatları", "TT", "orange"],
    ["Havacılık Kulübü", "Havacılık ve uzay", "HK", "navy"],
  ];

  function toggleClub(name: string) {
    setJoined((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
    onToast(currentMessage(name));
  }

  function currentMessage(name: string) {
    return joined.includes(name) ? `${name} üyeliğinden ayrıldın.` : `${name} başvurun alındı.`;
  }

  return (
    <div className="module-page">
      <ModuleHeader eyebrow="KAMPÜS YAŞAMI" title="Sosyal Kampüs" description="Toplulukları keşfet, etkinliklere katıl ve kampüs yaşamını tek yerden takip et." />
      <div className="module-tabs social-tabs">
        <button className={tab === "clubs" ? "active" : ""} onClick={() => setTab("clubs")}>Kulüpler</button>
        <button className={tab === "events" ? "active" : ""} onClick={() => setTab("events")}>Etkinlikler</button>
        <button className={tab === "journals" ? "active" : ""} onClick={() => setTab("journals")}>Dergiler</button>
        <button className={tab === "food" ? "active" : ""} onClick={() => setTab("food")}>Yemekhane</button>
      </div>

      {tab === "clubs" && (
        <div className="social-grid">
          {clubs.map((club) => (
            <article className="club-card panel" key={club[0]}>
              <span className={`club-badge ${club[3]}`}>{club[2]}</span>
              <div><h3>{club[0]}</h3><p>{club[1]}</p><small><Icon name="users" size={14} /> {club[0] === "MIS Society" ? 326 : 184} üye</small></div>
              <button className={joined.includes(club[0]) ? "joined" : ""} onClick={() => toggleClub(club[0])}>{joined.includes(club[0]) ? "Üyesin" : "Katıl"}</button>
            </article>
          ))}
          <article className="exchange-card panel">
            <span><Icon name="map" size={24} /></span><div><small>ULUSLARARASI OFİS</small><h3>Dünyaya açıl.</h3><p>Erasmus+, Farabi ve Mevlana programlarını keşfet.</p></div><button onClick={() => onToast("Değişim programları başvuru takvimi açıldı.")}>Programları gör <Icon name="arrow" size={15} /></button>
          </article>
        </div>
      )}

      {tab === "events" && (
        <div className="event-card-grid">
          {[
            ["12 TEM", "Yapay Zeka ve Geleceğin Meslekleri", "MIS Society", "Konferans Salonu · 13.00", "326"],
            ["18 TEM", "CampusO Girişimcilik Buluşması", "AYBÜ Girişimcilik", "Kuluçka Merkezi · 15.30", "148"],
            ["22 TEM", "Açık Hava Film Gösterimi", "Sosyal Yaşam Ofisi", "Merkez Kampüs · 20.00", "512"],
          ].map((event, index) => (
            <article className="event-card panel" key={event[1]}>
              <div className={`event-visual event-${index + 1}`}><span>{event[0]}</span><Icon name={index === 0 ? "spark" : index === 1 ? "briefcase" : "users"} size={35} /></div>
              <div><small>{event[2]}</small><h3>{event[1]}</h3><p><Icon name="map" size={14} /> {event[3]}</p><span><Icon name="users" size={14} /> {event[4]} katılımcı</span></div>
              <button onClick={() => onToast(`${event[1]} etkinliğine kaydın oluşturuldu.`)}>Etkinliğe katıl</button>
            </article>
          ))}
        </div>
      )}

      {tab === "journals" && (
        <div className="journal-grid">
          {[
            ["AYBÜ Business Journal", "İşletme, finans ve yönetim araştırmaları", "12 yeni sayı", "blue"],
            ["Journal of Architecture, Art & Heritage", "Mimarlık, sanat ve kültürel miras", "8 yeni sayı", "teal"],
            ["Turkish Journal of Health Research", "Sağlık bilimlerinde güncel çalışmalar", "16 yeni sayı", "orange"],
            ["Külliye", "Uluslararası sosyal bilimler dergisi", "10 yeni sayı", "navy"],
          ].map((journal) => (
            <button className="journal-card panel" key={journal[0]} onClick={() => onToast(`${journal[0]} arşivi açılıyor.`)}>
              <span className={journal[3]}><Icon name="book" size={28} /></span><small>AKADEMİK DERGİ</small><h3>{journal[0]}</h3><p>{journal[1]}</p><b>{journal[2]} <Icon name="arrow" size={14} /></b>
            </button>
          ))}
        </div>
      )}

      {tab === "food" && (
        <div className="cafeteria-layout">
          <section className="meal-card panel">
            <div className="meal-date"><span><b>03</b>TEMMUZ</span><div><small>BUGÜNÜN MENÜSÜ</small><h3>Cuma Menüsü</h3></div><b>735 kcal</b></div>
            {[
              ["Ezogelin Çorbası", "162 kcal", "Başlangıç"],
              ["Tavuk Pirzola", "210 kcal", "Ana yemek"],
              ["Bulgur Pilavı", "299 kcal", "Yardımcı"],
              ["Ayran", "64 kcal", "İçecek"],
            ].map((meal, index) => <div className="meal-row" key={meal[0]}><span>{index + 1}</span><div><b>{meal[0]}</b><small>{meal[2]}</small></div><i>{meal[1]}</i></div>)}
          </section>
          <aside className="nutrition-card panel"><span><Icon name="check" size={24} /></span><h3>Dengeli kampüs menüsü</h3><p>Menü günlük enerji ihtiyacının yaklaşık %36&apos;sını karşılar.</p><div><span><b>42g</b><small>Protein</small></span><span><b>86g</b><small>Karbonhidrat</small></span><span><b>24g</b><small>Yağ</small></span></div></aside>
        </div>
      )}
    </div>
  );
}

function MapModule({ onToast }: { onToast: (message: string) => void }) {
  const places = [
    { id: "management", label: "İşletme Fakültesi", short: "İF", x: "22%", y: "30%", detail: "Derslikler, dekanlık ve öğrenci işleri", walk: "2 dk" },
    { id: "library", label: "Merkez Kütüphane", short: "MK", x: "54%", y: "18%", detail: "7/24 çalışma alanı ve dijital kaynaklar", walk: "4 dk" },
    { id: "cafeteria", label: "Yemekhane", short: "YM", x: "70%", y: "56%", detail: "Öğrenci ve personel yemek salonu", walk: "6 dk" },
    { id: "conference", label: "Konferans Salonu", short: "KS", x: "38%", y: "67%", detail: "Etkinlikler ve akademik toplantılar", walk: "3 dk" },
    { id: "sports", label: "Spor Merkezi", short: "SM", x: "84%", y: "26%", detail: "Fitness, basketbol ve açık spor alanları", walk: "8 dk" },
  ];
  const [selected, setSelected] = useState(places[0]);

  return (
    <div className="module-page">
      <ModuleHeader eyebrow="AKILLI KAMPÜS" title="CampusOMap" description="Fakülteleri, derslikleri ve sosyal alanları saniyeler içinde bul." >
        <label className="module-search"><Icon name="search" size={17} /><input aria-label="Kampüste yer ara" placeholder="Kampüste yer ara..." /></label>
      </ModuleHeader>
      <div className="map-layout">
        <section className="campus-map panel">
          <div className="map-road road-one" /><div className="map-road road-two" /><div className="map-green green-one" /><div className="map-green green-two" />
          <div className="you-are-here"><i /><span>Buradasın</span></div>
          {places.map((place) => (
            <button key={place.id} className={`map-building ${selected.id === place.id ? "active" : ""}`} style={{ left: place.x, top: place.y }} onClick={() => setSelected(place)}>
              <span>{place.short}</span><b>{place.label}</b>
            </button>
          ))}
          <div className="map-controls"><button aria-label="Yakınlaştır">+</button><button aria-label="Uzaklaştır">−</button><button aria-label="Konumuma git"><Icon name="map" size={16} /></button></div>
        </section>
        <aside className="place-panel panel">
          <span className="place-icon"><Icon name="map" size={25} /></span><small>SEÇİLİ KONUM</small><h3>{selected.label}</h3><p>{selected.detail}</p>
          <div className="place-facts"><span><Icon name="clock" size={17} /><b>{selected.walk}</b><small>Yürüme</small></span><span><Icon name="map" size={17} /><b>420 m</b><small>Mesafe</small></span></div>
          <button className="button button-primary" onClick={() => onToast(`${selected.label} için rota oluşturuldu.`)}>Rota oluştur <Icon name="arrow" size={16} /></button>
          <div className="nearby-list"><b>Yakındaki noktalar</b><span>Kahve noktası <small>120 m</small></span><span>ATM <small>180 m</small></span><span>Bisiklet parkı <small>230 m</small></span></div>
        </aside>
      </div>
    </div>
  );
}

function MessagesModule({
  role,
  messages,
  onSend,
}: {
  role: Role;
  messages: { from: "student" | "faculty"; text: string; time: string }[];
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [activeConversation, setActiveConversation] = useState(0);
  const conversations = role === "student"
    ? [["Dr. Ali İhsan Çetin", "Aİ", "Ders notlarını yarın yükleyeceğim.", "16.04", "1"], ["Öğrenci İşleri", "Öİ", "Staj belgeniz danışmana iletildi.", "14.22", "2"], ["MIS Society", "MS", "Etkinlik kaydınız tamamlandı.", "Dün", ""]]
    : [["Barış Uysal", "BU", "Ders notlarına erişemiyorum hocam.", "16.04", "1"], ["Ece Yıldız", "EY", "Staj başvurumu onaylar mısınız?", "14.22", "2"], ["Kerem Aydın", "KA", "Sınav itirazı hakkında bilgi almak istiyorum.", "Dün", ""], ["Mert Kelemci", "MK", "Teşekkürler hocam, iyi çalışmalar!", "Dün", ""]];
  const peer = conversations[activeConversation];

  function submitMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    onSend(draft.trim());
    setDraft("");
  }

  return (
    <div className="module-page messages-page">
      <ModuleHeader eyebrow="İLETİŞİM" title="Mesajlar" description="Öğrenci ve akademisyenlerle güvenli, kampüs içi iletişim." />
      <div className="messages-layout panel">
        <aside className="conversation-list">
          <label><Icon name="search" size={16} /><input placeholder="Konuşma ara..." aria-label="Konuşma ara" /></label>
          <div className="conversation-list-title"><b>Konuşmalar</b><span>{conversations.length}</span></div>
          {conversations.map((conversation, index) => (
            <button key={conversation[0]} className={activeConversation === index ? "active" : ""} onClick={() => setActiveConversation(index)}>
              <span className={`avatar ${index % 2 ? "teal" : "blue"}`}>{conversation[1]}</span>
              <span><b>{conversation[0]}</b><small>{conversation[2]}</small></span>
              <span><small>{conversation[3]}</small>{conversation[4] && <i>{conversation[4]}</i>}</span>
            </button>
          ))}
        </aside>
        <section className="chat-panel">
          <header><span className="avatar blue">{peer[1]}</span><span><b>{peer[0]}</b><small><i /> Çevrim içi</small></span><button aria-label="Konuşma ayrıntıları">•••</button></header>
          <div className="chat-stream">
            <time>BUGÜN</time>
            {messages.map((message, index) => {
              const mine = message.from === role;
              return <div className={`chat-bubble ${mine ? "mine" : ""}`} key={`${message.time}-${index}`}><p>{message.text}</p><span>{message.time} {mine && "✓✓"}</span></div>;
            })}
          </div>
          <form className="chat-composer" onSubmit={submitMessage}>
            <button type="button" aria-label="Dosya ekle">＋</button>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Mesajını yaz..." aria-label="Mesajını yaz" />
            <button type="submit" aria-label="Mesaj gönder"><Icon name="arrow" size={17} /></button>
          </form>
        </section>
      </div>
    </div>
  );
}

function AcadexModule({
  role,
  opportunities,
  applied,
  onApply,
  onPublish,
  onToast,
}: {
  role: Role;
  opportunities: Opportunity[];
  applied: string[];
  onApply: (id: string, title: string) => void;
  onPublish: (opportunity: Opportunity) => void;
  onToast: (message: string) => void;
}) {
  const researchers = [
    { name: "Dr. Ali İhsan Çetin", initials: "Aİ", department: "YBS · İşletme Fakültesi", tags: ["Yapay Zeka", "Bilgi Sistemleri", "Blockchain"], match: 96, publications: 18, citations: 342 },
    { name: "Doç. Dr. Selin Ergün", initials: "SE", department: "Bilgisayar Mühendisliği", tags: ["Makine Öğrenmesi", "NLP"], match: 91, publications: 27, citations: 516 },
    { name: "Dr. Onur Taş", initials: "OT", department: "Endüstri Mühendisliği", tags: ["Blockchain", "Tedarik Zinciri"], match: 88, publications: 14, citations: 188 },
  ];
  const [selectedResearcher, setSelectedResearcher] = useState(researchers[0]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("Yapay Zeka ile Öğrenci Başarı Tahmini");
  const [description, setDescription] = useState("Öğrenci performans verileriyle erken uyarı modeli geliştirme çalışması.");
  const [type, setType] = useState("Tez");

  function publish(event: React.FormEvent) {
    event.preventDefault();
    const id = `opp-${opportunities.length + 1}`;
    onPublish({ id, title, owner: "Dr. Ali İhsan Çetin", type, deadline: "30 Eylül", match: 99, description });
    setShowForm(false);
  }

  return (
    <div className="module-page acadex-page">
      <ModuleHeader
        eyebrow="AKADEMİK KEŞİF AĞI"
        title="Acadex"
        description={role === "student" ? "İlgi alanlarına uygun danışmanları, araştırmacıları ve fırsatları keşfet." : "Akademik görünürlüğünü artır, iş birlikleri kur ve öğrencilere fırsat paylaş."}
      >
        {role === "faculty" && <button className="button button-primary" onClick={() => setShowForm(!showForm)}><Icon name={showForm ? "close" : "spark"} size={17} /> {showForm ? "Formu kapat" : "Fırsat paylaş"}</button>}
      </ModuleHeader>

      {role === "student" ? (
        <>
          <section className="acadex-hero">
            <div><span><Icon name="spark" size={19} /> YAPAY ZEKA DESTEKLİ EŞLEŞME</span><h2>Akademik yolculuğun için<br />doğru kişiyi bul.</h2><p>İlgi alanların ve hedeflerine göre en güçlü eşleşmeleri senin için sıraladık.</p></div>
            <div className="match-score"><small>EN YÜKSEK EŞLEŞME</small><strong>%96</strong><span>3 yeni araştırmacı</span></div>
          </section>
          <div className="acadex-layout">
            <section className="researcher-list panel">
              <div className="section-heading"><div><span>ÖNERİLEN</span><h3>Danışman ve araştırmacılar</h3></div></div>
              {researchers.map((researcher) => (
                <button key={researcher.name} className={selectedResearcher.name === researcher.name ? "active" : ""} onClick={() => setSelectedResearcher(researcher)}>
                  <span className="avatar teal">{researcher.initials}</span>
                  <span><b>{researcher.name}</b><small>{researcher.department}</small><span>{researcher.tags.slice(0, 2).map((tag) => <i key={tag}>{tag}</i>)}</span></span>
                  <strong>%{researcher.match}<small>eşleşme</small></strong>
                </button>
              ))}
            </section>
            <aside className="researcher-profile panel">
              <span className="avatar teal">{selectedResearcher.initials}</span><small>AKADEMİSYEN PROFİLİ</small><h3>{selectedResearcher.name}</h3><p>{selectedResearcher.department}</p>
              <div className="profile-tags">{selectedResearcher.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <div className="profile-stats"><span><b>{selectedResearcher.publications}</b><small>Yayın</small></span><span><b>{selectedResearcher.citations}</b><small>Atıf</small></span><span><b>%{selectedResearcher.match}</b><small>Eşleşme</small></span></div>
              <button className="button button-primary" onClick={() => onToast(`${selectedResearcher.name} için danışmanlık isteğin gönderildi.`)}>Bağlantı kur <Icon name="arrow" size={16} /></button>
            </aside>
          </div>
          <section className="opportunities-section">
            <div className="section-heading"><div><span>AÇIK ÇAĞRILAR</span><h3>Araştırma ve tez fırsatları</h3></div><b>{opportunities.length} aktif fırsat</b></div>
            <div className="opportunity-grid">
              {opportunities.map((opportunity) => (
                <article className="opportunity-card panel" key={opportunity.id}>
                  <div><span className="opportunity-type">{opportunity.type}</span><span className="opportunity-match">%{opportunity.match} eşleşme</span></div>
                  <h3>{opportunity.title}</h3><p>{opportunity.description}</p>
                  <span className="opportunity-owner"><i className="avatar blue">{opportunity.owner.split(" ").filter((part) => part.length > 2).map((part) => part[0]).slice(0, 2).join("")}</i><span><b>{opportunity.owner}</b><small>Son başvuru · {opportunity.deadline}</small></span></span>
                  <button className={applied.includes(opportunity.id) ? "applied" : ""} onClick={() => onApply(opportunity.id, opportunity.title)}>{applied.includes(opportunity.id) ? <><Icon name="check" size={16} /> Başvuruldu</> : <>Başvur <Icon name="arrow" size={16} /></>}</button>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="faculty-acadex-profile panel">
            <div className="faculty-profile-main"><span className="avatar teal">Aİ</span><div><small>AKADEMİK PROFİL</small><h2>Dr. Ali İhsan Çetin</h2><p>İşletme Fakültesi · Yönetim Bilişim Sistemleri</p><span className="profile-tags"><i>Yapay Zeka</i><i>Bilgi Sistemleri</i><i>Blockchain</i><i>Eğitim Teknolojileri</i></span></div></div>
            <div className="faculty-profile-metrics"><span><b>18</b><small>Yayın</small></span><span><b>342</b><small>Atıf</small></span><span><b>11</b><small>Bağlantı</small></span><span><b>6</b><small>Aktif fırsat</small></span></div>
            <button className="button button-secondary" onClick={() => onToast("Acadex profil düzenleyicisi açıldı.")}>Profili düzenle</button>
          </section>

          {showForm && (
            <form className="opportunity-form panel" onSubmit={publish}>
              <div><span><Icon name="spark" size={19} /></span><div><small>ACADEX&apos;TE YAYINLA</small><h3>Yeni akademik fırsat</h3><p>Öğrencilerin başvurabileceği araştırma, tez veya gönüllülük çağrısı oluştur.</p></div></div>
              <label><span>Başlık</span><input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
              <label className="wide"><span>Açıklama</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} required /></label>
              <fieldset><legend>Fırsat türü</legend>{["Tez", "Araştırma", "Gönüllü"].map((item) => <button type="button" key={item} className={type === item ? "active" : ""} onClick={() => setType(item)}>{item}</button>)}</fieldset>
              <label><span>Son başvuru</span><input type="text" value="30 Eylül 2026" readOnly /></label>
              <button className="button button-primary" type="submit">Acadex&apos;te yayınla <Icon name="arrow" size={16} /></button>
            </form>
          )}

          <section className="faculty-acadex-grid">
            <div className="panel">
              <div className="section-heading"><div><span>BAŞVURULAR</span><h3>Son adaylar</h3></div><b>12 yeni</b></div>
              {[["Ece Yıldız", "Yapay Zeka ile Öğrenci Başarı Tahmini", "%94"], ["Barış Uysal", "Bilgi Sistemleri Alan Araştırması", "%91"], ["Mert Kelemci", "Blockchain Diploma Doğrulama", "%86"]].map((applicant) => <div className="applicant-row" key={applicant[0]}><span className="avatar blue">{applicant[0].split(" ").map((part) => part[0]).join("")}</span><span><b>{applicant[0]}</b><small>{applicant[1]}</small></span><i>{applicant[2]}</i><button onClick={() => onToast(`${applicant[0]} başvurusu açıldı.`)}>İncele</button></div>)}
            </div>
            <div className="panel">
              <div className="section-heading"><div><span>KEŞFET</span><h3>Ortak ilgi alanı</h3></div></div>
              {researchers.slice(1).map((researcher) => <div className="connection-row" key={researcher.name}><span className="avatar teal">{researcher.initials}</span><span><b>{researcher.name}</b><small>{researcher.department}</small></span><button onClick={() => onToast(`${researcher.name} kişisine bağlantı isteği gönderildi.`)}>Bağlan</button></div>)}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function ApprovalsModule({
  statuses,
  onResolve,
}: {
  statuses: Record<string, ApprovalStatus>;
  onResolve: (id: string, name: string, status: ApprovalStatus) => void;
}) {
  const requests = [
    { id: "req-1", name: "Ece Yıldız", initials: "EY", type: "Referans Mektubu", description: "Yurt dışı yüksek lisans başvurusu için akademik referans mektubu", date: "Bugün · 10.42", category: "reference" },
    { id: "req-2", name: "Kerem Aydın", initials: "KA", type: "Referans Mektubu", description: "Staj başvurusu için kurum referans mektubu", date: "Bugün · 09.18", category: "reference" },
    { id: "req-3", name: "Mert Kelemci", initials: "MK", type: "Staj Belgesi", description: "Şirket staj kabul formu danışman onayı bekliyor", date: "Dün · 16.35", category: "internship" },
    { id: "req-4", name: "Ceren Öz", initials: "CÖ", type: "Staj Belgesi", description: "Staj sigorta belgesi kontrol ve onay talebi", date: "Dün · 14.20", category: "internship" },
  ];
  const [filter, setFilter] = useState<"all" | "pending" | "resolved">("all");
  const visibleRequests = requests.filter((request) => filter === "all" || (filter === "pending" ? statuses[request.id] === "pending" : statuses[request.id] !== "pending"));
  const pendingCount = requests.filter((request) => statuses[request.id] === "pending").length;

  return (
    <div className="module-page">
      <ModuleHeader eyebrow="AKADEMİK İŞ AKIŞI" title="Onay Merkezi" description="Referans mektupları, staj belgeleri ve öğrenci taleplerini tek kuyruktan yönet.">
        <span className="pending-summary"><b>{pendingCount}</b><small>bekleyen talep</small></span>
      </ModuleHeader>
      <div className="approval-summary-grid">
        <StatCard icon="clock" label="Bekleyen" value={String(pendingCount)} detail="İşlem gerekli" tone="coral" />
        <StatCard icon="check" label="Onaylanan" value={String(Object.values(statuses).filter((status) => status === "approved").length)} detail="Bu oturum" tone="green" />
        <StatCard icon="file" label="Referans" value="2" detail="Mektup talebi" tone="blue" />
        <StatCard icon="briefcase" label="Staj" value="2" detail="Belge talebi" tone="teal" />
      </div>
      <section className="approval-panel panel">
        <div className="approval-toolbar"><div className="module-tabs"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Tümü</button><button className={filter === "pending" ? "active" : ""} onClick={() => setFilter("pending")}>Bekleyen</button><button className={filter === "resolved" ? "active" : ""} onClick={() => setFilter("resolved")}>Sonuçlanan</button></div><label className="module-search"><Icon name="search" size={16} /><input placeholder="Talep ara..." aria-label="Talep ara" /></label></div>
        <div className="request-list">
          {visibleRequests.map((request) => {
            const status = statuses[request.id];
            return (
              <article key={request.id} className={`request-card ${status !== "pending" ? status : ""}`}>
                <span className={`avatar ${request.category === "reference" ? "blue" : "teal"}`}>{request.initials}</span>
                <div><span className="request-type">{request.type}</span><h3>{request.name}</h3><p>{request.description}</p><small>{request.date}</small></div>
                {status === "pending" ? (
                  <div className="request-actions"><button className="reject" onClick={() => onResolve(request.id, request.name, "rejected")}><Icon name="close" size={15} /> Reddet</button><button className="approve" onClick={() => onResolve(request.id, request.name, "approved")}><Icon name="check" size={15} /> Onayla</button></div>
                ) : (
                  <span className={`resolved-badge ${status}`}><Icon name={status === "approved" ? "check" : "close"} size={15} /> {status === "approved" ? "Onaylandı" : "Reddedildi"}</span>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PublicationsModule({ onToast }: { onToast: (message: string) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [publications, setPublications] = useState([
    { title: "Optimizing Smart Campus IoT Networks with Rule-Based AI", journal: "Journal of Digital Campus Systems", year: "2025", citations: 96, type: "Makale" },
    { title: "A Blockchain Framework for Academic Credential Verification", journal: "AYBU Business Journal", year: "2024", citations: 71, type: "Makale" },
    { title: "Student Engagement Prediction via MIS Dashboards", journal: "Turkish Journal of Health Research", year: "2024", citations: 54, type: "Bildiri" },
    { title: "Information Systems Adoption in Higher Education", journal: "International MIS Review", year: "2023", citations: 43, type: "Makale" },
  ]);
  const [newTitle, setNewTitle] = useState("");

  function addPublication(event: React.FormEvent) {
    event.preventDefault();
    if (!newTitle.trim()) return;
    setPublications((current) => [{ title: newTitle.trim(), journal: "CampusO Akademik Kayıt", year: "2026", citations: 0, type: "Yeni" }, ...current]);
    setNewTitle("");
    setShowForm(false);
    onToast("Yeni yayın akademik profiline eklendi.");
  }

  return (
    <div className="module-page">
      <ModuleHeader eyebrow="AKADEMİK PORTFÖY" title="Yayınlarım" description="Yayınlarını, atıflarını ve akademik görünürlüğünü tek profilde takip et.">
        <button className="button button-primary" onClick={() => setShowForm(!showForm)}><Icon name={showForm ? "close" : "file"} size={17} /> {showForm ? "Vazgeç" : "Yeni yayın ekle"}</button>
      </ModuleHeader>
      <div className="publication-summary">
        <div><span><Icon name="file" size={24} /></span><b>{publications.length + 14}</b><small>Toplam yayın</small></div>
        <div><span><Icon name="award" size={24} /></span><b>342</b><small>Toplam atıf</small></div>
        <div><span><Icon name="spark" size={24} /></span><b>9</b><small>h-index</small></div>
        <div><span><Icon name="users" size={24} /></span><b>11</b><small>Ortak yazar</small></div>
      </div>
      {showForm && <form className="publication-form panel" onSubmit={addPublication}><label><span>Yayın başlığı</span><input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Yayın başlığını yaz..." required /></label><label><span>Dergi / Konferans</span><input value="CampusO Akademik Kayıt" readOnly /></label><button className="button button-primary" type="submit">Yayını kaydet</button></form>}
      <section className="publication-list panel">
        <div className="approval-toolbar"><div className="module-tabs"><button className="active">Tüm yayınlar</button><button>Makaleler</button><button>Bildiriler</button></div><label className="module-search"><Icon name="search" size={16} /><input placeholder="Yayın ara..." aria-label="Yayın ara" /></label></div>
        {publications.map((publication, index) => (
          <article className="publication-row" key={publication.title}>
            <span className={`publication-index ${index < 2 ? "highlight" : ""}`}>{String(index + 1).padStart(2, "0")}</span>
            <div><span>{publication.type}</span><h3>{publication.title}</h3><p>{publication.journal} · {publication.year}</p></div>
            <span className="citation-count"><b>{publication.citations}</b><small>atıf</small></span>
            <button onClick={() => onToast(`${publication.title} ayrıntıları açıldı.`)} aria-label={`${publication.title} ayrıntılarını aç`}><Icon name="chevron" size={17} /></button>
          </article>
        ))}
      </section>
    </div>
  );
}

function IncentiveModule({ onToast }: { onToast: (message: string) => void }) {
  const items = [
    { label: "Yayınlar", value: 320, max: 350, tone: "blue", detail: "8 makale · 3 bildiri" },
    { label: "Projeler", value: 180, max: 300, tone: "teal", detail: "2 TÜBİTAK · 1 BAP" },
    { label: "Atıflar", value: 140, max: 300, tone: "cyan", detail: "2026 döneminde 54 yeni atıf" },
    { label: "Danışmanlık", value: 102, max: 300, tone: "orange", detail: "4 tez · 6 proje danışmanlığı" },
  ];
  return (
    <div className="module-page">
      <ModuleHeader eyebrow="2026 TEŞVİK DÖNEMİ" title="Akademik Teşvik" description="Akademik faaliyet puanlarını, eksiklerini ve dönem hedeflerini canlı takip et.">
        <button className="button button-secondary" onClick={() => onToast("Teşvik özeti PDF için hazırlandı.")}><Icon name="file" size={17} /> Rapor oluştur</button>
      </ModuleHeader>
      <section className="incentive-hero">
        <div className="score-ring"><span><b>742</b><small>toplam puan</small></span></div>
        <div><small>DÖNEM PERFORMANSI</small><h2>Hedefinin %82&apos;sine ulaştın.</h2><p>900 puanlık yıllık hedefe ulaşmak için 158 puan daha gerekiyor.</p><div className="target-progress"><i><em style={{ width: "82%" }} /></i><span>742 / 900</span></div></div>
        <span className="score-change"><Icon name="arrow" size={16} /><b>+86</b><small>geçen döneme göre</small></span>
      </section>
      <div className="incentive-grid">
        {items.map((item) => (
          <article className="incentive-card panel" key={item.label}>
            <div><span>{item.label}</span><strong>{item.value}</strong></div><p>{item.detail}</p>
            <span className="incentive-bar"><i className={item.tone} style={{ width: `${item.value / item.max * 100}%` }} /></span><small>{item.max} puanlık kategori hedefi</small>
          </article>
        ))}
      </div>
      <section className="incentive-breakdown panel">
        <div className="section-heading"><div><span>PUAN DÖKÜMÜ</span><h3>Faaliyet dağılımı</h3></div><b>Son güncelleme · Bugün</b></div>
        {items.map((item) => <div key={item.label}><span>{item.label}<small>{item.detail}</small></span><i><em className={item.tone} style={{ width: `${item.value / 3.5}%` }} /></i><b>{item.value}</b></div>)}
      </section>
    </div>
  );
}

function Toast({ message, onClear }: { message: string; onClear: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClear, 2800);
    return () => window.clearTimeout(timer);
  }, [message, onClear]);
  if (!message) return null;
  return <div className="app-toast" role="status"><span><Icon name="check" size={17} /></span><p>{message}</p><button onClick={onClear} aria-label="Bildirimi kapat"><Icon name="close" size={15} /></button></div>;
}

export default function Home() {
  const [role, setRole] = useState<Role | null>(null);
  const [view, setView] = useState<View>("home");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [opportunities, setOpportunities] = useState<Opportunity[]>(initialOpportunities);
  const [applied, setApplied] = useState<string[]>([]);
  const [approvalStatuses, setApprovalStatuses] = useState<Record<string, ApprovalStatus>>({
    "req-1": "pending",
    "req-2": "pending",
    "req-3": "pending",
    "req-4": "pending",
  });
  const [chatMessages, setChatMessages] = useState<{ from: "student" | "faculty"; text: string; time: string }[]>([
    { from: "student", text: "Merhaba hocam, sisteme yüklediğiniz ders notlarına erişemiyorum. Yardımcı olabilir misiniz?", time: "16.04" },
    { from: "faculty", text: "Merhaba Barış, notları güncelledikten sonra sisteme tekrar yükleyeceğim. Yarın erişebilirsin.", time: "16.06" },
  ]);

  const navItems = useMemo(() => role === "faculty" ? facultyNav : studentNav, [role]);

  function enter(nextRole: Role) {
    setRole(nextRole);
    setView("home");
    setMobileOpen(false);
  }

  function navigate(nextView: View) {
    setView(nextView);
    setMobileOpen(false);
    setNotificationOpen(false);
  }

  function showToast(message: string) {
    setToastMessage(message);
  }

  function applyToOpportunity(id: string, title: string) {
    if (applied.includes(id)) {
      showToast(`${title} için başvurun zaten alınmış.`);
      return;
    }
    setApplied((current) => [...current, id]);
    showToast(`${title} başvurun akademisyene iletildi.`);
  }

  function publishOpportunity(opportunity: Opportunity) {
    setOpportunities((current) => [opportunity, ...current]);
    showToast("Yeni fırsat Acadex'te öğrencilere yayınlandı.");
  }

  function resolveApproval(id: string, name: string, status: ApprovalStatus) {
    setApprovalStatuses((current) => ({ ...current, [id]: status }));
    showToast(`${name} talebi ${status === "approved" ? "onaylandı" : "reddedildi"}.`);
  }

  function sendMessage(text: string) {
    if (!role) return;
    setChatMessages((current) => [...current, { from: role, text, time: "16.18" }]);
    showToast("Mesaj gönderildi.");
  }

  if (!role) return <Landing onEnter={enter} />;

  const isStudent = role === "student";
  const pendingApprovalCount = Object.values(approvalStatuses).filter((status) => status === "pending").length;

  let pageContent: React.ReactNode;
  switch (view) {
    case "home":
      pageContent = isStudent ? <StudentDashboard navigate={navigate} /> : <FacultyDashboard navigate={navigate} />;
      break;
    case "courses":
      pageContent = <CoursesModule role={role} navigate={navigate} />;
      break;
    case "exams":
      pageContent = <ExamsModule role={role} onToast={showToast} />;
      break;
    case "academic":
      pageContent = <AcademicModule onToast={showToast} />;
      break;
    case "attendance":
      pageContent = <AttendanceModule role={role} onToast={showToast} />;
      break;
    case "social":
      pageContent = <SocialModule onToast={showToast} />;
      break;
    case "map":
      pageContent = <MapModule onToast={showToast} />;
      break;
    case "messages":
      pageContent = <MessagesModule role={role} messages={chatMessages} onSend={sendMessage} />;
      break;
    case "acadex":
      pageContent = (
        <AcadexModule
          role={role}
          opportunities={opportunities}
          applied={applied}
          onApply={applyToOpportunity}
          onPublish={publishOpportunity}
          onToast={showToast}
        />
      );
      break;
    case "approvals":
      pageContent = <ApprovalsModule statuses={approvalStatuses} onResolve={resolveApproval} />;
      break;
    case "publications":
      pageContent = <PublicationsModule onToast={showToast} />;
      break;
    case "incentive":
      pageContent = <IncentiveModule onToast={showToast} />;
      break;
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-top">
          <Brand inverse />
          <button className="sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Menüyü kapat"><Icon name="close" /></button>
        </div>

        <div className="role-card">
          <span className={`avatar ${isStudent ? "blue" : "teal"}`}>{isStudent ? "BU" : "Aİ"}</span>
          <span><b>{isStudent ? "Barış Uysal" : "Dr. Ali İhsan Çetin"}</b><small>{isStudent ? "Öğrenci" : "Akademisyen"}</small></span>
          <button aria-label="Rolü değiştir" onClick={() => enter(isStudent ? "faculty" : "student")}><Icon name="switch" size={17} /></button>
        </div>

        <p className="nav-label">KAMPÜS</p>
        <nav className="side-nav" aria-label="Uygulama menüsü">
          {navItems.map((item) => (
            <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}>
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              {item.id === "messages" && <i>4</i>}
              {item.id === "approvals" && pendingApprovalCount > 0 && <i>{pendingApprovalCount}</i>}
            </button>
          ))}
        </nav>

        <div className="sidebar-acadex">
          <span><Icon name="spark" size={18} /></span>
          <div><b>Acadex</b><small>Akademik keşif ağı</small></div>
          <button onClick={() => navigate("acadex")} aria-label="Acadex'i aç"><Icon name="arrow" size={16} /></button>
        </div>
        <button className="exit-button" onClick={() => setRole(null)}><Icon name="switch" size={17} /> Giriş ekranına dön</button>
      </aside>

      {mobileOpen && <button className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Menüyü kapat" />}

      <section className="app-main">
        <header className="app-header">
          <button className="menu-button" onClick={() => setMobileOpen(true)} aria-label="Menüyü aç"><Icon name="menu" /></button>
          <div className="breadcrumbs">
            <span>{isStudent ? "Öğrenci Paneli" : "Akademisyen Paneli"}</span>
            <Icon name="chevron" size={14} />
            <b>{viewTitles[view]}</b>
          </div>
          <label className="global-search">
            <Icon name="search" size={18} />
            <input aria-label="CampusO'da ara" placeholder="CampusO'da ara..." />
            <kbd>⌘ K</kbd>
          </label>
          <button className="header-icon message-icon" onClick={() => navigate("messages")} aria-label="Mesajları aç">
            <Icon name="message" size={19} /><i>4</i>
          </button>
          <button className="header-icon" onClick={() => setNotificationOpen(!notificationOpen)} aria-label="Bildirimleri aç">
            <Icon name="bell" size={20} /><i />
          </button>
          <button className="header-profile" onClick={() => enter(isStudent ? "faculty" : "student")} title="Rolü değiştir">
            <span className={`avatar ${isStudent ? "blue" : "teal"}`}>{isStudent ? "BU" : "Aİ"}</span>
            <span><b>{isStudent ? "Barış Uysal" : "Ali İhsan Çetin"}</b><small>{isStudent ? "19030411049" : "MIS Bölümü"}</small></span>
            <Icon name="chevron" size={15} />
          </button>

          {notificationOpen && (
            <div className="notification-popover">
              <div><b>Bildirimler</b><button onClick={() => setNotificationOpen(false)}><Icon name="close" size={16} /></button></div>
              <button onClick={() => navigate("exams")}><span className="coral"><Icon name="calendar" size={17} /></span><p><b>Sınav takvimi güncellendi</b><small>BUS-202 salon bilgisi eklendi.</small></p></button>
              <button onClick={() => navigate("acadex")}><span className="teal"><Icon name="spark" size={17} /></span><p><b>Yeni Acadex eşleşmesi</b><small>İlgi alanlarınla eşleşen bir fırsat var.</small></p></button>
            </div>
          )}
        </header>

        <div className="page-body">
          {pageContent}
        </div>
      </section>
      <Toast message={toastMessage} onClear={() => setToastMessage("")} />
    </main>
  );
}
