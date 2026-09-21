// Centralized, null-safe env access. Never throws at import time.
// Missing env is tolerated in dev; the app degrades gracefully.

export const env = {
  supabaseUrl:      (process.env.NEXT_PUBLIC_SUPABASE_URL      ?? "").trim(),
  supabaseAnonKey:  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
  appUrl:           (process.env.NEXT_PUBLIC_APP_URL   ?? "").replace(/\/$/, ""),
  adminUrl:         (process.env.NEXT_PUBLIC_ADMIN_URL ?? "").replace(/\/$/, ""),
  isDev:            process.env.NODE_ENV !== "production",
  isProd:           process.env.NODE_ENV === "production",
} as const;

export function hasSupabaseEnv(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
