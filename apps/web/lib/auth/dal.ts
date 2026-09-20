// apps/web/lib/auth/dal.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Data Access Layer — the single source of truth for session + role checks.
// ─────────────────────────────────────────────────────────────────────────────
// Design (from Next.js docs + Clerk guide):
//   1. Memoized session read via React `cache()` — one DB call per request
//   2. Role read from JWT claims (app_metadata.role / user_role) — no DB round-trip
//   3. Never trust middleware alone — DAL is the final authorization boundary
//   4. Typed discriminated unions for auth state
// ═══════════════════════════════════════════════════════════════════════════════

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerClientFromCookies } from "@zeal/database/server";
import type { User } from "@supabase/supabase-js";

export type AppRole =
  | "USER"
  | "CLIENT_ADMIN"
  | "SUPPORT"
  | "ADMIN"
  | "SUPER_ADMIN"
  | "VIEWER";

export type AuthState =
  | { kind: "anonymous" }
  | { kind: "authenticated"; user: User; role: AppRole; hasMfa: boolean };

const ROLE_LEVEL: Record<AppRole, number> = {
  VIEWER: 10,
  USER: 20,
  CLIENT_ADMIN: 40,
  SUPPORT: 50,
  ADMIN: 80,
  SUPER_ADMIN: 100,
};

function readRoleFromClaims(user: User): AppRole {
  const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
  const metaRole = String(appMeta.role ?? "").toUpperCase();
  if (metaRole) return metaRole as AppRole;

  // Fallback: Supabase injects `user_role` via the custom access token hook
  const anyUser = user as unknown as { user_role?: string };
  const claimRole = String(anyUser.user_role ?? "").toUpperCase();
  if (claimRole) return claimRole as AppRole;

  return "USER";
}

function readAal(user: User): string {
  const anyUser = user as unknown as { aal?: string };
  return String(anyUser.aal ?? "aal1");
}

/**
 * getSession — memoized per request.
 * One Supabase auth.getUser() call per request regardless of how many
 * components/actions call it.
 */
export const getSession = cache(async (): Promise<AuthState> => {
  const supabase = await createServerClientFromCookies();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) return { kind: "anonymous" };

  return {
    kind: "authenticated",
    user,
    role: readRoleFromClaims(user),
    hasMfa: readAal(user) === "aal2",
  };
});

/**
 * requireSession — throws (via redirect) when anonymous.
 * Use inside Server Components + Server Actions.
 */
export async function requireSession(): Promise<Extract<AuthState, { kind: "authenticated" }>> {
  const state = await getSession();
  if (state.kind === "anonymous") {
    redirect("/login");
  }
  return state;
}

/**
 * requireRole — role-level check. Throws 403 via Next's forbidden().
 */
export async function requireRole(minRole: AppRole) {
  const state = await getSession();
  if (state.kind === "anonymous") redirect("/login");

  const userLevel = ROLE_LEVEL[state.role] ?? 0;
  const requiredLevel = ROLE_LEVEL[minRole] ?? 100;
  if (userLevel < requiredLevel) {
    const { forbidden } = await import("next/navigation");
    forbidden();
  }
  return state;
}

/**
 * requireMfa — AAL2 step-up check. Redirects to /mfa-challenge if AAL1 only.
 * Use before destructive actions (wallet withdraw, admin mutations).
 */
export async function requireMfa() {
  const state = await requireSession();
  if (!state.hasMfa) {
    redirect("/mfa-challenge");
  }
  return state;
}

/**
 * assertOwnership — ownership check for user-scoped resources.
 * Throws an Error (not redirect) — caller decides the response.
 */
export function assertOwnership(resourceUserId: string, currentUserId: string): void {
  if (resourceUserId !== currentUserId) {
    throw new Error("FORBIDDEN_OWNERSHIP");
  }
}

export function hasRoleAtLeast(role: AppRole, min: AppRole): boolean {
  return (ROLE_LEVEL[role] ?? 0) >= (ROLE_LEVEL[min] ?? 100);
}
