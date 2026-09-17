#!/usr/bin/env bash
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo /d/zeal)" || exit 1

G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; M=$'\033[35m'; B=$'\033[1m'; N=$'\033[0m'
[[ ! -t 1 ]] && { G=''; R=''; Y=''; M=''; B=''; N=''; }

OK()   { printf "${G}OK${N}   %s\n" "$1"; }
BAD()  { printf "${R}FAIL${N} %s\n" "$1"; }
FIX()  { printf "${M}FIX${N}  %s\n" "$1"; }
HEAD() { printf "\n${B}══ %s ══${N}\n" "$1"; }

FAILED=0
TS=$(date +%s)
BK="_archive/fix-${TS}"
mkdir -p "$BK"

# ═══════════════════════════════════════════════════════════════════════
HEAD "Phase 2/3 file writes"

write_file() {
  local target="$1"
  local tmp="${target}.tmp.$$"
  mkdir -p "$(dirname "$target")"
  cat > "$tmp"
  if [[ ! -s "$tmp" ]]; then
    rm -f "$tmp"
    BAD "$target — empty write"
    FAILED=1
    return 1
  fi
  [[ -f "$target" ]] && cp "$target" "$BK/$(basename "$target").bak" 2>/dev/null
  mv "$tmp" "$target"
  local lines
  lines=$(wc -l < "$target" | tr -d '[:space:]')
  FIX "$target ($lines lines)"
  return 0
}

# ─── 1. server.ts auth core ─────────────────────────────────────────────
if ! grep -q 'export async function ensureUserRow' packages/database/src/server.ts 2>/dev/null; then
  cp packages/database/src/server.ts "$BK/server.ts.bak" 2>/dev/null
  cat >> packages/database/src/server.ts << 'SRV_END'

// ═══════════════════════════════════════════════════════════════════════
// SHARED AUTH CORE
// ═══════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "@supabase/supabase-js";

export type AppRole =
  | "USER" | "CLIENT_ADMIN" | "SUPPORT" | "ADMIN" | "SUPER_ADMIN" | "VIEWER" | "AI";

const ADMIN_ROLES: readonly AppRole[] = ["SUPPORT", "ADMIN", "SUPER_ADMIN", "VIEWER"] as const;
const CONSULTANT_ROLES: readonly AppRole[] = ["CLIENT_ADMIN", ...ADMIN_ROLES] as const;
const PRIVILEGED_SEED_ROLES: readonly AppRole[] = ["CLIENT_ADMIN", ...ADMIN_ROLES] as const;

export interface SupaUserShape {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}
export interface EnsureUserResult { role: AppRole; isNew: boolean; userId: string; }
export interface EnsureConsultantResult { id: string; isNew: boolean; subdomain: string; }
export interface CompletenessCheck {
  id: string; label: string; weight: number; passed: boolean; actionHref: string;
}
export interface CompletenessReport { score: number; isLive: boolean; checks: CompletenessCheck[]; }

let _idClient: SupabaseClient | null = null;
function identityClient(): SupabaseClient {
  if (_idClient) return _idClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("[auth-core] Missing Supabase env");
  _idClient = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return _idClient;
}

function safeBase(email: string): string {
  const l = (email.split("@")[0] ?? "user").toLowerCase().replace(/[^a-z0-9_]/g, "");
  return (l.length >= 3 ? l : `user${l}`).slice(0, 24);
}
function slugifyConsultant(n: string): string {
  const s = n.toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s-]/g, "")
    .trim().replace(/\s+/g, "-").replace(/-+/g, "-")
    .slice(0, 24).replace(/^-|-$/g, "");
  return s.length >= 3 ? s : "guide";
}
function shortId(u: string, len: number): string { return u.replace(/-/g, "").slice(0, len); }

async function ensureWalletRow(userId: string): Promise<void> {
  const a = identityClient();
  const { data } = await a.from("Wallet").select("id").eq("userId", userId).maybeSingle();
  if (data) return;
  const { error } = await a.from("Wallet").insert({
    userId, balance: 0, escrow: 0, pendingIn: 0, pendingOut: 0, blocked: 0,
  });
  if (error && error.code !== "23505") console.warn("[ensureWalletRow]", error.message);
}

