"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { fetchWithAuth, getCampusSession, supabase } from "../lib/supabase";

type Role = "student" | "faculty";
type PanelView = "home" | "qr";
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
  | "chevron"
  | "shield"
  | "settings"
  | "sun"
  | "moon";

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

type CourseGroup = {
  id: string;
  periodId: string;
  name: string;
  courseCode: string;
  section: string;
  joinCode: string;
  createdAt: number;
};

type AcademicPeriod = {
  id: string;
  academicYear: string;
  term: "guz" | "bahar" | "yaz";
  label: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isOpen: boolean;
  createdAt: number;
};

type AttendanceSession = {
  id: string;
  courseId: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  closedAt?: number;
};

type StudentProfile = { name: string; number: string };
type Membership = {
  courseId: string;
  studentName: string;
  studentNumber: string;
  joinedAt: number;
};
type AttendanceRecord = {
  id: string;
  sessionId: string;
  courseId: string;
  studentName: string;
  studentNumber: string;
  checkedAt: number;
};

type QrStore = {
  enabled: boolean;
  activePeriodId: string;
  periods: AcademicPeriod[];
  courses: CourseGroup[];
  sessions: AttendanceSession[];
  profile: StudentProfile | null;
  memberships: Membership[];
  records: AttendanceRecord[];
};

const emptyQrStore: QrStore = {
  enabled: true,
  activePeriodId: "period-2026-2027-guz",
  periods: [{
    id: "period-2026-2027-guz",
    academicYear: "2026-2027",
    term: "guz",
    label: "2026-2027 Güz",
    startDate: "2026-09-01",
    endDate: "2027-01-31",
    isActive: true,
    isOpen: true,
    createdAt: 0,
  }],
  courses: [],
  sessions: [],
  profile: null,
  memberships: [],
  records: [],
};

const QR_STORAGE_KEY = "campuso:qr-attendance:v1";
const QR_PROFILE_KEY = "campuso:qr-profile:v2";

type QrActionName =
  | "create-course"
  | "start-session"
  | "close-session"
  | "join-course"
  | "record-attendance"
  | "create-period"
  | "set-active-period"
  | "toggle-period-open"
  | "toggle-enabled";

type QrActionResult = {
  ok: boolean;
  message: string;
  store?: Omit<QrStore, "profile">;
};

type QrActionRunner = (
  action: QrActionName,
  payload?: Record<string, string | number | boolean>,
) => Promise<QrActionResult>;

function extractAttendanceToken(value: string) {
  const normalized = value.trim();
  if (!normalized) return "";

  try {
    const url = new URL(normalized, window.location.origin);
    const token = url.searchParams.get("attendance");
    if (token) return token.trim().toUpperCase();
  } catch {
    // Eski QR metinleri ve elle girilen kodlar aşağıda ele alınıyor.
  }

  const legacyParts = normalized.split("|");
  if (legacyParts[0]?.toUpperCase() === "CAMPUSO" && legacyParts[2]) {
    return legacyParts[2].trim().toUpperCase();
  }

  return /^[A-Z0-9]{8}$/i.test(normalized) ? normalized.toUpperCase() : "";
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(value);
}

const GUN_ADLARI = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
function bugununGunAdi() {
  return GUN_ADLARI[new Date().getDay()];
}
function bugunIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type ProfileInfo = { fullName: string; bolum: string; sinif: string; avatarUrl: string; heroRenk: string };

function activePeriodOf(store: QrStore) {
  return store.periods.find((period) => period.id === store.activePeriodId)
    ?? store.periods.find((period) => period.isActive)
    ?? null;
}

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
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.1.4.3.7.6 1 .3.2.7.4 1.1.4h.1v4h-.1c-.4 0-.8.2-1.1.4-.3.3-.5.6-.6 1Z" /></>,
    sun: <><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7" /></>,
    moon: <path d="M20.5 14.7A8.5 8.5 0 1 1 9.3 3.5a7 7 0 0 0 11.2 11.2Z" />,
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

function Landing() {
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
          <a href="/login" className="button button-ghost">
            Giriş Yap <Icon name="arrow" size={17} />
          </a>
          <a href="/signup" className="button button-primary" style={{ minHeight: 42, padding: "0 16px" }}>
            Kayıt Ol
          </a>
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
            <a href="/login" className="button button-primary">
              Giriş Yap <Icon name="arrow" size={18} />
            </a>
            <a href="/signup" className="button button-secondary">
              Kayıt Ol
            </a>
          </div>
          <div className="hero-trust">
            <div className="trust-avatars"><span>BU</span><span>Aİ</span><span>EY</span></div>
            <p><strong>Tek oturum, iki deneyim.</strong><br />Rolüne göre kişiselleşen kampüs.</p>
          </div>
        </div>

        <HeroCarousel />
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

type HeroSlide = {
  key: string;
  accent: "blue" | "teal" | "coral" | "amber";
  icon: IconName;
  title: string;
  subtitle: string;
  stat: { label: string; value: string };
  rows: Array<{ icon: IconName; title: string; detail: string }>;
  chip: { icon: IconName; title: string; detail: string };
};

const HERO_SLIDES: HeroSlide[] = [
  {
    key: "ders",
    accent: "blue",
    icon: "book",
    title: "Ders ve Sınav Takvimi",
    subtitle: "Haftalık program tek ekranda",
    stat: { label: "BUGÜN", value: "3 ders" },
    rows: [
      { icon: "book", title: "MIS 302 · Veri Tabanı", detail: "10.00 · B Blok 204" },
      { icon: "calendar", title: "Vize Sınavı", detail: "Finans ve Bankacılık" },
      { icon: "check", title: "Devamsızlık", detail: "%96 katılım" },
    ],
    chip: { icon: "check", title: "Yoklama tamamlandı", detail: "32 / 32 öğrenci" },
  },
  {
    key: "qr",
    accent: "teal",
    icon: "qr",
    title: "QR Yoklama",
    subtitle: "Saniyeler içinde güvenli giriş",
    stat: { label: "AKTİF OTURUM", value: "MIS-800" },
    rows: [
      { icon: "qr", title: "QR kod aktif", detail: "Kalan süre 04:12" },
      { icon: "users", title: "Katılımcılar", detail: "28 öğrenci okuttu" },
      { icon: "spark", title: "Anlık senkron", detail: "Sistem güncel" },
    ],
    chip: { icon: "spark", title: "Yeni Acadex eşleşmesi", detail: "%94 ortak ilgi alanı" },
  },
  {
    key: "acadex",
    accent: "coral",
    icon: "spark",
    title: "Acadex Ağı",
    subtitle: "Danışman, araştırma ve yayın ağı",
    stat: { label: "FIRSATLAR", value: "3 yeni" },
    rows: [
      { icon: "spark", title: "Araştırma eşleşmesi", detail: "Finans · Prof. Dr. A. Yıldız" },
      { icon: "graduation", title: "Yayın daveti", detail: "Uluslararası konferans" },
      { icon: "users", title: "Ağ bağlantısı", detail: "12 yeni takipçi" },
    ],
    chip: { icon: "check", title: "Profil onaylandı", detail: "Acadex ağına katıldın" },
  },
  {
    key: "sosyal",
    accent: "amber",
    icon: "users",
    title: "Sosyal & Kampüs Hayatı",
    subtitle: "Kulüpler, etkinlikler ve duvar",
    stat: { label: "YAKLAŞAN", value: "Kariyer Günleri" },
    rows: [
      { icon: "calendar", title: "Kariyer Günleri", detail: "12 Temmuz · 13.00" },
      { icon: "shield", title: "Öğrenci Kulüpleri", detail: "4 aktif kulübün var" },
      { icon: "message", title: "Kampüs Duvarı", detail: "2 yeni duyuru" },
    ],
    chip: { icon: "spark", title: "Yeni etkinlik eklendi", detail: "Sosyal Sorumluluk Kulübü" },
  },
];

function HeroCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % HERO_SLIDES.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, []);

  const slide = HERO_SLIDES[index];

  return (
    <div className="hero-product" aria-label="CampusO modül ön izlemesi">
      <div className="product-glow" />
      <div className="product-window">
        <div className="mini-sidebar">
          <Brand inverse />
          <div className="mini-nav">
            {HERO_SLIDES.map((item, i) => (
              <span key={item.key} className={i === index ? "active" : ""}>
                <Icon name={item.icon} size={17} />
              </span>
            ))}
          </div>
          <span className="mini-avatar">CO</span>
        </div>
        <div className="mini-main" key={slide.key}>
          <div className="mini-top"><span>{slide.title}</span><span className="mini-bell"><Icon name="bell" size={15} /></span></div>
          <div className="mini-id-card">
            <div><small>{slide.stat.label}</small><strong>{slide.stat.value}</strong></div>
            <div className="mini-progress"><i /></div>
            <p>{slide.subtitle}</p>
          </div>
          <div className="mini-grid">
            {slide.rows.map((row) => (
              <div key={row.title}>
                <span className={`mini-icon ${slide.accent}`}><Icon name={row.icon} size={16} /></span>
                <b>{row.title}</b><small>{row.detail}</small>
              </div>
            ))}
          </div>
          <div className="mini-event"><span><Icon name={slide.icon} size={16} /></span><div><b>{slide.chip.title}</b><small>{slide.chip.detail}</small></div><i><Icon name="chevron" size={15} /></i></div>
        </div>
      </div>
      <div className="floating-chip chip-one"><Icon name="check" size={16} /><span><b>Yoklama tamamlandı</b><small>32 / 32 öğrenci</small></span></div>
      <div className="floating-chip chip-two"><Icon name={slide.chip.icon} size={16} /><span><b>{slide.chip.title}</b><small>{slide.chip.detail}</small></span></div>
      <div className="hero-carousel-dots" role="tablist" aria-label="Modül önizleme seçimi">
        {HERO_SLIDES.map((item, i) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={item.title}
            className={i === index ? "active" : ""}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
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

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "CO";
}

function UserAvatar({ role, profileInfo, compact = false }: { role: Role; profileInfo: ProfileInfo | null; compact?: boolean }) {
  if (!profileInfo?.fullName) return <RoleSymbol role={role} compact={compact} />;
  const size = compact ? 34 : 44;
  const bg = profileInfo.heroRenk || "var(--blue-700)";
  if (profileInfo.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profileInfo.avatarUrl}
        alt={profileInfo.fullName}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <span
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        display: "grid", placeItems: "center", background: bg, color: "#fff",
        fontWeight: 800, fontSize: compact ? 13 : 16, letterSpacing: "-.02em",
      }}
    >
      {initialsOf(profileInfo.fullName)}
    </span>
  );
}

