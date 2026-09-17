// apps/web/lib/auth/api-guard.ts
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — API Route Auth Guard
// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 (auth core):
//   Read role from JWT claim first (injected by Custom Access Token Hook).
//   Fall back to DB read when the claim hasn't been injected (pre-hook sessions).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { createServerClientFromCookies, createAdminClient } from "@zeal/database/server";

export type Role = "USER" | "CLIENT_ADMIN" | "SUPPORT" | "ADMIN" | "SUPER_ADMIN" | "VIEWER";

const ROLE_LEVEL: Record<string, number> = {
  VIEWER: 10,
  USER: 20,
  CLIENT_ADMIN: 40,
  SUPPORT: 50,
  ADMIN: 80,
  SUPER_ADMIN: 100,
};

export interface GuardSuccess {
  ok: true;
  userId: string;
  email: string | null;
  role: string;
  admin: ReturnType<typeof createAdminClient>;
}

export interface GuardFailure {
  ok: false;
  response: NextResponse;
}

export type GuardResult = GuardSuccess | GuardFailure;

export async function requireAdminAPI(
  minRole: Role = "ADMIN"
): Promise<GuardResult> {
  try {
    const supabase = await createServerClientFromCookies();

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Unauthorized", code: "AUTH_UNAUTHORIZED" },
          { status: 401 }
        ),
      };
    }

    const claimRole = user.app_metadata?.role as string | undefined;

    let role: string;
    let email: string | null = user.email ?? null;

    if (claimRole && claimRole.length > 0) {
      role = claimRole;
    } else {
      const { data: profileRaw } = await supabase
        .from("User")
        .select("role, email")
        .eq("id", user.id)
        .maybeSingle();

      const profile = profileRaw as { role?: string; email?: string | null } | null;
      role = profile?.role || "USER";
      email = profile?.email ?? user.email ?? null;
    }

    const userLevel = ROLE_LEVEL[role] ?? 0;
    const requiredLevel = ROLE_LEVEL[minRole] ?? 100;

    if (userLevel < requiredLevel) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: `Forbidden — requires ${minRole}`,
            code: "AUTH_FORBIDDEN",
            yourRole: role,
          },
          { status: 403 }
        ),
      };
    }

    return {
      ok: true,
      userId: user.id,
      email,
      role,
      admin: createAdminClient(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Auth check failed";
    return {
      ok: false,
      response: NextResponse.json(
        { error: message, code: "AUTH_ERROR" },
        { status: 500 }
      ),
    };
  }
}

export async function requireUserAPI(): Promise<GuardResult> {
  return requireAdminAPI("USER");
}

export async function requireSuperAdminAPI(): Promise<GuardResult> {
  return requireAdminAPI("SUPER_ADMIN");
}

export async function logAdminAction(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    adminId: string;
    action: string;
    targetType: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await admin.from("AdminAuditLog").insert({
      userId: params.adminId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      metadata: (params.metadata ?? {}) as never,
      success: true,
    });
  } catch (err) {
    console.warn("[Audit] Failed to log admin action:", err);
  }
}