export async function ensureUserRow(supaUser: SupaUserShape): Promise<EnsureUserResult> {
  const admin = identityClient();
  const email = supaUser.email ?? "";
  const meta = supaUser.user_metadata ?? {};
  const appMeta = supaUser.app_metadata ?? {};

  const fullName =
    (typeof meta.full_name === "string" ? meta.full_name : null) ??
    (typeof meta.name === "string" ? meta.name : null);
  const avatar = typeof meta.avatar_url === "string" ? meta.avatar_url : null;

  const { data: existing } = await admin
    .from("User").select("id, role").eq("id", supaUser.id).maybeSingle();

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (email) patch.email = email;
    if (fullName) { patch.name = fullName; patch.full_name = fullName; }
    if (avatar) { patch.avatar = avatar; patch.avatar_url = avatar; }
    if (Object.keys(patch).length > 0) {
      await admin.from("User").update(patch).eq("id", supaUser.id);
    }
    await ensureWalletRow(supaUser.id);
    return { role: ((existing.role as AppRole) ?? "USER"), isNew: false, userId: supaUser.id };
  }

  const appRole = String(appMeta.role ?? "").toUpperCase() as AppRole;
  const seedRole: AppRole = PRIVILEGED_SEED_ROLES.includes(appRole) ? appRole : "USER";
  const base = safeBase(email);
  const stable = shortId(supaUser.id, 6);

  for (let attempt = 0; attempt < 4; attempt++) {
    const uname = attempt === 0 ? `${base}_${stable}`
      : `${base}_${Math.random().toString(36).slice(2, 8)}`;

    const { data, error } = await admin.from("User").insert({
      id: supaUser.id, email, username: uname,
      name: fullName, full_name: fullName,
      avatar, avatar_url: avatar,
      role: seedRole, sparks: 100,
      isVerified: false, is_online: false,
    }).select("role").single();

    if (!error && data) {
      await ensureWalletRow(supaUser.id);
      return { role: ((data.role as AppRole) ?? "USER"), isNew: true, userId: supaUser.id };
    }
    if (error?.code === "23505") {
      const { data: race } = await admin
        .from("User").select("role").eq("id", supaUser.id).maybeSingle();
      if (race) {
        await ensureWalletRow(supaUser.id);
        return { role: ((race.role as AppRole) ?? "USER"), isNew: false, userId: supaUser.id };
      }
      continue;
    }
    throw new Error(`[ensureUserRow] ${error?.message ?? "unknown"}`);
  }
  throw new Error("[ensureUserRow] retries exhausted");
}

export async function ensureConsultantRow(
  supaUser: SupaUserShape,
  opts: { category?: string; rate?: number } = {}
): Promise<EnsureConsultantResult> {
  const admin = identityClient();
  const { data: existing } = await admin
    .from("Consultant").select("id, subdomain").eq("userId", supaUser.id).maybeSingle();
  if (existing) return { id: existing.id, isNew: false, subdomain: existing.subdomain ?? "" };

  const meta = supaUser.user_metadata ?? {};
  const displayName = (typeof meta.full_name === "string" ? meta.full_name : null)
    ?? (typeof meta.name === "string" ? meta.name : null) ?? "consultant";
  const suffix = shortId(supaUser.id, 4);
  const subdomain = `${slugifyConsultant(displayName)}-${suffix}`;

  const { data, error } = await admin.from("Consultant").insert({
    userId: supaUser.id,
    category: opts.category ?? "ASTROLOGER",
    specialties: [], languages: ["English"], bio: null,
    perMinuteRate: opts.rate ?? 50, availability: {},
    status: "VERIFIED", isVerified: true, isActive: true,
    subdomain, subdomainActive: true, whiteLabelEnabled: true,
    rating: 5.0, totalConsultations: 0, sparkScore: 0, bufferMinutes: 10,
  }).select("id, subdomain").single();

  if (error) {
    if (error.code === "23505") {
      const { data: race } = await admin
        .from("Consultant").select("id, subdomain").eq("userId", supaUser.id).maybeSingle();
      if (race) return { id: race.id, isNew: false, subdomain: race.subdomain ?? "" };
    }
    throw new Error(`[ensureConsultantRow] ${error.message}`);
  }
  return { id: data!.id, isNew: true, subdomain: data!.subdomain ?? subdomain };
}

export async function syncAppMetadata(
  userId: string, role: AppRole, currentMeta: Record<string, unknown> | undefined
): Promise<void> {
  if ((currentMeta?.role as string) === role) return;
  try {
    const admin = identityClient();
    await admin.auth.admin.updateUserById(userId, {
      app_metadata: { ...(currentMeta ?? {}), role },
    });
  } catch (err) { console.warn("[syncAppMetadata]", err); }
}