function QrVisual({ value }: { value: string }) {
  const [source, setSource] = useState("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { width: 260, margin: 2, color: { dark: "#08275f", light: "#ffffff" } })
      .then((result) => active && setSource(result))
      .catch(() => active && setSource(""));
    return () => { active = false; };
  }, [value]);

  return source
    ? <img className="qr-image" src={source} alt="Aktif yoklama QR kodu" /> // eslint-disable-line @next/next/no-img-element
    : <span className="qr-loading"><Icon name="qr" size={44} /></span>;
}

const MODULE_ACCENTS: Record<string, { icon: string; bg: string; border: string }> = {
  blue: { icon: "#175cd3", bg: "linear-gradient(145deg, #ffffff, #e6f0ff)", border: "#c7deff" },
  teal: { icon: "#0f8a8a", bg: "linear-gradient(145deg, #ffffff, #e6fbf8)", border: "#bdeee8" },
  coral: { icon: "#e0663a", bg: "linear-gradient(145deg, #ffffff, #fff1eb)", border: "#ffd9c8" },
  amber: { icon: "#b46d0c", bg: "linear-gradient(145deg, #ffffff, #fff4dd)", border: "#ffe1a8" },
  green: { icon: "#1e9a70", bg: "linear-gradient(145deg, #ffffff, #e9f9f3)", border: "#bfe9d9" },
  sky: { icon: "#1f8fc4", bg: "linear-gradient(145deg, #ffffff, #eaf7fd)", border: "#c3e8f6" },
};

function moduleIconStyle(accent: keyof typeof MODULE_ACCENTS): React.CSSProperties {
  const a = MODULE_ACCENTS[accent];
  return { color: a.icon, background: a.bg, borderColor: a.border };
}

