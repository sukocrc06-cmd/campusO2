"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

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
  | "settings";

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
  name: string;
  courseCode: string;
  section: string;
  joinCode: string;
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
  courses: CourseGroup[];
  sessions: AttendanceSession[];
  profile: StudentProfile | null;
  memberships: Membership[];
  records: AttendanceRecord[];
};

const emptyQrStore: QrStore = {
  enabled: true,
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

function Landing({ onEnter, onAdmin }: { onEnter: (role: Role) => void; onAdmin: () => void }) {
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

function ModuleHome({ role, onOpenQr }: { role: Role; onOpenQr: () => void }) {
  return (
    <div className="clean-dashboard">
      <section className={`welcome-banner clean-welcome ${role === "student" ? "student-banner" : "faculty-banner"}`}>
        <div>
          <span className="banner-kicker">VOL 1 AKTİF</span>
          <h2>{roleCopy[role].panel} hazır.</h2>
          <p>İlk CampusO modülü olan QR Kodla Ders Yoklaması kullanıma açıldı.</p>
        </div>
        <span className="clean-ready-badge"><Icon name="qr" size={25} /><b>Vol 1</b></span>
      </section>

      <section className="module-launch-card panel">
        <span className="module-launch-icon"><Icon name="qr" size={34} /></span>
        <div>
          <small>VOL 1</small>
          <h1>QR Kodla Ders Yoklaması</h1>
          <p>
            {role === "faculty"
              ? "Ders grubunu oluştur, katılım kodunu paylaş ve süreli yoklamayı başlat."
              : "Profilini tanımla, akademisyenin katılım koduyla derse katıl ve yoklamanı tamamla."}
          </p>
        </div>
        <button className="button button-primary" onClick={onOpenQr}>
          Modülü aç <Icon name="arrow" size={17} />
        </button>
      </section>

      <section className="module-launch-card panel" style={{ marginTop: 16 }}>
        <span className="module-launch-icon"><Icon name="briefcase" size={34} /></span>
        <div>
          <small>VOL 2</small>
          <h1>Staj Takip</h1>
          <p>
            {role === "faculty"
              ? "Öğrenci staj başvurularını incele, onayla veya reddet."
              : "Staj başvurusu oluştur ve durumunu takip et."}
          </p>
        </div>
        <a
          className="button button-primary"
          href={role === "student" ? "/student/staj" : "/academician/staj"}
          style={{ textDecoration: "none" }}
        >
          Modülü aç <Icon name="arrow" size={17} />
        </a>
      </section>
    </div>
  );
}

function FacultyQr({ store, onAction }: { store: QrStore; onAction: QrActionRunner }) {
  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [section, setSection] = useState("");
  const [duration, setDuration] = useState(3);
  const [selectedCourseId, setSelectedCourseId] = useState(store.courses[0]?.id ?? "");
  const [now, setNow] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const appOrigin = typeof window === "undefined" ? "https://campus-o2.vercel.app" : window.location.origin;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const effectiveCourseId = selectedCourseId || store.courses[0]?.id || "";
  const activeSession = store.sessions.find((session) => !session.closedAt && session.expiresAt > now);
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
      {message && <div className="qr-message" role="status">{message}</div>}

      <div className="qr-grid">
        <section className="panel qr-card">
          <div className="qr-card-title"><span><Icon name="book" /></span><div><small>1. ADIM</small><h2>Ders grubu oluştur</h2></div></div>
          <form className="qr-form" onSubmit={createCourse}>
            <label>Ders adı<input value={courseName} onChange={(event) => setCourseName(event.target.value)} placeholder="Örn. Yönetim Bilişim Sistemleri" disabled={!store.enabled} /></label>
            <div className="qr-form-row">
              <label>Ders kodu<input value={courseCode} onChange={(event) => setCourseCode(event.target.value)} placeholder="YBS-401" disabled={!store.enabled} /></label>
              <label>Şube<input value={section} onChange={(event) => setSection(event.target.value)} placeholder="1" disabled={!store.enabled} /></label>
            </div>
            <button className="button button-primary" disabled={!store.enabled || busy}>Grubu oluştur</button>
          </form>
        </section>

        <section className="panel qr-card">
          <div className="qr-card-title"><span><Icon name="qr" /></span><div><small>2. ADIM</small><h2>Yoklamayı başlat</h2></div></div>
          {store.courses.length ? (
            <div className="qr-form">
              <label>Ders grubu
                <select value={effectiveCourseId} onChange={(event) => setSelectedCourseId(event.target.value)} disabled={!store.enabled || Boolean(activeSession)}>
                  {store.courses.map((course) => <option key={course.id} value={course.id}>{course.courseCode} · {course.name}</option>)}
                </select>
              </label>
              <label>Süre
                <select value={duration} onChange={(event) => setDuration(Number(event.target.value))} disabled={!store.enabled || Boolean(activeSession)}>
                  {[1, 2, 3, 5, 10].map((minute) => <option key={minute} value={minute}>{minute} dakika</option>)}
                </select>
              </label>
              <button className="button button-primary" onClick={startAttendance} disabled={!store.enabled || Boolean(activeSession) || busy}>Yoklamayı başlat</button>
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
        <div className="qr-card-title"><span><Icon name="users" /></span><div><small>DERSLER</small><h2>Oluşturulan gruplar</h2></div></div>
        {store.courses.length ? store.courses.map((course) => (
          <div className="course-row" key={course.id}><div><b>{course.courseCode} · {course.name}</b><small>Şube {course.section} · {store.memberships.filter((item) => item.courseId === course.id).length} öğrenci</small></div><span><small>KATILIM KODU</small><strong>{course.joinCode}</strong></span></div>
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<{ stop: () => void; destroy: () => void } | null>(null);
  const attemptedToken = useRef("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const studentMemberships = store.profile
    ? store.memberships.filter((item) => item.studentNumber === store.profile?.number)
    : [];
  const joinedIds = new Set(studentMemberships.map((item) => item.courseId));
  const joinedCourses = store.courses.filter((course) => joinedIds.has(course.id));
  const activeSessions = store.sessions.filter((session) => joinedIds.has(session.courseId) && !session.closedAt && session.expiresAt > now);

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
      {pendingToken && !store.profile && <div className="qr-scan-notice"><Icon name="qr" /><span><b>Yoklama QR kodu algılandı.</b><small>Profilini bir kez kaydet; CampusO kalan işlemleri otomatik tamamlasın.</small></span></div>}
      {message && <div className="qr-message" role="status">{message}</div>}

      <section className="panel student-scan-card">
        <span className="module-launch-icon"><Icon name="qr" size={34} /></span>
        <div><small>HIZLI KATILIM</small><h2>QR kodu kamerayla tara</h2><p>Akademisyenin ekranındaki QR bağlantısını okut; ders üyeliğin ve yoklaman tek adımda kaydedilsin.</p></div>
        <button className="button button-primary" onClick={() => setScannerOpen(true)} disabled={!store.enabled || busy}>Kamerayı aç</button>
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
            <label>Akademisyen katılım kodu<input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="Örn. 7K9P2M" maxLength={6} disabled={!store.enabled} /></label>
            <button className="button button-primary" disabled={!store.enabled || busy}>Derse katıl</button>
          </form>
        </section>
      </div>

      <section className="panel attendance-check">
        <div className="qr-card-title"><span><Icon name="check" /></span><div><small>YEDEK YÖNTEM</small><h2>Yoklama kodunu doğrula</h2></div></div>
        <form className="attendance-code-form" onSubmit={verifyCode}>
          <label>QR ekranındaki yoklama kodu<input value={attendanceCode} onChange={(event) => setAttendanceCode(event.target.value.toUpperCase())} placeholder="8 haneli kod" maxLength={8} disabled={!store.enabled} /></label>
          <button className="button button-primary" disabled={!store.enabled || busy}>Yoklamayı doğrula</button>
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
          <div className="qr-card-title"><span><Icon name="book" /></span><div><small>DERSLERİM</small><h2>Katıldığın gruplar</h2></div></div>
          {joinedCourses.length ? joinedCourses.map((course) => <div className="course-row" key={course.id}><div><b>{course.courseCode} · {course.name}</b><small>Şube {course.section}</small></div><Icon name="check" size={20} /></div>) : <div className="qr-empty compact"><p>Henüz bir ders grubuna katılmadın.</p></div>}
        </section>
        <section className="panel course-list">
          <div className="qr-card-title"><span><Icon name="calendar" /></span><div><small>GEÇMİŞ</small><h2>Yoklamalarım</h2></div></div>
          {store.records.filter((record) => record.studentNumber === store.profile?.number).length
            ? store.records.filter((record) => record.studentNumber === store.profile?.number).map((record) => {
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

function AdminPanel({ onExit, store, onAction }: { onExit: () => void; store: QrStore; onAction: QrActionRunner }) {
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
          <button onClick={() => { window.location.href = "/admin/davet"; }}><Icon name="users" size={19} /><span>Yetki Ver</span></button>
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
          <span className="admin-stage-badge"><i /> 1 aktif modül</span>
        </header>

        <div className="admin-body">
          <section className="admin-welcome">
            <div>
              <span className="banner-kicker">YÖNETİM MERKEZİ</span>
              <h1>Vol 1 yönetimi hazır.</h1>
              <p>QR Yoklama modülünü kontrol et, ders gruplarını ve katılım kayıtlarını tek ekrandan takip et.</p>
            </div>
            <span className="admin-shield"><Icon name="shield" size={38} /></span>
          </section>

          <section className="admin-module panel" aria-label="QR yoklama yönetimi">
            <div className="admin-module-heading">
              <span><Icon name="qr" size={26} /></span>
              <div><small>VOL 1</small><h2>QR Kodla Ders Yoklaması</h2><p>Neon üzerinde ortak tutulan canlı kullanım verileri.</p></div>
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
              <div><span><Icon name="book" /></span><small>Ders grubu</small><b>{store.courses.length}</b></div>
              <div><span><Icon name="users" /></span><small>Öğrenci üyeliği</small><b>{store.memberships.length}</b></div>
              <div><span><Icon name="qr" /></span><small>Yoklama oturumu</small><b>{store.sessions.length}</b></div>
              <div><span><Icon name="check" /></span><small>Katılım kaydı</small><b>{store.records.length}</b></div>
            </div>
            <div className="admin-recent">
              <div className="qr-card-title"><span><Icon name="calendar" /></span><div><small>SON İŞLEMLER</small><h2>Yoklama kayıtları</h2></div></div>
              {store.records.length ? store.records.slice(0, 6).map((record) => {
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
  const [adminOpen, setAdminOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [panelView, setPanelView] = useState<PanelView>("home");
  const [qrStore, setQrStore] = useState<QrStore>(emptyQrStore);
  const [pendingAttendanceToken, setPendingAttendanceToken] = useState("");

  useEffect(() => {
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
    const token = new URLSearchParams(window.location.search).get("attendance")?.trim().toUpperCase() ?? "";
    window.setTimeout(() => {
      if (profile?.name && profile.number) {
        setQrStore((current) => ({ ...current, profile }));
        window.localStorage.setItem(QR_PROFILE_KEY, JSON.stringify(profile));
      }
      if (token) {
        setPendingAttendanceToken(token);
        setRole("student");
        setPanelView("qr");
      }
            const roleParam = new URLSearchParams(window.location.search).get("role");
      if (roleParam === "admin") {
        setAdminOpen(true);
      } else if (roleParam === "student" || roleParam === "faculty") {
        setRole(roleParam);
      }
    }, 0);
  }, []);

  const mergeRemoteStore = useCallback((remote: Omit<QrStore, "profile">) => {
    setQrStore((current) => ({ ...remote, profile: current.profile }));
  }, []);

  const refreshQrStore = useCallback(async () => {
    try {
      const response = await fetch("/api/qr", { cache: "no-store" });
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
      const response = await fetch("/api/qr", {
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

  function enter(nextRole: Role) {
    setRole(nextRole);
    setAdminOpen(false);
    setMobileOpen(false);
    setProfileOpen(false);
    setPanelView("home");
  }

  function returnToLanding() {
    setRole(null);
    setAdminOpen(false);
    setMobileOpen(false);
    setProfileOpen(false);
    setPanelView("home");
  }

  if (adminOpen) {
    return <AdminPanel onExit={returnToLanding} store={qrStore} onAction={runQrAction} />;
  }

  if (!role) {
    return <Landing onEnter={enter} onAdmin={() => setAdminOpen(true)} />;
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
          <button className={panelView === "home" ? "active" : ""} onClick={() => { setPanelView("home"); setMobileOpen(false); }}><Icon name="home" size={19} /><span>Ana Sayfa</span></button>
          <button className={panelView === "qr" ? "active" : ""} onClick={() => { setPanelView("qr"); setMobileOpen(false); }}><Icon name="qr" size={19} /><span>QR Yoklama</span></button>
          <button onClick={() => window.location.href = (typeof role !== "undefined" && role === "student") ? "/student/staj" : "/academician/staj"}><Icon name="briefcase" size={19} /><span>Staj Takip</span></button>
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
            <span><b>{copy.panel}</b><small>Kullanıcı verisi bağlı değil</small></span>
          </button>
          <div className="breadcrumbs"><span>{copy.panel}</span><b>{panelView === "home" ? "Ana Sayfa" : "QR Yoklama"}</b></div>
          <label className="global-search clean-search">
            <Icon name="search" size={18} />
            <input aria-label="CampusO'da ara" placeholder="CampusO'da ara" disabled />
          </label>
          <button className="header-icon clean-disabled-icon" aria-label="Henüz bildirim bulunmuyor" disabled><Icon name="bell" size={20} /></button>
          <button className="header-profile" onClick={() => setProfileOpen(true)} title="Panel görünümünü aç">
            <RoleSymbol role={role} compact />
            <span><b>{copy.panel}</b><small>Kişisel veri bulunmuyor</small></span>
            <Icon name="switch" size={15} />
          </button>
        </header>

        <div className="page-body">
          {panelView === "home"
            ? <ModuleHome role={role} onOpenQr={() => setPanelView("qr")} />
            : <QrModule role={role} store={qrStore} onAction={runQrAction} onProfileChange={updateStudentProfile} pendingToken={pendingAttendanceToken} onPendingHandled={clearPendingAttendance} />}
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
        <button className={panelView === "home" ? "active" : ""} onClick={() => setPanelView("home")}><Icon name="home" size={20} /><span>Ana Sayfa</span></button>
        <button className={panelView === "qr" ? "active" : ""} onClick={() => setPanelView("qr")}><Icon name="qr" size={20} /><span>QR Yoklama</span></button>
        <button onClick={() => window.location.href = (typeof role !== "undefined" && role === "student") ? "/student/staj" : "/academician/staj"}><Icon name="briefcase" size={20} /><span>Staj Takip</span></button>
        <button onClick={() => setMobileOpen(true)}><Icon name="menu" size={20} /><span>Menü</span></button>
      </nav>
    </main>
  );
}
