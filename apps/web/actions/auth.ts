"use server";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ensureUserRow,
  ensureConsultantRow,
  resolveDestination,
  syncAppMetadata,
  type AppRole,
} from "@zeal/database/server";
import { checkRateLimit, authLimiter } from "@/lib/rate-limit";

export type RegisterErrorCode =
  | "VALIDATION"
  | "WEAK_PASSWORD"
  | "EMAIL_EXISTS"
  | "RATE_LIMITED"
  | "INTERNAL";

export type RegisterResult =
  | { ok: true; destination: string; needsConfirmation?: false }
  | { ok: true; needsConfirmation: true }
  | { ok: false; error: string; code: RegisterErrorCode };

export type LoginErrorCode = "INVALID_CREDENTIALS" | "RATE_LIMITED" | "INTERNAL" | "NOT_AUTHORIZED";

export type LoginResult =
  | { ok: true; destination: string }
  | { ok: false; error: string; code: LoginErrorCode };

// ─── Supabase clients ─────────────────────────────────────────────────────────
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
              cookieStore.set(name, value, options)
            );
          } catch { /* RSC context — safe */ }
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

async function recordAttempt(params: {
  email: string;
  ip: string;
  success: boolean;
  reason?: string;
}): Promise<void> {
  const admin = adminClient();
  if (!admin) return;
  try {
    await admin.from("auth_attempts").insert({
      email: params.email.toLowerCase(),
      ip: params.ip,
      success: params.success,
      reason: params.reason ?? null,
    });
  } catch { /* best-effort */ }
}

/**
 * Generate a magic-link handoff token that lands on the admin portal.
 * The admin app consumes it via verifyOtp() to create a session on that domain.
 */
async function generateAdminHandoff(email: string): Promise<string | null> {
  const admin = adminClient();
  if (!admin) return null;
  const adminUrl = (process.env.NEXT_PUBLIC_ADMIN_URL ?? "").replace(/\/$/, "");
  if (!adminUrl) return null;

  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${adminUrl}/auth/handoff` },
    });
    if (error || !data?.properties?.hashed_token) return null;

    const url = new URL(`${adminUrl}/auth/handoff`);
    url.searchParams.set("token_hash", data.properties.hashed_token);
    url.searchParams.set("type", "magiclink");
    return url.toString();
  } catch (err) {
    console.warn("[handoff] generateLink failed:", err);
    return null;
  }
}

// ─── registerAction ───────────────────────────────────────────────────────────
export async function registerAction(formData: FormData): Promise<RegisterResult> {
  const ip = await clientIp();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const accountType = String(formData.get("accountType") ?? "user") as "user" | "consultant";

  if (!email || !password || !fullName) {
    return { ok: false, error: "All fields are required.", code: "VALIDATION" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Invalid email address.", code: "VALIDATION" };
  }
  if (password.length < 12) {
    return { ok: false, error: "Password must be at least 12 characters.", code: "WEAK_PASSWORD" };
  }
  if (accountType !== "user" && accountType !== "consultant") {
    return { ok: false, error: "Invalid account type.", code: "VALIDATION" };
  }

  const rl = await checkRateLimit(authLimiter, `register:${ip}`);
  if (!rl.ok) {
    return { ok: false, error: "Too many attempts. Try again in a minute.", code: "RATE_LIMITED" };
  }

  try {
    const supabase = await userSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, account_type: accountType } },
    });

    if (error) {
      const lower = error.message.toLowerCase();
      if (lower.includes("already") || lower.includes("exist")) {
        return { ok: false, error: "An account with this email already exists.", code: "EMAIL_EXISTS" };
      }
      return { ok: false, error: error.message, code: "INTERNAL" };
    }
    if (!data.user) {
      return { ok: false, error: "Signup failed.", code: "INTERNAL" };
    }

    const { role } = await ensureUserRow(data.user);
    let effectiveRole: AppRole = role;
    let hasConsultant = false;

    if (accountType === "consultant") {
      await ensureConsultantRow(data.user);
      hasConsultant = true;
      effectiveRole = "CLIENT_ADMIN";
      await syncAppMetadata(data.user.id, "CLIENT_ADMIN", data.user.app_metadata);
    } else {
      await syncAppMetadata(data.user.id, role, data.user.app_metadata);
    }

    // No session yet (email confirmation required) — user must confirm then log in
    if (!data.session) {
      return { ok: true, needsConfirmation: true };
    }

    // Consultant with session → handoff to admin portal
    if (accountType === "consultant") {
      const handoffUrl = await generateAdminHandoff(email);
      if (handoffUrl) {
        return { ok: true, destination: handoffUrl };
      }
      // Fallback: absolute destination for next login
      return {
        ok: true,
        destination: resolveDestination({ role: effectiveRole, hasConsultant, portal: "web" }),
      };
    }

    return {
      ok: true,
      destination: resolveDestination({ role: effectiveRole, hasConsultant, portal: "web" }),
    };
  } catch (err) {
    console.error("[registerAction]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Registration failed.",
      code: "INTERNAL",
    };
  }
}

// ─── loginAction ──────────────────────────────────────────────────────────────
export async function loginAction(formData: FormData): Promise<LoginResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const customRedirect = String(formData.get("redirectTo") ?? "");

  if (!email || !password) {
    return { ok: false, error: "Email and password are required.", code: "INVALID_CREDENTIALS" };
  }

  const rl = await checkRateLimit(authLimiter, `login:${email}`);
  if (!rl.ok) {
    return { ok: false, error: "Too many attempts. Please wait a minute.", code: "RATE_LIMITED" };
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
      return { ok: false, error: "Email or password is incorrect.", code: "INVALID_CREDENTIALS" };
    }

    const { role } = await ensureUserRow(data.user);
    await syncAppMetadata(data.user.id, role, data.user.app_metadata);

    const { data: consultant } = await supabase
      .from("Consultant")
      .select("id")
      .eq("userId", data.user.id)
      .maybeSingle();

    const hasConsultant = Boolean(consultant?.id);

    // Consultant logging in on web → handoff to admin portal
    if (role === "CLIENT_ADMIN" || hasConsultant) {
      const handoffUrl = await generateAdminHandoff(email);
      if (handoffUrl) {
        return { ok: true, destination: handoffUrl };
      }
    }

    const safeCustom =
      customRedirect &&
      customRedirect.startsWith("/") &&
      customRedirect !== "/login" &&
      customRedirect !== "/register" &&
      customRedirect !== "/";

    if (role === "USER" && !hasConsultant && safeCustom) {
      return { ok: true, destination: customRedirect };
    }

    return {
      ok: true,
      destination: resolveDestination({ role, hasConsultant, portal: "web" }),
    };
  } catch (err) {
    console.error("[loginAction]", err);
    return { ok: false, error: "Login failed. Please try again.", code: "INTERNAL" };
  }
}

// ─── signOutAction ────────────────────────────────────────────────────────────
export async function signOutAction(): Promise<void> {
  try {
    const supabase = await userSupabase();
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("[signOutAction]", err);
  }
  redirect("/login");
}
