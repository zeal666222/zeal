// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — API Auth Guard (enterprise)
// ═══════════════════════════════════════════════════════════════════════════════
// Accepts auth from EITHER:
//   1. Bearer token  — admin app proxy (Authorization: Bearer <jwt>)
//   2. Cookie session — direct client calls (Supabase SSR)
//
// Impersonation support:
//   Super admins may send X-Act-As-User-Id to act as another user.
//   Every impersonated request is audited with the ORIGINAL admin's id.
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

const ROLE_LEVEL: Record<Role, number> = {
  VIEWER: 10,
  USER: 20,
  CLIENT_ADMIN: 40,
  SUPPORT: 50,
  ADMIN: 80,
  SUPER_ADMIN: 100,
};

// ─── Result types (discriminated union) ───────────────────────────────────────
export interface GuardSuccess {
  ok: true;
  userId: string;
  email: string | null;
  role: Role;
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

// ─── Header helpers ───────────────────────────────────────────────────────────
async function safeGetHeader(name: string): Promise<string | null> {
  try {
    const h = await headers();
    const v = h.get(name);
    return v && v.trim().length > 0 ? v.trim() : null;
  } catch {
    return null;
  }
}

// ─── Bearer verification ──────────────────────────────────────────────────────
interface Verified {
  userId: string;
  email: string | null;
  role: Role;
}

async function verifyAccessToken(token: string): Promise<Verified | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return null;

    const user = data.user;
    let role = (user.app_metadata?.role as string) || "";

    // Stale token fallback — read canonical role from DB
    if (!role) {
      const { data: profile } = await admin
        .from("User")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      role = (profile?.role as string) || "USER";
    }

    return {
      userId: user.id,
      email: user.email ?? null,
      role: role as Role,
    };
  } catch {
    return null;
  }
}

// ─── Audit helper ─────────────────────────────────────────────────────────────
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
  } catch (e) {
    console.warn("[Audit] Failed to write log:", e);
  }
}

// ─── Impersonation resolver ───────────────────────────────────────────────────
interface ImpersonationResult {
  effectiveUserId: string;
  effectiveEmail: string | null;
  effectiveRole: Role;
  impersonatorId: string | null;
}

async function resolveImpersonation(
  actAsUserId: string,
  actorUserId: string,
  actorRole: Role,
): Promise<ImpersonationResult | null> {
  if (actorRole !== "SUPER_ADMIN") return null;
  if (actAsUserId === actorUserId) return null;

  try {
    const admin = createAdminClient();
    const { data: target } = await admin
      .from("User")
      .select("id, email, role")
      .eq("id", actAsUserId)
      .maybeSingle();

    if (!target) return null;

    await logAdminAction(admin, {
      adminId: actorUserId,
      action: "IMPERSONATE_ACTION",
      targetType: "user",
      targetId: actAsUserId,
    });

    return {
      effectiveUserId: target.id as string,
      effectiveEmail: (target.email as string | null) ?? null,
      effectiveRole: ((target.role as string) ?? "USER") as Role,
      impersonatorId: actorUserId,
    };
  } catch {
    return null;
  }
}

// ─── Core guard ───────────────────────────────────────────────────────────────
export async function requireAdminAPI(
  minRole: Role = "ADMIN",
): Promise<GuardResult> {
  try {
    // ─── Resolve identity ─────────────────────────────────────────────────
    let resolvedUserId: string | null = null;
    let resolvedEmail: string | null = null;
    let resolvedRole: Role = "USER";

    // Path A: Bearer
    const authHeader = await safeGetHeader("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      const verified = await verifyAccessToken(token);
      if (verified) {
        resolvedUserId = verified.userId;
        resolvedEmail = verified.email;
        resolvedRole = verified.role;
      }
    }

    // Path B: Cookie session
    if (!resolvedUserId) {
      const supabase = await createServerClientFromCookies();
      const { data: { user }, error } = await supabase.auth.getUser();

      if (!error && user) {
        resolvedUserId = user.id;
        resolvedEmail = user.email ?? null;
        const metaRole = (user.app_metadata?.role as string) || "";

        if (metaRole) {
          resolvedRole = metaRole as Role;
        } else {
          const { data: profile } = await supabase
            .from("User")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
          resolvedRole = ((profile?.role as string) ?? "USER") as Role;
        }
      }
    }

    // ─── Auth gate — narrow to non-null string ────────────────────────────
    if (resolvedUserId === null) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Unauthorized", code: "AUTH_UNAUTHORIZED" },
          { status: 401 },
        ),
      };
    }

    // Snapshot for later use. TS narrows `resolvedUserId` to `string` here.
    const authenticatedUserId: string = resolvedUserId;

    // ─── Impersonation ────────────────────────────────────────────────────
    let effectiveUserId: string = authenticatedUserId;
    let effectiveEmail: string | null = resolvedEmail;
    let effectiveRole: Role = resolvedRole;
    let impersonatorId: string | null = null;

    const actAsUserId = await safeGetHeader("x-act-as-user-id");
    if (actAsUserId) {
      const impersonation = await resolveImpersonation(
        actAsUserId,
        authenticatedUserId,
        resolvedRole,
      );
      if (impersonation) {
        effectiveUserId = impersonation.effectiveUserId;
        effectiveEmail = impersonation.effectiveEmail;
        effectiveRole = impersonation.effectiveRole;
        impersonatorId = impersonation.impersonatorId;
      }
    }

    // ─── Role level check ─────────────────────────────────────────────────
    const userLevel = ROLE_LEVEL[effectiveRole] ?? 0;
    const requiredLevel = ROLE_LEVEL[minRole] ?? 100;

    if (userLevel < requiredLevel) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: `Forbidden — requires ${minRole}`,
            code: "AUTH_FORBIDDEN",
            yourRole: effectiveRole,
          },
          { status: 403 },
        ),
      };
    }

    // ─── Build success result ─────────────────────────────────────────────
    const result: GuardSuccess = {
      ok: true,
      userId: effectiveUserId,
      email: effectiveEmail,
      role: effectiveRole,
      admin: createAdminClient(),
    };

    if (impersonatorId !== null) {
      result.isImpersonating = true;
      result.impersonatorId = impersonatorId;
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

// ─── Convenience guards ───────────────────────────────────────────────────────
export async function requireUserAPI(): Promise<GuardResult> {
  return requireAdminAPI("USER");
}

export async function requireSuperAdminAPI(): Promise<GuardResult> {
  return requireAdminAPI("SUPER_ADMIN");
}
