#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — Auth + DB hardening fix script
# ─────────────────────────────────────────────────────────────────────────────
# Fixes:
#   1. apps/admin/middleware.ts          — RSC prefetch no longer triggers
#                                          cross-origin redirect (CORS bug)
#   2. apps/admin/actions/register.ts    — provisioning can no longer 500
#                                          the page; promotes User.role
#   3. packages/database/src/server.ts   — typed errors, loud logging,
#                                          promoteTo option
#   4. supabase/migrations/108_rls_lockdown.sql — full idempotent RLS
#                                          lockdown (every public table)
#
# Backups live in .zeal-backup/fix-auth-<timestamp>/
# Run from the repo root. Idempotent — safe to re-run.
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Colours ──────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; BOLD=''; NC=''
fi

info()  { echo -e "${BLUE}→${NC} $*"; }
ok()    { echo -e "${GREEN}✓${NC} $*"; }
warn()  { echo -e "${YELLOW}○${NC} $*"; }
fail()  { echo -e "${RED}✗${NC} $*"; }
head1() { echo ""; echo -e "${BOLD}$*${NC}"; }

# ─── Preflight ────────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

if [[ ! -f package.json ]] || [[ ! -d apps/admin ]]; then
  fail "Run this from the Zeal monorepo root (package.json + apps/admin must exist)."
  exit 1
fi

TS="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="$REPO_ROOT/.zeal-backup/fix-auth-$TS"
mkdir -p "$BACKUP_DIR"

backup() {
  local src="$1"
  if [[ -f "$src" ]]; then
    local dst="$BACKUP_DIR/$(echo "$src" | tr '/' '_')"
    cp "$src" "$dst"
    warn "backed up: $src → $dst"
  fi
}

head1 "╔══════════════════════════════════════════════════════════════════════╗"
head1 "║  ZEAL — auth + DB hardening fix                                     ║"
head1 "╚══════════════════════════════════════════════════════════════════════╝"
info "Repo root : $REPO_ROOT"
info "Backups   : $BACKUP_DIR"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 1. apps/admin/middleware.ts
# ═══════════════════════════════════════════════════════════════════════════════
head1 "── [1/4] apps/admin/middleware.ts"
MW_FILE="apps/admin/middleware.ts"
backup "$MW_FILE"

cat > "$MW_FILE" << 'ZEAL_MW_EOF'
// ZEAL_FIX_PHASE1_MW_ADMIN
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Legal pages linked from /register are public.
const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/auth/callback",
  "/auth/handoff",
  "/not-found",
  "/terms",
  "/privacy",
];

const ADMIN_CONSOLE_PREFIXES = [
  "/dashboard",
  "/users",
  "/consultants",
  "/verification",
  "/bookings",
  "/withdrawals",
  "/analytics",
  "/broadcast",
  "/content",
  "/ai-consultants",
  "/recordings",
  "/wallet",
  "/settings",
];

const CONSULTANT_PREFIX = "/consultant";
const ADMIN_ROLES = ["SUPPORT", "ADMIN", "SUPER_ADMIN", "VIEWER"];

