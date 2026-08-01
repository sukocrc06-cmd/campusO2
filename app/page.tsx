"use client";

import { useState } from "react";

type Role = "student" | "faculty";
type IconName =
  | "home"
  | "book"
  | "calendar"
  | "briefcase"
  | "qr"
  | "users"
  | "message"
  | "spark"
  | "bell"
  | "search"
  | "arrow"
  | "switch"
  | "menu"
  | "close"
  | "graduation"
  | "check"
  | "user"
  | "chevron";

const roleCopy: Record<Role, { title: string; panel: string; description: string }> = {
  student: {
    title: "Öğrenci",
    panel: "Öğrenci Paneli",
    description: "Öğrenciye açılacak modüller burada yer alacak.",
  },
  faculty: {
    title: "Akademisyen",
    panel: "Akademisyen Paneli",
    description: "Akademisyene açılacak modüller burada yer alacak.",
  },
};

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
    message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8M8 13h5" /></>,
    spark: <><path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    switch: <><path d="m7 7-4 4 4 4" /><path d="M3 11h13a4 4 0 0 1 4 4v1" /><path d="m17 3 4 4-4 4" /><path d="M21 7H8a4 4 0 0 0-4 4" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    graduation: <><path d="m2 10 10-5 10 5-10 5Z" /><path d="M6 12v5c3 2 9 2 12 0v-5" /><path d="M22 10v6" /></>,
    check: <><path d="m5 12 4 4L19 6" /><circle cx="12" cy="12" r="9" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
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
        <div className="landing-nav-actions">
          <span className="admin-link" title="Yönetici paneli daha sonra hazırlanacak">
            <Icon name="briefcase" size={15} /> Yönetici Girişi
          </span>
          <button className="button button-ghost" onClick={() => onEnter("student")}>
            Sisteme giriş <Icon name="arrow" size={17} />
          </button>
        </div>
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

function RoleSymbol({ role, compact = false }: { role: Role; compact?: boolean }) {
  return (
    <span className={`clean-role-symbol ${role} ${compact ? "compact" : ""}`}>
      <Icon name={role === "student" ? "graduation" : "book"} size={compact ? 18 : 26} />
    </span>
  );
}

function EmptyDashboard({ role }: { role: Role }) {
  return (
    <div className="clean-dashboard">
      <section className={`welcome-banner clean-welcome ${role === "student" ? "student-banner" : "faculty-banner"}`}>
        <div>
          <span className="banner-kicker">TEMİZ BAŞLANGIÇ</span>
          <h2>{roleCopy[role].panel} hazır.</h2>
          <p>Demo kullanıcılar, örnek dersler, notlar, istatistikler ve bildirimler bu görünümden kaldırıldı.</p>
        </div>
        <span className="clean-ready-badge"><Icon name="check" size={24} /><b>Hazır</b></span>
      </section>

      <section className="clean-empty-panel panel" aria-label="Boş modül alanı">
        <span className="clean-empty-icon"><Icon name="graduation" size={34} /></span>
        <small>MODÜL ALANI</small>
        <h1>Henüz aktif modül bulunmuyor.</h1>
        <p>
          CampusO modülleri konuşulup kararlaştırıldıktan sonra bu panele tek tek eklenecek.
          Bu aşamada hiçbir öğrenci veya akademisyen verisi gösterilmiyor.
        </p>
        <span className="clean-empty-status"><i /> Sonraki modül kararı bekleniyor</span>
      </section>
    </div>
  );
}

function ProfileMenu({
  role,
  onClose,
  onSwitchRole,
  onChooseRole,
}: {
  role: Role;
  onClose: () => void;
  onSwitchRole: () => void;
  onChooseRole: () => void;
}) {
  return (
    <div className="profile-layer" role="dialog" aria-modal="true" aria-label="Panel menüsü">
      <button className="profile-layer-backdrop" onClick={onClose} aria-label="Panel menüsünü kapat" />
      <section className="prototype-profile clean-profile">
        <header>
          <button onClick={onClose} aria-label="Geri dön"><Icon name="arrow" size={18} /></button>
          <div><b>Panel görünümü</b><small>Henüz kullanıcı hesabı bağlı değil</small></div>
        </header>
        <div className="profile-identity clean-profile-identity">
          <RoleSymbol role={role} />
          <b>{roleCopy[role].panel}</b>
          <small>Kişisel veri bulunmuyor</small>
          <em>{roleCopy[role].title}</em>
        </div>
        <button className="profile-role-switch" onClick={onSwitchRole}>
          <Icon name="switch" size={18} />
          {role === "student" ? "Akademisyen paneline geç" : "Öğrenci paneline geç"}
        </button>
        <button className="clean-secondary-action" onClick={onChooseRole}>
          Ana sayfaya dön
        </button>
      </section>
    </div>
  );
}

