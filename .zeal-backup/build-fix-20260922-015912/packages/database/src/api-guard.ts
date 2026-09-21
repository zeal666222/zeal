// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/database/api-guard — role guard for API routes
// ═══════════════════════════════════════════════════════════════════════════════
// Reads role from DB (never from JWT). No middleware dependency.
// ═══════════════════════════════════════════════════════════════════════════════

import "server-only";
import { NextResponse } from "next/server";
import { getSession, ROLE_LEVEL, type AppRole } from "./session";

export interface ApiGuardSuccess {
  ok: true;
  user: { id: string; email: string | null };
  role: AppRole;
  supabase: Awaited<ReturnType<typeof getSession>>["supabase"];
}

export interface ApiGuardFailure {
  ok: false;
  response: NextResponse;
}

export type ApiGuardResult = ApiGuardSuccess | ApiGuardFailure;

export async function requireApiRole(min: AppRole): Promise<ApiGuardResult> {
  const { user, role, supabase } = await getSession();

  if (!user || !role) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized", code: "AUTH_UNAUTHORIZED" },
        { status: 401 },
      ),
    };
  }

  if (ROLE_LEVEL[role] < ROLE_LEVEL[min]) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden", code: "AUTH_FORBIDDEN", yourRole: role },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    user: { id: user.id, email: user.email ?? null },
    role,
    supabase,
  };
}

export const requireApiUser = () => requireApiRole("USER");
export const requireApiAdmin = () => requireApiRole("ADMIN");
export const requireApiSuperAdmin = () => requireApiRole("SUPER_ADMIN");
