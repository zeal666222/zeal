"use server";
// ═══════════════════════════════════════════════════════════════════════════════
// Auth actions — register, login, sign out
// ═══════════════════════════════════════════════════════════════════════════════
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ensureUserRow,
  syncAppMetadata,
  resolveDestination,
  type AppRole,
} from "@zeal/database/server";
import { generateAdminHandoff } from "@zeal/database/auth-handoff";
import { checkRateLimit, authLimiter } from "@/lib/rate-limit";

export type RegisterResult =
  | { ok: true; destination: string; needsConfirmation?: false }
  | { ok: true; needsConfirmation: true }
  | { ok: false; error: string; code: string };

export type LoginResult =
  | { ok: true; destination: string }
  | { ok: false; error: string; code: string };

const ADMIN_ROLES: AppRole[] = [
  "CLIENT_ADMIN", "SUPPORT", "ADMIN", "SUPER_ADMIN", "VIEWER",
];

async function userSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* RSC context */
          }
        },
      },
    },
  );
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    return (
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

// ─── Write attempt to canonical AdminLoginAttempt table ──────────────────────
async function recordAttempt(p: {
  email: string;
  ip: string;
  success: boolean;
  reason?: string;
}): Promise<void> {
  const admin = adminClient();
  if (!admin) return;
  try {
    await admin.from("AdminLoginAttempt").insert({
      email: p.email.toLowerCase(),
      ip: p.ip,
      success: p.success,
      reason: p.reason ?? null,
    });
  } catch {
    /* best-effort */
  }
}

// ─── REGISTER (seeker only) ──────────────────────────────────────────────────
export async function registerAction(formData: FormData): Promise<RegisterResult> {
  const ip = await clientIp();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!email || !password || !fullName) {
    return { ok: false, error: "All fields required.", code: "VALIDATION" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Invalid email.", code: "VALIDATION" };
  }
  if (password.length < 12) {
    return { ok: false, error: "Password must be 12+ chars.", code: "WEAK_PASSWORD" };
  }

  const rl = await checkRateLimit(authLimiter, `register:${ip}`);
  if (!rl.ok) {
    return { ok: false, error: "Too many attempts.", code: "RATE_LIMITED" };
  }

  try {
    const supabase = await userSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, account_type: "user" },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });

    if (error) {
      if (/already|exist/i.test(error.message)) {
        return { ok: false, error: "Email already registered.", code: "EMAIL_EXISTS" };
      }
      return { ok: false, error: error.message, code: "INTERNAL" };
    }
    if (!data.user) {
      return { ok: false, error: "Signup failed.", code: "INTERNAL" };
    }

    const { role } = await ensureUserRow(data.user);
    await syncAppMetadata(data.user.id, role, data.user.app_metadata);

    if (!data.session) return { ok: true, needsConfirmation: true };
    return { ok: true, destination: "/explore" };
  } catch (err) {
    console.error("[registerAction]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Registration failed",
      code: "INTERNAL",
    };
  }
}

// ─── LOGIN (seeker + handoff for consultant/admin) ───────────────────────────
export async function loginAction(formData: FormData): Promise<LoginResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const customRedirect = String(formData.get("redirectTo") ?? "");

  if (!email || !password) {
    return {
      ok: false,
      error: "Email and password are required.",
      code: "INVALID_CREDENTIALS",
    };
  }

  const rl = await checkRateLimit(authLimiter, `login:${email}`);
  if (!rl.ok) {
    return { ok: false, error: "Too many attempts. Wait a minute.", code: "RATE_LIMITED" };
  }

  try {
    const supabase = await userSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      await recordAttempt({
        email,
        ip: await clientIp(),
        success: false,
        reason: error?.message,
      });
      return {
        ok: false,
        error: "Email or password is incorrect.",
        code: "INVALID_CREDENTIALS",
      };
    }

    const { role } = await ensureUserRow(data.user);
    await syncAppMetadata(data.user.id, role, data.user.app_metadata);

    const { data: consultant } = await supabase
      .from("Consultant")
      .select("id")
      .eq("userId", data.user.id)
      .maybeSingle();
    const hasConsultant = Boolean(consultant?.id);

    // Consultant or admin → handoff to admin portal
    if (role === "CLIENT_ADMIN" || hasConsultant || ADMIN_ROLES.includes(role)) {
      const handoffUrl = await generateAdminHandoff(email);
      if (handoffUrl) return { ok: true, destination: handoffUrl };
      const adminUrl = (process.env.NEXT_PUBLIC_ADMIN_URL ?? "").replace(/\/$/, "");
      if (adminUrl) {
        return { ok: true, destination: `${adminUrl}/login?error=handoff_failed` };
      }
    }

    // Seeker → custom redirect or /explore
    const safeCustom =
      customRedirect &&
      customRedirect.startsWith("/") &&
      customRedirect !== "/login" &&
      customRedirect !== "/register" &&
      customRedirect !== "/";
    if (safeCustom) return { ok: true, destination: customRedirect };

    return {
      ok: true,
      destination: resolveDestination({ role, hasConsultant, portal: "web" }),
    };
  } catch (err) {
    console.error("[loginAction]", err);
    return { ok: false, error: "Login failed. Try again.", code: "INTERNAL" };
  }
}

// ─── SIGN OUT ───────────────────────────────────────────────────────────────
export async function signOutAction(): Promise<void> {
  try {
    const supabase = await userSupabase();
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("[signOutAction]", err);
  }
  redirect("/login");
}