export function resolveDestination(params: { role: AppRole; hasConsultant: boolean }): string {
  const { role, hasConsultant } = params;
  if (ADMIN_ROLES.includes(role)) {
    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL?.replace(/\/$/, "");
    return adminUrl ? `${adminUrl}/dashboard` : "/";
  }
  if (role === "CLIENT_ADMIN" || hasConsultant) return "/consultant/dashboard";
  return "/explore";
}

export function isAdminRole(role: string | null | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role as AppRole);
}
export function isConsultantRole(role: string | null | undefined): boolean {
  return !!role && CONSULTANT_ROLES.includes(role as AppRole);
}

interface ConsultantShape {
  bio?: string | null; perMinuteRate?: number | null;
  specialties?: string[] | null; languages?: string[] | null;
  availability?: unknown; category?: string | null;
}

export function evaluateConsultantProfile(c: ConsultantShape | null): CompletenessReport {
  if (!c) return { score: 0, isLive: false, checks: [] };
  const bioOk = (c.bio ?? "").trim().length >= 20;
  const rateOk = (c.perMinuteRate ?? 0) >= 10;
  const specOk = (c.specialties ?? []).length >= 1;
  const langOk = (c.languages ?? []).length >= 1;
  const catOk = Boolean(c.category);
  const availOk = (() => {
    const a = c.availability;
    if (!a || typeof a !== "object") return false;
    return Object.values(a as Record<string, unknown>).some(
      (b) => Array.isArray(b) && b.length > 0
    );
  })();
  const checks: CompletenessCheck[] = [
    { id: "bio",          label: "Professional bio (20+ chars)", weight: 25, passed: bioOk,   actionHref: "/apply?step=3" },
    { id: "rate",         label: "Per-minute rate configured",   weight: 15, passed: rateOk,  actionHref: "/apply?step=2" },
    { id: "specialties",  label: "At least one specialty",       weight: 15, passed: specOk,  actionHref: "/apply?step=1" },
    { id: "availability", label: "Weekly availability set",      weight: 20, passed: availOk, actionHref: "/consultant/availability" },
    { id: "languages",    label: "Languages configured",         weight: 10, passed: langOk,  actionHref: "/apply?step=1" },
    { id: "category",     label: "Primary category selected",    weight:  5, passed: catOk,   actionHref: "/apply?step=1" },
  ];
  const score = checks.reduce((s, c) => (c.passed ? s + c.weight : s), 0);
  const critical = bioOk && rateOk && specOk;
  return { score, isLive: critical && score >= 60, checks };
}
SRV_END
  FIX "server.ts auth core appended"
else
  OK "server.ts already has auth core"
fi

# ─── 2. apps/web/actions/auth.ts ────────────────────────────────────────
if ! grep -q 'export type LoginResult' apps/web/actions/auth.ts 2>/dev/null; then
  write_file apps/web/actions/auth.ts << 'WEB_AUTH_END'
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

export type LoginErrorCode = "INVALID_CREDENTIALS" | "RATE_LIMITED" | "INTERNAL";

export type LoginResult =
  | { ok: true; destination: string }
  | { ok: false; error: string; code: LoginErrorCode };

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
            /* RSC context — safe */
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
  } catch {
    /* best-effort */
  }
}