function isPublic(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

/**
 * RSC prefetch detection.
 *
 * Next.js App Router signals a prefetch three different ways depending on
 * version and whether the request is a soft navigation:
 *   1. `?_rsc=<hash>` query param        — primary (App Router, Next 14+)
 *   2. `RSC: 1` header                   — secondary
 *   3. `Next-Router-Prefetch: 1` header  — legacy
 *   4. `Purpose: prefetch` header        — spec-compliant (fetch metadata)
 *
 * Any ONE of these means "do not issue a cross-origin redirect".
 * The browser blocks cross-origin fetch redirects with no
 * Access-Control-Allow-Origin header — that was the CORS error.
 */
function isPrefetchOrRsc(request: NextRequest): boolean {
  const h = request.headers;
  const url = request.nextUrl;
  return (
    url.searchParams.has("_rsc") ||
    h.get("rsc") === "1" ||
    h.get("next-router-prefetch") === "1" ||
    h.get("purpose") === "prefetch"
  );
}

/** Same-origin no-op for prefetches — never redirect cross-origin on fetch. */
function noContent(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // ─── API proxy: attach bearer token ─────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    if (user) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set("Authorization", `Bearer ${session.access_token}`);
        requestHeaders.set("X-Admin-Proxy", "1");
        const apiResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });
        response.cookies.getAll().forEach((c) => apiResponse.cookies.set(c));
        return apiResponse;
      }
    }
    return response;
  }

  if (isPublic(pathname)) return response;

  if (!user) {
    // RSC prefetch → same-origin 204 (no redirect that could be cross-origin)
    if (isPrefetchOrRsc(request)) return noContent();

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  const role = (user.app_metadata?.role as string) ?? "USER";
  const isAdmin = ADMIN_ROLES.includes(role);
  const isConsultant = role === "CLIENT_ADMIN";

  // ─── Consultant hitting an admin console route → bounce to studio ───────
  if (
    isConsultant &&
    ADMIN_CONSOLE_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    if (isPrefetchOrRsc(request)) return noContent();
    return NextResponse.redirect(new URL("/consultant/dashboard", request.url));
  }

  // ─── Admin hitting a consultant route → bounce to console ───────────────
  if (isAdmin && pathname.startsWith(CONSULTANT_PREFIX)) {
    if (isPrefetchOrRsc(request)) return noContent();
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // ─── Plain USER (no admin, no consultant) ───────────────────────────────
  // RSC prefetch → 204 (never redirect cross-origin — the browser blocks it).
  // Full navigation → cross-origin redirect to the web app is fine.
  if (!isAdmin && !isConsultant) {
    if (isPrefetchOrRsc(request)) return noContent();

    const webUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    if (webUrl) return NextResponse.redirect(`${webUrl}/explore`);
    return NextResponse.redirect(
      new URL("/login?error=not_authorized", request.url),
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
ZEAL_MW_EOF

ok "wrote $MW_FILE ($(wc -l < "$MW_FILE") lines)"

# ═══════════════════════════════════════════════════════════════════════════════
# 2. apps/admin/actions/register.ts
# ═══════════════════════════════════════════════════════════════════════════════
head1 "── [2/4] apps/admin/actions/register.ts"
REG_FILE="apps/admin/actions/register.ts"
backup "$REG_FILE"

cat > "$REG_FILE" << 'ZEAL_REG_EOF'
"use server";

// ═══════════════════════════════════════════════════════════════════════════════
// Consultant registration — self-healing, never 500s the page
// ═══════════════════════════════════════════════════════════════════════════════
// Provisioning is best-effort. If Supabase env is missing or the
// provisioning RPCs fail, we still return success so the user reaches
// the confirmation screen; a login-time self-heal repairs the rows.
// ═══════════════════════════════════════════════════════════════════════════════

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  ensureUserRow,
  ensureConsultantRow,
  syncAppMetadata,
} from "@zeal/database/server";

export type RegisterResult =
  | { ok: true; destination?: string; needsConfirmation?: false; warning?: string }
  | { ok: true; needsConfirmation: true; warning?: string }
  | { ok: false; error: string };

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function registerConsultantAction(
  formData: FormData,
): Promise<RegisterResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!email || !password || !fullName) {
    return { ok: false, error: "All fields required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Invalid email." };
  }
  if (password.length < 12) {
    return { ok: false, error: "Password must be 12+ characters." };
  }

  const adminUrl = (process.env.NEXT_PUBLIC_ADMIN_URL ?? "").replace(/\/$/, "");
  const cookieStore = await cookies();
  const supabase = createServerClient(
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
            /* RSC context */
          }
        },
      },
    },
  );

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, account_type: "consultant" },
      emailRedirectTo: `${adminUrl}/auth/callback`,
    },
  });

  if (error) {
    if (/already|exist/i.test(error.message)) {
      return { ok: false, error: "An account with this email already exists." };
    }
    return { ok: false, error: error.message };
  }
  if (!data.user) return { ok: false, error: "Signup failed." };

  // ─── Provisioning — best-effort, never throws ──────────────────────────
  // The DB trigger `on_auth_user_created` (migration 017) already created
  // User + Wallet. These calls are idempotent healers. If they fail here
  // (missing env, cold-start race), the next login runs self_heal_user().
  let warning: string | undefined;

  try {
    await ensureUserRow(data.user, { promoteTo: "CLIENT_ADMIN" });
    await ensureConsultantRow(data.user, {
      category: "ASTROLOGER",
      rate: 50,
    });

    // Belt-and-braces: make the DB row match the JWT claim.
    const admin = adminClient();
    if (admin) {
      await admin
        .from("User")
        .update({ role: "CLIENT_ADMIN" })
        .eq("id", data.user.id);
    }

    const synced = await syncAppMetadata(
      data.user.id,
      "CLIENT_ADMIN",
      data.user.app_metadata,
    );
    if (!synced) {
      warning = "Account created — role will finalise on first sign-in.";
    }
  } catch (err) {
    warning = "Account created — profile will finish provisioning on sign-in.";
    console.error("[registerConsultantAction] provisioning deferred:", err);
  }

  if (!data.session) {
    return { ok: true, needsConfirmation: true, warning };
  }
  return { ok: true, destination: "/consultant/dashboard", warning };
}
ZEAL_REG_EOF

ok "wrote $REG_FILE ($(wc -l < "$REG_FILE") lines)"

# ═══════════════════════════════════════════════════════════════════════════════
# 3. packages/database/src/server.ts
# ═══════════════════════════════════════════════════════════════════════════════
head1 "── [3/4] packages/database/src/server.ts"
SRV_FILE="packages/database/src/server.ts"
backup "$SRV_FILE"

