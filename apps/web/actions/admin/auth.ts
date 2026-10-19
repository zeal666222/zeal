"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkRateLimit, authLimiter } from "@/lib/admin/rate-limit";

const ADMIN_PORTAL_ROLES = new Set([
  "CLIENT_ADMIN",
  "SUPPORT",
  "ADMIN",
  "SUPER_ADMIN",
  "VIEWER",
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
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* RSC */
          }
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
  } catch {
    return "unknown";
  }
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
    return {
      ok: false,
      error: "Too many attempts. Please wait a minute.",
      code: "RATE_LIMITED",
    };
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { ok: false, error: "Invalid email or password.", code: "INVALID_CREDENTIALS" };
  }

  // ─── Read role from the DB. This is the ONLY source of truth. ────────────
  const { data: profile } = await supabase
    .from("User")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  const role = String(profile?.role ?? "USER").toUpperCase();

  if (!ADMIN_PORTAL_ROLES.has(role)) {
    await supabase.auth.signOut();
    return {
      ok: false,
      error: "This account is for the Zeal seeker app. Use the link below.",
      code: "WRONG_PORTAL_SEEKER",
    };
  }

  const destination =
    (data.user.user_metadata as Record<string, unknown> | undefined)?.must_change_password === true
      ? "/admin/change-temporary-password"
      : role === "CLIENT_ADMIN"
        ? "/admin/consultant/dashboard"
        : "/admin/dashboard";

  return { ok: true, destination };
}

export async function adminSignOutAction(): Promise<void> {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// ─── Forced rotation for bootstrap-issued SUPER_ADMIN credentials ────────────
// Mirrors scripts/bootstrap-super-admin.mjs password policy so the same
// rejection reasons apply whether the operator generated or supplied the value.
export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; error: string; issues?: string[] };

function validateRotation(pw: string, email: string): string[] {
  const problems: string[] = [];
  if (pw.length < 20) problems.push("at least 20 characters");
  if (!/[a-z]/.test(pw)) problems.push("one lowercase letter");
  if (!/[A-Z]/.test(pw)) problems.push("one uppercase letter");
  if (!/\d/.test(pw)) problems.push("one digit");
  if (!/[^A-Za-z0-9]/.test(pw)) problems.push("one symbol");
  const [local, domain = ""] = email.toLowerCase().split("@");
  const low = pw.toLowerCase();
  const banned = [
    local,
    domain,
    domain.split(".")[0],
    "password", "admin", "superadmin", "super", "zeal", "zealer",
    "123456", "qwerty", "letmein", "welcome", "iloveyou",
  ];
  for (const b of banned) {
    if (b && b.length >= 3 && low.includes(b)) {
      problems.push(`must not contain "${b}"`);
      break;
    }
  }
  return problems;
}

export async function changeTemporaryPasswordAction(
  formData: FormData,
): Promise<ChangePasswordResult> {
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next !== confirm) {
    return { ok: false, error: "New password and confirmation do not match." };
  }

  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return { ok: false, error: "Session expired. Please sign in again." };
  }

  const issues = validateRotation(next, user.email);
  if (issues.length) {
    return {
      ok: false,
      error: "Password does not meet the SUPER_ADMIN policy.",
      issues,
    };
  }

  const { error: pwErr } = await supabase.auth.updateUser({ password: next });
  if (pwErr) {
    return { ok: false, error: pwErr.message };
  }

  // Clear the flag in the SAME user_metadata blob so we don't clobber name /
  // bootstrapped_at. Supabase will not accept app_metadata writes from the
  // client — that's why the bootstrap script parks the flag in user_metadata.
  const nextMeta = { ...(user.user_metadata ?? {}), must_change_password: false };
  delete (nextMeta as Record<string, unknown>).bootstrapped_at;
  const { error: metaErr } = await supabase.auth.updateUser({ data: nextMeta });
  if (metaErr) {
    // Password rotated but flag stuck — operator can still log in and retry.
    return {
      ok: false,
      error: "Password updated, but the forced-rotation flag could not be cleared. Sign out and back in to verify.",
    };
  }

  return { ok: true };
}
