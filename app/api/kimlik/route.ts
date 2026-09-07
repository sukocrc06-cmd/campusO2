import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// /kimlik sayfası (QR ile açılan sanal öğrenci kimlik kartı) giriş yapmamış
// bir ziyaretçiden (telefon kamerası) geliyor, bu yüzden anon anahtarla
// profiles tablosunu doğrudan sorgulamak Supabase projesindeki RLS
// politikalarına takılabiliyordu (satırlar sessizce boş dönüyor, hata
// vermiyor). admin-set-password uç noktasındakiyle aynı deseni kullanıp
// service-role anahtarıyla RLS'i bypass ediyoruz, ama SADECE kimlik
// kartında zaten görünecek zararsız alanları (isim/bölüm/sınıf/öğrenci no/
// fotoğraf) döndürüyoruz — e-posta gibi hassas bir alan asla dönmüyor.
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = (searchParams.get("id") || "").trim();
  if (!id) {
    return NextResponse.json({ error: "id gerekli." }, { status: 400 });
  }

  const admin = serviceClient();
  if (!admin) {
    return NextResponse.json({ error: "Sunucu yapılandırılmamış." }, { status: 503 });
  }

  const { data, error } = await admin
    .from("profiles")
    .select("full_name, bolum, sinif, ogrenci_no, avatar_url, role")
    .eq("id", id)
    .maybeSingle();

  if (error || !data || data.role === "academician" || data.role === "admin") {
    return NextResponse.json({ error: "Kimlik bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({
    full_name: data.full_name ?? null,
    bolum: data.bolum ?? null,
    sinif: data.sinif ?? null,
    ogrenci_no: data.ogrenci_no ?? null,
    avatar_url: data.avatar_url ?? null,
  });
}
