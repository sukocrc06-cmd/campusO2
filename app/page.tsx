"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fetchWithAuth, getCampusSession, supabase } from "../lib/supabase";
import { TAKVIM_TURLERI, AY_ADLARI, GUN_KISALTMALARI, tarihIso, ayIzgarasiUret } from "../lib/kisisel-takvim";
import { BuyuyenBitki, bitkiTuruBelirle, saniyeyiMMSSyapVeyaSaat } from "../lib/buyuyen-bitki";

const takvimInputStyle = { height: 42, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 11, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const };
// Bir günde birden fazla etkinlik türü varsa hücrenin tamamını dolduracak
// "baskın" türü belirlemek için öncelik sırası (en dikkat gerektirenden aza).
const TUR_ONCELIK = ["sinav", "proje", "sunum", "ders", "diger"];

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
  | "chevron"
  | "shield"
  | "settings"
  | "sun"
  | "moon"
  | "leaf";

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

const GUN_ADLARI = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
function bugununGunAdi() {
  return GUN_ADLARI[new Date().getDay()];
}
function bugunIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type ProfileInfo = { fullName: string; bolum: string; sinif: string; avatarUrl: string; heroRenk: string };

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
    leaf: <><path d="M5 21c8 0 14-6 14-14V5h-2C9 5 5 11 5 19v2Z" /><path d="M5 21c0-6 3-10 8-13" /></>,
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

