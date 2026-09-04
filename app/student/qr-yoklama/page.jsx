"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

function extractToken(value) {
  const normalized = (value || "").trim();
  if (!normalized) return "";
  try {
    const url = new URL(normalized, window.location.origin);
    const token = url.searchParams.get("token");
    if (token) return token.trim().toUpperCase();
  } catch {
    // düz metin/kod olabilir, aşağıda ele alınıyor
  }
  return /^[A-Z0-9]{8}$/i.test(normalized) ? normalized.toUpperCase() : "";
}

export default function OgrenciQrYoklamaPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notStudent, setNotStudent] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [inlineMessage, setInlineMessage] = useState("");
  const [sonuc, setSonuc] = useState(null); // { basarili, mesaj, ders_kodu, ders_adi, bolum, icerik_ozet }

  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const attemptedToken = useRef("");

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Oturum bulunamadı. Giriş yapıp tekrar deneyin."); setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
      if (profile?.role !== "student") { setNotStudent(true); setLoading(false); return; }
      setLoading(false);

      const search = new URLSearchParams(window.location.search);
      const urlToken = extractToken(search.get("token") || "");
      if (urlToken) void attend(urlToken);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attend = useCallback(async (token) => {
    if (!token || attemptedToken.current === token) return;
    attemptedToken.current = token;
    setScanBusy(true);
    setInlineMessage("");
    const { data, error: err } = await supabase.rpc("campuso_qr_yoklama_kaydet", { p_token: token });
    setScanBusy(false);
    attemptedToken.current = "";
    if (err) { setInlineMessage("Bir hata oluştu: " + err.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) { setInlineMessage("Bir hata oluştu, tekrar dene."); return; }
    setSonuc(row);
    if (!row.basarili) setInlineMessage(row.mesaj);
  }, []);

  const handleScanned = useCallback((value) => {
    const token = extractToken(value);
    if (!token) { setInlineMessage("Bu QR kodu geçerli bir CampusO yoklama bağlantısı değil."); return; }
    scannerRef.current?.stop();
    setScannerOpen(false);
    void attend(token);
  }, [attend]);

  useEffect(() => {
    if (!scannerOpen || !videoRef.current) return;
    let cancelled = false;
    const video = videoRef.current;

    import("qr-scanner").then(async ({ default: QrScanner }) => {
      if (cancelled) return;
      const scanner = new QrScanner(
        video,
        (result) => handleScanned(typeof result === "string" ? result : result.data),
        { preferredCamera: "environment", highlightScanRegion: true, returnDetailedScanResult: true },
      );
      scannerRef.current = scanner;
      await scanner.start();
    }).catch(() => {
      setScannerOpen(false);
      setInlineMessage("Kamera açılamadı. Kamera izni verdiğinden emin ol ve tekrar dene.");
    });

    return () => {
      cancelled = true;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [scannerOpen, handleScanned]);

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f8fc", fontFamily: "system-ui, sans-serif", color: "#0f1b33", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 18px", borderBottom: "1px solid #e3ebf6", background: "#fff" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#175cd3" }}>VOL 1 · QR YOKLAMA</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Yoklama Tara</div>
        </div>
        <Link href="/student/yoklamalarim" style={{ minHeight: 38, padding: "0 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", borderRadius: 12, border: "1px solid #c7deff", color: "#0e4bae" }}>Yoklamalarım</Link>
      </header>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 18, textAlign: "center" }}>
        {error ? (
          <div style={{ padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div>
        ) : notStudent ? (
          <div style={{ padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>Bu sayfa yalnız öğrenciler içindir.</div>
        ) : loading ? (
          <p style={{ color: "#5b6b85" }}>Yükleniyor…</p>
        ) : (
          <>
            {inlineMessage && (
              <div style={{ padding: "10px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600, maxWidth: 340 }}>{inlineMessage}</div>
            )}
            <div style={{ width: 88, height: 88, borderRadius: "50%", background: "#eaf7fd", color: "#1f8fc4", display: "grid", placeItems: "center", fontSize: 40 }}>▦</div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>QR kodu tara</div>
            <p style={{ fontSize: 13, color: "#5b6b85", maxWidth: 300 }}>Akademisyeninin ekranındaki QR kodunu kamerayla okut; ders üyeliğin ve yoklaman tek adımda kaydedilsin.</p>
            <button
              className="button button-primary"
              onClick={() => { setInlineMessage(""); setScannerOpen(true); }}
              disabled={scanBusy}
              style={{ minHeight: 52, padding: "0 32px", fontSize: 15, borderRadius: 14 }}
            >
              {scanBusy ? "İşleniyor…" : "Kamerayı Aç"}
            </button>
          </>
        )}
      </main>

      {scannerOpen && (
        <div role="dialog" aria-modal="true" aria-label="QR kod tarayıcı" style={{ position: "fixed", inset: 0, background: "#000", zIndex: 60, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, color: "#fff" }}>
            <b style={{ fontSize: 14 }}>QR kodu çerçeveye getir</b>
            <button onClick={() => setScannerOpen(false)} aria-label="Kapat" style={{ background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer" }}>✕</button>
          </div>
          <video ref={videoRef} muted playsInline style={{ flex: 1, width: "100%", objectFit: "cover" }} />
        </div>
      )}

      {sonuc && sonuc.basarili && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(15,27,51,0.45)", display: "grid", placeItems: "center", zIndex: 70, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 28, maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(15,27,51,0.25)" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e3faf0", color: "#0b8f5c", display: "grid", placeItems: "center", margin: "0 auto 14px", fontSize: 28 }}>✓</div>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{sonuc.ders_adi} {sonuc.ders_kodu ? <span style={{ fontWeight: 500, color: "#5b6b85" }}>({sonuc.ders_kodu})</span> : null}</div>
            {sonuc.icerik_ozet && <p style={{ fontSize: 12.5, color: "#5b6b85", marginBottom: 10 }}>{sonuc.icerik_ozet}</p>}
            <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 18 }}>{sonuc.mesaj}</p>
            <div style={{ display: "grid", gap: 8 }}>
              <button className="button button-primary" onClick={() => setSonuc(null)} style={{ minHeight: 42, width: "100%" }}>Tamam</button>
              <Link href="/student/yoklamalarim" style={{ fontSize: 12.5, fontWeight: 700, color: "#0e4bae", textDecoration: "none" }}>Yoklama Takibi'ni aç</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
