// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/database/server — server-side Supabase clients + auth core
// ═══════════════════════════════════════════════════════════════════════════════
// ⚠ SERVER-ONLY MODULE
//
// This file exports service-role clients and cookie-bound SSR clients. It must
// only be imported from:
//   • Server Components (async function Component() { ... })
//   • Route Handlers (app/api/*/route.ts)
//   • Server Actions ("use server")
//   • Middleware
//
// Design notes:
//   • No `import "server-only"` here. Next.js 16 + `transpilePackages` for
//     workspace packages can mis-classify the runtime context, causing build
//     failures like: "This module cannot be imported from a Client Component
//     module." The subpath export (`@zeal/database/server`) + TS config already
//     prevent accidental client imports.
//   • Dummy fallbacks ("build-dummy-*") allow Next.js static analysis to run
//     during `next build` without env vars present — real runtime always has
//     them.
// ═══════════════════════════════════════════════════════════════════════════════

import {cookies} from "next/headers";
import {createServerClient as createSSRServerClient} from "@supabase/ssr";
import {createClient as createSupabaseClient} from "@supabase/supabase-js";
import type { Database } from "@zeal/types";
export type { Database, Json } from "@zeal/types";

// ─── Service-role admin client ────────────────────────────────────────────────
// Bypasses RLS. Use ONLY for trusted server-side operations:
// audit logging, admin actions, cron jobs, webhooks.
export function createAdminClient(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "build-dummy-service-key";
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const getAdminClient = (): any => createAdminClient();

// ─── Cookie-bound SSR client (RLS enforced via user session) ──────────────────
export const createServerClientFromCookies = async (): Promise<any> => {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "build-dummy-key";
  return createSSRServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cs) {
        try {
          cs.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* RSC context — cookies are read-only */
        }
      },
    },
  });
};

// Alias for compatibility with older call sites
export const createClient = async (): Promise<any> =>
  createServerClientFromCookies();

