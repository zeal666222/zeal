// packages/database/src/server.ts
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Server-only database exports
// ═══════════════════════════════════════════════════════════════════════════════
// Import path: '@zeal/database/server'
// This file uses "server-only" to guarantee it never lands in a client bundle.
// ═══════════════════════════════════════════════════════════════════════════════

import "server-only";
import { cookies } from "next/headers";
import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@zeal/types";

// Re-export client-safe helpers so server code has a single import path
export {
  createAnonClient,
  getBrowserClient,
  prisma,
  withTransaction,
} from "./client";
export * from "@zeal/types";

// ─── Admin (service role) ────────────────────────────────────────────────────
export function createAdminClient(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "build-dummy-service-key";
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const getAdminClient = (): any => createAdminClient();

// ─── Server Client from Cookies ──────────────────────────────────────────────
export const createServerClientFromCookies = async (): Promise<any> => {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "build-dummy-key";

  return createSSRServerClient<Database>(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch { /* RSC context — safe to ignore */ }
      },
    },
  });
};

// ─── createClient (async on the server) ──────────────────────────────────────
export const createClient = async (): Promise<any> => {
  return createServerClientFromCookies();
};

// ─── Auth helpers ────────────────────────────────────────────────────────────
export const getUserId = async (): Promise<string | null> => {
  try {
    const supabase = await createServerClientFromCookies();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch { return null; }
};

export const getActorRole = async (): Promise<string | null> => {
  try {
    const supabase = await createServerClientFromCookies();
    const { data: { user } } = await supabase.auth.getUser();
    return (user?.app_metadata?.role as string) ?? null;
  } catch { return null; }
};
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


export function resolveDestination(params: {
  role: AppRole;
  hasConsultant: boolean;
  portal?: 'web' | 'admin';
}): string {
  const { role, hasConsultant } = params;
  const ADMIN_PORTAL_URL = (process.env.NEXT_PUBLIC_ADMIN_URL ?? '').replace(/\/$/, '');
  const WEB_PORTAL_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  const ADMIN_ROLES: readonly AppRole[] = ['SUPPORT', 'ADMIN', 'SUPER_ADMIN', 'VIEWER'];

  if (ADMIN_ROLES.includes(role)) {
    return ADMIN_PORTAL_URL ? `${ADMIN_PORTAL_URL}/admin/dashboard` : '/';
  }
  if (role === 'CLIENT_ADMIN' || hasConsultant) {
    return ADMIN_PORTAL_URL ? `${ADMIN_PORTAL_URL}/consultant/dashboard` : '/consultant/dashboard';
  }
  return WEB_PORTAL_URL ? `${WEB_PORTAL_URL}/explore` : '/explore';
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
