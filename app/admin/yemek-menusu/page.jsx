"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase, fetchWithAuth } from "../../../lib/supabase";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTarih(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatZaman(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AdminYemekMenusuPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [gunler, setGunler] = useState([]);
  const [loglar, setLoglar] = useState([]);

  async function loadData() {
    const bugun = todayIso();
    const [{ data: gData, error: gErr }, { data: lData }] = await Promise.all([
      supabase.from("yemek_menusu").select("*").gte("tarih", bugun).order("tarih", { ascending: true }).limit(10),
      supabase.from("yemek_menu_sync_loglari").select("*").order("calisma_zamani", { ascending: false }).limit(5),
    ]);
    if (gErr) setError("Menü alınamadı: " + gErr.message);
    else setGunler(gData || []);
    setLoglar(lData || []);
  }

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Menü veritabanı bağlantısı yapılandırılmamış."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email?.toLowerCase() !== "suko.crc06@gmail.com") {
        setError("Bu sayfa yalnız yetkili yönetici hesabıyla kullanılabilir.");
        setLoading(false);
        return;
      }
      await loadData();
      setLoading(false);
    }
    init();
  }, []);

  const sonLog = loglar[0] || null;

  async function handleSync() {
    setSyncing(true); setError(""); setMessage("");
    try {
      const res = await fetchWithAuth("/api/yemek-menu-sync", { method: "POST" });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setError(body.message || body.mesaj || "Senkronizasyon başarısız oldu.");
      } else {
        setMessage(body.mesaj || "Menü güncellendi.");
      }
    } catch (err) {
      setError("Senkronizasyon isteği gönderilemedi: " + (err instanceof Error ? err.message : String(err)));
    }
    await loadData();
    setSyncing(false);
  }

  const kayitliGunSayisi = useMemo(() => gunler.length, [gunler]);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg, #f5f8fc)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", color: "var(--ink, #0f1b33)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 22px", borderBottom: "1px solid var(--line, #e3ebf6)", background: "var(--white, #fff)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, border: "1px solid var(--line, #e3ebf6)", background: "var(--bg, #f5f8fc)", color: "var(--blue-700, #175cd3)", textDecoration: "none" }}>←</Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 820, letterSpacing: ".12em", color: "var(--blue-700, #175cd3)" }}>VOL 1-7 · YEMEK MENÜSÜ</div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.02em" }}>Yemek Menüsü Senkronizasyonu</div>
          </div>
        </div>
        <Link href="/" className="button button-secondary" style={{ minHeight: 40, padding: "0 16px", fontSize: 13 }}>Panele dön</Link>
      </header>

      <main style={{ width: "min(900px, 100%)", margin: "0 auto", padding: "28px 20px 60px" }}>
        {loading ? (
          <p style={{ color: "var(--slate)", fontSize: 13 }}>Yükleniyor…</p>
        ) : error && gunler.length === 0 && loglar.length === 0 ? (
          <div style={{ padding: 20, borderRadius: 14, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13 }}>{error}</div>
        ) : (
          <>
            <section
              style={{
                padding: "22px 26px",
                marginBottom: 18,
                border: "1px solid var(--blue-200, #c7deff)",
                borderRadius: 18,
                background: "radial-gradient(320px 160px at 0% 0%, rgba(230,240,255,.85), transparent 70%), #fff",
                boxShadow: "0 18px 45px -28px rgba(15,43,90,.28)",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
                <div>
                  <small style={{ color: "#175cd3", fontSize: 10, fontWeight: 820, letterSpacing: ".14em" }}>AYBÜ SKS · OTOMATİK ÇEKME</small>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>
                    {sonLog ? (sonLog.basarili ? "Son senkronizasyon başarılı" : "Son senkronizasyon başarısız") : "Henüz senkronizasyon çalışmadı"}
                  </div>
                  {sonLog && (
                    <div style={{ fontSize: 12, color: "#5b6b85", marginTop: 4 }}>
                      {formatZaman(sonLog.calisma_zamani)} · {sonLog.mesaj}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={syncing}
                  className="button button-primary"
                  style={{ minHeight: 44, padding: "0 20px", fontSize: 13, opacity: syncing ? 0.6 : 1 }}
                >
                  {syncing ? "Çekiliyor…" : "Şimdi AYBÜ'den Çek"}
                </button>
              </div>
            </section>

            {error ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff4f0", border: "1px solid #f2c5ba", color: "#984333", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}
            {message ? <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#effbf6", border: "1px solid #bde5d5", color: "#0b5c42", fontSize: 13, fontWeight: 600 }}>{message}</div> : null}

            <section style={{ padding: 22, borderRadius: 18, border: "1px solid var(--line, #e3ebf6)", background: "#fff", marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 16 }}>Kayıtlı Menü</h2>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{kayitliGunSayisi} gün</span>
              </div>
              {gunler.length === 0 ? (
                <div style={{ display: "grid", placeItems: "center", minHeight: 100, border: "1px dashed var(--line)", borderRadius: 14, background: "var(--bg)", color: "var(--muted)", fontSize: 13 }}>
                  Henüz menü verisi yok. "Şimdi AYBÜ'den Çek" ile ilk senkronizasyonu başlat.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {gunler.map((g) => (
                    <div key={g.id} style={{ border: "1px solid #e3ebf6", borderRadius: 12, padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ fontWeight: 800, fontSize: 13 }}>{g.gun_adi} <span style={{ fontWeight: 500, color: "#5b6b85", fontSize: 11 }}>· {formatTarih(g.tarih)}</span></div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: g.kaynak === "otomatik" ? "#175cd3" : "#5b6b85", background: g.kaynak === "otomatik" ? "#e6f0ff" : "#f5f8fc", padding: "3px 9px", borderRadius: 999 }}>{g.kaynak === "otomatik" ? "OTOMATİK" : "ELLE"}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#5b6b85", marginTop: 6 }}>
                        {(g.yemekler || []).map((y) => y.ad).join(" · ") || "Yemek bulunamadı"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={{ padding: 22, borderRadius: 18, border: "1px solid var(--line, #e3ebf6)", background: "#fff" }}>
              <h2 style={{ margin: "0 0 14px", fontSize: 16 }}>Senkronizasyon Geçmişi</h2>
              {loglar.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--muted)" }}>Henüz kayıt yok.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {loglar.map((log) => (
                    <div key={log.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, padding: "8px 0", borderBottom: "1px solid #e3ebf6" }}>
                      <span style={{ color: log.basarili ? "#0b5c42" : "#984333", fontWeight: 700, flex: "none" }}>{log.basarili ? "Başarılı" : "Başarısız"}</span>
                      <span style={{ color: "#5b6b85", flex: 1 }}>{log.mesaj}</span>
                      <span style={{ color: "#8fa0bc", flex: "none", whiteSpace: "nowrap" }}>{formatZaman(log.calisma_zamani)}</span>
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
