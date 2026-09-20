// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — API Auth Guard
// ═══════════════════════════════════════════════════════════════════════════════
// Accepts auth from EITHER:
//   1. Bearer token (admin proxy)   — admin app sends this
//   2. Supabase session cookie      — direct client calls
//
// Additionally supports impersonation:
//   Super admins may send an `X-Act-As-User-Id` header to act as another user.
//   Every impersonated action is audited with the ORIGINAL admin's id.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  createServerClientFromCookies,
  createAdminClient,
} from "@zeal/database/server";

export type Role =
  | "USER"
  | "CLIENT_ADMIN"
  | "SUPPORT"
  | "ADMIN"
  | "SUPER_ADMIN"
  | "VIEWER";

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
  /** Present when this request is impersonated. */
  impersonatorId?: string;
  /** True when a super-admin is acting as another user. */
  isImpersonating?: boolean;
}

export interface GuardFailure {
  ok: false;
  response: NextResponse;
}

export type GuardResult = GuardSuccess | GuardFailure;

// ─── Bearer token verification ────────────────────────────────────────────────
async function verifyAccessToken(
  token: string,
): Promise<{ userId: string; email: string | null; role: string } | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return null;

    const user = data.user;
    let role = (user.app_metadata?.role as string) ?? "";

    // Token may be stale — DB fallback
    if (!role) {
      const { data: profile } = await admin
        .from("User")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      role = (profile?.role as string) || "USER";
    }

    return { userId: user.id, email: user.email ?? null, role };
  } catch {
    return null;
  }
}

// ─── Read Authorization header safely ─────────────────────────────────────────
async function getAuthHeader(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("authorization");
  } catch {
    return null;
  }
}

// ─── Read X-Act-As-User-Id safely ─────────────────────────────────────────────
async function getImpersonationHeader(): Promise<string | null> {
  try {
    const h = await headers();
    const v = h.get("x-act-as-user-id");
    return v && v.trim().length > 0 ? v.trim() : null;
  } catch {
    return null;
  }
}

// ─── Audit log helper ─────────────────────────────────────────────────────────
export async function logAdminAction(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    adminId: string;
    action: string;
    targetType: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await admin.from("AdminAuditLog").insert({
      userId: params.adminId,
      action: params.action,
      targetName: params.targetType,
      targetId: params.targetId ?? null,
      metadata: (params.metadata ?? {}) as never,
      success: true,
    });
  } catch (err) {
    console.warn("[Audit] Failed to log admin action:", err);
  }
}

// ─── Core guard ───────────────────────────────────────────────────────────────
export async function requireAdminAPI(
  minRole: Role = "ADMIN",
): Promise<GuardResult> {
  try {
    let userId: string | null = null;
    let email: string | null = null;
    let role = "USER";
    let actorId: string | undefined = undefined;
    let isImpersonating = false;

    // ─── Path A: Bearer token (admin proxy) ───────────────────────────────
    const authHeader = await getAuthHeader();
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      const verified = await verifyAccessToken(token);
      if (verified) {
        userId = verified.userId;
        email = verified.email;
        role = verified.role;
      }
    }

    // ─── Path B: Cookie session (direct client) ───────────────────────────
    if (!userId) {
      const supabase = await createServerClientFromCookies();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!error && user) {
        userId = user.id;
        email = user.email ?? null;
        role = (user.app_metadata?.role as string) ?? "USER";

        if (!user.app_metadata?.role) {
          const { data: profile } = await supabase
            .from("User")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
          role = (profile?.role as string) || "USER";
        }
      }
    }

    if (!userId) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Unauthorized", code: "AUTH_UNAUTHORIZED" },
          { status: 401 },
        ),
      };
    }

    // ─── Impersonation check: super-admin only ────────────────────────────
    const actAs = await getImpersonationHeader();
    if (actAs && role === "SUPER_ADMIN" && actAs !== userId) {
      const admin = createAdminClient();
      const { data: target } = await admin
        .from("User")
        .select("id, email, role")
        .eq("id", actAs)
        .maybeSingle();

      if (target) {
        // Audit the impersonated action — actor is the ORIGINAL admin
        await logAdminAction(admin, {
          adminId: userId,
          action: "IMPERSONATE_ACTION",
          targetType: "user",
          targetId: actAs,
        });
        actorId = userId;
        isImpersonating = true;
        userId = target.id;
        email = target.email ?? null;
        role = (target.role as string) ?? "USER";
      }
    }

    // ─── Role level check ─────────────────────────────────────────────────
    const userLevel = ROLE_LEVEL[role] ?? 0;
    const requiredLevel = ROLE_LEVEL[minRole] ?? 100;

    if (userLevel < requiredLevel) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: "Forbidden - requires " + minRole,
            code: "AUTH_FORBIDDEN",
            yourRole: role,
          },
          { status: 403 },
        ),
      };
    }

    const result: GuardSuccess = {
      ok: true,
      userId,
      email,
      role,
      admin: createAdminClient(),
    };
    if (isImpersonating) {
      result.isImpersonating = true;
      result.impersonatorId = actorId;
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Auth check failed";
    return {
      ok: false,
      response: NextResponse.json(
        { error: message, code: "AUTH_ERROR" },
        { status: 500 },
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