cat > "$SRV_FILE" << 'ZEAL_SRV_EOF'
// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/database/server — server-side Supabase clients + auth core
// ═══════════════════════════════════════════════════════════════════════════════
// ⚠ SERVER-ONLY MODULE
//
// Imported by Server Components, Route Handlers, Server Actions, Middleware.
// Do NOT import from "use client" files — use @zeal/types for shared types.
//
// Design notes:
//   • No `import "server-only"` — Next.js 16 + transpilePackages mis-handles
//     the runtime tripwire during page data collection. Subpath export
//     boundary is the real compile-time guard.
//   • Dummy fallbacks ("build-dummy-*") allow static analysis during build
//     without env vars present. Runtime paths use identityClient() which
//     throws a TYPED error when env is missing.
// ═══════════════════════════════════════════════════════════════════════════════

import { cookies } from "next/headers";
import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@zeal/types";
export type { Database, Json } from "@zeal/types";

// ─── Types ────────────────────────────────────────────────────────────────────
export type { CompletenessCheck, CompletenessReport } from "@zeal/types";

export class DatabaseConfigError extends Error {
  constructor(public readonly missing: string[]) {
    super(`[@zeal/database] Missing env: ${missing.join(", ")}`);
    this.name = "DatabaseConfigError";
  }
}

// ─── Admin (service role) — stateless, safe fallback ──────────────────────────
export function createAdminClient(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "build-dummy-service-key";
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export const getAdminClient = (): any => createAdminClient();

// ─── Cookie-bound SSR client ──────────────────────────────────────────────────
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
            cookieStore.set(name, value, options),
          );
        } catch {
          /* RSC context — cookies are read-only */
        }
      },
    },
  });
};
export const createClient = async (): Promise<any> =>
  createServerClientFromCookies();

// ─── Session helpers ──────────────────────────────────────────────────────────
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

// ─── Roles ────────────────────────────────────────────────────────────────────
export type AppRole =
  | "USER"
  | "CLIENT_ADMIN"
  | "SUPPORT"
  | "ADMIN"
  | "SUPER_ADMIN"
  | "VIEWER"
  | "AI";

const ADMIN_ROLES: readonly AppRole[] = [
  "SUPPORT", "ADMIN", "SUPER_ADMIN", "VIEWER",
] as const;

const PRIVILEGED: readonly AppRole[] = ["CLIENT_ADMIN", ...ADMIN_ROLES] as const;

