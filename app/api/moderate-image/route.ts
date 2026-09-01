import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AuthError, authenticateRequest } from "../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGHTENGINE_MODELS = "nudity-2.1,offensive-2.0,gore-2.0,violence,weapon";

// Sightengine skor eşikleri — aşılırsa görsel reddedilir. Kategoriler
// modele göre farklı alanlarda gelir (bkz. checkSightengineResult).
// nudity-2.1 modeli tek bir "raw" skor değil, ayrı yoğunluk seviyeleri
// döndürüyor (sexual_activity, sexual_display, erotica, very_suggestive,
// suggestive, mildly_suggestive, none) — bu yüzden nudity için birden
// fazla alan ayrı ayrı kontrol ediliyor.
const ESIK = {
  nuditySert: 0.5, // sexual_activity / sexual_display / erotica
  nudityOrta: 0.6, // very_suggestive (iç çamaşırı, dekolte vb. net uygunsuz sayılan pozlar)
  offensive: 0.5,
  goreSert: 0.5, // gore.prob veya very_bloody/serious_injury/corpse gibi ağır sınıflar
  goreHafif: 0.6, // slightly_bloody/superficial_injury gibi daha hafif "açık yara/kan" sınıfları
  violence: 0.5,
  weapon: 0.5,
  weaponOyuncak: 0.75, // firearm_toy — oyuncak silah, daha yüksek eşik
};

type Item = { url: string; path: string };

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY tanımlı değil.");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function sightengineConfigured() {
  return Boolean(process.env.SIGHTENGINE_API_USER?.trim() && process.env.SIGHTENGINE_API_SECRET?.trim());
}

function checkSightengineResult(json: any): string[] {
  const nedenler: string[] = [];

  const nudity = json?.nudity ?? {};
  const nuditySertSkor = Math.max(
    Number(nudity.sexual_activity ?? 0),
    Number(nudity.sexual_display ?? 0),
    Number(nudity.erotica ?? 0),
    Number(nudity.raw ?? 0), // eski nudity-1.x API'lerle uyumluluk için
  );
  const nudityOrtaSkor = Number(nudity.very_suggestive ?? 0);

  if (nuditySertSkor >= ESIK.nuditySert) {
    nedenler.push("uygunsuz/müstehcen görsel");
  } else if (nudityOrtaSkor >= ESIK.nudityOrta) {
    nedenler.push("uygunsuz/açık saçık görsel");
  }

  const offensiveProb = json?.offensive?.prob ?? 0;
  if (typeof offensiveProb === "number" && offensiveProb >= ESIK.offensive) {
    nedenler.push("saldırgan/nefret içerikli görsel");
  }

  const gore = json?.gore ?? {};
  const goreClasses = gore.classes ?? {};
  const goreSertSkor = Math.max(
    Number(gore.prob ?? 0),
    Number(goreClasses.very_bloody ?? 0),
    Number(goreClasses.serious_injury ?? 0),
    Number(goreClasses.corpse ?? 0),
    Number(goreClasses.body_organ ?? 0),
  );
  const goreHafifSkor = Math.max(
    Number(goreClasses.slightly_bloody ?? 0),
    Number(goreClasses.superficial_injury ?? 0),
  );
  if (goreSertSkor >= ESIK.goreSert) {
    nedenler.push("kan/yaralanma içeren görsel");
  } else if (goreHafifSkor >= ESIK.goreHafif) {
    nedenler.push("açık yara/kan izi içeren görsel");
  }

  const violenceProb = json?.violence?.prob ?? 0;
  if (typeof violenceProb === "number" && violenceProb >= ESIK.violence) {
    nedenler.push("şiddet/kavga içeren görsel");
  }

  const weaponClasses = json?.weapon?.classes ?? {};
  const weaponSkor = Math.max(
    Number(weaponClasses.firearm ?? 0),
    Number(weaponClasses.firearm_gesture ?? 0),
    Number(weaponClasses.knife ?? 0),
  );
  const weaponOyuncakSkor = Number(weaponClasses.firearm_toy ?? 0);
  if (weaponSkor >= ESIK.weapon) {
    nedenler.push("silah içeren görsel");
  } else if (weaponOyuncakSkor >= ESIK.weaponOyuncak) {
    nedenler.push("silah (oyuncak/replika) içeren görsel");
  }

  return nedenler;
}

async function scanWithSightengine(imageUrl: string): Promise<string[]> {
  const apiUser = process.env.SIGHTENGINE_API_USER!.trim();
  const apiSecret = process.env.SIGHTENGINE_API_SECRET!.trim();

  const params = new URLSearchParams({
    url: imageUrl,
    models: SIGHTENGINE_MODELS,
    api_user: apiUser,
    api_secret: apiSecret,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`https://api.sightengine.com/1.0/check.json?${params.toString()}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error("Sightengine HTTP hatası", res.status, await res.text().catch(() => ""));
      return [];
    }
    const json = await res.json();
    if (json?.status === "failure") {
      console.error("Sightengine analiz hatası", json?.error);
      return [];
    }
    return checkSightengineResult(json);
  } catch (err) {
    clearTimeout(timeout);
    console.error("Sightengine isteği başarısız", err);
    return [];
  }
}

function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
  }
  console.error("CampusO görsel moderasyon hatası", error);
  return NextResponse.json(
    { ok: false, message: error instanceof Error ? error.message : "Bilinmeyen hata." },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  try {
    const actor = await authenticateRequest(request);

    const body = await request.json().catch(() => null);
    const items: Item[] = Array.isArray(body?.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json({ ok: true, flagged: false, nedenler: [] }, { headers: { "cache-control": "no-store" } });
    }

    // Sightengine hesabı henüz tanımlanmadıysa (env değişkenleri yoksa)
    // sistem "fail open" davranır: yükleme engellenmez ama durum açıkça
    // bildirilir ki admin farkında olsun.
    if (!sightengineConfigured()) {
      return NextResponse.json(
        {
          ok: true,
          flagged: false,
          nedenler: [],
          uyari: "Görsel moderasyon servisi (Sightengine) henüz yapılandırılmamış; görseller taranmadan kabul edildi.",
        },
        { headers: { "cache-control": "no-store" } },
      );
    }

    const sonuclar = await Promise.all(items.map((item) => scanWithSightengine(item.url)));
    const nedenler = Array.from(new Set(sonuclar.flat()));
    const flagged = nedenler.length > 0;

    if (flagged) {
      const supabase = serviceClient();
      const paths = items.map((item) => item.path).filter(Boolean);
      if (paths.length > 0) {
        const { error: removeError } = await supabase.storage.from("gonderi-gorselleri").remove(paths);
        if (removeError) {
          console.error("Uygunsuz görsel silinemedi", removeError);
        }
      }
      const { error: rpcError } = await supabase.rpc("campuso_ihlal_kaydet", {
        p_kullanici: actor.id,
        p_tip: "gorsel",
        p_detay: nedenler.join(", ").slice(0, 120),
      });
      if (rpcError) {
        console.error("Görsel ihlali kaydedilemedi", rpcError);
      }
    }

    return NextResponse.json({ ok: true, flagged, nedenler }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
