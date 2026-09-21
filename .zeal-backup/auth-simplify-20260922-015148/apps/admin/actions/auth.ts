"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkRateLimit, authLimiter } from "@/lib/rate-limit";

const ADMIN_PORTAL_ROLES = new Set([
  "CLIENT_ADMIN", "SUPPORT", "ADMIN", "SUPER_ADMIN", "VIEWER",
]);

export type AdminLoginResult =
  | { ok: true; destination: string }
  | { ok: false; error: string; code: string };

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch { /* RSC */ }
        },
      },
    },
  );
}

async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    return (
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      "unknown"
    );
  } catch { return "unknown"; }
}

export async function adminLoginAction(
  formData: FormData,
): Promise<AdminLoginResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "Email and password required.", code: "VALIDATION" };
  }

  const ip = await getClientIp();
  const rl = await checkRateLimit(authLimiter, `admin-login:${ip}:${email}`);
  if (!rl.ok) {
    return { ok: false, error: "Too many attempts. Please wait a minute.", code: "RATE_LIMITED" };
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { ok: false, error: "Invalid email or password.", code: "INVALID_CREDENTIALS" };
  }

  const role = String(
    (data.user as unknown as { user_role?: string }).user_role ??
    data.user.app_metadata?.role ??
    "USER",
  ).toUpperCase();

  if (!ADMIN_PORTAL_ROLES.has(role)) {
    await supabase.auth.signOut();
    return {
      ok: false,
      error: "This account is for the Zeal seeker app. Use the link below.",
      code: "WRONG_PORTAL_SEEKER",
    };
  }

  const destination = role === "CLIENT_ADMIN" ? "/consultant/dashboard" : "/dashboard";
  return { ok: true, destination };
}

export async function adminSignOutAction(): Promise<void> {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