// Acadex SSO — lets a faculty ("academician") user land straight in
// Acadex's teacher panel from here, with no separate Acadex account to
// register by hand. Calls our own /api/acadex-sso route (which verifies
// this session server-side and holds the shared secret Acadex's Edge
// Function requires), then does a full-page navigation to the one-time
// magic-link URL it returns — Acadex's sso-callback.html turns that into a
// real session and forwards into teacher.html. Students/admins keep using
// the plain marketing link to Acadex instead (see call sites below).
async function goToAcadexTeacherPanel() {
  try {
    const response = await fetchWithAuth("/api/acadex-sso", { method: "POST" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.redirectUrl) {
      window.alert(data?.message || "Acadex Hoca Paneline giriş yapılamadı, lütfen tekrar deneyin.");
      return;
    }
    window.location.href = data.redirectUrl;
  } catch (err) {
    console.error("Acadex SSO error:", err);
    window.alert("Acadex Hoca Paneline giriş yapılamadı, lütfen tekrar deneyin.");
  }
}

function ModuleHome({
  role,
  onOpenQr,
  displayName,
  unreadCount,
  todaySummary,
}: {
  role: Role;
  onOpenQr: () => void;
  displayName?: string;
  unreadCount?: number;
  todaySummary?: string | null;
}) {
  return (
    <div className="clean-dashboard">
      <section className={`welcome-banner clean-welcome banner-with-cta ${role === "student" ? "student-banner" : "faculty-banner"}`}>
        <div>
          <span className="banner-kicker">{unreadCount ? `${unreadCount} yeni bildirim` : "Kampüs güncel"}</span>
          <h2>{displayName ? `Merhaba, ${displayName}.` : `${roleCopy[role].panel} hazır.`}</h2>
          <p>{todaySummary || "İlk CampusO modülü olan QR Kodla Ders Yoklaması kullanıma açıldı."}</p>
        </div>
        <div className="banner-cta">
          <span className="banner-cta-icon"><Icon name="qr" size={22} /></span>
          <div className="banner-cta-copy">
            <small>VOL 1</small>
            <b>QR Kodla Ders Yoklaması</b>
          </div>
          <button className="button button-primary banner-cta-button" onClick={onOpenQr}>
            Modülü aç <Icon name="arrow" size={16} />
          </button>
        </div>
      </section>

      {MODULE_CATEGORIES.map((category) => {
        const items = category.items.filter((item) => !item.role || item.role === role);
        if (items.length === 0) return null;
        return (
          <div className="dashboard-category" key={category.title}>
            <p className="dashboard-category-title">{category.title}</p>
            <div className="module-grid">
              {items.map((item) => {
                const badge = item.badgeKey === "unread" ? unreadCount : undefined;
                const href = item.hrefFor ? item.hrefFor(role) : (item.href || "#");
                // The Acadex card SSOs faculty straight into the teacher
                // panel instead of just linking out — see
                // goToAcadexTeacherPanel() above. Students/admins keep the
                // plain external link (they don't get an Acadex teacher
                // account this way).
                const isAcadexSso = item.ssoTarget === "acadex" && role === "faculty";
                return (
                  <a
                    key={item.title}
                    className="module-grid-card"
                    href={isAcadexSso ? "#" : href}
                    target={!isAcadexSso && item.external ? "_blank" : undefined}
                    rel={!isAcadexSso && item.external ? "noopener noreferrer" : undefined}
                    onClick={isAcadexSso ? (e) => { e.preventDefault(); goToAcadexTeacherPanel(); } : undefined}
                  >
                    <span className="module-grid-icon" style={moduleIconStyle(item.accent)}><Icon name={item.icon} size={22} /></span>
                    <h3>
                      {item.title}
                      {!!badge && (
                        <span style={{ marginLeft: 7, fontSize: 10, fontWeight: 800, color: "#fff", background: "#ef5c63", borderRadius: 999, padding: "1.5px 7px", verticalAlign: "middle" }}>
                          {badge}
                        </span>
                      )}
                    </h3>
                    <p>{typeof item.desc === "function" ? item.desc(role) : item.desc}</p>
                    <span className="grid-cta">{item.external ? "Aç" : "Modülü aç"} <Icon name="arrow" size={13} /></span>
                  </a>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type ModuleGridItem = {
  title: string;
  desc: string | ((role: Role) => string);
  href?: string;
  hrefFor?: (role: Role) => string;
  icon: IconName;
  accent: keyof typeof MODULE_ACCENTS;
  role?: Role;
  external?: boolean;
  badgeKey?: "unread";
  ssoTarget?: "acadex";
};

const MODULE_CATEGORIES: { title: string; items: ModuleGridItem[] }[] = [
  {
    title: "Akademik",
    items: [
      {
        title: "Ders ve Sınav Takvimi", icon: "book", accent: "blue", href: "/ders-programi-sinav-takvimi",
        desc: "Bölümüne ve sınıfına göre haftalık ders programını ve yaklaşan sınavları görüntüle.",
      },
      {
        title: "Yoklama Takibi", icon: "check", accent: "green",
        hrefFor: (role) => role === "student" ? "/student/yoklamalarim" : "/academician/yoklama",
        desc: (role) => role === "faculty" ? "Kendi derslerinde yoklama al, devam yüzdesi eşiğini takip et." : "Derslerindeki devam yüzdeni ve yoklama geçmişini takip et.",
      },
      {
        title: "Acadex Eğitim Modülü", icon: "spark", accent: "coral", href: "https://acadex-1lku.vercel.app", external: true, ssoTarget: "acadex",
        desc: (role) => role === "faculty" ? "Hoca Paneline tek tıkla geç — ayrıca kayıt olmana gerek yok." : "Ders ağacı, eşleşme ve akademik fırsatlar için Acadex platformuna geç.",
      },
      {
        title: "Akademik Teşvik Hesaplama Robotu", icon: "graduation", accent: "amber", href: "/academician/tesvik", role: "faculty",
        desc: "Yayın, atıf, proje faaliyetlerini gir; toplam teşvik puanını hesapla.",
      },
    ],
  },
  {
    title: "Kariyer & Gelişim",
    items: [
      {
        title: "Staj Takip", icon: "briefcase", accent: "teal",
        hrefFor: (role) => role === "student" ? "/student/staj" : "/academician/staj",
        desc: (role) => role === "faculty" ? "Öğrenci staj başvurularını incele, onayla veya reddet." : "Staj başvurusu oluştur ve durumunu takip et.",
      },
    ],
  },
  {
    title: "Sosyal & Kampüs Hayatı",
    items: [
      {
        title: "Sosyal Sorumluluk", icon: "users", accent: "green",
        hrefFor: (role) => role === "student" ? "/student/sosyal-sorumluluk" : "/academician/sosyal-sorumluluk",
        desc: (role) => role === "faculty" ? "Öğrencilerin sosyal sorumluluk kayıtlarını incele, onayla." : "Katıldığın faaliyetleri kaydet, onay durumunu takip et.",
      },
      {
        title: "Öğrenci Kulüpleri", icon: "shield", accent: "sky",
        hrefFor: (role) => role === "student" ? "/student/kulupler" : "/academician/kulupler",
        desc: (role) => role === "faculty" ? "Danışmanı olduğun kulübü yönet, üyeleri onayla." : "Kampüs kulüplerine göz at, başvur, üyeliğini takip et.",
      },
      {
        title: "Yemek Menüsü", icon: "calendar", accent: "amber", href: "/yemek-menusu",
        desc: "AYBÜ SKS'nin haftalık yemek menüsünü günlere göre görüntüle.",
      },
      {
        title: "Kampüs Duvarı", icon: "message", accent: "teal", href: "/student/kampus-duvari", role: "student", badgeKey: "unread",
        desc: "Gönderi paylaş, arkadaşlarının gönderilerine yorum yap.",
      },
    ],
  },
  {
    title: "Hesabım",
    items: [
      {
        title: "Özelleştirilmiş Profil", icon: "user", accent: "coral", href: "/profil",
        desc: "Profil fotoğrafını, hero kapak rengini, bölüm/sınıf/numaranı düzenle.",
      },
    ],
  },
];

function FacultyQr({ store, onAction }: { store: QrStore; onAction: QrActionRunner }) {
  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [section, setSection] = useState("");
  const [duration, setDuration] = useState(3);
  const [selectedCourseId, setSelectedCourseId] = useState(store.courses[0]?.id ?? "");
  const [selectedPeriodId, setSelectedPeriodId] = useState(store.activePeriodId || "");
  const [now, setNow] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const appOrigin = typeof window === "undefined" ? "https://campus-o2.vercel.app" : window.location.origin;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activePeriod = activePeriodOf(store);
  const selectedPeriod = store.periods.find((period) => period.id === selectedPeriodId) ?? activePeriod;
  const activePeriodCourses = store.courses.filter((course) => course.periodId === activePeriod?.id);
  const periodCourses = store.courses.filter((course) => course.periodId === selectedPeriod?.id);
  const selectedCourseIsActive = activePeriodCourses.some((course) => course.id === selectedCourseId);
  const effectiveCourseId = selectedCourseIsActive ? selectedCourseId : activePeriodCourses[0]?.id || "";
  const activeSession = store.sessions.find((session) => {
    const course = store.courses.find((item) => item.id === session.courseId);
    return course?.periodId === activePeriod?.id && !session.closedAt && session.expiresAt > now;
  });
  const activeCourse = store.courses.find((course) => course.id === activeSession?.courseId);
  const activeRecords = store.records.filter((record) => record.sessionId === activeSession?.id);
  const secondsLeft = activeSession ? Math.max(0, Math.ceil((activeSession.expiresAt - now) / 1000)) : 0;

  async function createCourse(event: FormEvent) {
    event.preventDefault();
    if (!courseName.trim() || !courseCode.trim()) {
      setMessage("Ders adı ve ders kodu zorunludur.");
      return;
    }
    setBusy(true);
    const result = await onAction("create-course", {
      name: courseName.trim(),
      courseCode: courseCode.trim().toUpperCase(),
      section: section.trim() || "1",
    });
    setBusy(false);
    setMessage(result.message);
    if (result.ok) {
      const createdCourse = result.store?.courses[0];
      if (createdCourse) setSelectedCourseId(createdCourse.id);
      setCourseName("");
      setCourseCode("");
      setSection("");
    }
  }

  async function startAttendance() {
    if (!effectiveCourseId) {
      setMessage("Önce bir ders grubu oluşturmalısın.");
      return;
    }
    setBusy(true);
    const result = await onAction("start-session", { courseId: effectiveCourseId, duration });
    setBusy(false);
    setMessage(result.message);
  }

  async function closeAttendance() {
    if (!activeSession) return;
    setBusy(true);
    const result = await onAction("close-session", { sessionId: activeSession.id });
    setBusy(false);
    setMessage(result.message);
  }

  return (
    <div className="qr-workspace">
      <section className="qr-page-heading">
        <div><small>AKADEMİSYEN · VOL 1</small><h1>QR Yoklama Yönetimi</h1><p>Ders grubunu kur, katılım kodunu paylaş ve süreli QR yoklamasını başlat.</p></div>
        <span className={`module-status ${store.enabled ? "online" : "offline"}`}><i /> {store.enabled ? "Modül aktif" : "Modül kapalı"}</span>
      </section>

      {!store.enabled && <div className="module-disabled"><Icon name="shield" /><span><b>QR modülü yönetici tarafından kapatıldı.</b><small>Yeni işlem yapılamaz.</small></span></div>}
      {activePeriod && !activePeriod.isOpen && <div className="module-disabled"><Icon name="calendar" /><span><b>{activePeriod.label} dönemi kapalı.</b><small>Geçmiş kayıtlar görülebilir; yeni ders ve yoklama oluşturulamaz.</small></span></div>}
      {message && <div className="qr-message" role="status">{message}</div>}

      <section className="panel period-toolbar" aria-label="QR dönem seçimi">
        <div>
          <small>AKTİF DÖNEM</small>
          <strong>{activePeriod?.label ?? "Yönetici dönem seçmedi"}</strong>
          <span className={activePeriod?.isOpen ? "open" : "closed"}>{activePeriod?.isOpen ? "İşlemlere açık" : "Kapalı"}</span>
        </div>
        <label>Görüntülenen dönem
          <select value={selectedPeriod?.id ?? ""} onChange={(event) => setSelectedPeriodId(event.target.value)}>
            {store.periods.map((period) => <option key={period.id} value={period.id}>{period.label}{period.isActive ? " · Aktif" : ""}</option>)}
          </select>
        </label>
      </section>

      <div className="qr-grid">
        <section className="panel qr-card">
          <div className="qr-card-title"><span><Icon name="book" /></span><div><small>1. ADIM</small><h2>Ders grubu oluştur</h2></div></div>
          <form className="qr-form" onSubmit={createCourse}>
            <label>Ders adı<input value={courseName} onChange={(event) => setCourseName(event.target.value)} placeholder="Örn. Yönetim Bilişim Sistemleri" disabled={!store.enabled || !activePeriod?.isOpen} /></label>
            <div className="qr-form-row">
              <label>Ders kodu<input value={courseCode} onChange={(event) => setCourseCode(event.target.value)} placeholder="YBS-401" disabled={!store.enabled || !activePeriod?.isOpen} /></label>
              <label>Şube<input value={section} onChange={(event) => setSection(event.target.value)} placeholder="1" disabled={!store.enabled || !activePeriod?.isOpen} /></label>
            </div>
            <button className="button button-primary" disabled={!store.enabled || !activePeriod?.isOpen || busy}>Grubu oluştur</button>
          </form>
        </section>

        <section className="panel qr-card">
          <div className="qr-card-title"><span><Icon name="qr" /></span><div><small>2. ADIM</small><h2>Yoklamayı başlat</h2></div></div>
          {activePeriodCourses.length ? (
            <div className="qr-form">
              <label>Ders grubu
                <select value={effectiveCourseId} onChange={(event) => setSelectedCourseId(event.target.value)} disabled={!store.enabled || !activePeriod?.isOpen || Boolean(activeSession)}>
                  {activePeriodCourses.map((course) => <option key={course.id} value={course.id}>{course.courseCode} · {course.name}</option>)}
                </select>
              </label>
              <label>Süre
                <select value={duration} onChange={(event) => setDuration(Number(event.target.value))} disabled={!store.enabled || !activePeriod?.isOpen || Boolean(activeSession)}>
                  {[1, 2, 3, 5, 10].map((minute) => <option key={minute} value={minute}>{minute} dakika</option>)}
                </select>
              </label>
              <button className="button button-primary" onClick={startAttendance} disabled={!store.enabled || !activePeriod?.isOpen || Boolean(activeSession) || busy}>Yoklamayı başlat</button>
            </div>
          ) : <div className="qr-empty"><Icon name="book" /><p>Yoklama için önce ders grubu oluştur.</p></div>}
        </section>
      </div>

      {activeSession && activeCourse && (
        <section className="panel active-attendance">
          <div className="attendance-qr">
            <QrVisual value={`${appOrigin}/?attendance=${encodeURIComponent(activeSession.token)}`} />
            <span>YOKLAMA KODU</span>
            <strong>{activeSession.token}</strong>
          </div>
          <div className="attendance-detail">
            <small>AKTİF YOKLAMA</small>
            <h2>{activeCourse.courseCode} · {activeCourse.name}</h2>
            <p>Öğrenci telefon kamerasıyla QR kodu okuttuğunda CampusO açılır; profilinden sonra derse ve yoklamaya otomatik katılır.</p>
            <div className="attendance-metrics">
              <div><span>Kalan süre</span><b>{Math.floor(secondsLeft / 60).toString().padStart(2, "0")}:{(secondsLeft % 60).toString().padStart(2, "0")}</b></div>
              <div><span>Katılımcı</span><b>{activeRecords.length}</b></div>
              <div><span>Ders katılım kodu</span><b>{activeCourse.joinCode}</b></div>
            </div>
            <button className="button button-secondary" onClick={closeAttendance} disabled={busy}>Yoklamayı kapat</button>
          </div>
          <div className="live-participants">
            <div className="qr-card-title"><span><Icon name="users" /></span><div><small>CANLI</small><h2>Katılanlar</h2></div></div>
            {activeRecords.length ? activeRecords.map((record) => (
              <div className="participant-row" key={record.id}><span>{record.studentName.slice(0, 2).toUpperCase()}</span><div><b>{record.studentName}</b><small>{record.studentNumber} · {formatTime(record.checkedAt)}</small></div><Icon name="check" size={18} /></div>
            )) : <div className="qr-empty compact"><p>Henüz katılım yok.</p></div>}
          </div>
        </section>
      )}

      <section className="panel course-list">
        <div className="qr-card-title"><span><Icon name="users" /></span><div><small>{selectedPeriod?.label ?? "DÖNEM"}</small><h2>Oluşturulan gruplar</h2></div></div>
        {periodCourses.length ? periodCourses.map((course) => (
          <div className="course-row" key={course.id}><div><b>{course.courseCode} · {course.name}</b><small>Şube {course.section} · {store.memberships.filter((item) => item.courseId === course.id).length} öğrenci</small></div><span><small>{selectedPeriod?.isOpen ? "KATILIM KODU" : "ARŞİV"}</small><strong>{course.joinCode}</strong></span></div>
        )) : <div className="qr-empty compact"><p>Henüz ders grubu oluşturulmadı.</p></div>}
      </section>
    </div>
  );
}

function StudentQr({
  store,
  onAction,
  onProfileChange,
  pendingToken,
  onPendingHandled,
}: {
  store: QrStore;
  onAction: QrActionRunner;
  onProfileChange: (profile: StudentProfile) => void;
  pendingToken: string;
  onPendingHandled: () => void;
}) {
  const [name, setName] = useState(store.profile?.name ?? "");
  const [number, setNumber] = useState(store.profile?.number ?? "");
  const [joinCode, setJoinCode] = useState("");
  const [attendanceCode, setAttendanceCode] = useState("");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState(store.activePeriodId || "");
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<{ stop: () => void; destroy: () => void } | null>(null);
  const attemptedToken = useRef("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activePeriod = activePeriodOf(store);
  const selectedPeriod = store.periods.find((period) => period.id === selectedPeriodId) ?? activePeriod;
  const studentMemberships = store.profile
    ? store.memberships.filter((item) => item.studentNumber === store.profile?.number)
    : [];
  const joinedIds = new Set(studentMemberships.map((item) => item.courseId));
  const joinedCourses = store.courses.filter((course) => joinedIds.has(course.id) && course.periodId === selectedPeriod?.id);
  const activeSessions = store.sessions.filter((session) => {
    const course = store.courses.find((item) => item.id === session.courseId);
    return joinedIds.has(session.courseId)
      && course?.periodId === activePeriod?.id
      && activePeriod?.isOpen
      && !session.closedAt
      && session.expiresAt > now;
  });
  const selectedRecordIds = new Set(store.courses.filter((course) => course.periodId === selectedPeriod?.id).map((course) => course.id));
  const selectedRecords = store.records.filter((record) => record.studentNumber === store.profile?.number && selectedRecordIds.has(record.courseId));

  const attendWithToken = useCallback(async (token: string) => {
    if (!store.profile) {
      setMessage("QR tanındı. Profilini kaydettiğinde derse ve yoklamaya otomatik katılacaksın.");
      return;
    }
    setBusy(true);
    const result = await onAction("record-attendance", {
      token,
      studentName: store.profile.name,
      studentNumber: store.profile.number,
    });
    setBusy(false);
    setAttendanceCode("");
    setMessage(result.message);
  }, [onAction, store.profile]);

  useEffect(() => {
    if (!pendingToken) return;
    if (!store.profile) return;
    if (attemptedToken.current === pendingToken) return;
    attemptedToken.current = pendingToken;
    void attendWithToken(pendingToken).finally(onPendingHandled);
  }, [attendWithToken, onPendingHandled, pendingToken, store.profile]);

  const handleScannedValue = useCallback(async (value: string) => {
    const token = extractAttendanceToken(value);
    if (!token) {
      setMessage("Bu QR kodu geçerli bir CampusO yoklama bağlantısı değil.");
      return;
    }
    scannerRef.current?.stop();
    setScannerOpen(false);
    await attendWithToken(token);
  }, [attendWithToken]);

  useEffect(() => {
    if (!scannerOpen || !videoRef.current) return;
    let cancelled = false;
    const video = videoRef.current;

    void import("qr-scanner")
      .then(async ({ default: QrScanner }) => {
        if (cancelled) return;
        const scanner = new QrScanner(
          video,
          (result) => void handleScannedValue(typeof result === "string" ? result : result.data),
          { preferredCamera: "environment", highlightScanRegion: true, returnDetailedScanResult: true },
        );
        scannerRef.current = scanner;
        await scanner.start();
      })
      .catch(() => {
        setScannerOpen(false);
        setMessage("Kamera açılamadı. Telefon kamerasını kullanabilir veya 8 haneli kodu yazabilirsin.");
      });

    return () => {
      cancelled = true;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [handleScannedValue, scannerOpen]);

  function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !number.trim()) {
      setMessage("Ad soyad ve öğrenci numarası zorunludur.");
      return;
    }
    onProfileChange({ name: name.trim(), number: number.trim() });
    setMessage(pendingToken
      ? "Profil kaydedildi; QR yoklaman otomatik tamamlanıyor."
      : "Öğrenci profili bu cihazda kaydedildi.");
  }

  async function joinCourse(event: FormEvent) {
    event.preventDefault();
    if (!store.profile) {
      setMessage("Önce öğrenci profilini kaydetmelisin.");
      return;
    }
    setBusy(true);
    const result = await onAction("join-course", {
      joinCode: joinCode.trim().toUpperCase(),
      studentName: store.profile.name,
      studentNumber: store.profile.number,
    });
    setBusy(false);
    setMessage(result.message);
    if (result.ok) setJoinCode("");
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    const token = extractAttendanceToken(attendanceCode);
    if (!token) {
      setMessage("8 haneli yoklama kodunu kontrol et.");
      return;
    }
    await attendWithToken(token);
  }

  return (
    <div className="qr-workspace">
      <section className="qr-page-heading">
        <div><small>ÖĞRENCİ · VOL 1</small><h1>QR Yoklama</h1><p>QR kodu tara; aktif derse ve yoklamaya otomatik katıl.</p></div>
        <span className={`module-status ${store.enabled ? "online" : "offline"}`}><i /> {store.enabled ? "Modül aktif" : "Modül kapalı"}</span>
      </section>

      {!store.enabled && <div className="module-disabled"><Icon name="shield" /><span><b>QR modülü yönetici tarafından kapatıldı.</b><small>Yeni işlem yapılamaz.</small></span></div>}
      {activePeriod && !activePeriod.isOpen && <div className="module-disabled"><Icon name="calendar" /><span><b>{activePeriod.label} dönemi kapalı.</b><small>Yeni katılım alınmıyor; geçmiş yoklamalarını görüntüleyebilirsin.</small></span></div>}
      {pendingToken && !store.profile && <div className="qr-scan-notice"><Icon name="qr" /><span><b>Yoklama QR kodu algılandı.</b><small>Profilini bir kez kaydet; CampusO kalan işlemleri otomatik tamamlasın.</small></span></div>}
      {message && <div className="qr-message" role="status">{message}</div>}

      <section className="panel period-toolbar" aria-label="Öğrenci QR dönem seçimi">
        <div>
          <small>AKTİF DÖNEM</small>
          <strong>{activePeriod?.label ?? "Dönem seçilmedi"}</strong>
          <span className={activePeriod?.isOpen ? "open" : "closed"}>{activePeriod?.isOpen ? "Yoklamaya açık" : "Kapalı"}</span>
        </div>
        <label>Geçmiş dönem
          <select value={selectedPeriod?.id ?? ""} onChange={(event) => setSelectedPeriodId(event.target.value)}>
            {store.periods.map((period) => <option key={period.id} value={period.id}>{period.label}{period.isActive ? " · Aktif" : ""}</option>)}
          </select>
        </label>
      </section>

      <section className="panel student-scan-card">
        <span className="module-launch-icon"><Icon name="qr" size={34} /></span>
        <div><small>HIZLI KATILIM</small><h2>QR kodu kamerayla tara</h2><p>Akademisyenin ekranındaki QR bağlantısını okut; ders üyeliğin ve yoklaman tek adımda kaydedilsin.</p></div>
        <button className="button button-primary" onClick={() => setScannerOpen(true)} disabled={!store.enabled || !activePeriod?.isOpen || busy}>Kamerayı aç</button>
      </section>

      {scannerOpen && (
        <div className="qr-scanner-layer" role="dialog" aria-modal="true" aria-label="QR kod tarayıcı">
          <button className="qr-scanner-backdrop" onClick={() => setScannerOpen(false)} aria-label="Tarayıcıyı kapat" />
          <section className="qr-scanner-card">
            <header><div><b>QR kodu çerçeveye getir</b><small>Kamera yalnızca tarama sırasında kullanılır.</small></div><button onClick={() => setScannerOpen(false)} aria-label="Kapat"><Icon name="close" /></button></header>
            <video ref={videoRef} muted playsInline />
          </section>
        </div>
      )}

      <div className="qr-grid">
        <section className="panel qr-card">
          <div className="qr-card-title"><span><Icon name="user" /></span><div><small>1. ADIM</small><h2>Öğrenci profili</h2></div></div>
          <form className="qr-form" onSubmit={saveProfile}>
            <label>Ad soyad<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Adın ve soyadın" disabled={!store.enabled} /></label>
            <label>Öğrenci numarası<input value={number} onChange={(event) => setNumber(event.target.value)} placeholder="Öğrenci numaran" disabled={!store.enabled} /></label>
            <button className="button button-primary" disabled={!store.enabled}>{store.profile ? "Profili güncelle" : "Profili kaydet"}</button>
          </form>
        </section>

        <section className="panel qr-card">
          <div className="qr-card-title"><span><Icon name="book" /></span><div><small>ALTERNATİF</small><h2>Ders grubuna kodla katıl</h2></div></div>
          <form className="qr-form" onSubmit={joinCourse}>
            <label>Akademisyen katılım kodu<input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="Örn. 7K9P2M" maxLength={6} disabled={!store.enabled || !activePeriod?.isOpen} /></label>
            <button className="button button-primary" disabled={!store.enabled || !activePeriod?.isOpen || busy}>Derse katıl</button>
          </form>
        </section>
      </div>

      <section className="panel attendance-check">
        <div className="qr-card-title"><span><Icon name="check" /></span><div><small>YEDEK YÖNTEM</small><h2>Yoklama kodunu doğrula</h2></div></div>
        <form className="attendance-code-form" onSubmit={verifyCode}>
          <label>QR ekranındaki yoklama kodu<input value={attendanceCode} onChange={(event) => setAttendanceCode(event.target.value.toUpperCase())} placeholder="8 haneli kod" maxLength={8} disabled={!store.enabled} /></label>
          <button className="button button-primary" disabled={!store.enabled || !activePeriod?.isOpen || busy}>Yoklamayı doğrula</button>
        </form>
        <div className="active-session-list">
          {activeSessions.length ? activeSessions.map((session) => {
            const course = store.courses.find((item) => item.id === session.courseId);
            const completed = store.records.some((record) => record.sessionId === session.id && record.studentNumber === store.profile?.number);
            return <div className="student-session" key={session.id}><span><Icon name={completed ? "check" : "qr"} /></span><div><b>{course?.courseCode} · {course?.name}</b><small>{completed ? "Yoklaman kaydedildi" : `${formatTime(session.expiresAt)} tarihine kadar açık`}</small></div><button onClick={() => attendWithToken(session.token)} disabled={completed || !store.enabled || busy}>{completed ? "Tamamlandı" : "Katıl"}</button></div>;
          }) : <div className="qr-empty compact"><p>Katıldığın derslerde açık yoklama bulunmuyor.</p></div>}
        </div>
      </section>

      <div className="qr-grid">
        <section className="panel course-list">
          <div className="qr-card-title"><span><Icon name="book" /></span><div><small>{selectedPeriod?.label ?? "DERSLERİM"}</small><h2>Katıldığın gruplar</h2></div></div>
          {joinedCourses.length ? joinedCourses.map((course) => <div className="course-row" key={course.id}><div><b>{course.courseCode} · {course.name}</b><small>Şube {course.section}</small></div><Icon name="check" size={20} /></div>) : <div className="qr-empty compact"><p>Henüz bir ders grubuna katılmadın.</p></div>}
        </section>
        <section className="panel course-list">
          <div className="qr-card-title"><span><Icon name="calendar" /></span><div><small>{selectedPeriod?.label ?? "GEÇMİŞ"}</small><h2>Yoklamalarım</h2></div></div>
          {selectedRecords.length
            ? selectedRecords.map((record) => {
              const course = store.courses.find((item) => item.id === record.courseId);
              return <div className="history-row" key={record.id}><Icon name="check" size={18} /><div><b>{course?.courseCode} · {course?.name}</b><small>{formatTime(record.checkedAt)}</small></div></div>;
            })
            : <div className="qr-empty compact"><p>Henüz yoklama kaydın yok.</p></div>}
        </section>
      </div>
    </div>
  );
}

function QrModule({
  role,
  store,
  onAction,
  onProfileChange,
  pendingToken,
  onPendingHandled,
}: {
  role: Role;
  store: QrStore;
  onAction: QrActionRunner;
  onProfileChange: (profile: StudentProfile) => void;
  pendingToken: string;
  onPendingHandled: () => void;
}) {
  return role === "faculty"
    ? <FacultyQr store={store} onAction={onAction} />
    : <StudentQr store={store} onAction={onAction} onProfileChange={onProfileChange} pendingToken={pendingToken} onPendingHandled={onPendingHandled} />;
}

function PeriodManagement({ store, onAction }: { store: QrStore; onAction: QrActionRunner }) {
  const [academicYear, setAcademicYear] = useState("2026-2027");
  const [term, setTerm] = useState<AcademicPeriod["term"]>("guz");
  const [startDate, setStartDate] = useState("2026-09-01");
  const [endDate, setEndDate] = useState("2027-01-31");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function createPeriod(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await onAction("create-period", { academicYear, term, startDate, endDate });
    setBusy(false);
    setMessage(result.message);
  }

  async function runPeriodAction(action: "set-active-period" | "toggle-period-open", payload: Record<string, string | boolean>) {
    setBusy(true);
    const result = await onAction(action, payload);
    setBusy(false);
    setMessage(result.message);
  }

  return (
    <section className="admin-module panel period-management" aria-label="Akademik dönem yönetimi">
      <div className="admin-module-heading">
        <span><Icon name="calendar" size={26} /></span>
        <div><small>ORTAK SİSTEM</small><h2>Akademik Dönem Yönetimi</h2><p>QR Yoklama ve Staj Takip kayıtlarını aynı dönem altında yönet.</p></div>
      </div>

      {message && <div className="qr-message" role="status">{message}</div>}

      <form className="period-create-form" onSubmit={createPeriod}>
        <label>Akademik yıl<input value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} placeholder="2026-2027" maxLength={9} /></label>
        <label>Dönem
          <select value={term} onChange={(event) => setTerm(event.target.value as AcademicPeriod["term"])}>
            <option value="guz">Güz</option>
            <option value="bahar">Bahar</option>
            <option value="yaz">Yaz</option>
          </select>
        </label>
        <label>Başlangıç<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label>Bitiş<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        <button className="button button-primary" disabled={busy}>Dönem oluştur</button>
      </form>

      <div className="period-list">
        {store.periods.map((period) => (
          <article key={period.id} className={period.isActive ? "active" : ""}>
            <div>
              <span className={`period-state ${period.isOpen ? "open" : "closed"}`}>{period.isOpen ? "Açık" : "Kapalı"}</span>
              <strong>{period.label}</strong>
              <small>{period.startDate} → {period.endDate}{period.isActive ? " · Aktif dönem" : ""}</small>
            </div>
            <div>
              {!period.isActive && period.isOpen && (
                <button disabled={busy} onClick={() => void runPeriodAction("set-active-period", { periodId: period.id })}>Aktif yap</button>
              )}
              <button
                disabled={busy}
                onClick={() => void runPeriodAction("toggle-period-open", { periodId: period.id, open: !period.isOpen })}
              >
                {period.isOpen ? "Dönemi kapat" : "Dönemi aç"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminPanel({ onExit, store, onAction }: { onExit: () => void; store: QrStore; onAction: QrActionRunner }) {
  const activePeriod = activePeriodOf(store);
  const activeCourses = store.courses.filter((course) => course.periodId === activePeriod?.id);
  const activeCourseIds = new Set(activeCourses.map((course) => course.id));
  const activeSessions = store.sessions.filter((session) => activeCourseIds.has(session.courseId));
  const activeMemberships = store.memberships.filter((membership) => activeCourseIds.has(membership.courseId));
  const activeRecords = store.records.filter((record) => activeCourseIds.has(record.courseId));

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Brand inverse />
        <div className="admin-identity">
          <span><Icon name="shield" size={20} /></span>
          <div><b>Yönetim Merkezi</b><small>CampusO Admin</small></div>
        </div>

        <p className="nav-label">YÖNETİM</p>
        <nav className="side-nav" aria-label="Yönetici menüsü">
          <button className="active"><Icon name="home" size={19} /><span>Genel Bakış</span></button>
          <button><Icon name="qr" size={19} /><span>QR Yoklama</span></button>
                  <button onClick={() => { window.location.href = "/admin/staj"; }}><Icon name="briefcase" size={19} /><span>Staj Takip</span></button>
          <button onClick={() => { window.location.href = "/admin/tesvik"; }}><Icon name="graduation" size={19} /><span>Akademik Teşvik</span></button>
          <button onClick={() => { window.location.href = "/admin/sosyal-sorumluluk"; }}><Icon name="check" size={19} /><span>Sosyal Sorumluluk</span></button>
          <button onClick={() => { window.location.href = "/admin/kulupler"; }}><Icon name="shield" size={19} /><span>Kulüpler</span></button>
          <button onClick={() => { window.location.href = "/admin/yemek-menusu"; }}><Icon name="calendar" size={19} /><span>Yemek Menüsü</span></button>
          <button onClick={() => { window.location.href = "/admin/ders-programi-sinav-takvimi"; }}><Icon name="book" size={19} /><span>Ders ve Sınav Takvimi</span></button>
          <button onClick={() => { window.location.href = "/admin/yoklama"; }}><Icon name="check" size={19} /><span>Yoklama Takibi</span></button>
          <button onClick={() => { window.location.href = "/admin/profiller"; }}><Icon name="user" size={19} /><span>Profil Yönetimi</span></button>
          <button onClick={() => { window.location.href = "/admin/kampus-duvari"; }}><Icon name="message" size={19} /><span>Kampüs Duvarı</span></button>
          <button onClick={() => { window.location.href = "/admin/davet"; }}><Icon name="users" size={19} /><span>Yetki Ver</span></button>
          <button onClick={() => { window.location.href = "/admin/kullanicilar"; }}><Icon name="user" size={19} /><span>Kullanıcılar</span></button>
        </nav>

        <div className="admin-sidebar-empty">
          <span><Icon name="qr" size={18} /></span>
          <div><b>Vol 1</b><small>QR Yoklama aktif</small></div>
        </div>

        <button className="exit-button" onClick={onExit}>
          <Icon name="arrow" size={17} /> Ana sayfaya dön
        </button>
      </aside>

      <section className="admin-main">
        <header className="admin-header">
          <div><span>CampusO</span><b>Yönetici Paneli</b></div>
          <span className="admin-stage-badge"><i /> 2 dönemsel modül</span>
        </header>

        <div className="admin-body">
          <section className="admin-welcome">
            <div>
              <span className="banner-kicker">YÖNETİM MERKEZİ</span>
              <h1>Dönemsel yönetim hazır.</h1>
              <p>Aktif dönemi belirle; QR Yoklama ve Staj Takip kayıtlarını dönem bazında yönet.</p>
            </div>
            <span className="admin-shield"><Icon name="shield" size={38} /></span>
          </section>

          <PeriodManagement store={store} onAction={onAction} />

          <section className="admin-module panel" aria-label="QR yoklama yönetimi">
            <div className="admin-module-heading">
              <span><Icon name="qr" size={26} /></span>
              <div><small>VOL 1 · {activePeriod?.label ?? "DÖNEM YOK"}</small><h2>QR Kodla Ders Yoklaması</h2><p>Seçili döneme ait ders ve yoklama verileri.</p></div>
              <label className="module-toggle">
                <input
                  type="checkbox"
                  checked={store.enabled}
                  onChange={(event) => void onAction("toggle-enabled", { enabled: event.target.checked })}
                />
                <span />
                {store.enabled ? "Aktif" : "Kapalı"}
              </label>
            </div>
            <div className="admin-stat-grid">
              <div><span><Icon name="book" /></span><small>Ders grubu</small><b>{activeCourses.length}</b></div>
              <div><span><Icon name="users" /></span><small>Öğrenci üyeliği</small><b>{activeMemberships.length}</b></div>
              <div><span><Icon name="qr" /></span><small>Yoklama oturumu</small><b>{activeSessions.length}</b></div>
              <div><span><Icon name="check" /></span><small>Katılım kaydı</small><b>{activeRecords.length}</b></div>
            </div>
            <div className="admin-recent">
              <div className="qr-card-title"><span><Icon name="calendar" /></span><div><small>SON İŞLEMLER</small><h2>Yoklama kayıtları</h2></div></div>
              {activeRecords.length ? activeRecords.slice(0, 6).map((record) => {
                const course = store.courses.find((item) => item.id === record.courseId);
                return <div className="participant-row" key={record.id}><span>{record.studentName.slice(0, 2).toUpperCase()}</span><div><b>{record.studentName}</b><small>{record.studentNumber} · {course?.courseCode} · {formatTime(record.checkedAt)}</small></div><Icon name="check" size={18} /></div>;
              }) : <div className="qr-empty compact"><p>Henüz yoklama kaydı bulunmuyor.</p></div>}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function ProfileMenu({
  role,
  onClose,
  onSignOut,
  onChooseRole,
}: {
  role: Role;
  onClose: () => void;
  onSignOut: () => void;
  onChooseRole: () => void;
}) {
  return (
    <div className="profile-layer" role="dialog" aria-modal="true" aria-label="Panel menüsü">
      <button className="profile-layer-backdrop" onClick={onClose} aria-label="Panel menüsünü kapat" />
      <section className="prototype-profile clean-profile">
        <header>
          <button onClick={onClose} aria-label="Geri dön"><Icon name="arrow" size={18} /></button>
          <div><b>Hesap menüsü</b><small>Güvenli oturum aktif</small></div>
        </header>
        <div className="profile-identity clean-profile-identity">
          <RoleSymbol role={role} />
          <b>{roleCopy[role].panel}</b>
          <small>Rol sunucuda doğrulandı</small>
          <em>{roleCopy[role].title}</em>
        </div>
        <button className="profile-role-switch" onClick={() => { window.location.href = "/profil"; }}>
          <Icon name="user" size={18} />
          Profilimi Düzenle
        </button>
        <button className="profile-role-switch" onClick={onSignOut}>
          <Icon name="switch" size={18} />
          Güvenli çıkış yap
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
  const [adminOpen, setAdminOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [panelView, setPanelView] = useState<PanelView>("home");
  const [qrStore, setQrStore] = useState<QrStore>(emptyQrStore);
  const [pendingAttendanceToken, setPendingAttendanceToken] = useState("");
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [todaySummary, setTodaySummary] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState<Array<{ id: string; tip: string; created_at: string; okundu: boolean }>>([]);

  const refreshNotifCount = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { count } = await supabase
      .from("kampus_duvari_bildirimleri")
      .select("id", { count: "exact", head: true })
      .eq("kullanici_id", userId)
      .eq("okundu", false);
    setUnreadCount(count || 0);
  }, []);

  const openNotifDropdown = useCallback(async () => {
    if (!supabase) return;
    setNotifOpen((current) => !current);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("kampus_duvari_bildirimleri")
      .select("id, tip, created_at, okundu")
      .eq("kullanici_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    setNotifItems(data || []);
    const unreadIds = (data || []).filter((n) => !n.okundu).map((n) => n.id);
    if (unreadIds.length) {
      await supabase.from("kampus_duvari_bildirimleri").update({ okundu: true }).in("id", unreadIds);
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initializeSession() {
      let profile: StudentProfile | null = null;
      try {
        profile = JSON.parse(window.localStorage.getItem(QR_PROFILE_KEY) ?? "null") as StudentProfile | null;
        if (!profile) {
          const legacy = JSON.parse(window.localStorage.getItem(QR_STORAGE_KEY) ?? "null") as Partial<QrStore> | null;
          profile = legacy?.profile ?? null;
        }
      } catch {
        profile = null;
      }

      const search = new URLSearchParams(window.location.search);
      const token = search.get("attendance")?.trim().toUpperCase() ?? "";
      const session = await getCampusSession();
      if (cancelled) return;

      if (!session) {
        if (token) {
          const returnTo = `${window.location.pathname}${window.location.search}`;
          window.location.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
        }
        return;
      }

      if (profile?.name && profile.number) {
        setQrStore((current) => ({ ...current, profile }));
        window.localStorage.setItem(QR_PROFILE_KEY, JSON.stringify(profile));
      }
      if (token && session.role === "student") {
        setPendingAttendanceToken(token);
        setRole("student");
        setPanelView("qr");
        return;
      }

      if (session.role === "admin") {
        setAdminOpen(true);
      } else {
        const resolvedRole: Role = session.role === "academician" ? "faculty" : "student";
        setRole(resolvedRole);
        void loadDashboardExtras(session.user.id, resolvedRole);
      }
    }

    async function loadDashboardExtras(userId: string, resolvedRole: Role) {
      if (!supabase) return;
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("full_name, bolum, sinif, avatar_url, hero_renk")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (profileRow) {
        setProfileInfo({
          fullName: profileRow.full_name || "",
          bolum: profileRow.bolum || "",
          sinif: profileRow.sinif || "",
          avatarUrl: profileRow.avatar_url || "",
          heroRenk: profileRow.hero_renk || "",
        });
      }

      void refreshNotifCount(userId);

      const gunAdi = bugununGunAdi();
      if (resolvedRole === "faculty") {
        const { count: dersSayisi } = await supabase
          .from("ders_programi")
          .select("id", { count: "exact", head: true })
          .eq("akademisyen_id", userId)
          .eq("gun", gunAdi);
        if (!cancelled) {
          setTodaySummary(dersSayisi ? `Bugün ${dersSayisi} dersin var.` : "Bugün programında ders görünmüyor.");
        }
      } else if (profileRow?.bolum && profileRow?.sinif) {
        const [{ count: dersSayisi }, { count: sinavSayisi }] = await Promise.all([
          supabase.from("ders_programi").select("id", { count: "exact", head: true })
            .eq("bolum", profileRow.bolum).eq("sinif", profileRow.sinif).eq("gun", gunAdi),
          supabase.from("sinav_takvimi").select("id", { count: "exact", head: true })
            .eq("bolum", profileRow.bolum).eq("sinif", profileRow.sinif).eq("tarih", bugunIso()),
        ]);
        if (!cancelled) {
          const parcalar: string[] = [];
          if (dersSayisi) parcalar.push(`${dersSayisi} dersin`);
          if (sinavSayisi) parcalar.push(`${sinavSayisi} sınavın`);
          setTodaySummary(parcalar.length ? `Bugün ${parcalar.join(" ve ")} var.` : "Bugün programında ders/sınav görünmüyor.");
        }
      }
    }

    void initializeSession();
    return () => { cancelled = true; };
  }, []);

  const mergeRemoteStore = useCallback((remote: Omit<QrStore, "profile">) => {
    setQrStore((current) => ({ ...remote, profile: current.profile }));
  }, []);

  const refreshQrStore = useCallback(async () => {
    try {
      const response = await fetchWithAuth("/api/qr", { cache: "no-store" });
      if (!response.ok) return;
      const remote = await response.json() as Omit<QrStore, "profile">;
      mergeRemoteStore(remote);
    } catch {
      // Ağ kısa süreli kesilirse ekrandaki son doğrulanmış veri korunur.
    }
  }, [mergeRemoteStore]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refreshQrStore(), 0);
    const timer = window.setInterval(() => void refreshQrStore(), 2000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refreshQrStore]);

  const runQrAction = useCallback<QrActionRunner>(async (action, payload = {}) => {
    try {
      const response = await fetchWithAuth("/api/qr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await response.json() as QrActionResult;
      if (result.store) mergeRemoteStore(result.store);
      return result;
    } catch {
      return { ok: false, message: "CampusO sunucusuna ulaşılamadı. Lütfen tekrar dene." };
    }
  }, [mergeRemoteStore]);

  const updateStudentProfile = useCallback((profile: StudentProfile) => {
    window.localStorage.setItem(QR_PROFILE_KEY, JSON.stringify(profile));
    setQrStore((current) => ({ ...current, profile }));
  }, []);

  const clearPendingAttendance = useCallback(() => {
    setPendingAttendanceToken("");
    const url = new URL(window.location.href);
    url.searchParams.delete("attendance");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  function returnToLanding() {
    setRole(null);
    setAdminOpen(false);
    setMobileOpen(false);
    setProfileOpen(false);
    setPanelView("home");
  }

  async function signOut() {
    await supabase?.auth.signOut();
    window.localStorage.removeItem(QR_PROFILE_KEY);
    window.location.href = "/";
  }

  if (adminOpen) {
    return <AdminPanel onExit={returnToLanding} store={qrStore} onAction={runQrAction} />;
  }

  if (!role) {
    return <Landing />;
  }

  const copy = roleCopy[role];
  const profileLine = profileInfo?.fullName
    ? [profileInfo.bolum, profileInfo.sinif ? `${profileInfo.sinif}. sınıf` : ""].filter(Boolean).join(" · ") || copy.title
    : "Kullanıcı verisi bağlı değil";

  return (
    <main className="app-shell clean-app-shell">
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-top">
          <Brand inverse />
          <button className="sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Menüyü kapat"><Icon name="close" /></button>
        </div>

        <div className="role-card clean-role-card">
          <UserAvatar role={role} profileInfo={profileInfo} compact />
          <span><b>{profileInfo?.fullName || copy.panel}</b><small>{profileLine}</small></span>
          <button aria-label="Panel görünümünü aç" onClick={() => setProfileOpen(true)}><Icon name="switch" size={17} /></button>
        </div>

        <p className="nav-label">KAMPÜS</p>
        <nav className="side-nav" aria-label="Uygulama menüsü">
          <button className={panelView === "home" ? "active" : ""} onClick={() => { setPanelView("home"); setMobileOpen(false); }}><Icon name="home" size={19} /><span>Ana Sayfa</span></button>
          <button className={panelView === "qr" ? "active" : ""} onClick={() => { setPanelView("qr"); setMobileOpen(false); }}><Icon name="qr" size={19} /><span>QR Yoklama</span></button>
          <button onClick={() => window.location.href = (typeof role !== "undefined" && role === "student") ? "/student/staj" : "/academician/staj"}><Icon name="briefcase" size={19} /><span>Staj Takip</span></button>
          {role === "faculty" && (
            <button onClick={() => { window.location.href = "/academician/tesvik"; }}><Icon name="graduation" size={19} /><span>Akademik Teşvik</span></button>
          )}
          <button onClick={() => { window.location.href = (typeof role !== "undefined" && role === "student") ? "/student/sosyal-sorumluluk" : "/academician/sosyal-sorumluluk"; }}><Icon name="users" size={19} /><span>Sosyal Sorumluluk</span></button>
          <button onClick={() => { window.location.href = (typeof role !== "undefined" && role === "student") ? "/student/kulupler" : "/academician/kulupler"; }}><Icon name="shield" size={19} /><span>Kulüpler</span></button>
          <button onClick={() => { window.location.href = "/yemek-menusu"; }}><Icon name="calendar" size={19} /><span>Yemek Menüsü</span></button>
          <button onClick={() => { window.location.href = "/ders-programi-sinav-takvimi"; }}><Icon name="book" size={19} /><span>Ders ve Sınav Takvimi</span></button>
          <button onClick={() => { window.location.href = (typeof role !== "undefined" && role === "student") ? "/student/yoklamalarim" : "/academician/yoklama"; }}><Icon name="check" size={19} /><span>Yoklama Takibi</span></button>
          {role === "student" && (
            <button onClick={() => { window.location.href = "/student/kampus-duvari"; }}><Icon name="message" size={19} /><span>Kampüs Duvarı</span></button>
          )}
                    <button onClick={() => { if (role === "faculty") { goToAcadexTeacherPanel(); } else { window.open("https://acadex-1lku.vercel.app", "_blank"); } }}><Icon name="spark" size={19} /><span>Acadex</span></button>
        </nav>

        <div className="clean-sidebar-empty">
          <span><Icon name="qr" size={18} /></span>
          <div><b>Vol 1 aktif</b><small>QR Kodla Ders Yoklaması</small></div>
        </div>

        <button className="exit-button" onClick={returnToLanding}><Icon name="arrow" size={17} /> Ana sayfaya dön</button>
      </aside>

      {mobileOpen && <button className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Menüyü kapat" />}

      <section className="app-main">
        <header className="app-header">
          <button className="menu-button" onClick={() => setMobileOpen(true)} aria-label="Menüyü aç"><Icon name="menu" /></button>
          <button className="mobile-app-identity" onClick={() => setProfileOpen(true)} aria-label="Panel görünümünü aç">
            <span className="mobile-seal">CO</span>
            <span><b>{profileInfo?.fullName || copy.panel}</b><small>{profileLine}</small></span>
          </button>
          <div className="breadcrumbs"><span>{copy.panel}</span><b>{panelView === "home" ? "Ana Sayfa" : "QR Yoklama"}</b></div>
          <label className="global-search clean-search">
            <Icon name="search" size={18} />
            <input aria-label="CampusO'da ara" placeholder="CampusO'da ara" disabled />
          </label>
          <button className="header-icon" aria-label="Profilim" title="Profilim" onClick={() => { window.location.href = "/profil"; }}>
            <Icon name="user" size={19} />
          </button>
          <div className="notif-wrap" style={{ position: "relative" }}>
            <button className="header-icon" aria-label={unreadCount ? `${unreadCount} okunmamış bildirim` : "Bildirimler"} onClick={openNotifDropdown}>
              <Icon name="bell" size={20} />
              {unreadCount > 0 && (
                <span style={{ position: "absolute", top: 4, right: 4, minWidth: 15, height: 15, padding: "0 3px", borderRadius: 999, background: "#ef5c63", color: "#fff", fontSize: 9.5, fontWeight: 800, display: "grid", placeItems: "center" }}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 300, maxHeight: 340, overflowY: "auto", background: "var(--white)", border: "1px solid var(--line)", borderRadius: 14, boxShadow: "var(--shadow)", padding: 8, zIndex: 40 }}>
                {notifItems.length === 0 ? (
                  <div style={{ padding: "18px 10px", textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>Henüz bildirim yok.</div>
                ) : (
                  notifItems.map((n) => (
                    <div key={n.id} style={{ padding: "9px 10px", borderRadius: 9, fontSize: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ marginTop: 2 }}><Icon name={n.tip === "duyuru" ? "spark" : "message"} size={15} /></span>
                      <span>
                        {n.tip === "duyuru" ? "Yeni bir duyuru paylaşıldı." : "Gönderine yeni bir yorum geldi."}
                        <br />
                        <small style={{ color: "var(--muted)" }}>{new Date(n.created_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}</small>
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <button className="header-profile" onClick={() => setProfileOpen(true)} title="Panel görünümünü aç">
            <UserAvatar role={role} profileInfo={profileInfo} compact />
            <span><b>{profileInfo?.fullName || copy.panel}</b><small>{profileLine}</small></span>
            <Icon name="switch" size={15} />
          </button>
        </header>

        <div className="page-body">
          {panelView === "home"
            ? <ModuleHome role={role} onOpenQr={() => setPanelView("qr")} displayName={profileInfo?.fullName} unreadCount={unreadCount} todaySummary={todaySummary} />
            : <QrModule role={role} store={qrStore} onAction={runQrAction} onProfileChange={updateStudentProfile} pendingToken={pendingAttendanceToken} onPendingHandled={clearPendingAttendance} />}
        </div>
      </section>

      {profileOpen && (
        <ProfileMenu
          role={role}
          onClose={() => setProfileOpen(false)}
          onSignOut={() => void signOut()}
          onChooseRole={returnToLanding}
        />
      )}

      <nav className="mobile-bottom-nav clean-bottom-nav" aria-label="Mobil uygulama menüsü">
        <button className={panelView === "home" ? "active" : ""} onClick={() => setPanelView("home")}><Icon name="home" size={20} /><span>Ana Sayfa</span></button>
        <button className={panelView === "qr" ? "active" : ""} onClick={() => setPanelView("qr")}><Icon name="qr" size={20} /><span>QR Yoklama</span></button>
        <button onClick={() => window.location.href = (typeof role !== "undefined" && role === "student") ? "/student/staj" : "/academician/staj"}><Icon name="briefcase" size={20} /><span>Staj Takip</span></button>
        <button onClick={() => setMobileOpen(true)}><Icon name="menu" size={20} /><span>Menü</span></button>
      </nav>
    </main>
  );
}