export async function registerAction(formData: FormData): Promise<RegisterResult> {
  const ip = await clientIp();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const accountType = String(formData.get("accountType") ?? "user") as
    | "user"
    | "consultant";

  if (!email || !password || !fullName) {
    return { ok: false, error: "All fields are required.", code: "VALIDATION" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Invalid email address.", code: "VALIDATION" };
  }
  if (password.length < 12) {
    return {
      ok: false,
      error: "Password must be at least 12 characters.",
      code: "WEAK_PASSWORD",
    };
  }
  if (accountType !== "user" && accountType !== "consultant") {
    return { ok: false, error: "Invalid account type.", code: "VALIDATION" };
  }

  const rl = await checkRateLimit(authLimiter, `register:${ip}`);
  if (!rl.ok) {
    return {
      ok: false,
      error: "Too many attempts. Try again in a minute.",
      code: "RATE_LIMITED",
    };
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
        return {
          ok: false,
          error: "An account with this email already exists.",
          code: "EMAIL_EXISTS",
        };
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

    if (!data.session) {
      return { ok: true, needsConfirmation: true };
    }

    return {
      ok: true,
      destination: resolveDestination({ role: effectiveRole, hasConsultant }),
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
    return {
      ok: false,
      error: "Too many attempts. Please wait a minute.",
      code: "RATE_LIMITED",
    };
  }

  try {
    const supabase = await userSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

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

    const safeCustom =
      customRedirect &&
      customRedirect.startsWith("/") &&
      customRedirect !== "/login" &&
      customRedirect !== "/register" &&
      customRedirect !== "/";

    if (role === "USER" && !consultant && safeCustom) {
      return { ok: true, destination: customRedirect };
    }

    return {
      ok: true,
      destination: resolveDestination({ role, hasConsultant: !!consultant }),
    };
  } catch (err) {
    console.error("[loginAction]", err);
    return {
      ok: false,
      error: "Login failed. Please try again.",
      code: "INTERNAL",
    };
  }
}

export async function signOutAction(): Promise<void> {
  try {
    const supabase = await userSupabase();
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("[signOutAction]", err);
  }
  redirect("/login");
}
WEB_AUTH_END
  [[ -f apps/web/actions/auth.ts ]] && grep -q 'export type LoginResult' apps/web/actions/auth.ts && OK "actions/auth.ts verified" || { BAD "actions/auth.ts verification failed"; FAILED=1; }
else
  OK "actions/auth.ts already has LoginResult"
fi

# ─── 3. apps/web/lib/auth/server.ts ─────────────────────────────────────
if ! grep -q 'from "@zeal/database/server"' apps/web/lib/auth/server.ts 2>/dev/null; then
  write_file apps/web/lib/auth/server.ts << 'LIB_AUTH_END'
import { createClient } from "@zeal/database/server";
import {
  ensureUserRow,
  ensureConsultantRow,
  resolveDestination,
  syncAppMetadata,
  isAdminRole,
  isConsultantRole,
  evaluateConsultantProfile,
  type AppRole,
  type SupaUserShape,
  type EnsureUserResult,
  type EnsureConsultantResult,
  type CompletenessReport,
} from "@zeal/database/server";

export {
  ensureUserRow,
  ensureConsultantRow,
  resolveDestination,
  syncAppMetadata,
  isAdminRole,
  isConsultantRole,
  evaluateConsultantProfile,
};
export type {
  AppRole,
  SupaUserShape,
  EnsureUserResult,
  EnsureConsultantResult,
  CompletenessReport,
};

export async function getUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    if (!supabase) return null;
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return null;
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function getServerSession() {
  try {
    const supabase = await createClient();
    if (!supabase) return { user: null, session: null };
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) return { user: null, session: null };
    return { user: session?.user ?? null, session: session ?? null };
  } catch {
    return { user: null, session: null };
  }
}

export interface SyncResult {
  ok: boolean;
  role: AppRole;
  isNew: boolean;
  redirectTo: string;
  error?: string;
}

export async function syncAuthUser(): Promise<SyncResult> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return {
        ok: false,
        role: "USER",
        isNew: false,
        redirectTo: "/login",
        error: "Unauthorized",
      };
    }
    const { role, isNew } = await ensureUserRow(user);
    await syncAppMetadata(user.id, role, user.app_metadata);
    const { data: consultant } = await supabase
      .from("Consultant")
      .select("id")
      .eq("userId", user.id)
      .maybeSingle();
    return {
      ok: true,
      role,
      isNew,
      redirectTo: resolveDestination({ role, hasConsultant: !!consultant }),
    };
  } catch (err) {
    return {
      ok: false,
      role: "USER",
      isNew: false,
      redirectTo: "/login",
      error: err instanceof Error ? err.message : "sync failed",
    };
  }
}
LIB_AUTH_END
  OK "lib/auth/server.ts written"
else
  OK "lib/auth/server.ts already correct"
fi

# ─── 4. apps/admin/actions/auth.ts ──────────────────────────────────────
if ! grep -q 'export async function adminLoginAction' apps/admin/actions/auth.ts 2>/dev/null; then
  write_file apps/admin/actions/auth.ts << 'ADMIN_AUTH_END'
"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ensureUserRow,
  syncAppMetadata,
  type AppRole,
} from "@zeal/database/server";

const ALLOWED: readonly AppRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "SUPPORT",
  "VIEWER",
] as const;

export type AdminLoginResult =
  | { ok: true; destination: string; role: AppRole }
  | { ok: false; error: string };

async function supabaseServer() {
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
            /* RSC */
          }
        },
      },
    },
  );
}