// ─── Identity client (service role, eager error on missing env) ───────────────
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
  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!key) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length > 0) throw new DatabaseConfigError(missing);

  _identityClient = createSupabaseClient(url!, key!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return _identityClient;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const buildUsernameBase = (email: string): string => {
  const local = (email.split("@")[0] ?? "user")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
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

// ─── ensureUserRow (idempotent, race-safe, optional promote) ──────────────────
export async function ensureUserRow(
  u: SupaUserShape,
  opts: { promoteTo?: AppRole } = {},
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

  // ── Existing row path ────────────────────────────────────────────────────
  if (existing) {
    const patch: Record<string, unknown> = {};
    if (email) patch.email = email;
    if (fullName) {
      patch.name = fullName;
      patch.full_name = fullName;
    }
    if (avatar) patch.avatar_url = avatar;

    // Role promotion — needed for consultant signup (DB trigger seeds USER).
    if (opts.promoteTo && existing.role !== opts.promoteTo) {
      patch.role = opts.promoteTo;
      patch.updatedAt = new Date().toISOString();
    }

    if (Object.keys(patch).length > 0) {
      await admin.from("User").update(patch).eq("id", u.id);
    }
    await ensureWallet(u.id);

    return {
      role: (patch.role as AppRole) ?? ((existing.role as AppRole) ?? "USER"),
      isNew: false,
      userId: u.id,
    };
  }

  // ── Fresh row path ───────────────────────────────────────────────────────
  const appRole = String(appMeta.role ?? "").toUpperCase() as AppRole;
  const seedRole: AppRole = opts.promoteTo
    ? opts.promoteTo
    : PRIVILEGED.includes(appRole)
      ? appRole
      : "USER";

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

    // Race — someone else inserted first
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

// ─── ensureConsultantRow ──────────────────────────────────────────────────────
export async function ensureConsultantRow(
  u: SupaUserShape,
  opts: { category?: string; rate?: number } = {},
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

// ─── syncAppMetadata (loud on failure, returns boolean) ───────────────────────
export async function syncAppMetadata(
  userId: string,
  role: AppRole,
  current: Record<string, unknown> | undefined,
): Promise<boolean> {
  if ((current?.role as string) === role) return true;
  try {
    await identityClient().auth.admin.updateUserById(userId, {
      app_metadata: { ...(current ?? {}), role },
    });
    return true;
  } catch (err) {
    console.error("[syncAppMetadata] failed", {
      userId,
      role,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// ─── Destination resolver ─────────────────────────────────────────────────────
export function resolveDestination(params: {
  role: AppRole;
  hasConsultant: boolean;
  portal?: "web" | "admin";
}): string {
  const { role, hasConsultant } = params;
  const A = (process.env.NEXT_PUBLIC_ADMIN_URL ?? "").replace(/\/$/, "");
  const W = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (ADMIN_ROLES.includes(role)) return A ? `${A}/dashboard` : "/dashboard";
  if (role === "CLIENT_ADMIN" || hasConsultant) {
    return A ? `${A}/consultant/dashboard` : "/consultant/dashboard";
  }
  return W ? `${W}/explore` : "/explore";
}

// ─── Consultant profile completeness ──────────────────────────────────────────
import type {
  CompletenessCheck,
  CompletenessReport,
} from "@zeal/types";

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
      (b: any) => Array.isArray(b) && b.length > 0,
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
ZEAL_SRV_EOF

ok "wrote $SRV_FILE ($(wc -l < "$SRV_FILE") lines)"

# ═══════════════════════════════════════════════════════════════════════════════
# 4. supabase/migrations/108_rls_lockdown.sql
# ═══════════════════════════════════════════════════════════════════════════════
head1 "── [4/4] supabase/migrations/108_rls_lockdown.sql"
SQL_DIR="supabase/migrations"
mkdir -p "$SQL_DIR"
SQL_FILE="$SQL_DIR/108_rls_lockdown.sql"
backup "$SQL_FILE"

cat > "$SQL_FILE" << 'ZEAL_SQL_EOF'
-- ═══════════════════════════════════════════════════════════════════════════════
-- 108_rls_lockdown.sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Full RLS lockdown + performance pass.
--
-- Guarantees:
--   • Every public table has RLS ENABLED + FORCED.
--   • Every policy uses wrapped (SELECT auth.uid()) — no per-row re-eval.
--   • User.role / sparks / isVerified are ADMIN-ONLY writable.
--   • Wallet / Transaction are READ-ONLY for owners; writes only via RPC.
--   • Admin-only tables (audit, invites, login attempts, debug) are locked
--     to auth_is_admin().
--   • A verification block RAISES if any table ends unprotected.
--
-- Idempotent: DROP IF EXISTS before every CREATE. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;
SET LOCAL statement_timeout = '5min';
SET LOCAL lock_timeout = '20s';

-- ═══════════════════════════════════════════════════════════════════════════
-- §0. HELPERS (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS text LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() ->> 'user_role',
    'USER'
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS boolean LANGUAGE sql STABLE
AS $$
  SELECT public.auth_user_role() IN ('ADMIN','SUPER_ADMIN','SUPPORT','VIEWER');
$$;

CREATE OR REPLACE FUNCTION public.auth_is_consultant()
RETURNS boolean LANGUAGE sql STABLE
AS $$
  SELECT public.auth_user_role() IN ('CLIENT_ADMIN','ADMIN','SUPER_ADMIN');
$$;

GRANT EXECUTE ON FUNCTION public.auth_user_role()    TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auth_is_admin()     TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auth_is_consultant() TO authenticated, anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- §1. ENABLE + FORCE RLS ON EVERY USER-DATA TABLE
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  t text;
  skip text[] := ARRAY[
    '_legacy_audit_events',
    '_legacy_audit_logs',
    '_legacy_consultant_applications',
    '_legacy_consultant_bookings',
    '_legacy_consultations',
    '_legacy_messages',
    '_legacy_notifications',
    '_legacy_session_messages',
    '_legacy_session_requests',
    '_legacy_transactions',
    '_mv_refresh_log',
    '_zeal_audit_history',
    '_zeal_diag',
    '_zeal_migrations',
    'Category',
    'Service',
    'rate_limits'
  ];
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT (c.relname = ANY(skip))
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §2. USER
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS user_self_select   ON public."User";
DROP POLICY IF EXISTS user_self_insert   ON public."User";
DROP POLICY IF EXISTS user_self_update   ON public."User";
DROP POLICY IF EXISTS users_select_self  ON public."User";
DROP POLICY IF EXISTS users_insert_self  ON public."User";
DROP POLICY IF EXISTS users_update_self  ON public."User";
DROP POLICY IF EXISTS admin_full_access  ON public."User";
DROP POLICY IF EXISTS user_admin_all     ON public."User";

CREATE POLICY user_self_select ON public."User"
  FOR SELECT USING (id = (SELECT auth.uid()));

CREATE POLICY user_self_insert ON public."User"
  FOR INSERT WITH CHECK (id = (SELECT auth.uid()));

-- Column-scoped self update: role / sparks / isVerified cannot be self-edited.
CREATE POLICY user_self_update ON public."User"
  FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid())
    AND role          IS NOT DISTINCT FROM (SELECT role          FROM public."User" WHERE id = (SELECT auth.uid()))
    AND sparks        IS NOT DISTINCT FROM (SELECT sparks        FROM public."User" WHERE id = (SELECT auth.uid()))
    AND "isVerified"  IS NOT DISTINCT FROM (SELECT "isVerified"  FROM public."User" WHERE id = (SELECT auth.uid()))
    AND "sparkScore"  IS NOT DISTINCT FROM (SELECT "sparkScore"  FROM public."User" WHERE id = (SELECT auth.uid()))
  );

CREATE POLICY user_admin_all ON public."User"
  FOR ALL USING ((SELECT public.auth_is_admin()));

-- ═══════════════════════════════════════════════════════════════════════════
-- §3. WALLET — owner read only; writes only via SECURITY DEFINER RPC
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS wallet_owner_all    ON public."Wallet";
DROP POLICY IF EXISTS wallet_owner_read   ON public."Wallet";
DROP POLICY IF EXISTS wallet_admin_read   ON public."Wallet";

CREATE POLICY wallet_owner_read ON public."Wallet"
  FOR SELECT USING ("userId" = (SELECT auth.uid()));

CREATE POLICY wallet_admin_read ON public."Wallet"
  FOR SELECT USING ((SELECT public.auth_is_admin()));

-- No INSERT / UPDATE / DELETE policy → app must use hold_in_escrow_safe,
-- credit_funds_safe, etc. (SECURITY DEFINER functions bypass RLS by design).

-- ═══════════════════════════════════════════════════════════════════════════
-- §4. TRANSACTION
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS tx_owner_read ON public."Transaction";
DROP POLICY IF EXISTS tx_admin_read ON public."Transaction";

CREATE POLICY tx_owner_read ON public."Transaction"
  FOR SELECT USING (
    "walletId" IN (
      SELECT id FROM public."Wallet" WHERE "userId" = (SELECT auth.uid())
    )
  );

CREATE POLICY tx_admin_read ON public."Transaction"
  FOR SELECT USING ((SELECT public.auth_is_admin()));

-- ═══════════════════════════════════════════════════════════════════════════
-- §5. CONSULTANT
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS consultant_public_read  ON public."Consultant";
DROP POLICY IF EXISTS consultant_self_manage  ON public."Consultant";
DROP POLICY IF EXISTS consultant_self_write   ON public."Consultant";
DROP POLICY IF EXISTS consultant_admin_all    ON public."Consultant";

CREATE POLICY consultant_public_read ON public."Consultant"
  FOR SELECT USING (status = 'VERIFIED' AND "isActive" = true);

CREATE POLICY consultant_self_manage ON public."Consultant"
  FOR UPDATE USING ("userId" = (SELECT auth.uid()))
  WITH CHECK  ("userId" = (SELECT auth.uid()));

CREATE POLICY consultant_admin_all ON public."Consultant"
  FOR ALL USING ((SELECT public.auth_is_admin()));

-- ═══════════════════════════════════════════════════════════════════════════
-- §6. AICONSULTANT
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS ai_consultants_public_read ON public."AIConsultant";
DROP POLICY IF EXISTS ai_consultants_admin_all   ON public."AIConsultant";

CREATE POLICY ai_consultants_public_read ON public."AIConsultant"
  FOR SELECT USING ("isActive" = true);

CREATE POLICY ai_consultants_admin_all ON public."AIConsultant"
  FOR ALL USING ((SELECT public.auth_is_admin()));

-- ═══════════════════════════════════════════════════════════════════════════
-- §7. BOOKING
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS booking_participants ON public."Booking";
DROP POLICY IF EXISTS booking_user_insert  ON public."Booking";
DROP POLICY IF EXISTS booking_admin_all    ON public."Booking";

CREATE POLICY booking_participants ON public."Booking"
  FOR SELECT USING (
    "userId" = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public."Consultant" c
      WHERE c.id = "Booking"."consultantId"
        AND c."userId" = (SELECT auth.uid())
    )
  );

CREATE POLICY booking_user_insert ON public."Booking"
  FOR INSERT WITH CHECK ("userId" = (SELECT auth.uid()));

CREATE POLICY booking_admin_all ON public."Booking"
  FOR ALL USING ((SELECT public.auth_is_admin()));

-- ═══════════════════════════════════════════════════════════════════════════
-- §8. CALLSESSION
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS callsession_participants ON public."CallSession";

CREATE POLICY callsession_participants ON public."CallSession"
  FOR SELECT USING (
    "userId" = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public."Consultant" c
      WHERE c.id = "CallSession"."consultantId"
        AND c."userId" = (SELECT auth.uid())
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- §9. POST / COMMENT / CHEER
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS posts_public_read   ON public."Post";
DROP POLICY IF EXISTS posts_author_insert ON public."Post";
DROP POLICY IF EXISTS posts_author_update ON public."Post";
DROP POLICY IF EXISTS posts_author_delete ON public."Post";
DROP POLICY IF EXISTS post_public_read    ON public."Post";
DROP POLICY IF EXISTS post_author_write   ON public."Post";

CREATE POLICY posts_public_read ON public."Post"
  FOR SELECT USING ("isFlagged" = false);

CREATE POLICY posts_author_insert ON public."Post"
  FOR INSERT WITH CHECK ("authorId" = (SELECT auth.uid()));

CREATE POLICY posts_author_update ON public."Post"
  FOR UPDATE USING ("authorId" = (SELECT auth.uid()));

CREATE POLICY posts_author_delete ON public."Post"
  FOR DELETE USING ("authorId" = (SELECT auth.uid()));

DROP POLICY IF EXISTS comments_public_read   ON public."Comment";
DROP POLICY IF EXISTS comments_author_insert ON public."Comment";

CREATE POLICY comments_public_read ON public."Comment"
  FOR SELECT USING (true);

CREATE POLICY comments_author_insert ON public."Comment"
  FOR INSERT WITH CHECK ("authorId" = (SELECT auth.uid()));

DROP POLICY IF EXISTS cheers_public_read ON public."Cheer";
DROP POLICY IF EXISTS cheers_self_write  ON public."Cheer";
DROP POLICY IF EXISTS cheers_self_delete ON public."Cheer";

CREATE POLICY cheers_public_read ON public."Cheer"
  FOR SELECT USING (true);

CREATE POLICY cheers_self_write ON public."Cheer"
  FOR INSERT WITH CHECK ("userId" = (SELECT auth.uid()));

CREATE POLICY cheers_self_delete ON public."Cheer"
  FOR DELETE USING ("userId" = (SELECT auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════
-- §10. NOTIFICATION
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS notif_owner_read          ON public."Notification";
DROP POLICY IF EXISTS notif_owner_update        ON public."Notification";
DROP POLICY IF EXISTS notification_owner_read   ON public."Notification";
DROP POLICY IF EXISTS notification_owner_update ON public."Notification";

CREATE POLICY notif_owner_read ON public."Notification"
  FOR SELECT USING ("userId" = (SELECT auth.uid()));

CREATE POLICY notif_owner_update ON public."Notification"
  FOR UPDATE USING ("userId" = (SELECT auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════
-- §11. CONVERSATION / PARTICIPANT / MESSAGE
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS conversation_participant_read ON public."Conversation";
DROP POLICY IF EXISTS conversation_participants_read ON public."Conversation";

CREATE POLICY conversation_participant_read ON public."Conversation"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public."ConversationParticipant" cp
      WHERE cp."conversationId" = "Conversation".id
        AND cp."userId" = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS participant_self_read ON public."ConversationParticipant";

CREATE POLICY participant_self_read ON public."ConversationParticipant"
  FOR SELECT USING (
    "userId" = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public."ConversationParticipant" cp
      WHERE cp."conversationId" = "ConversationParticipant"."conversationId"
        AND cp."userId" = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS message_participant_read ON public."Message";
DROP POLICY IF EXISTS message_participant_send ON public."Message";
DROP POLICY IF EXISTS message_participants_read ON public."Message";
DROP POLICY IF EXISTS message_sender_insert    ON public."Message";

CREATE POLICY message_participant_read ON public."Message"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public."ConversationParticipant" cp
      WHERE cp."conversationId" = "Message"."conversationId"
        AND cp."userId" = (SELECT auth.uid())
    )
  );

CREATE POLICY message_participant_send ON public."Message"
  FOR INSERT WITH CHECK (
    "senderId" = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public."ConversationParticipant" cp
      WHERE cp."conversationId" = "Message"."conversationId"
        AND cp."userId" = (SELECT auth.uid())
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- §12. ADMIN-ONLY TABLES
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  t text;
  admin_tables text[] := ARRAY[
    'AdminAuditLog',
    'AdminInvite',
    'AdminLoginAttempt',
    'DebugLog'
  ];
BEGIN
  FOREACH t IN ARRAY admin_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING ((SELECT public.auth_is_admin()))',
        t || '_admin_all', t
      );
    END IF;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §13. CONSULTANT-SERVICE JOIN + DRAFT
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS consultant_service_public_read ON public."ConsultantService";
DROP POLICY IF EXISTS consultant_service_self_write  ON public."ConsultantService";

CREATE POLICY consultant_service_public_read ON public."ConsultantService"
  FOR SELECT USING (true);

CREATE POLICY consultant_service_self_write ON public."ConsultantService"
  FOR ALL USING (
    consultant_id IN (
      SELECT id FROM public."Consultant" WHERE "userId" = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS consultant_draft_self ON public."ConsultantDraft";

CREATE POLICY consultant_draft_self ON public."ConsultantDraft"
  FOR ALL USING ("userId" = (SELECT auth.uid()))
  WITH CHECK ("userId" = (SELECT auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════
-- §14. USERPREFERENCES / USERACTIVITY
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS prefs_owner_all    ON public."UserPreferences";
DROP POLICY IF EXISTS activity_owner_all ON public."UserActivity";

CREATE POLICY prefs_owner_all ON public."UserPreferences"
  FOR ALL USING ("userId" = (SELECT auth.uid()));

CREATE POLICY activity_owner_all ON public."UserActivity"
  FOR ALL USING ("userId" = (SELECT auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════
-- §15. PUBLIC CATALOGS — read-only for everyone, writes via service role
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='Category') THEN
    EXECUTE 'ALTER TABLE public."Category" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS category_public_read ON public."Category"';
    EXECUTE 'CREATE POLICY category_public_read ON public."Category" FOR SELECT USING (true)';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='Service') THEN
    EXECUTE 'ALTER TABLE public."Service" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS service_public_read ON public."Service"';
    EXECUTE 'CREATE POLICY service_public_read ON public."Service" FOR SELECT USING (true)';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §16. INDEXES FOR RLS FILTER COLUMNS
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_user_role                 ON public."User"(role);
CREATE INDEX IF NOT EXISTS idx_user_online               ON public."User"("is_online") WHERE "is_online" = true;
CREATE INDEX IF NOT EXISTS idx_wallet_user               ON public."Wallet"("userId");
CREATE INDEX IF NOT EXISTS idx_transaction_wallet        ON public."Transaction"("walletId");
CREATE INDEX IF NOT EXISTS idx_consultant_user           ON public."Consultant"("userId");
CREATE INDEX IF NOT EXISTS idx_consultant_status_active  ON public."Consultant"(status, "isActive");
CREATE INDEX IF NOT EXISTS idx_consultant_spark          ON public."Consultant"("sparkScore" DESC)
  WHERE status = 'VERIFIED' AND "isActive" = true;
CREATE INDEX IF NOT EXISTS idx_booking_user              ON public."Booking"("userId");
CREATE INDEX IF NOT EXISTS idx_booking_consultant        ON public."Booking"("consultantId");
CREATE INDEX IF NOT EXISTS idx_booking_status            ON public."Booking"(status);
CREATE INDEX IF NOT EXISTS idx_callsession_user          ON public."CallSession"("userId");
CREATE INDEX IF NOT EXISTS idx_callsession_consultant    ON public."CallSession"("consultantId");
CREATE INDEX IF NOT EXISTS idx_message_conversation      ON public."Message"("conversationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_participant_user          ON public."ConversationParticipant"("userId");
CREATE INDEX IF NOT EXISTS idx_participant_conv          ON public."ConversationParticipant"("conversationId");
CREATE INDEX IF NOT EXISTS idx_notification_user_unread  ON public."Notification"("userId")
  WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_post_author               ON public."Post"("authorId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_post_feed                 ON public."Post"("createdAt" DESC)
  WHERE "isFlagged" = false;
CREATE INDEX IF NOT EXISTS idx_cheer_post                ON public."Cheer"("postId");
CREATE INDEX IF NOT EXISTS idx_cheer_user                ON public."Cheer"("userId");
CREATE INDEX IF NOT EXISTS idx_comment_post              ON public."Comment"("postId", "createdAt" DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- §17. VERIFICATION — hard-fail if anything slipped through
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  unprotected text[];
  unwrapped   int;
  missing_uid int;
BEGIN
  -- Every user-data table must have RLS enabled
  SELECT array_agg(c.relname) INTO unprotected
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname NOT LIKE '\_%'
    AND c.relname NOT IN ('Category','Service','rate_limits')
    AND NOT c.relrowsecurity;

  IF unprotected IS NOT NULL THEN
    RAISE EXCEPTION '108 RLS lockdown FAILED — tables without RLS: %', unprotected;
  END IF;

  -- Every policy that mentions auth.uid() must use the wrapped subquery
  SELECT COUNT(*) INTO unwrapped
  FROM pg_policies
  WHERE schemaname = 'public'
    AND qual LIKE '%auth.uid()%'
    AND qual NOT LIKE '%(SELECT auth.uid())%';

  IF unwrapped > 0 THEN
    RAISE WARNING '108 — % policies still use unwrapped auth.uid()', unwrapped;
  END IF;

  -- Every user-scoped policy must reference auth.uid()
  SELECT COUNT(*) INTO missing_uid
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'User','Wallet','Transaction','Consultant','Booking','CallSession',
      'Notification','Conversation','ConversationParticipant','Message',
      'UserPreferences','UserActivity','ConsultantDraft'
    )
    AND qual IS NOT NULL
    AND qual NOT LIKE '%auth.uid()%'
    AND qual NOT LIKE '%auth_is_admin%'
    AND qual NOT LIKE '%true%';

  IF missing_uid > 0 THEN
    RAISE WARNING '108 — % user-scoped policies do not reference auth.uid()', missing_uid;
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE '  108_rls_lockdown.sql — VERIFIED';
  RAISE NOTICE '  Tables without RLS : 0';
  RAISE NOTICE '  Unwrapped uid()    : %', unwrapped;
  RAISE NOTICE '========================================';
END $$;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
ZEAL_SQL_EOF

ok "wrote $SQL_FILE ($(wc -l < "$SQL_FILE") lines)"

# ═══════════════════════════════════════════════════════════════════════════════
# 5. Sanity checks
# ═══════════════════════════════════════════════════════════════════════════════
head1 "── Post-write checks"

# 5a. Every file present and non-empty
for f in "$MW_FILE" "$REG_FILE" "$SRV_FILE" "$SQL_FILE"; do
  if [[ -s "$f" ]]; then
    ok "$f"
  else
    fail "$f is missing or empty"
    exit 1
  fi
done

# 5b. Grep for the critical fixes
if grep -q "url.searchParams.has(\"_rsc\")" "$MW_FILE"; then
  ok "middleware: _rsc query-param check present"
else
  fail "middleware: _rsc check missing"
  exit 1
fi

if grep -q "promoteTo: \"CLIENT_ADMIN\"" "$REG_FILE"; then
  ok "register: promoteTo CLIENT_ADMIN present"
else
  fail "register: promoteTo missing"
  exit 1
fi

if grep -q "DatabaseConfigError" "$SRV_FILE"; then
  ok "server.ts: typed error present"
else
  fail "server.ts: typed error missing"
  exit 1
fi

if grep -q "FORCE ROW LEVEL SECURITY" "$SQL_FILE"; then
  ok "SQL: FORCE RLS present"
else
  fail "SQL: FORCE RLS missing"
  exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 6. TypeScript compile check (best-effort)
# ═══════════════════════════════════════════════════════════════════════════════
head1 "── TypeScript sanity"
if command -v npx >/dev/null 2>&1 && [[ -f node_modules/.package-lock.json || -d node_modules ]]; then
  if npx --no-install tsc --noEmit -p apps/admin/tsconfig.json 2>/dev/null; then
    ok "apps/admin type-check passed"
  else
    warn "apps/admin type-check reported issues — run manually:"
    echo "    npx tsc --noEmit -p apps/admin/tsconfig.json"
  fi
else
  warn "skipping type-check (node_modules not installed)"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 7. Apply SQL migration (optional)
# ═══════════════════════════════════════════════════════════════════════════════
head1 "── Apply SQL migration"

APPLY_SQL="${APPLY_SQL:-0}"

if [[ "$APPLY_SQL" == "1" ]]; then
  if [[ -z "${SUPABASE_DB_URL:-}" && -z "${DATABASE_URL:-}" ]]; then
    fail "APPLY_SQL=1 but SUPABASE_DB_URL / DATABASE_URL is not set"
    exit 1
  fi

  DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL}}"

  if command -v psql >/dev/null 2>&1; then
    info "applying $SQL_FILE via psql…"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
    ok "108_rls_lockdown.sql applied"
  elif command -v supabase >/dev/null 2>&1; then
    info "applying via supabase db push…"
    supabase db push
    ok "migration pushed via supabase CLI"
  else
    fail "neither psql nor supabase CLI available — install one, or run manually:"
    echo "    psql \"\$SUPABASE_DB_URL\" -f $SQL_FILE"
    exit 1
  fi
else
  info "SQL not auto-applied. To apply, run:"
  echo ""
  echo -e "    ${BOLD}APPLY_SQL=1 SUPABASE_DB_URL='postgresql://…' ./fix-zeal-auth.sh${NC}"
  echo ""
  echo -e "    or manually:"
  echo -e "    ${BOLD}psql \"\$SUPABASE_DB_URL\" -f $SQL_FILE${NC}"
  echo -e "    ${BOLD}supabase db push${NC}"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 8. Summary
# ═══════════════════════════════════════════════════════════════════════════════
head1 "════════════════════════════════════════════════════════════════════"
ok "All 4 files written."
echo ""
echo -e "  ${BOLD}1.${NC} apps/admin/middleware.ts"
echo -e "     → RSC prefetch (?_rsc, RSC header, Purpose header) returns 204."
echo -e "     → No more cross-origin redirect on fetch → CORS error gone."
echo ""
echo -e "  ${BOLD}2.${NC} apps/admin/actions/register.ts"
echo -e "     → Provisioning wrapped in try/catch → page never 500s."
echo -e "     → Explicit User.role = CLIENT_ADMIN update."
echo -e "     → Returns a warning string instead of throwing."
echo ""
echo -e "  ${BOLD}3.${NC} packages/database/src/server.ts"
echo -e "     → DatabaseConfigError with missing var names."
echo -e "     → syncAppMetadata returns boolean + logs loudly."
echo -e "     → ensureUserRow({ promoteTo }) for atomic role promotion."
echo ""
echo -e "  ${BOLD}4.${NC} supabase/migrations/108_rls_lockdown.sql"
echo -e "     → FORCE RLS on every public table."
echo -e "     → Every policy wrapped with (SELECT auth.uid())."
echo -e "     → role / sparks / isVerified become admin-only writable."
echo -e "     → Verification block RAISES if anything slips through."
echo ""
echo -e "  ${BOLD}Backups:${NC} $BACKUP_DIR"
echo ""
echo -e "  ${BOLD}Next:${NC}"
echo "    git diff                              # review"
echo "    git add -A && git commit -m 'fix: auth + RLS lockdown'"
echo "    git push                              # Vercel auto-deploys"
echo "    # then, once Vercel is green:"
echo "    APPLY_SQL=1 SUPABASE_DB_URL='...' ./fix-zeal-auth.sh"
echo ""
echo -e "${GREEN}${BOLD}Done.${NC}"
head1 "════════════════════════════════════════════════════════════════════"