export default function Home() {
  const [role, setRole] = useState<Role | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  function enter(nextRole: Role) {
    setRole(nextRole);
    setMobileOpen(false);
    setProfileOpen(false);
  }

  function returnToLanding() {
    setRole(null);
    setMobileOpen(false);
    setProfileOpen(false);
  }

  if (!role) {
    return <Landing onEnter={enter} />;
  }

  const copy = roleCopy[role];

  return (
    <main className="app-shell clean-app-shell">
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-top">
          <Brand inverse />
          <button className="sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Menüyü kapat"><Icon name="close" /></button>
        </div>

        <div className="role-card clean-role-card">
          <RoleSymbol role={role} compact />
          <span><b>{copy.panel}</b><small>Kullanıcı verisi bağlı değil</small></span>
          <button aria-label="Panel görünümünü aç" onClick={() => setProfileOpen(true)}><Icon name="switch" size={17} /></button>
        </div>

        <p className="nav-label">KAMPÜS</p>
        <nav className="side-nav" aria-label="Uygulama menüsü">
          <button className="active"><Icon name="home" size={19} /><span>Ana Sayfa</span></button>
        </nav>

        <div className="clean-sidebar-empty">
          <span><Icon name="book" size={18} /></span>
          <div><b>Modüller</b><small>Henüz modül eklenmedi</small></div>
        </div>

        <button className="exit-button" onClick={returnToLanding}><Icon name="arrow" size={17} /> Ana sayfaya dön</button>
      </aside>

      {mobileOpen && <button className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Menüyü kapat" />}

      <section className="app-main">
        <header className="app-header">
          <button className="menu-button" onClick={() => setMobileOpen(true)} aria-label="Menüyü aç"><Icon name="menu" /></button>
          <button className="mobile-app-identity" onClick={() => setProfileOpen(true)} aria-label="Panel görünümünü aç">
            <span className="mobile-seal">CO</span>
            <span><b>{copy.panel}</b><small>Kullanıcı verisi bağlı değil</small></span>
          </button>
          <div className="breadcrumbs"><span>{copy.panel}</span><b>Ana Sayfa</b></div>
          <label className="global-search clean-search">
            <Icon name="search" size={18} />
            <input aria-label="CampusO'da ara" placeholder="Modüller eklendiğinde arama açılacak" disabled />
          </label>
          <button className="header-icon clean-disabled-icon" aria-label="Henüz bildirim bulunmuyor" disabled><Icon name="bell" size={20} /></button>
          <button className="header-profile" onClick={() => setProfileOpen(true)} title="Panel görünümünü aç">
            <RoleSymbol role={role} compact />
            <span><b>{copy.panel}</b><small>Kişisel veri bulunmuyor</small></span>
            <Icon name="switch" size={15} />
          </button>
        </header>

        <div className="page-body">
          <EmptyDashboard role={role} />
        </div>
      </section>

      {profileOpen && (
        <ProfileMenu
          role={role}
          onClose={() => setProfileOpen(false)}
          onSwitchRole={() => enter(role === "student" ? "faculty" : "student")}
          onChooseRole={returnToLanding}
        />
      )}

      <nav className="mobile-bottom-nav clean-bottom-nav" aria-label="Mobil uygulama menüsü">
        <button className="active"><Icon name="home" size={20} /><span>Ana Sayfa</span></button>
        <button onClick={() => setProfileOpen(true)}><Icon name="switch" size={20} /><span>Rol değiştir</span></button>
        <button onClick={() => setMobileOpen(true)}><Icon name="menu" size={20} /><span>Menü</span></button>
      </nav>
    </main>
  );
}
