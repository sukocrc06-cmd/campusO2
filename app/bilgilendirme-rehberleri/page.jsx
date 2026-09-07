"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

// Kampüs Yaşamı > Bilgilendirme Rehberleri (3.6). Diğer Kampüs Yaşamı
// modüllerinin aksine bu sayfanın içeriği (Wi-Fi ayarları, resmi kaynak
// linkleri) AYBÜ Bilgi İşlem Daire Başkanlığı'nın (bidb.aybu.edu.tr /
// aybu.edu.tr/bidb) resmi, nadiren değişen kurulum bilgileri — bu yüzden
// Ulaşım/Kampüs Haritası'ndaki gibi ayrı bir tablo + admin paneli yerine
// doğrudan sayfaya yazıldı. Bilgiler AYBÜ BİDB'nin "Kılavuzlar" sayfasından
// (aybu.edu.tr/bidb/tr/sayfa/884) ve eduroam ayarları sayfasından
// (aybu.edu.tr/bidb/tr/sayfa/39) doğrulandı — her kart resmi kılavuza link
// veriyor, içerik kopyalanmadı.
const REHBERLER = [
  {
    id: "wifi",
    baslik: "Wi-Fi Bağlantısı (Eduroam)",
    emoji: "📶",
    renk: "#5b9dff",
    ozet: "Kampüste \"eduroam\" ağına kurumsal e-posta ve şifrenle bağlanabilirsin.",
    adimlar: [
      "Wi-Fi ayarlarından \"eduroam\" ağını seç.",
      "Kullanıcı adı olarak kurumsal e-posta adresini gir (…@aybu.edu.tr).",
      "EAP yöntemi: PEAP, Aşama 2 kimlik doğrulaması: MSCHAPv2.",
      "Şifre olarak kurumsal e-posta şifreni gir, sertifika onayı çıkarsa \"Güven / Trust\" de.",
    ],
    not: "Cihazına göre (Android, iPhone, Windows, macOS, Linux) adım adım ayrı kılavuzlar mevcut — bağlanamazsan kendi cihazının kılavuzuna bak.",
    linkler: [{ url: "https://aybu.edu.tr/bidb/tr/sayfa/884/K%C4%B1lavuzlar", metin: "Cihazına Göre Kılavuzu Aç" }],
  },
  {
    id: "eposta",
    baslik: "Kurumsal E-posta ve Microsoft 365",
    emoji: "📧",
    renk: "#34d399",
    ozet: "Kurumsal e-posta hesabınla Microsoft 365 (Word, Excel, Teams, Outlook) ücretsiz kullanılıyor.",
    adimlar: [
      "Kurumsal e-posta adresin ve ilk şifren, kayıt sonrası e-posta başvuru/aktivasyon süreciyle tanımlanır.",
      "office.com üzerinden kurumsal hesabınla giriş yap; Microsoft 365 uygulamalarını (Word, Excel, PowerPoint, Teams) ücretsiz indirebilirsin.",
      "Outlook masaüstü ya da mobil uygulamasını kurumsal e-postanla (Exchange hesabı olarak) kurabilirsin.",
    ],
    not: "AYBÜ Bulut (OwnCloud tabanlı) üzerinden de dosya depolama ve paylaşımı yapılabiliyor.",
    linkler: [{ url: "https://aybu.edu.tr/bidb/tr/sayfa/884/K%C4%B1lavuzlar", metin: "E-posta / Office 365 Kılavuzlarını Aç" }],
  },
  {
    id: "obslms",
    baslik: "OBS ve LMS (Ders Kayıt / Uzaktan Eğitim)",
    emoji: "🎓",
    renk: "#a78bfa",
    ozet: "Ders kaydı, not ve transkript için OBS; online ders içerikleri için AYBUZEM (LMS) kullanılıyor.",
    adimlar: [
      "OBS — obs.aybu.edu.tr: ders kaydı, not görüntüleme, transkript, harç ve öğrenci belgeleri.",
      "AYBUZEM — aybuzem.aybu.edu.tr: Moodle tabanlı uzaktan eğitim platformu; ödev, sınav ve ders materyalleri burada.",
      "Her iki sisteme de öğrenci numaran ve şifrenle giriş yapılıyor.",
    ],
    not: "AYBUZEM mobilde de resmi Moodle uygulaması üzerinden kullanılabiliyor.",
    linkler: [
      { url: "https://obs.aybu.edu.tr/oibs/std/login.aspx", metin: "OBS'a Git" },
      { url: "https://aybuzem.aybu.edu.tr", metin: "AYBUZEM'e Git" },
    ],
  },
  {
    id: "vpn",
    baslik: "Kampüs Dışından Erişim (VPN)",
    emoji: "🔒",
    renk: "#ff9f5a",
    ozet: "Kütüphane veritabanlarına ve iç kaynaklara kampüs dışından erişmek için Fortinet VPN kullanılıyor.",
    adimlar: [
      "FortiClient VPN uygulamasını indir (Windows ve iOS için ayrı kılavuzlar mevcut).",
      "Kurumsal e-posta ve şifrenle VPN bağlantısını kur.",
      "Bağlandıktan sonra kütüphane veritabanlarına ve iç sistemlere kampüs içindeymiş gibi erişebilirsin.",
    ],
    linkler: [{ url: "https://aybu.edu.tr/bidb/tr/sayfa/884/K%C4%B1lavuzlar", metin: "VPN Kurulum Kılavuzunu Aç" }],
  },
];

