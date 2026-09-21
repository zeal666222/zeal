"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkRateLimit, authLimiter } from "@/lib/rate-limit";

export type RegisterResult =
  | { ok: true; destination: string; needsConfirmation?: false }
  | { ok: true; needsConfirmation: true }
  | { ok: false; error: string; code: string };

export type LoginResult =
  | { ok: true; destination: string }
  | { ok: false; error: string; code: string };

const WEB_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

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

export async function registerAction(formData: FormData): Promise<RegisterResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!email || !password || !fullName) {
    return { ok: false, error: "All fields are required.", code: "VALIDATION" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Invalid email.", code: "VALIDATION" };
  }
  if (password.length < 12) {
    return { ok: false, error: "Password must be at least 12 characters.", code: "WEAK_PASSWORD" };
  }

  const ip = await getClientIp();
  const rl = await checkRateLimit(authLimiter, `register:${ip}`);
  if (!rl.ok) {
    return { ok: false, error: "Too many attempts. Wait a minute.", code: "RATE_LIMITED" };
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        account_type: "seeker",
      },
      emailRedirectTo: `${WEB_URL}/auth/callback`,
    },
  });

  if (error) {
    if (/already|exist/i.test(error.message)) {
      return { ok: false, error: "Email already registered.", code: "EMAIL_EXISTS" };
    }
    return { ok: false, error: error.message, code: "INTERNAL" };
  }
  if (!data.user) return { ok: false, error: "Signup failed.", code: "INTERNAL" };

  if (!data.session) return { ok: true, needsConfirmation: true };
  return { ok: true, destination: "/explore" };
}

export async function loginAction(formData: FormData): Promise<LoginResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "Email and password required.", code: "VALIDATION" };
  }

  const ip = await getClientIp();
  const rl = await checkRateLimit(authLimiter, `login:${ip}:${email}`);
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

  if (role !== "USER") {
    await supabase.auth.signOut();
    return {
      ok: false,
      error: "This account is for the Zeal Studio. Use the link below.",
      code: "WRONG_PORTAL_CONSULTANT",
    };
  }

  return { ok: true, destination: "/explore" };
}

export async function signOutAction(): Promise<void> {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