async function writeAudit(params: {
  action: string;
  outcome: "SUCCESS" | "FAILURE" | "DENIED";
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  reason?: string;
}): Promise<void> {
  try {
    const { createAdminClient } = await import("@zeal/database/server");
    const admin = createAdminClient();
    await admin.from("AdminAuditLog").insert({
      userId: params.actorId ?? null,
      email: params.actorEmail ?? null,
      action: params.action,
      targetType: "admin_auth",
      targetId: params.actorId ?? null,
      metadata: {
        outcome: params.outcome,
        role: params.actorRole,
        reason: params.reason,
      } as never,
      success: params.outcome === "SUCCESS",
    });
  } catch (err) {
    console.warn("[admin-audit]", err);
  }
}

export async function adminLoginAction(
  formData: FormData,
): Promise<AdminLoginResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "Credentials required." };
  }

  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      await writeAudit({
        action: "admin_login",
        outcome: "FAILURE",
        actorEmail: email,
        reason: error?.message ?? "invalid_credentials",
      });
      return { ok: false, error: "Invalid credentials." };
    }

    const { role } = await ensureUserRow(data.user);
    await syncAppMetadata(data.user.id, role, data.user.app_metadata);

    if (!ALLOWED.includes(role)) {
      await supabase.auth.signOut();
      await writeAudit({
        action: "admin_login",
        outcome: "DENIED",
        actorId: data.user.id,
        actorEmail: email,
        actorRole: role,
        reason: "role_not_allowed",
      });
      return { ok: false, error: "Unauthorized. Admin access only." };
    }

    await writeAudit({
      action: "admin_login",
      outcome: "SUCCESS",
      actorId: data.user.id,
      actorEmail: email,
      actorRole: role,
    });

    return { ok: true, destination: "/dashboard", role };
  } catch (err) {
    console.error("[adminLoginAction]", err);
    await writeAudit({
      action: "admin_login",
      outcome: "FAILURE",
      actorEmail: email,
      reason: err instanceof Error ? err.message : "unknown",
    });
    return { ok: false, error: "Authentication failed." };
  }
}

export async function adminSignOutAction(): Promise<void> {
  try {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("[adminSignOutAction]", err);
  }
  redirect("/login");
}
ADMIN_AUTH_END
  OK "admin/actions/auth.ts written"
else
  OK "admin/actions/auth.ts already correct"
fi

# ═══════════════════════════════════════════════════════════════════════
HEAD "Typecheck gate"

tsc_ws() {
  local ws="$1"
  local log="/tmp/zeal-tsc-$$.log"
  pushd "$ws" >/dev/null 2>&1 || return 1
  npx --no-install tsc --noEmit --pretty false > "$log" 2>&1
  local rc=$?
  popd >/dev/null 2>&1
  if [[ $rc -ne 0 ]]; then
    local n
    n=$(grep -c 'error TS' "$log" 2>/dev/null | tr -d '[:space:]')
    [[ -z "$n" ]] && n=0
    BAD "$ws — $n errors"
    grep 'error TS' "$log" 2>/dev/null | head -12 | sed 's/^/     /'
    FAILED=1
    return 1
  fi
  OK "$ws clean"
  return 0
}

tsc_ws packages/database
tsc_ws apps/web
tsc_ws apps/admin

# ═══════════════════════════════════════════════════════════════════════
HEAD "Result"

if [[ $FAILED -eq 0 ]]; then
  git add -A 2>/dev/null || true
  git reset -- _archive/ .zeal/ 2>/dev/null || true
  staged=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d '[:space:]')
  if [[ "${staged:-0}" -gt 0 ]]; then
    git commit -m "Fix auth: discriminated union results + shared core

- packages/database/src/server.ts: ensureUserRow, ensureConsultantRow,
  resolveDestination, syncAppMetadata, evaluateConsultantProfile
- apps/web/actions/auth.ts: typed LoginResult / RegisterResult
- apps/web/lib/auth/server.ts: thin delegation
- apps/admin/actions/auth.ts: admin login bootstrap

All workspaces typecheck clean." >/tmp/zeal-commit.log 2>&1 \
      && OK "committed $(git rev-parse --short HEAD)" \
      || BAD "commit failed"

    br=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)
    up=$(git log --oneline "@{u}..HEAD" 2>/dev/null | wc -l | tr -d '[:space:]')
    if [[ "${up:-0}" -gt 0 ]]; then
      git push origin "$br" >/dev/null 2>&1 && OK "pushed origin/$br" || BAD "push failed"
    fi
  else
    OK "no changes to commit"
  fi
  exit 0
else
  BAD "typecheck failed — nothing committed"
  exit 1
fi
