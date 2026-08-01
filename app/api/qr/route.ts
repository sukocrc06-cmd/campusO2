import { NextResponse } from "next/server";
import { loadQrStore, performQrAction } from "../../../lib/qr-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function databaseError(error: unknown) {
  const missing = error instanceof Error && error.message === "DATABASE_URL_MISSING";
  return NextResponse.json(
    {
      ok: false,
      message: missing
        ? "Neon bağlantısı için DATABASE_URL bulunamadı."
        : "QR veritabanı işlemi tamamlanamadı.",
    },
    { status: 503 },
  );
}

export async function GET() {
  try {
    return NextResponse.json(await loadQrStore());
  } catch (error) {
    console.error("CampusO QR GET error", error);
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const result = await performQrAction(body);
    const store = await loadQrStore();
    return NextResponse.json({ ...result, store }, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error("CampusO QR POST error", error);
    return databaseError(error);
  }
}
