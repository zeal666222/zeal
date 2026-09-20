// apps/admin/lib/auth/dal.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Admin DAL — same contract as web DAL, admin role set only.
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

const ROLE_LEVEL: Record<AppRole, number> = {
  VIEWER: 10,
  USER: 20,
  CLIENT_ADMIN: 40,
  SUPPORT: 50,
  ADMIN: 80,
  SUPER_ADMIN: 100,
};

function readRole(user: User): AppRole {
  const metaRole = String((user.app_metadata ?? {}).role ?? "").toUpperCase();
  if (metaRole) return metaRole as AppRole;
  const claim = String((user as unknown as { user_role?: string }).user_role ?? "").toUpperCase();
  if (claim) return claim as AppRole;
  return "USER";
}

export const getAdminSession = cache(async () => {
  const supabase = await createServerClientFromCookies();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { kind: "anonymous" as const };
  const role = readRole(user);
  const hasMfa = String((user as unknown as { aal?: string }).aal ?? "aal1") === "aal2";
  return { kind: "authenticated" as const, user, role, hasMfa };
});

export async function requireAdminSession() {
  const s = await getAdminSession();
  if (s.kind === "anonymous") redirect("/login");
  if (ROLE_LEVEL[s.role] < ROLE_LEVEL.VIEWER) redirect("/login?error=not_authorized");
  return s;
}

export async function requireAdminRole(minRole: AppRole) {
  const s = await requireAdminSession();
  if ((ROLE_LEVEL[s.role] ?? 0) < (ROLE_LEVEL[minRole] ?? 100)) {
    const { forbidden } = await import("next/navigation");
    forbidden();
  }
  return s;
}

export async function requireAdminMfa() {
  const s = await requireAdminSession();
  if (!s.hasMfa) redirect("/mfa-challenge");
  return s;
}
