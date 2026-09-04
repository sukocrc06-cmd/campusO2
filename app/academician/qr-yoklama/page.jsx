"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { supabase } from "../../../lib/supabase";

const inputStyle = { height: 40, padding: "0 12px", border: "1px solid #e3ebf6", borderRadius: 10, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };

function formatCountdown(msLeft) {
  const secs = Math.max(0, Math.ceil(msLeft / 1000));
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function AkademisyenQrYoklamaPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState(null);

  const [dersler, setDersler] = useState([]);
  const [secilenDersId, setSecilenDersId] = useState("");
  const [sureDk, setSureDk] = useState(3);
  const [busy, setBusy] = useState(false);

  const [aktifOturum, setAktifOturum] = useState(null); // { qr_oturum_id, token, gecerlilik_bitis, ders_kodu, ders_adi }
  const [qrGorsel, setQrGorsel] = useState("");
  const [now, setNow] = useState(Date.now());
  const [katilanlar, setKatilanlar] = useState([]); // [{ id, full_name }]
  const [tamamlandiPopup, setTamamlandiPopup] = useState(false);

  const secilenDers = dersler.find((d) => d.id === secilenDersId) || null;
  const pollTimer = useRef(null);

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
      if (profile?.role !== "academician") { setError("Bu sayfa yalnız akademisyenler içindir."); setLoading(false); return; }
      setUserId(session.user.id);
      const { data: donemSatiri } = await supabase.from("aktif_donem").select("donem").eq("id", true).maybeSingle();
      const guncelDonem = donemSatiri?.donem || "bahar";
      const { data, error: err } = await supabase.from("ders_programi").select("*").eq("akademisyen_id", session.user.id).eq("donem", guncelDonem).order("ders_adi");
      if (err) { setError("Derslerin alınamadı: " + err.message); setLoading(false); return; }
      setDersler(data || []);
      if (data && data.length > 0) setSecilenDersId(data[0].id);
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!aktifOturum) { setQrGorsel(""); return; }
    let active = true;
    const value = `${window.location.origin}/student/qr-yoklama?token=${encodeURIComponent(aktifOturum.token)}`;
    QRCode.toDataURL(value, { width: 260, margin: 2, color: { dark: "#08275f", light: "#ffffff" } })
      .then((result) => active && setQrGorsel(result))
      .catch(() => active && setQrGorsel(""));
    return () => { active = false; };
  }, [aktifOturum]);

  const katilanlariYukle = useCallback(async (qrOturumId) => {
    const { data: kayitlar } = await supabase
      .from("yoklama_kayitlari")
      .select("ogrenci_id, durum")
      .eq("oturum_id", qrOturumId)
      .eq("durum", "var");
    const ids = (kayitlar || []).map((k) => k.ogrenci_id);
    if (ids.length === 0) { setKatilanlar([]); return; }
    const { data: profiller } = await supabase.rpc("campuso_get_profiller", { p_user_ids: ids });
    setKatilanlar((profiller || []).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "", "tr")));
  }, []);

  useEffect(() => {
    if (!aktifOturum) {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
      return;
    }
    katilanlariYukle(aktifOturum.qr_oturum_id);
    pollTimer.current = window.setInterval(() => katilanlariYukle(aktifOturum.qr_oturum_id), 3000);
    return () => { if (pollTimer.current) window.clearInterval(pollTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktifOturum?.qr_oturum_id]);

  async function qrOlustur() {
    if (!secilenDers) return;
    setBusy(true); setError("");
    const { data, error: err } = await supabase.rpc("campuso_qr_yoklama_baslat", {
      p_ders_id: secilenDers.id,
      p_sure_dk: Number(sureDk) || 3,
    });
    setBusy(false);
    if (err) { setError("QR oluşturulamadı: " + err.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) { setError("QR oluşturulamadı."); return; }
    setAktifOturum({
      qr_oturum_id: row.qr_oturum_id,
      token: row.token,
      gecerlilik_bitis: new Date(row.gecerlilik_bitis).getTime(),
      ders_kodu: row.ders_kodu,
      ders_adi: row.ders_adi,
    });
    setKatilanlar([]);
    setTamamlandiPopup(true);
  }

  const kalanMs = aktifOturum ? aktifOturum.gecerlilik_bitis - now : 0;
  const suresiDoldu = aktifOturum ? kalanMs <= 0 : false;

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/?role=faculty" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid #e3ebf6", background: "#f5f8fc", color: "#175cd3", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>VOL 1 · QR YOKLAMA</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>QR Oluştur</div>
          </div>
        </div>
        <Link href="/academician/yoklama" style={{ minHeight: 40, padding: "0 16px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid #c7deff", color: "#0e4bae" }}>Yoklama Takibi</Link>
      </header>

      <main style={{ width: "min(560px, 100%)", margin: "0 auto", padding: "24px 18px 60px" }}>
        {error ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}

        {loading ? (
          <p style={{ color: "#5b6b85" }}>Yükleniyor…</p>
        ) : dersler.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", border: "1px dashed #e3ebf6", borderRadius: 16, background: "#fff", color: "#8fa0bc", fontSize: 14 }}>
            Sana atanmış bir ders bulunamadı. Admin'den ders programında bu dersin öğretim üyesi olarak seni atamasını iste.
          </div>
        ) : !aktifOturum || suresiDoldu ? (
          <section style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 20, display: "grid", gap: 14 }}>
            {suresiDoldu && <div style={{ fontSize: 12.5, fontWeight: 700, color: "#984333", background: "#fff4f0", border: "1px solid #f2c5ba", borderRadius: 10, padding: "8px 12px" }}>Önceki QR'ın süresi doldu. Yeni bir QR oluşturabilirsin.</div>}
            <label style={{ fontSize: 12, fontWeight: 700, color: "#5b6b85", display: "flex", flexDirection: "column", gap: 5 }}>Ders
              <select style={inputStyle} value={secilenDersId} onChange={(e) => setSecilenDersId(e.target.value)}>
                {dersler.map((d) => <option key={d.id} value={d.id}>{d.ders_adi} — {d.bolum} / {d.sinif}. sınıf</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#5b6b85", display: "flex", flexDirection: "column", gap: 5 }}>Süre
              <select style={inputStyle} value={sureDk} onChange={(e) => setSureDk(e.target.value)}>
                {[1, 2, 3, 5, 10].map((m) => <option key={m} value={m}>{m} dakika</option>)}
              </select>
            </label>
            <button className="button button-primary" onClick={qrOlustur} disabled={busy} style={{ minHeight: 44, fontSize: 14 }}>{busy ? "Oluşturuluyor…" : "QR Oluştur"}</button>
          </section>
        ) : (
          <section style={{ background: "#fff", border: "1px solid #e3ebf6", borderRadius: 16, padding: 20, display: "grid", gap: 14, textAlign: "center" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{aktifOturum.ders_adi}</div>
              <div style={{ fontSize: 12, color: "#8fa0bc" }}>{aktifOturum.ders_kodu}</div>
            </div>
            {qrGorsel ? (
              <img src={qrGorsel} alt="Yoklama QR kodu" style={{ width: 240, height: 240, margin: "0 auto", borderRadius: 12, border: "1px solid #e3ebf6" }} />
            ) : (
              <div style={{ width: 240, height: 240, margin: "0 auto", display: "grid", placeItems: "center", color: "#c7deff" }}>QR hazırlanıyor…</div>
            )}
            <div style={{ fontSize: 13, fontWeight: 700, color: "#175cd3" }}>Kalan süre: {formatCountdown(kalanMs)}</div>
            <div style={{ fontSize: 12.5, color: "#5b6b85" }}>Öğrenciler telefon kamerasıyla bu QR'ı okutsun; yoklamaları otomatik kaydedilir.</div>

            <div style={{ marginTop: 8, paddingTop: 14, borderTop: "1px solid #e3ebf6", textAlign: "left" }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>Katılanlar ({katilanlar.length})</div>
              {katilanlar.length === 0 ? (
                <div style={{ fontSize: 12, color: "#8fa0bc" }}>Henüz katılım yok.</div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {katilanlar.map((k) => (
                    <div key={k.id} style={{ fontSize: 12.5, padding: "6px 10px", borderRadius: 8, background: "#f5f8fc" }}>{k.full_name || "Öğrenci"}</div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setAktifOturum(null)}
              style={{ minHeight: 38, fontSize: 12.5, fontWeight: 700, border: "1px solid #e3ebf6", borderRadius: 10, background: "#fff", color: "#5b6b85", cursor: "pointer" }}
            >
              Yeni QR oluştur
            </button>
          </section>
        )}
      </main>

      {tamamlandiPopup && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(15,27,51,0.45)", display: "grid", placeItems: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 28, maxWidth: 360, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(15,27,51,0.25)" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e3faf0", color: "#0b8f5c", display: "grid", placeItems: "center", margin: "0 auto 14px", fontSize: 28 }}>✓</div>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Yoklama tamamlandı</div>
            <p style={{ fontSize: 13, color: "#5b6b85", marginBottom: 18 }}>Derse başlayabilirsiniz ve bu ders için yoklama geçmişine Yoklama Takibi panelinden erişebilirsiniz.</p>
            <button className="button button-primary" onClick={() => setTamamlandiPopup(false)} style={{ minHeight: 42, width: "100%" }}>Tamam</button>
          </div>
        </div>
      )}
    </div>
  );
}
