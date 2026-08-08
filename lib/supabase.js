import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

export async function getCampusSession() {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token || !session.user) return null

  let role = "student"
  let fullName = session.user.user_metadata?.full_name || ""
  if (session.user.email?.toLowerCase() === "suko.crc06@gmail.com") {
    role = "admin"
  } else {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", session.user.id)
      .maybeSingle()
    if (profile?.role === "academician") role = "academician"
    if (profile?.full_name) fullName = profile.full_name
  }

  return {
    accessToken: session.access_token,
    user: session.user,
    role,
    displayName: fullName || session.user.email?.split("@")[0] || "CampusO kullanıcısı",
  }
}

export async function fetchWithAuth(input, init = {}) {
  const session = await getCampusSession()
  if (!session?.accessToken) throw new Error("AUTH_REQUIRED")
  const headers = new Headers(init.headers || {})
  headers.set("authorization", `Bearer ${session.accessToken}`)
  return fetch(input, { ...init, headers })
}
