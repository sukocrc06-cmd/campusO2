import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AuthError, authenticateRequest, requireRole } from "../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bu uç nokta bir kullanıcının ESKİ şifresini asla görmez/öğrenmez —
// Supabase şifreleri hiçbir zaman düz metin olarak saklamaz. Yaptığı şey,
// service-role (yönetici) yetkisiyle kullanıcı için DOĞRUDAN YENİ bir şifre
// belirlemek — e-posta ile şifre sıfırlama akışının bir alternatifi.
// Sadece admin rolündeki hesap çağırabilir (authenticateRequest + requireRole).

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new AuthError("SUPABASE_SERVICE_ROLE_KEY tanımlı değil.", 503);
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const actor = await authenticateRequest(request);
    requireRole(actor, ["admin"]);

    const body = await request.json().catch(() => null);
    const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

    if (!userId) {
      return NextResponse.json({ error: "Kullanıcı belirtilmedi." }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Yeni şifre en az 8 karakter olmalı." }, { status: 400 });
    }

    const admin = serviceClient();
    const { data, error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) {
      return NextResponse.json({ error: error.message || "Şifre güncellenemedi." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, email: data.user?.email ?? null });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Beklenmeyen bir hata oluştu." }, { status: 500 });
  }
}