// ─── Session helpers (never throw) ────────────────────────────────────────────
export const getUserId = async (): Promise<string | null> => {
  try {
    const sb = await createServerClientFromCookies();
    const { data: { user } } = await sb.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
};

export const getActorRole = async (): Promise<string | null> => {
  try {
    const sb = await createServerClientFromCookies();
    const { data: { user } } = await sb.auth.getUser();
    return (user?.app_metadata?.role as string) ?? null;
  } catch {
    return null;
  }
};

// ─── Role model ───────────────────────────────────────────────────────────────
export type AppRole =
  | "USER"
  | "CLIENT_ADMIN"
  | "SUPPORT"
  | "ADMIN"
  | "SUPER_ADMIN"
  | "VIEWER"
  | "AI";

const ADMIN_ROLES: readonly AppRole[] = [
  "SUPPORT",
  "ADMIN",
  "SUPER_ADMIN",
  "VIEWER",
] as const;

const PRIVILEGED: readonly AppRole[] = ["CLIENT_ADMIN", ...ADMIN_ROLES] as const;

// ─── Auth core ────────────────────────────────────────────────────────────────
export interface SupaUserShape {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

export interface EnsureUserResult {
  role: AppRole;
  isNew: boolean;
  userId: string;
}

export interface EnsureConsultantResult {
  id: string;
  isNew: boolean;
  subdomain: string;
}

let _identityClient: any = null;

function identityClient(): any {
  if (_identityClient) return _identityClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("[auth-core] Missing Supabase env");
  _identityClient = createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return _identityClient;
}

const buildUsernameBase = (email: string): string => {
  const local = (email.split("@")[0] ?? "user").toLowerCase().replace(/[^a-z0-9_]/g, "");
  return (local.length >= 3 ? local : `user${local}`).slice(0, 24);
};

const buildSubdomainSlug = (name: string): string => {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 24)
    .replace(/^-|-$/g, "");
  return slug.length >= 3 ? slug : "guide";
};

const shortId = (uuid: string, n: number): string =>
  uuid.replace(/-/g, "").slice(0, n);

async function ensureWallet(userId: string): Promise<void> {
  const admin = identityClient();
  const { data } = await admin
    .from("Wallet")
    .select("id")
    .eq("userId", userId)
    .maybeSingle();
  if (data) return;
  await admin.from("Wallet").insert({
    userId,
    balance: 0,
    escrow: 0,
    pendingIn: 0,
    pendingOut: 0,
    blocked: 0,
  });
}

export async function ensureUserRow(
  u: SupaUserShape
): Promise<EnsureUserResult> {
  const admin = identityClient();
  const email = u.email ?? "";
  const meta = u.user_metadata ?? {};
  const appMeta = u.app_metadata ?? {};

  const fullName =
    (typeof meta.full_name === "string" ? meta.full_name : null) ??
    (typeof meta.name === "string" ? meta.name : null);
  const avatar = typeof meta.avatar_url === "string" ? meta.avatar_url : null;

  const { data: existing } = await admin
    .from("User")
    .select("id, role")
    .eq("id", u.id)
    .maybeSingle();

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (email) patch.email = email;
    if (fullName) {
      patch.name = fullName;
      patch.full_name = fullName;
    }
    if (avatar) {
      patch.avatar = avatar;
      patch.avatar_url = avatar;
    }
    if (Object.keys(patch).length > 0) {
      await admin.from("User").update(patch).eq("id", u.id);
    }
    await ensureWallet(u.id);
    return {
      role: (existing.role as AppRole) ?? "USER",
      isNew: false,
      userId: u.id,
    };
  }

  const appRole = String(appMeta.role ?? "").toUpperCase() as AppRole;
  const seedRole: AppRole = PRIVILEGED.includes(appRole) ? appRole : "USER";
  const base = buildUsernameBase(email);
  const stable = shortId(u.id, 6);

  for (let i = 0; i < 4; i++) {
    const uname =
      i === 0
        ? `${base}_${stable}`
        : `${base}_${Math.random().toString(36).slice(2, 8)}`;

    const { data, error } = await admin
      .from("User")
      .insert({
        id: u.id,
        email,
        username: uname,
        name: fullName,
        full_name: fullName,
        avatar,
        avatar_url: avatar,
        role: seedRole,
        sparks: 100,
        isVerified: false,
        is_online: false,
      })
      .select("role")
      .single();

    if (!error && data) {
      await ensureWallet(u.id);
      return {
        role: (data.role as AppRole) ?? "USER",
        isNew: true,
        userId: u.id,
      };
    }

    if (error?.code === "23505") {
      const { data: race } = await admin
        .from("User")
        .select("role")
        .eq("id", u.id)
        .maybeSingle();
      if (race) {
        await ensureWallet(u.id);
        return {
          role: (race.role as AppRole) ?? "USER",
          isNew: false,
          userId: u.id,
        };
      }
      continue;
    }

    throw new Error(`[ensureUserRow] ${error?.message}`);
  }

  throw new Error("[ensureUserRow] retries exhausted");
}

export async function ensureConsultantRow(
  u: SupaUserShape,
  opts: { category?: string; rate?: number } = {}
): Promise<EnsureConsultantResult> {
  const admin = identityClient();
  const { data: existing } = await admin
    .from("Consultant")
    .select("id, subdomain")
    .eq("userId", u.id)
    .maybeSingle();
  if (existing) {
    return {
      id: existing.id,
      isNew: false,
      subdomain: existing.subdomain ?? "",
    };
  }

  const meta = u.user_metadata ?? {};
  const displayName =
    (typeof meta.full_name === "string" ? meta.full_name : null) ??
    (typeof meta.name === "string" ? meta.name : null) ??
    "consultant";
  const suffix = shortId(u.id, 4);
  const subdomain = `${buildSubdomainSlug(displayName)}-${suffix}`;

  const { data, error } = await admin
    .from("Consultant")
    .insert({
      userId: u.id,
      category: opts.category ?? "ASTROLOGER",
      specialties: [],
      languages: ["English"],
      bio: null,
      perMinuteRate: opts.rate ?? 50,
      availability: {},
      status: "VERIFIED",
      isVerified: true,
      isActive: true,
      subdomain,
      subdomainActive: true,
      whiteLabelEnabled: true,
      rating: 5.0,
      totalConsultations: 0,
      sparkScore: 0,
      bufferMinutes: 10,
    })
    .select("id, subdomain")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: race } = await admin
        .from("Consultant")
        .select("id, subdomain")
        .eq("userId", u.id)
        .maybeSingle();
      if (race) {
        return {
          id: race.id,
          isNew: false,
          subdomain: race.subdomain ?? "",
        };
      }
    }
    throw new Error(`[ensureConsultantRow] ${error.message}`);
  }

  return {
    id: data!.id,
    isNew: true,
    subdomain: data!.subdomain ?? subdomain,
  };
}