// Ana sayfadaki takvim: /ders-programi-sinav-takvimi sayfasının "Takvimim"
// sekmesiyle BİREBİR AYNI bileşen (aynı ay ızgarası, aynı gün detay paneli,
// aynı etkinlik ekleme formu) — hem öğrenci hem akademisyen ana sayfasında
// kullanılıyor (tamamen kişisel, kullanici_id bazlı olduğu için role bağımlı
// değil). "Tam takvimi aç" linki yine tam sayfaya yönlendirir.
function TakvimWidget({ userId }: { userId?: string | null }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const bugunTarih = new Date();
  const [takvimEtkinlikleri, setTakvimEtkinlikleri] = useState<any[]>([]);
  const [takvimYil, setTakvimYil] = useState(bugunTarih.getFullYear());
  const [takvimAy, setTakvimAy] = useState(bugunTarih.getMonth());
  const [secilenGun, setSecilenGun] = useState(bugunIso());
  const [yeniTur, setYeniTur] = useState("ders");
  const [yeniBaslik, setYeniBaslik] = useState("");
  const [yeniSaat, setYeniSaat] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function yukle() {
      if (!supabase || !userId) { setLoading(false); return; }
      const { data } = await supabase.from("kisisel_takvim_etkinlikleri").select("*").eq("kullanici_id", userId).order("saat", { ascending: true });
      if (cancelled) return;
      setTakvimEtkinlikleri(data || []);
      setLoading(false);
    }
    yukle();
    return () => { cancelled = true; };
  }, [userId]);

  const takvimGunEtkinlikleri = useMemo(() => {
    const map = new Map<string, any[]>();
    takvimEtkinlikleri.forEach((e) => {
      if (!map.has(e.tarih)) map.set(e.tarih, []);
      map.get(e.tarih)!.push(e);
    });
    return map;
  }, [takvimEtkinlikleri]);

  const takvimIzgara = useMemo(() => ayIzgarasiUret(takvimYil, takvimAy), [takvimYil, takvimAy]);
  const secilenGunEtkinlikleri = takvimGunEtkinlikleri.get(secilenGun) || [];

  function ayDegistir(fark: number) {
    let yeniAy = takvimAy + fark;
    let yeniYil = takvimYil;
    if (yeniAy < 0) { yeniAy = 11; yeniYil -= 1; }
    if (yeniAy > 11) { yeniAy = 0; yeniYil += 1; }
    setTakvimAy(yeniAy);
    setTakvimYil(yeniYil);
  }

  async function handleEtkinlikEkle(e: React.FormEvent) {
    e.preventDefault();
    if (!yeniBaslik.trim() || !supabase || !userId) return;
    setBusy(true); setError("");
    const { data, error: err } = await supabase.from("kisisel_takvim_etkinlikleri").insert([{
      kullanici_id: userId, tarih: secilenGun, tur: yeniTur, baslik: yeniBaslik.trim(), saat: yeniSaat || null,
    }]).select().maybeSingle();
    if (err) setError("Etkinlik eklenemedi: " + err.message);
    else if (data) { setTakvimEtkinlikleri((prev) => [...prev, data]); setYeniBaslik(""); setYeniSaat(""); }
    setBusy(false);
  }

  async function handleEtkinlikSil(id: string) {
    if (!supabase) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.from("kisisel_takvim_etkinlikleri").delete().eq("id", id);
    if (err) setError("Silinemedi: " + err.message);
    else setTakvimEtkinlikleri((prev) => prev.filter((e) => e.id !== id));
    setBusy(false);
  }

  return (
    <div className="dashboard-category">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <p className="dashboard-category-title" style={{ margin: 0 }}>Takvimim</p>
        <a href="/ders-programi-sinav-takvimi" style={{ fontSize: 12, fontWeight: 700, color: "#175cd3", textDecoration: "none" }}>Tam takvimi aç →</a>
      </div>

      {loading ? (
        <div style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 18 }}>
          <p style={{ fontSize: 13, color: "#8fa0bc", margin: 0 }}>Yükleniyor…</p>
        </div>
      ) : (
        <section>
          {error ? (
            <div style={{ padding: "14px 16px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{error}</div>
          ) : null}

          <div style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 18, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <button type="button" onClick={() => ayDegistir(-1)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e3ebf6", background: "#fff", cursor: "pointer", fontSize: 14 }}>←</button>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{AY_ADLARI[takvimAy]} {takvimYil}</div>
              <button type="button" onClick={() => ayDegistir(1)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e3ebf6", background: "#fff", cursor: "pointer", fontSize: 14 }}>→</button>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              {Object.entries(TAKVIM_TURLERI).map(([anahtar, tur]) => (
                <div key={anahtar} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#5b6b85" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: tur.color, display: "inline-block" }} />
                  {tur.label}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
              {GUN_KISALTMALARI.map((g) => (
                <div key={g} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 800, color: "#8fa0bc" }}>{g}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {takvimIzgara.flat().map((gun, idx) => {
                if (gun === null) return <div key={idx} />;
                const iso = tarihIso(takvimYil, takvimAy, gun);
                const etkinlikler = takvimGunEtkinlikleri.get(iso) || [];
                const buGunMu = iso === bugunIso();
                const seciliMi = iso === secilenGun;
                const baskinTur = etkinlikler.length ? (TUR_ONCELIK.find((t) => etkinlikler.some((e) => e.tur === t)) || etkinlikler[0].tur) as keyof typeof TAKVIM_TURLERI : null;
                const digerTurler = baskinTur ? Array.from(new Set(etkinlikler.map((e) => e.tur))).filter((t) => t !== baskinTur) : [];
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSecilenGun(iso)}
                    style={{
                      minHeight: 56, borderRadius: 10, padding: "6px 4px", textAlign: "left", cursor: "pointer",
                      border: seciliMi ? "2px solid #175cd3" : baskinTur ? "1px solid transparent" : buGunMu ? "1px solid #175cd3" : "1px solid #e3ebf6",
                      outline: buGunMu ? "2px solid #175cd3" : "none", outlineOffset: -2,
                      background: baskinTur ? TAKVIM_TURLERI[baskinTur].color : seciliMi ? "#eef5ff" : "#fff",
                      display: "flex", flexDirection: "column", gap: 3,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: buGunMu || baskinTur ? 800 : 600, color: baskinTur ? "#fff" : buGunMu ? "#175cd3" : "#0f1b33" }}>{gun}</span>
                    {digerTurler.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                        {digerTurler.slice(0, 3).map((t) => (
                          <span key={t} style={{ width: 6, height: 6, borderRadius: "50%", background: TAKVIM_TURLERI[t as keyof typeof TAKVIM_TURLERI]?.color || "#8fa0bc", border: "1px solid #fff", display: "inline-block" }} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>
              {new Date(secilenGun).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", weekday: "long" })}
            </div>

            {secilenGunEtkinlikleri.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "#8fa0bc", marginBottom: 14 }}>Bu tarihte henüz bir etkinlik yok.</div>
            ) : (
              <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
                {secilenGunEtkinlikleri.map((e) => {
                  const tur = TAKVIM_TURLERI[e.tur as keyof typeof TAKVIM_TURLERI] || TAKVIM_TURLERI.diger;
                  return (
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: tur.bg, flexWrap: "wrap" }}>
                      <div>
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: tur.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{tur.label}</span>
                        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{e.baslik}{e.saat ? <span style={{ fontWeight: 500, color: "#5b6b85" }}> · {e.saat}</span> : null}</div>
                      </div>
                      <button onClick={() => handleEtkinlikSil(e.id)} disabled={busy} style={{ minHeight: 26, padding: "0 10px", fontSize: 10.5, fontWeight: 700, borderRadius: 7, border: "1px solid #f2c5ba", background: "#fff", color: "#984333", cursor: "pointer" }}>Sil</button>
                    </div>
                  );
                })}
              </div>
            )}

            <form onSubmit={handleEtkinlikEkle} style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
              <select style={takvimInputStyle} value={yeniTur} onChange={(e) => setYeniTur(e.target.value)}>
                {Object.entries(TAKVIM_TURLERI).map(([anahtar, tur]) => <option key={anahtar} value={anahtar}>{tur.label}</option>)}
              </select>
              <input style={{ ...takvimInputStyle, gridColumn: "span 2" }} placeholder="Örn. Financial Data Analysis sunumu" maxLength={140} value={yeniBaslik} onChange={(e) => setYeniBaslik(e.target.value)} />
              <input style={takvimInputStyle} type="time" value={yeniSaat} onChange={(e) => setYeniSaat(e.target.value)} />
              <button type="submit" disabled={busy || !yeniBaslik.trim()} className="button button-primary" style={{ minHeight: 42, padding: "0 16px", fontSize: 12.5 }}>Ekle</button>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}

type HizliIslem = { title: string; icon: IconName; accent: keyof typeof MODULE_ACCENTS; href: string };
const OGRENCI_HIZLI_ISLEMLER: HizliIslem[] = [
  { title: "Ders Kayıt", icon: "graduation", accent: "coral", href: "/student/ders-kayit" },
  { title: "Ders Programı", icon: "book", accent: "blue", href: "/ders-programi-sinav-takvimi" },
  { title: "Çalışma Teknikleri", icon: "leaf", accent: "green", href: "/student/calisma-teknikleri" },
  { title: "Yoklama Takibi", icon: "check", accent: "green", href: "/student/yoklamalarim" },
  { title: "QR ile Yoklama", icon: "qr", accent: "sky", href: "/student/qr-yoklama" },
  { title: "Staj Takip", icon: "briefcase", accent: "amber", href: "/student/staj" },
  { title: "Kulüpler", icon: "users", accent: "teal", href: "/student/kulupler" },
  { title: "Kampüs Duvarı", icon: "message", accent: "coral", href: "/student/kampus-duvari" },
];

const AKADEMISYEN_HIZLI_ISLEMLER: HizliIslem[] = [
  { title: "Ders Programı", icon: "book", accent: "blue", href: "/ders-programi-sinav-takvimi" },
  { title: "Yoklama Takibi", icon: "check", accent: "green", href: "/academician/yoklama" },
  { title: "QR ile Yoklama", icon: "qr", accent: "sky", href: "/academician/qr-yoklama" },
  { title: "Akademik Teşvik", icon: "graduation", accent: "amber", href: "/academician/tesvik" },
  { title: "Staj Takip", icon: "briefcase", accent: "teal", href: "/academician/staj" },
  { title: "Sosyal Sorumluluk", icon: "users", accent: "coral", href: "/academician/sosyal-sorumluluk" },
  { title: "Kampüs Duvarı", icon: "message", accent: "sky", href: "/student/kampus-duvari" },
];

function HizliIslemler({ items }: { items: HizliIslem[] }) {
  return (
    <div className="dashboard-category">
      <p className="dashboard-category-title">Hızlı İşlemler</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 10 }}>
        {items.map((item) => (
          <a key={item.title} href={item.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 8px", borderRadius: 14, border: "1px solid #e3ebf6", background: "#fff", textDecoration: "none", color: "#0f1b33" }}>
            <span className="module-grid-icon" style={{ ...moduleIconStyle(item.accent), width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 12, border: "1px solid" }}><Icon name={item.icon} size={18} /></span>
            <span style={{ fontSize: 11, fontWeight: 700, textAlign: "center" }}>{item.title}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

// "Akademik Yönetim" — AYRINTILI TASARIM.docx'teki 1. modül ve alt katmanları
// (1.1-1.8). Şu an gerçekten var olan özellikler ilgili alt maddeye bağlandı
// (Ders Programı, Ders İçerikleri, Sınav Bilgileri, Devamsızlık, Bilimsel
// Çalışma Teknikleri); henüz kurulmamış olanlar (Not ve Başarı Durumu,
// Transkript, Cornell Not Sistemi) "yapım aşamasında" etiketiyle sadece
// görüntü amaçlı listeleniyor, tıklanamıyor.
type AkademikAltModul = { title: string; desc: string; icon: IconName; href?: string; durum: "aktif" | "yapim" };
const AKADEMIK_YONETIM_ALT_MODULLER: AkademikAltModul[] = [
  { title: "Ders Programı", desc: "Haftalık ders programını görüntüle", icon: "calendar", href: "/ders-programi-sinav-takvimi", durum: "aktif" },
  { title: "Ders İçerikleri", desc: "Amaç, içerik, hoca ve haftalık konular", icon: "book", href: "/student/ders-icerikleri", durum: "aktif" },
  { title: "Sınav Bilgileri", desc: "Vize / final / bütünleme takvimi", icon: "check", href: "/ders-programi-sinav-takvimi?tab=sinav", durum: "aktif" },
  { title: "Not ve Başarı Durumu", desc: "Not görüntüleme, GPA, başarı grafikleri", icon: "spark", durum: "yapim" },
  { title: "Devamsızlık", desc: "Devam yüzden ve yoklama geçmişin", icon: "shield", href: "/student/yoklamalarim", durum: "aktif" },
  { title: "Transkript", desc: "Anlık transkript talebi, PDF indirme", icon: "graduation", durum: "yapim" },
  { title: "Cornell Not Sistemi", desc: "Ders bazlı not şablonu, PDF dışa aktar", icon: "message", durum: "yapim" },
  { title: "Pomodoro Tekniği", desc: "25dk odaklan, 5dk mola — döngüsel çalışma", icon: "leaf", href: "/student/calisma-teknikleri/pomodoro", durum: "aktif" },
  { title: "Aralıklı Tekrar", desc: "1 → 3 → 7 → 16 gün tekrar zinciri", icon: "leaf", href: "/student/calisma-teknikleri/aralikli-tekrar", durum: "aktif" },
  { title: "Uzun Odaklı Çalışma", desc: "Büyüyen bitki eşliğinde derin odak", icon: "leaf", href: "/student/calisma-teknikleri/uzun-odakli", durum: "aktif" },
];

function AkademikYonetimNav() {
  const [acik, setAcik] = useState(false);
  const [konum, setKonum] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const kapatZamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);

  function ac() {
    if (kapatZamanlayici.current) { clearTimeout(kapatZamanlayici.current); kapatZamanlayici.current = null; }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setKonum({ top: r.top, left: r.right + 10 });
    }
    setAcik(true);
  }
  function kapatGecikmeli() {
    kapatZamanlayici.current = setTimeout(() => setAcik(false), 180);
  }

  // Panel içeriği (8 alt madde) buton hizasından başlayınca ekranın altından
  // taşıp son maddelerin sıkışmasına/görünmemesine yol açabiliyordu — panel
  // gerçekten render olduktan sonra gerçek yüksekliğini ölçüp gerekirse
  // yukarı kaydırıyoruz; yine de sığmazsa panelin kendisi kayabilir (overflow).
  useLayoutEffect(() => {
    if (!acik || !panelRef.current || !btnRef.current) return;
    const panelH = panelRef.current.offsetHeight;
    const r = btnRef.current.getBoundingClientRect();
    const maxTop = Math.max(12, window.innerHeight - panelH - 12);
    const yeniTop = Math.min(r.top, maxTop);
    setKonum((k) => (k && Math.round(k.top) !== Math.round(yeniTop) ? { ...k, top: yeniTop } : k));
  }, [acik]);

  return (
    <div onMouseEnter={ac} onMouseLeave={kapatGecikmeli}>
      <button ref={btnRef} type="button" onClick={() => (acik ? setAcik(false) : ac())} aria-haspopup="true" aria-expanded={acik}>
        <Icon name="graduation" size={19} /><span>Akademik Yönetim</span><Icon name="chevron" size={14} />
      </button>
      {acik && konum && typeof document !== "undefined" && createPortal(
        <>
          <div onClick={() => setAcik(false)} style={{ position: "fixed", inset: 0, zIndex: 199 }} />
          <div
            ref={panelRef}
            onMouseEnter={ac}
            onMouseLeave={kapatGecikmeli}
            style={{
              position: "fixed", top: konum.top, left: konum.left, width: 290, zIndex: 200,
              background: "#fff", borderRadius: 16, boxShadow: "0 18px 40px rgba(15,27,51,0.28)",
              border: "1px solid #e3ebf6", padding: 8, color: "#0f1b33",
              maxHeight: "calc(100vh - 24px)", overflowY: "auto",
            }}
          >
            <div style={{ padding: "8px 10px 4px", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#8fa0bc" }}>AKADEMİK YÖNETİM</div>
            {AKADEMIK_YONETIM_ALT_MODULLER.map((m) => {
              const yapim = m.durum === "yapim";
              return (
                <button
                  key={m.title}
                  type="button"
                  disabled={yapim}
                  title={yapim ? "Yapım aşamasında" : undefined}
                  onClick={() => { if (!yapim && m.href) window.location.href = m.href; }}
                  style={{
                    width: "100%", display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 10px", borderRadius: 11,
                    border: "none", background: "transparent", textAlign: "left", cursor: yapim ? "default" : "pointer",
                    opacity: yapim ? 0.5 : 1, color: "#0f1b33", minHeight: 0,
                  }}
                  onMouseEnter={(e) => { if (!yapim) (e.currentTarget as HTMLButtonElement).style.background = "#f5f8fc"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <span style={{ marginTop: 2, color: "#175cd3", flex: "none" }}><Icon name={m.icon} size={17} /></span>
                  <span style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, color: "#0f1b33" }}>
                      {m.title}
                    </div>
                    {yapim ? (
                      <div style={{ fontSize: 8.5, fontWeight: 800, color: "#b7853f", background: "#fdf1dc", padding: "2px 6px", borderRadius: 999, display: "inline-block", marginTop: 3 }}>YAPIM AŞAMASINDA</div>
                    ) : (
                      <div style={{ fontSize: 10.5, color: "#8fa0bc", marginTop: 1 }}>{m.desc}</div>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// Öğrenci ana sayfasındaki "büyüyen bitki" özet widget'ı — Uzun Odaklı
// Çalışma tekniğine bağlı: aktif bir oturum varsa kalan süreyi ve büyüyen
// filizi gösterir, yoksa "bugün bir bitki dikmeye ne dersin?" çağrısı yapar.
function BitkiWidget({ userId }: { userId?: string | null }) {
  const [yukleniyor, setYukleniyor] = useState(true);
  const [oturum, setOturum] = useState<any>(null);
  const [kalan, setKalan] = useState(0);
  const [hasat, setHasat] = useState(0);
  const [toplamSaniye, setToplamSaniye] = useState(0);

  useEffect(() => {
    if (!userId || !supabase) { setYukleniyor(false); return; }
    let iptal = false;
    async function yukle() {
      const { data: profil } = await supabase!.from("profiles").select("tamamlanan_odak_oturumu_sayisi, toplam_odak_saniyesi").eq("id", userId).maybeSingle();
      const { data: aktif } = await supabase!.from("calisma_oturumlari").select("*").eq("kullanici_id", userId).eq("tur", "uzun_odakli").eq("durum", "devam_ediyor").maybeSingle();
      if (iptal) return;
      setHasat(profil?.tamamlanan_odak_oturumu_sayisi || 0);
      setToplamSaniye(profil?.toplam_odak_saniyesi || 0);
      setOturum(aktif || null);
      setYukleniyor(false);
    }
    yukle();
    return () => { iptal = true; };
  }, [userId]);

  useEffect(() => {
    if (!oturum) return;
    const bitis = new Date(oturum.bitis_zamani_planlanan).getTime();
    const tik = () => setKalan(Math.max(0, Math.round((bitis - Date.now()) / 1000)));
    tik();
    const id = setInterval(tik, 1000);
    return () => clearInterval(id);
  }, [oturum?.id]);

  if (yukleniyor) return null;

  const yuzde = oturum ? Math.min(100, Math.max(0, 100 * (1 - kalan / Math.max(1, (new Date(oturum.bitis_zamani_planlanan).getTime() - new Date(oturum.baslangic_at).getTime()) / 1000)))) : 0;
  const bitkiTuru = bitkiTuruBelirle(toplamSaniye);

  return (
    <a href="/student/calisma-teknikleri/uzun-odakli" style={{ textDecoration: "none", color: "inherit" }}>
      <section
        className="dashboard-category"
        style={{
          display: "flex", alignItems: "center", gap: 16, padding: "16px 18px",
          background: "linear-gradient(135deg, #1c3324, #14261b)", borderRadius: 18, color: "#eafaf0", border: "none",
        }}
      >
        <BuyuyenBitki percent={yuzde} size={56} dark tur={bitkiTuru.tur} />
        <div style={{ flex: 1 }}>
          {oturum ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 800 }}>Filizin büyüyor 🌱</div>
              <div style={{ fontSize: 11.5, color: "#bfe6c8", marginTop: 2 }}>Kalan süre: {saniyeyiMMSSyapVeyaSaat(kalan)} — devam etmek için dokun.</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 800 }}>Bugün bir bitki dikmeye ne dersin?</div>
              <div style={{ fontSize: 11.5, color: "#bfe6c8", marginTop: 2 }}>Uzun Odaklı Çalışma ile odaklan, filizin gözünün önünde büyüsün.{hasat > 0 ? ` Şimdiye kadar ${hasat} bitki yetiştirdin.` : ""}</div>
            </>
          )}
        </div>
        <Icon name="arrow" size={18} />
      </section>
    </a>
  );
}

function ModuleHome({
  role,
  displayName,
  unreadCount,
  todaySummary,
  userId,
  bolum,
  sinif,
}: {
  role: Role;
  displayName?: string;
  unreadCount?: number;
  todaySummary?: string | null;
  userId?: string | null;
  bolum?: string;
  sinif?: string;
}) {
  return (
    <div className="clean-dashboard">
      <section className={`welcome-banner clean-welcome banner-with-cta ${role === "student" ? "student-banner" : "faculty-banner"}`}>
        <div>
          <span className="banner-kicker">{unreadCount ? `${unreadCount} yeni bildirim` : "Kampüs güncel"}</span>
          <h2>{displayName ? `Merhaba, ${displayName}.` : `${roleCopy[role].panel} hazır.`}</h2>
          <p>{todaySummary || "QR Kodla Ders Yoklaması kullanıma açıldı."}</p>
        </div>
        <div className="banner-cta">
          <span className="banner-cta-icon"><Icon name="qr" size={22} /></span>
          <div className="banner-cta-copy">
            <small>VOL 1</small>
            <b>QR Kodla Ders Yoklaması</b>
          </div>
          <button
            className="button button-primary banner-cta-button"
            onClick={() => { window.location.href = role === "student" ? "/student/qr-yoklama" : "/academician/qr-yoklama"; }}
          >
            Modülü aç <Icon name="arrow" size={16} />
          </button>
        </div>
      </section>

      {role === "student" ? (
        <>
          <BitkiWidget userId={userId} />
          <TakvimWidget userId={userId} />
          <HizliIslemler items={OGRENCI_HIZLI_ISLEMLER} />
        </>
      ) : (
        <>
          <TakvimWidget userId={userId} />
          <HizliIslemler items={AKADEMISYEN_HIZLI_ISLEMLER} />
        </>
      )}

    </div>
  );
}

// Not: kategorili modül ızgarası (MODULE_CATEGORIES) artık ana sayfada
// gösterilmiyor — hem öğrenci hem akademisyen ana sayfası artık takvim +
// hızlı işlemler kullanıyor. Tüm modüllere sidebar üzerinden erişim hâlâ var.

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
        title: "QR ile Yoklama", icon: "qr", accent: "sky",
        hrefFor: (role) => role === "student" ? "/student/qr-yoklama" : "/academician/qr-yoklama",
        desc: (role) => role === "faculty" ? "Dersini seç, QR kodu göster; katılan öğrencileri anlık gör." : "Kamerayı aç, akademisyeninin QR kodunu okut, yoklaman anında kaydedilsin.",
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
        title: "Kampüs Duvarı", icon: "message", accent: "teal", href: "/student/kampus-duvari", badgeKey: "unread",
        desc: (role) => role === "faculty" ? "Öğrenci paylaşımlarını ve kampüs gündemini takip et." : "Gönderi paylaş, arkadaşlarının gönderilerine yorum yap.",
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

function AdminPanel({ onExit }: { onExit: () => void }) {
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
                  <button onClick={() => { window.location.href = "/admin/staj"; }}><Icon name="briefcase" size={19} /><span>Staj Takip</span></button>
          <button onClick={() => { window.location.href = "/admin/tesvik"; }}><Icon name="graduation" size={19} /><span>Akademik Teşvik</span></button>
          <button onClick={() => { window.location.href = "/admin/sosyal-sorumluluk"; }}><Icon name="check" size={19} /><span>Sosyal Sorumluluk</span></button>
          <button onClick={() => { window.location.href = "/admin/kulupler"; }}><Icon name="shield" size={19} /><span>Kulüpler</span></button>
          <button onClick={() => { window.location.href = "/admin/yemek-menusu"; }}><Icon name="calendar" size={19} /><span>Yemek Menüsü</span></button>
          <button onClick={() => { window.location.href = "/admin/ders-programi-sinav-takvimi"; }}><Icon name="book" size={19} /><span>Ders ve Sınav Takvimi</span></button>
          <button onClick={() => { window.location.href = "/admin/ders-icerikleri"; }}><Icon name="book" size={19} /><span>Ders İçerikleri Kataloğu</span></button>
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
              <h1>CampusO yönetim paneline hoş geldin.</h1>
              <p>Soldaki menüden bir modül seç. QR ile alınan yoklamalar da dahil tüm yoklama kayıtları Yoklama Takibi'nde.</p>
            </div>
            <span className="admin-shield"><Icon name="shield" size={38} /></span>
          </section>

          <section className="admin-module panel" aria-label="Yoklama Takibi'ne git">
            <div className="admin-module-heading">
              <span><Icon name="qr" size={26} /></span>
              <div><small>VOL 1</small><h2>QR Kodla Ders Yoklaması</h2><p>QR ile alınan yoklamalar, akademisyenlerin elle aldığı yoklamalarla aynı Yoklama Takibi panelinde toplanır.</p></div>
              <button className="button button-primary" onClick={() => { window.location.href = "/admin/yoklama"; }}>Yoklama Takibi'ni aç</button>
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
  const [userId, setUserId] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [todaySummary, setTodaySummary] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState<Array<{ id: string; tip: string; created_at: string; okundu: boolean; ogrenciAdi?: string; dersAdi?: string }>>([]);

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
      .select("id, tip, created_at, okundu, olusturan_id, ders_programi_id")
      .eq("kullanici_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    // "ders_kaydi" bildirimleri için hangi öğrencinin hangi derse kayıt
    // olduğunu göstermek üzere ek bilgi çek (isim + ders adı).
    const dersKayitBildirimleri = (data || []).filter((n) => n.tip === "ders_kaydi");
    let ogrenciMap: Record<string, string> = {};
    let dersMap: Record<string, string> = {};
    if (dersKayitBildirimleri.length > 0) {
      const ogrenciIdler = Array.from(new Set(dersKayitBildirimleri.map((n) => n.olusturan_id).filter(Boolean)));
      const dersIdler = Array.from(new Set(dersKayitBildirimleri.map((n) => n.ders_programi_id).filter(Boolean)));
      const [{ data: ogrenciler }, { data: dersler }] = await Promise.all([
        ogrenciIdler.length ? supabase.from("profiles").select("id, full_name").in("id", ogrenciIdler) : Promise.resolve({ data: [] as any[] }),
        dersIdler.length ? supabase.from("ders_programi").select("id, ders_adi").in("id", dersIdler) : Promise.resolve({ data: [] as any[] }),
      ]);
      (ogrenciler || []).forEach((o: any) => { ogrenciMap[o.id] = o.full_name; });
      (dersler || []).forEach((d: any) => { dersMap[d.id] = d.ders_adi; });
    }

    const zenginlestirilmis = (data || []).map((n) => ({
      ...n,
      ogrenciAdi: n.olusturan_id ? ogrenciMap[n.olusturan_id] : undefined,
      dersAdi: n.ders_programi_id ? dersMap[n.ders_programi_id] : undefined,
    }));
    setNotifItems(zenginlestirilmis);
    const unreadIds = (data || []).filter((n) => !n.okundu).map((n) => n.id);
    if (unreadIds.length) {
      await supabase.from("kampus_duvari_bildirimleri").update({ okundu: true }).in("id", unreadIds);
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initializeSession() {
      const session = await getCampusSession();
      if (cancelled) return;

      if (!session) {
        return;
      }

      if (session.role === "admin") {
        setAdminOpen(true);
      } else {
        const resolvedRole: Role = session.role === "academician" ? "faculty" : "student";
        setRole(resolvedRole);
        setUserId(session.user.id);
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
      const { data: donemSatiri } = await supabase.from("aktif_donem").select("donem").eq("id", true).maybeSingle();
      const guncelDonem = donemSatiri?.donem || "bahar";
      if (resolvedRole === "faculty") {
        const { count: dersSayisi } = await supabase
          .from("ders_programi")
          .select("id", { count: "exact", head: true })
          .eq("akademisyen_id", userId)
          .eq("donem", guncelDonem)
          .eq("gun", gunAdi);
        if (!cancelled) {
          setTodaySummary(dersSayisi ? `Bugün ${dersSayisi} dersin var.` : "Bugün programında ders görünmüyor.");
        }
      } else {
        // Öğrenci özeti artık bölüm/sınıf eşleşmesine değil, öğrencinin
        // kendi seçtiği (ders_kayitlari) derslere göre hesaplanır.
        const { data: kayitliDersler } = await supabase
          .from("ders_kayitlari")
          .select("ders_programi:ders_programi_id(id, ders_kodu, bolum, gun)")
          .eq("ogrenci_id", userId)
          .eq("donem", guncelDonem);
        const dersRows: Array<{ id: string; ders_kodu: string | null; bolum: string | null; gun: string | null }> =
          (kayitliDersler || []).map((r: any) => r.ders_programi).filter(Boolean);
        if (dersRows.length === 0) {
          if (!cancelled) setTodaySummary("Henüz ders seçmedin — ders programını oluşturmak için Ders Kayıt'tan derslerini seç.");
        } else {
          const dersKoduBolumSeti = new Set(dersRows.filter((d) => d.ders_kodu).map((d) => `${d.ders_kodu}||${d.bolum}`));
          const dersSayisi = dersRows.filter((d) => d.gun === gunAdi).length;
          const { data: sinavRows } = await supabase
            .from("sinav_takvimi")
            .select("ders_kodu, bolum")
            .eq("donem", guncelDonem)
            .eq("tarih", bugunIso());
          const sinavSayisi = (sinavRows || []).filter((s) => dersKoduBolumSeti.has(`${s.ders_kodu}||${s.bolum}`)).length;
          if (!cancelled) {
            const parcalar: string[] = [];
            if (dersSayisi) parcalar.push(`${dersSayisi} dersin`);
            if (sinavSayisi) parcalar.push(`${sinavSayisi} sınavın`);
            setTodaySummary(parcalar.length ? `Bugün ${parcalar.join(" ve ")} var.` : "Bugün programında ders/sınav görünmüyor.");
          }
        }
      }
    }

    void initializeSession();
    return () => { cancelled = true; };
  }, []);

  function returnToLanding() {
    setRole(null);
    setAdminOpen(false);
    setMobileOpen(false);
    setProfileOpen(false);
  }

  async function signOut() {
    await supabase?.auth.signOut();
    window.location.href = "/";
  }

  if (adminOpen) {
    return <AdminPanel onExit={returnToLanding} />;
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
          <button className="active" onClick={() => setMobileOpen(false)}><Icon name="home" size={19} /><span>Ana Sayfa</span></button>
          {role === "faculty" && (
            <button onClick={() => { window.location.href = "/academician/qr-yoklama"; }}><Icon name="qr" size={19} /><span>QR Yoklama</span></button>
          )}
          {role === "student" && <AkademikYonetimNav />}
          <button onClick={() => window.location.href = (typeof role !== "undefined" && role === "student") ? "/student/staj" : "/academician/staj"}><Icon name="briefcase" size={19} /><span>Staj Takip</span></button>
          {role === "faculty" && (
            <button onClick={() => { window.location.href = "/academician/tesvik"; }}><Icon name="graduation" size={19} /><span>Akademik Teşvik</span></button>
          )}
          <button onClick={() => { window.location.href = (typeof role !== "undefined" && role === "student") ? "/student/sosyal-sorumluluk" : "/academician/sosyal-sorumluluk"; }}><Icon name="users" size={19} /><span>Sosyal Sorumluluk</span></button>
          <button onClick={() => { window.location.href = (typeof role !== "undefined" && role === "student") ? "/student/kulupler" : "/academician/kulupler"; }}><Icon name="shield" size={19} /><span>Kulüpler</span></button>
          <button onClick={() => { window.location.href = "/yemek-menusu"; }}><Icon name="calendar" size={19} /><span>Yemek Menüsü</span></button>
          {role === "faculty" && (
            <button onClick={() => { window.location.href = "/ders-programi-sinav-takvimi"; }}><Icon name="book" size={19} /><span>Ders ve Sınav Takvimi</span></button>
          )}
          {role === "faculty" && (
            <button onClick={() => { window.location.href = "/academician/yoklama"; }}><Icon name="check" size={19} /><span>Yoklama Takibi</span></button>
          )}
          <button onClick={() => { window.location.href = "/student/kampus-duvari"; }}><Icon name="message" size={19} /><span>Kampüs Duvarı</span></button>
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
          <div className="breadcrumbs"><span>{copy.panel}</span><b>Ana Sayfa</b></div>
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
                      <span style={{ marginTop: 2 }}><Icon name={n.tip === "duyuru" ? "spark" : n.tip === "ders_kaydi" ? "book" : "message"} size={15} /></span>
                      <span>
                        {n.tip === "duyuru"
                          ? "Yeni bir duyuru paylaşıldı."
                          : n.tip === "ders_kaydi"
                            ? `${n.ogrenciAdi || "Bir öğrenci"}, ${n.dersAdi || "dersinize"} dersine kayıt oldu.`
                            : "Gönderine yeni bir yorum geldi."}
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
          <ModuleHome role={role} displayName={profileInfo?.fullName} unreadCount={unreadCount} todaySummary={todaySummary} userId={userId} bolum={profileInfo?.bolum} sinif={profileInfo?.sinif} />
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
        <button className="active"><Icon name="home" size={20} /><span>Ana Sayfa</span></button>
        <button onClick={() => { window.location.href = role === "student" ? "/student/qr-yoklama" : "/academician/qr-yoklama"; }}><Icon name="qr" size={20} /><span>QR Yoklama</span></button>
        <button onClick={() => window.location.href = (typeof role !== "undefined" && role === "student") ? "/student/staj" : "/academician/staj"}><Icon name="briefcase" size={20} /><span>Staj Takip</span></button>
        <button onClick={() => setMobileOpen(true)}><Icon name="menu" size={20} /><span>Menü</span></button>
      </nav>
    </main>
  );
}
