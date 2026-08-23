import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AuthError, authenticateRequest, requireRole } from "../../../lib/server-auth";
import { parseAybuMenu } from "../../../lib/yemek-menu-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AYBU_URL = "https://aybu.edu.tr/sks/tr/sayfa/6265";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY tanımlı değil. Vercel proje ayarlarına ekleyin.");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function authorizeRequest(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { via: "cron" as const };
  }
  const actor = await authenticateRequest(request);
  requireRole(actor, ["admin"]);
  return { via: "admin" as const, actor };
}

function todayIso() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = `${now.getUTCMonth() + 1}`.padStart(2, "0");
  const d = `${now.getUTCDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function runSync() {
  const supabase = serviceClient();

  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(AYBU_URL, {
      signal: controller.signal,
      headers: { "user-agent": "CampusO-YemekMenu-Sync/1.0" },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`AYBÜ sayfası HTTP ${res.status} döndürdü.`);
    html = await res.text();
  } catch (err) {
    const mesaj = "AYBÜ sayfasına erişilemedi: " + (err instanceof Error ? err.message : String(err));
    await supabase.from("yemek_menu_sync_loglari").insert([{ basarili: false, bulunan_gun_sayisi: 0, mesaj }]);
    return { ok: false, mesaj, gunSayisi: 0 };
  }

  const gunler = parseAybuMenu(html, todayIso());

  if (gunler.length === 0) {
    const mesaj = "Sayfa alındı ama menü ayıklanamadı; AYBÜ site yapısı değişmiş olabilir. Mevcut menü korunuyor.";
    await supabase.from("yemek_menu_sync_loglari").insert([{ basarili: false, bulunan_gun_sayisi: 0, mesaj }]);
    return { ok: false, mesaj, gunSayisi: 0 };
  }

  const rows = gunler.map((g) => ({
    tarih: g.tarih,
    gun_adi: g.gun_adi,
    yemekler: g.yemekler,
    kaynak: "otomatik" as const,
  }));

  const { error } = await supabase.from("yemek_menusu").upsert(rows, { onConflict: "tarih" });
  if (error) {
    const mesaj = "Veritabanına yazılamadı: " + error.message;
    await supabase.from("yemek_menu_sync_loglari").insert([{ basarili: false, bulunan_gun_sayisi: gunler.length, mesaj }]);
    return { ok: false, mesaj, gunSayisi: gunler.length };
  }

  const mesaj = `${gunler.length} gün için menü güncellendi (${gunler.map((g) => g.gun_adi).join(", ")}).`;
  await supabase.from("yemek_menu_sync_loglari").insert([{ basarili: true, bulunan_gun_sayisi: gunler.length, mesaj }]);
  return { ok: true, mesaj, gunSayisi: gunler.length, gunler };
}

function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
  }
  console.error("CampusO yemek menü sync hatası", error);
  return NextResponse.json(
    { ok: false, message: error instanceof Error ? error.message : "Bilinmeyen hata." },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    await authorizeRequest(request);
    const result = await runSync();
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await authorizeRequest(request);
    const result = await runSync();
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