export async function syncAppMetadata(
  userId: string,
  role: AppRole,
  current: Record<string, unknown> | undefined
): Promise<void> {
  if ((current?.role as string) === role) return;
  try {
    await identityClient().auth.admin.updateUserById(userId, {
      app_metadata: { ...(current ?? {}), role },
    });
  } catch {
    /* non-fatal */
  }
}

export function resolveDestination(params: {
  role: AppRole;
  hasConsultant: boolean;
  portal?: "web" | "admin";
}): string {
  const { role, hasConsultant } = params;
  const A = (process.env.NEXT_PUBLIC_ADMIN_URL ?? "").replace(/\/$/, "");
  const W = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (ADMIN_ROLES.includes(role)) return A ? `${A}/dashboard` : "/dashboard";
  if (role === "CLIENT_ADMIN" || hasConsultant)
    return A ? `${A}/consultant/dashboard` : "/consultant/dashboard";
  return W ? `${W}/explore` : "/explore";
}

// ─── Consultant profile completeness ──────────────────────────────────────────
export interface CompletenessCheck {
  id: string;
  label: string;
  weight: number;
  passed: boolean;
  actionHref: string;
}

export interface CompletenessReport {
  score: number;
  isLive: boolean;
  checks: CompletenessCheck[];
}

export function evaluateConsultantProfile(c: any): CompletenessReport {
  if (!c) return { score: 0, isLive: false, checks: [] };

  const bioOk = (c.bio ?? "").trim().length >= 20;
  const rateOk = (c.perMinuteRate ?? 0) >= 10;
  const specOk = (c.specialties ?? []).length >= 1;
  const langOk = (c.languages ?? []).length >= 1;
  const catOk = Boolean(c.category);
  const avOk = (() => {
    const a = c.availability;
    if (!a || typeof a !== "object") return false;
    return Object.values(a).some(
      (b: any) => Array.isArray(b) && b.length > 0
    );
  })();

  const checks: CompletenessCheck[] = [
    {
      id: "bio",
      label: "Professional bio (20+ chars)",
      weight: 25,
      passed: bioOk,
      actionHref: "/consultant/settings",
    },
    {
      id: "rate",
      label: "Rate configured",
      weight: 15,
      passed: rateOk,
      actionHref: "/consultant/settings",
    },
    {
      id: "specialties",
      label: "At least one specialty",
      weight: 15,
      passed: specOk,
      actionHref: "/consultant/settings",
    },
    {
      id: "availability",
      label: "Weekly availability set",
      weight: 20,
      passed: avOk,
      actionHref: "/consultant/availability",
    },
    {
      id: "languages",
      label: "Languages configured",
      weight: 10,
      passed: langOk,
      actionHref: "/consultant/settings",
    },
    {
      id: "category",
      label: "Primary category",
      weight: 5,
      passed: catOk,
      actionHref: "/consultant/settings",
    },
  ];

  const score = checks.reduce((s, x) => (x.passed ? s + x.weight : s), 0);
  return {
    score,
    isLive: bioOk && rateOk && specOk && score >= 60,
    checks,
  };
}