function RehberKarti({ rehber, index, acikMi, onToggle }) {
  return (
    <section
      style={{
        border: `1px solid ${acikMi ? rehber.renk + "66" : "rgba(255,255,255,0.1)"}`,
        borderRadius: 16,
        background: "rgba(255,255,255,0.045)",
        backdropFilter: "blur(10px)",
        overflow: "hidden",
        opacity: 0,
        animation: `brBelir 0.5s ease ${(index * 0.1).toFixed(2)}s forwards`,
        transition: "border-color 0.25s ease",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12,
          padding: "16px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        <div
          style={{
            width: 40, height: 40, borderRadius: 12, flex: "none", display: "grid", placeItems: "center",
            fontSize: 20, background: `${rehber.renk}22`, transition: "transform 0.25s ease", transform: acikMi ? "scale(1.08)" : "scale(1)",
          }}
        >
          {rehber.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: "#f4f8ff" }}>{rehber.baslik}</div>
          <div style={{ fontSize: 12, color: "rgba(232,238,252,0.55)", marginTop: 2 }}>{rehber.ozet}</div>
        </div>
        <div
          style={{
            flex: "none", fontSize: 16, color: rehber.renk, transition: "transform 0.25s ease",
            transform: acikMi ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ⌄
        </div>
      </button>

      <div
        style={{
          maxHeight: acikMi ? 480 : 0,
          opacity: acikMi ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.35s ease, opacity 0.25s ease",
        }}
      >
        <div style={{ padding: "0 18px 18px 18px" }}>
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 14 }} />
          <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
            {rehber.adimlar.map((adim, i) => (
              <li key={i} style={{ fontSize: 12.5, color: "rgba(232,238,252,0.8)", lineHeight: 1.55 }}>{adim}</li>
            ))}
          </ol>
          {rehber.not && (
            <div style={{ marginTop: 12, fontSize: 11.5, color: "rgba(232,238,252,0.5)", display: "flex", gap: 6, alignItems: "flex-start" }}>
              <span>ℹ️</span><span>{rehber.not}</span>
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            {rehber.linkler.map((l, i) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 800,
                  color: rehber.renk, textDecoration: "none", padding: "7px 12px", borderRadius: 999,
                  background: `${rehber.renk}18`, border: `1px solid ${rehber.renk}55`,
                }}
              >
                🔗 {l.metin}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function BilgilendirmeRehberleriPage() {
  const [roleHref, setRoleHref] = useState("/");
  const [acikId, setAcikId] = useState(REHBERLER[0].id);

  useEffect(() => {
    async function init() {
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
      const isAcademician = session.user.email?.toLowerCase() !== "suko.crc06@gmail.com" && profile?.role === "academician";
      setRoleHref(isAcademician ? "/?role=faculty" : "/?role=student");
    }
    init();
  }, []);

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(165deg, #0e1c38 0%, #0a1428 45%, #050a16 100%)", fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <style>{`
        @keyframes brBelir {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(8,14,28,0.72)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={roleHref} style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#9cc4ff", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#7fb2ff" }}>KAMPÜS YAŞAMI · BİLGİLENDİRME REHBERLERİ</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f4f8ff" }}>Wi-Fi, E-posta, OBS/LMS</div>
          </div>
        </div>
        <Link href={roleHref} style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid rgba(127,178,255,0.35)", color: "#9cc4ff", background: "rgba(91,157,255,0.08)" }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(880px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        <div style={{ fontSize: 12.5, color: "rgba(232,238,252,0.55)", marginBottom: 16, lineHeight: 1.6 }}>
          Kampüs teknik hizmetleriyle ilgili en sık aranan konular — her başlığa tıklayıp açabilir, ayrıntılı adımlar için AYBÜ Bilgi İşlem Daire Başkanlığı'nın resmi kılavuzuna gidebilirsin.
        </div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", alignItems: "start" }}>
          {REHBERLER.map((r, i) => (
            <RehberKarti key={r.id} rehber={r} index={i} acikMi={acikId === r.id} onToggle={() => setAcikId(acikId === r.id ? null : r.id)} />
          ))}
        </div>
      </main>
    </div>
  );
}
