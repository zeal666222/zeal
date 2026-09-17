// apps/web/lib/auth/api-guard.ts
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — API Route Auth Guard
// ─────────────────────────────────────────────────────────────────────────────
// Provides role-gated authentication for every /api/admin/* and
// role-protected route. Returns either an error response (when guard fails)
// or the authenticated user context + a service-role client for the operation.
//
// Usage:
//   export async function GET(req: Request) {
//     const guard = await requireAdminAPI("ADMIN");
//     if (!guard.ok) return guard.response!;
//     const { admin, userId, role } = guard;
//     // ... use admin client for RLS-bypass queries
//   }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { createServerClientFromCookies, createAdminClient } from "@zeal/database/server";

// ─── Role hierarchy (single source of truth) ─────────────────────────────────
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

// ─── Core guard ──────────────────────────────────────────────────────────────
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

    // Read role from User table (authoritative source)
    const { data: profileRaw } = await supabase
      .from("User")
      .select("role, email")
      .eq("id", user.id)
      .maybeSingle();

    const profile = profileRaw as { role?: string; email?: string | null } | null;
    const role = profile?.role || "USER";

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
      email: profile?.email ?? user.email ?? null,
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

// ─── Convenience: user-context guard (not admin) ─────────────────────────────
export async function requireUserAPI(): Promise<GuardResult> {
  return requireAdminAPI("USER");
}

// ─── Convenience: super-admin only ───────────────────────────────────────────
export async function requireSuperAdminAPI(): Promise<GuardResult> {
  return requireAdminAPI("SUPER_ADMIN");
}

// ─── Audit helper for admin actions ──────────────────────────────────────────
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
    // Auditing is best-effort — never block the operation
    console.warn("[Audit] Failed to log admin action:", err);
  }
}