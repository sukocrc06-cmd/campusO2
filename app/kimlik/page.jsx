"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

// Sanal öğrenci kimlik kartındaki QR kod, ham JSON yerine artık bu sayfaya
// (?id=<profil id>) yönlendiren bir URL taşıyor — telefonla okutunca
// tarayıcı doğrudan burayı açıyor ve şık, mavi-beyaz bir kimlik kartı
// gösteriyor. Sayfa bilerek herkese açık: fiziksel bir kimlik kartına
// bakmakla aynı — giriş yapmaya gerek yok, sadece isim/bölüm/sınıf/öğrenci
// no gibi kart üzerinde zaten yazılı olan bilgileri gösteriyor, e-posta gibi
// hassas alanları hiç sorgulamıyor.
export default function OgrenciKimlikKartiPage() {
  const [durum, setDurum] = useState("yukleniyor"); // yukleniyor | bulundu | yok
  const [profil, setProfil] = useState(null);

  useEffect(() => {
    async function yukle() {
      if (!supabase) { setDurum("yok"); return; }
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      if (!id) { setDurum("yok"); return; }
      const { data } = await supabase
        .from("profiles")
        .select("full_name, bolum, sinif, ogrenci_no, avatar_url, role")
        .eq("id", id)
        .eq("role", "student")
        .maybeSingle();
      if (!data) { setDurum("yok"); return; }
      setProfil(data);
      setDurum("bulundu");
    }
    yukle();
  }, []);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        background: "radial-gradient(circle at 30% 15%, #2f7ff0, #0e4bae 45%, #071b3f 100%)",
      }}
    >
      {durum === "yukleniyor" && <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, fontWeight: 600 }}>Kimlik yükleniyor…</div>}

      {durum === "yok" && (
        <div style={{ textAlign: "center", color: "#fff", maxWidth: 320 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🪪</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Kimlik bulunamadı</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Bu bağlantı geçersiz ya da kimlik artık mevcut değil.</div>
        </div>
      )}

      {durum === "bulundu" && profil && (
        <div style={{ width: "min(380px, 100%)" }}>
          <div
            style={{
              borderRadius: 26,
              padding: "28px 26px",
              background: "linear-gradient(160deg, #ffffff, #eef5ff 65%, #e2edff)",
              boxShadow: "0 30px 60px -22px rgba(3,15,45,0.6)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", top: -60, right: -60, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(23,92,211,0.14), transparent 70%)" }} />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #175cd3, #0b3b8c)", color: "#fff", fontSize: 15, fontWeight: 800 }}>▣</span>
                <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.03em", color: "#0f1b33" }}>Campus<span style={{ color: "#175cd3" }}>O</span></span>
              </span>
              <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em", color: "#0e4bae", background: "#e6f0ff", padding: "4px 10px", borderRadius: 999 }}>ÖĞRENCİ KİMLİĞİ</span>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div style={{
                width: 96, height: 96, borderRadius: "50%", overflow: "hidden", flex: "none",
                background: "linear-gradient(145deg, #175cd3, #0b3b8c)", display: "grid", placeItems: "center",
                border: "4px solid #fff", boxShadow: "0 10px 26px -12px rgba(15,43,90,0.45)",
              }}>
                {profil.avatar_url ? (
                  <img src={profil.avatar_url} alt={profil.full_name || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ color: "#fff", fontWeight: 800, fontSize: 34 }}>{(profil.full_name || "?").trim().charAt(0).toUpperCase()}</span>
                )}
              </div>
            </div>

            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div style={{ fontSize: 19, fontWeight: 800, color: "#0f1b33", letterSpacing: "-0.02em" }}>{profil.full_name || "İsimsiz Öğrenci"}</div>
              <div style={{ fontSize: 12.5, color: "#5b6b85", marginTop: 4 }}>{profil.bolum || "Bölüm belirtilmedi"}{profil.sinif ? ` · ${profil.sinif}. Sınıf` : ""}</div>
            </div>

            <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #dbe6f7, transparent)", marginBottom: 18 }} />

            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em", color: "#8fa0bc" }}>ÖĞRENCİ NO</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#0f1b33", letterSpacing: "0.05em", marginTop: 2 }}>{profil.ogrenci_no || "—"}</div>
              </div>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
            CampusO üzerinden doğrulanmış sanal öğrenci kimliği
          </div>
        </div>
      )}
    </div>
  );
}
