"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

const cardStyle = { background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 24, marginBottom: 16 };
const inputStyle = { height: 44, padding: "0 14px", border: "1px solid #e3ebf6", borderRadius: 11, fontSize: 13.5, outline: "none", width: "100%", boxSizing: "border-box" };

// Bir e-posta uzantısı girdisini normalize eder: baştaki "@" işaretini,
// baştaki/sondaki boşlukları siler ve küçük harfe çevirir. Kullanıcı
// "@ogrenci.xxx.edu.tr" ya da "ogrenci.xxx.edu.tr" yazsa da aynı sonucu verir.
function domainNormalize(deger) {
  return deger.trim().toLowerCase().replace(/^@+/, "");
}

export default function AdminKurumsalDomainlerPage() {
  const [yetkili, setYetkili] = useState(null); // null = kontrol ediliyor, true/false = sonuç
  const [domainler, setDomainler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [yeniDomain, setYeniDomain] = useState("");
  const [yeniAciklama, setYeniAciklama] = useState("");
  const [ekleBusy, setEkleBusy] = useState(false);
  const [silBusyId, setSilBusyId] = useState(null);
  const [mesaj, setMesaj] = useState("");
  const [hata, setHata] = useState("");

  useEffect(() => {
    async function init() {
      if (!supabase) { setHata("Veritabanı bağlantısı yapılandırılmamış."); setYetkili(false); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email?.toLowerCase() !== "suko.crc06@gmail.com") {
        setYetkili(false);
        setLoading(false);
        return;
      }
      setYetkili(true);
      await listeyiYenile();
      setLoading(false);
    }
    init();
  }, []);

  async function listeyiYenile() {
    const { data, error: err } = await supabase.from("izinli_email_domainleri").select("*").order("created_at", { ascending: true });
    if (err) setHata("Liste alınamadı: " + err.message);
    else setDomainler(data || []);
  }

  async function handleEkle(e) {
    e.preventDefault();
    const temiz = domainNormalize(yeniDomain);
    if (!temiz || !temiz.includes(".")) { setHata('Geçerli bir e-posta uzantısı yaz (örn. "ogrenci.xxx.edu.tr").'); return; }
    setEkleBusy(true); setHata(""); setMesaj("");
    const { error: err } = await supabase.from("izinli_email_domainleri").insert({ domain: temiz, aciklama: yeniAciklama.trim() || null });
    setEkleBusy(false);
    if (err) { setHata(err.code === "23505" ? "Bu uzantı zaten listede." : "Eklenemedi: " + err.message); return; }
    setYeniDomain(""); setYeniAciklama("");
    setMesaj(`@${temiz} listeye eklendi.`);
    await listeyiYenile();
  }

  async function handleSil(d) {
    setSilBusyId(d.id); setHata(""); setMesaj("");
    const { error: err } = await supabase.from("izinli_email_domainleri").delete().eq("id", d.id);
    setSilBusyId(null);
    if (err) { setHata("Silinemedi: " + err.message); return; }
    setMesaj(`@${d.domain} listeden kaldırıldı.`);
    await listeyiYenile();
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=admin" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>YÖNETİM MERKEZİ</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Kurumsal E-posta Domainleri</div>
          </div>
        </div>
      </header>

      <main style={{ width: "min(640px, 100%)", margin: "0 auto", padding: "28px 18px 60px" }}>
        {yetkili === false ? (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>Bu sayfa yalnız yetkili yönetici hesabıyla kullanılabilir.</div>
        ) : (
          <>
            {hata ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{hata}</div> : null}
            {mesaj ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#e3faf0", border: "1px solid #b7e9d2", color: "#0b6b46", fontSize: 13, fontWeight: 600 }}>{mesaj}</div> : null}

            <section style={cardStyle}>
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>Öğrenci Kaydı için İzinli E-posta Uzantıları</div>
              <div style={{ fontSize: 12, color: "#8fa0bc", marginBottom: 16, lineHeight: 1.6 }}>
                Öğrenciler /signup üzerinden kendi kendine kayıt olurken, e-postaları burada listelenen uzantılardan biriyle bitmiyorsa kayıt reddedilir.
                <b> Liste boşken herhangi bir e-posta ile kayıt olunabilir</b> — kısıtlamayı etkinleştirmek için en az bir uzantı eklemen yeterli.
                Bu kısıtlama sadece öğrenci kendi kendine kayıt olurken uygulanır; akademisyen davetlerini ve "Kullanıcılar" sayfasından senin oluşturduğun hesapları etkilemez.
              </div>

              <form onSubmit={handleEkle} style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr auto", alignItems: "end" }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#5b6b85", display: "flex", flexDirection: "column", gap: 5 }}>Uzantı
                  <input style={inputStyle} value={yeniDomain} onChange={(e) => setYeniDomain(e.target.value)} placeholder="ogrenci.xxx.edu.tr" />
                </label>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#5b6b85", display: "flex", flexDirection: "column", gap: 5 }}>Açıklama (opsiyonel)
                  <input style={inputStyle} value={yeniAciklama} onChange={(e) => setYeniAciklama(e.target.value)} placeholder="Örn. Öğrenci e-postası" />
                </label>
                <button type="submit" disabled={ekleBusy} className="button button-primary" style={{ minHeight: 44, padding: "0 18px", fontSize: 12.5, whiteSpace: "nowrap" }}>{ekleBusy ? "Ekleniyor…" : "Ekle"}</button>
              </form>
            </section>

            <section style={cardStyle}>
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 12 }}>Listedeki Uzantılar {domainler.length > 0 && `(${domainler.length})`}</div>
              {loading ? (
                <div style={{ color: "#8fa0bc", fontSize: 13 }}>Yükleniyor…</div>
              ) : domainler.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "#8fa0bc", fontSize: 13, border: "1px dashed #e3ebf6", borderRadius: 12 }}>Henüz hiç uzantı eklenmedi — kısıtlama şu an devre dışı, herkes kayıt olabilir.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {domainler.map((d) => (
                    <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid #e3ebf6" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>@{d.domain}</div>
                        {d.aciklama && <div style={{ fontSize: 11, color: "#8fa0bc", marginTop: 2 }}>{d.aciklama}</div>}
                      </div>
                      <button
                        type="button"
                        disabled={silBusyId === d.id}
                        onClick={() => handleSil(d)}
                        style={{ minHeight: 34, padding: "0 12px", fontSize: 11.5, fontWeight: 700, borderRadius: 9, border: "1px solid #f2c5ba", background: "#fff", color: "#984333", cursor: "pointer" }}
                      >
                        {silBusyId === d.id ? "…" : "Kaldır"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
