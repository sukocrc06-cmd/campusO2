import { NextResponse } from "next/server";
import { loadQrStore, performQrAction } from "../../../lib/qr-db";
import { AuthError, authenticateRequest } from "../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function databaseError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: error.status, headers: { "cache-control": "no-store" } },
    );
  }
  const missing = error instanceof Error && error.message === "DATABASE_URL_MISSING";
  return NextResponse.json(
    {
      ok: false,
      message: missing
        ? "Neon bağlantısı için DATABASE_URL bulunamadı."
        : "QR veritabanı işlemi tamamlanamadı.",
    },
    { status: 503, headers: { "cache-control": "no-store" } },
  );
}

export async function GET(request: Request) {
  try {
    const actor = await authenticateRequest(request);
    return NextResponse.json(await loadQrStore(actor), {
      headers: { "cache-control": "no-store, private" },
    });
  } catch (error) {
    if (!(error instanceof AuthError)) {
      console.error("CampusO QR GET error", error);
    }
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await authenticateRequest(request);
    const body = await request.json() as Record<string, unknown>;
    const result = await performQrAction(body, actor);
    const store = await loadQrStore(actor);
    return NextResponse.json(
      { ...result, store },
      {
        status: result.ok ? 200 : 400,
        headers: { "cache-control": "no-store, private" },
      },
    );
  } catch (error) {
    if (!(error instanceof AuthError)) {
      console.error("CampusO QR POST error", error);
    }
    return databaseError(error);
  }
}
