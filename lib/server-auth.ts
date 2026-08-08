import { createClient, type User } from "@supabase/supabase-js";

export type CampusRole = "student" | "academician" | "admin";

export type CampusActor = {
  id: string;
  email: string;
  displayName: string;
  role: CampusRole;
};

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

function requiredEnvironment(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY") {
  const value = process.env[name]?.trim();
  if (!value) throw new AuthError("Kimlik doğrulama servisi yapılandırılmamış.", 503);
  return value;
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match?.[1]) throw new AuthError("Bu işlem için giriş yapmalısınız.");
  return match[1];
}

function adminEmails() {
  return new Set(
    `${process.env.CAMPUSO_ADMIN_EMAILS ?? ""},suko.crc06@gmail.com`
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function normalizedRole(value: unknown): CampusRole {
  if (value === "academician") return "academician";
  return "student";
}

function fallbackName(user: User) {
  const metadataName = typeof user.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name.trim()
    : "";
  return metadataName || user.email?.split("@")[0] || "CampusO kullanıcısı";
}

export async function authenticateRequest(request: Request): Promise<CampusActor> {
  const token = bearerToken(request);
  const supabase = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData.user;
  if (userError || !user?.id || !user.email) {
    throw new AuthError("Oturumunuz geçersiz veya süresi dolmuş. Lütfen yeniden giriş yapın.");
  }

  const normalizedEmail = user.email.toLowerCase();
  if (adminEmails().has(normalizedEmail)) {
    return { id: user.id, email: normalizedEmail, displayName: fallbackName(user), role: "admin" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = typeof profile?.full_name === "string" && profile.full_name.trim()
    ? profile.full_name.trim()
    : fallbackName(user);

  return {
    id: user.id,
    email: normalizedEmail,
    displayName,
    role: normalizedRole(profile?.role),
  };
}

export function requireRole(actor: CampusActor, allowed: CampusRole[]) {
  if (!allowed.includes(actor.role)) {
    throw new AuthError("Bu işlem için yetkiniz bulunmuyor.", 403);
  }
}
