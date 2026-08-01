"use client";

import { useState } from "react";

type Role = "student" | "faculty";
type EntryStage = "splash" | "role-select";
type IconName =
  | "home"
  | "book"
  | "bell"
  | "search"
  | "arrow"
  | "switch"
  | "menu"
  | "close"
  | "graduation"
  | "check"
  | "user";

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
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    switch: <><path d="m7 7-4 4 4 4" /><path d="M3 11h13a4 4 0 0 1 4 4v1" /><path d="m17 3 4 4-4 4" /><path d="M21 7H8a4 4 0 0 0-4 4" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    graduation: <><path d="m2 10 10-5 10 5-10 5Z" /><path d="M6 12v5c3 2 9 2 12 0v-5" /><path d="M22 10v6" /></>,
    check: <><path d="m5 12 4 4L19 6" /><circle cx="12" cy="12" r="9" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
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

function RoleSymbol({ role, compact = false }: { role: Role; compact?: boolean }) {
  return (
    <span className={`clean-role-symbol ${role} ${compact ? "compact" : ""}`}>
      <Icon name={role === "student" ? "graduation" : "book"} size={compact ? 18 : 26} />
    </span>
  );
}

function EntryExperience({
  stage,
  selectedRole,
  onContinue,
  onSelectRole,
  onEnter,
}: {
  stage: EntryStage;
  selectedRole: Role;
  onContinue: () => void;
  onSelectRole: (role: Role) => void;
  onEnter: (role: Role) => void;
}) {
  if (stage === "splash") {
    return (
      <main className="prototype-entry prototype-splash">
        <button className="splash-surface" onClick={onContinue} aria-label="CampusO'ya devam et">
          <span className="splash-logo"><Icon name="graduation" size={48} /></span>
          <strong>CampusO</strong>
          <small>Campus Online</small>
          <span className="splash-dots"><i /><i /><i /></span>
          <em>devam etmek için dokun</em>
        </button>
      </main>
    );
  }

  return (
    <main className="prototype-entry">
      <section className="role-select-card clean-role-select" aria-label="CampusO rol seçimi">
        <Brand />
        <div className="clean-role-heading">
          <span>ROL SEÇİMİ</span>
          <h1>Hangi paneli görüntülemek istiyorsun?</h1>
          <p>Gerçek kullanıcı bilgileri bağlanana kadar yalnızca panel türünü seç.</p>
        </div>

        <div className="clean-role-grid">
          {(["student", "faculty"] as Role[]).map((role) => (
            <button
              key={role}
              className={`clean-role-option ${selectedRole === role ? "selected" : ""}`}
              onClick={() => onSelectRole(role)}
            >
              <RoleSymbol role={role} />
              <span><b>{roleCopy[role].title}</b><small>{roleCopy[role].description}</small></span>
              <i><Icon name="check" size={16} /></i>
            </button>
          ))}
        </div>

        <button className="enter-campus-button" onClick={() => onEnter(selectedRole)}>
          {roleCopy[selectedRole].panel}ni aç
          <Icon name="arrow" size={18} />
        </button>
        <p className="entry-note">CampusO · Temiz başlangıç paneli</p>
      </section>
    </main>
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
          Rol seçim ekranına dön
        </button>
      </section>
    </div>
  );
}

export default function Home() {
  const [role, setRole] = useState<Role | null>(null);
  const [entryStage, setEntryStage] = useState<EntryStage>("splash");
  const [roleChoice, setRoleChoice] = useState<Role>("student");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  function enter(nextRole: Role) {
    setRole(nextRole);
    setRoleChoice(nextRole);
    setMobileOpen(false);
    setProfileOpen(false);
  }

  function returnToRoles() {
    setRole(null);
    setEntryStage("role-select");
    setMobileOpen(false);
    setProfileOpen(false);
  }

  if (!role) {
    return (
      <EntryExperience
        stage={entryStage}
        selectedRole={roleChoice}
        onContinue={() => setEntryStage("role-select")}
        onSelectRole={setRoleChoice}
        onEnter={enter}
      />
    );
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

        <button className="exit-button" onClick={returnToRoles}><Icon name="switch" size={17} /> Rol seçimine dön</button>
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
          onChooseRole={returnToRoles}
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
