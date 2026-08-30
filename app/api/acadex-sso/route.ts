import { NextResponse } from "next/server";
import { AuthError, authenticateRequest, requireRole } from "../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Acadex teacher-panel SSO handoff.
//
// A faculty ("academician") user on CampusO clicks the Acadex card/nav
// button in app/page.tsx (goToAcadexTeacherPanel()), which POSTs here with
// their normal CampusO session token. We verify that session and role
// server-side — exactly like app/api/yemek-menu-sync/route.ts already does
// for its own admin-only action — then make an authenticated outbound call
// to Acadex's campuso-sso Edge Function using a secret that lives only in
// this server's environment, never in the browser. Acadex's function
// returns a one-time magic-link URL; we hand that straight back to the
// browser, which does a full-page navigation to it and lands already
// signed in to Acadex's teacher panel.
const ACADEX_SSO_URL =
  process.env.ACADEX_SSO_URL || "https://yrcdvcsowblzmkpbmkut.supabase.co/functions/v1/campuso-sso";

function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
  }
  console.error("Acadex SSO hatası", error);
  return NextResponse.json(
    { ok: false, message: error instanceof Error ? error.message : "Bilinmeyen hata." },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  try {
    const actor = await authenticateRequest(request);
    requireRole(actor, ["academician", "admin"]);

    const secret = process.env.ACADEX_SSO_SECRET;
    if (!secret) {
      return NextResponse.json(
        { ok: false, message: "Acadex SSO yapılandırılmamış (ACADEX_SSO_SECRET eksik). Vercel proje ayarlarına ekleyin." },
        { status: 503 },
      );
    }

    const response = await fetch(ACADEX_SSO_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-campuso-secret": secret,
      },
      body: JSON.stringify({
        email: actor.email,
        full_name: actor.displayName,
        campuso_user_id: actor.id,
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.redirectUrl) {
      const message = data?.error || `Acadex SSO isteği başarısız (HTTP ${response.status}).`;
      return NextResponse.json({ ok: false, message }, { status: response.status || 502 });
    }

    return NextResponse.json(
      { ok: true, redirectUrl: data.redirectUrl },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
