// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL Admin — API Auth Guard
// ═══════════════════════════════════════════════════════════════════════════════
// Accepts auth from EITHER:
//   1. Bearer token  — admin app proxy or service-to-service call
//   2. Cookie session — direct client calls (Supabase SSR)
//
// Reads role from the User table (single indexed SELECT — never trusts JWT).
// Supports super-admin impersonation via X-Act-As-User-Id header.
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
  | "VIEWER"
  | "AI";

const ROLE_LEVEL: Record<Role, number> = {
  AI: 0,
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
  role: Role;
  admin: ReturnType<typeof createAdminClient>;
  impersonatorId?: string;
  isImpersonating?: boolean;
}

export interface GuardFailure {
  ok: false;
  response: NextResponse;
}

export type GuardResult = GuardSuccess | GuardFailure;

async function safeGetHeader(name: string): Promise<string | null> {
  try {
    const h = await headers();
    const v = h.get(name);
    return v && v.trim().length > 0 ? v.trim() : null;
  } catch {
    return null;
  }
}

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

    // Always read canonical role from DB — JWT may be stale
    const { data: profile } = await admin
      .from("User")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role) role = profile.role as string;
    if (!role) role = "USER";

    return {
      userId: user.id,
      email: user.email ?? null,
      role: role as Role,
    };
  } catch {
    return null;
  }
}

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
      action: "UPDATE",
      action_name: params.action,
      userId: params.adminId,
      actor_id: params.adminId,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      metadata: (params.metadata ?? {}) as never,
      success: true,
    } as never);
  } catch (e) {
    console.warn("[Audit] Failed to write log:", e);
  }
}

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

export async function requireAdminAPI(
  minRole: Role = "ADMIN",
): Promise<GuardResult> {
  try {
    let resolvedUserId: string | null = null;
    let resolvedEmail: string | null = null;
    let resolvedRole: Role = "USER";

    // ─── Path A: Bearer token ────────────────────────────────────────────
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

    // ─── Path B: Cookie session ──────────────────────────────────────────
    if (!resolvedUserId) {
      const supabase = await createServerClientFromCookies();
      const { data: { user }, error } = await supabase.auth.getUser();

      if (!error && user) {
        resolvedUserId = user.id;
        resolvedEmail = user.email ?? null;

        const { data: profile } = await supabase
          .from("User")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        resolvedRole = ((profile?.role as string) ??
          (user.app_metadata?.role as string) ??
          "USER") as Role;
      }
    }

    if (resolvedUserId === null) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Unauthorized", code: "AUTH_UNAUTHORIZED" },
          { status: 401 },
        ),
      };
    }

    const authenticatedUserId: string = resolvedUserId;

    // ─── Impersonation ──────────────────────────────────────────────────
    let effectiveUserId: string = authenticatedUserId;
    let effectiveEmail: string | null = resolvedEmail;
    let effectiveRole: Role = resolvedRole;
    let impersonatorId: string | null = null;

    const actAsUserId = await safeGetHeader("x-act-as-user-id");
    if (actAsUserId) {
      const imp = await resolveImpersonation(
        actAsUserId,
        authenticatedUserId,
        resolvedRole,
      );
      if (imp) {
        effectiveUserId = imp.effectiveUserId;
        effectiveEmail = imp.effectiveEmail;
        effectiveRole = imp.effectiveRole;
        impersonatorId = imp.impersonatorId;
      }
    }

    // ─── Role gate ──────────────────────────────────────────────────────
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

export async function requireUserAPI(): Promise<GuardResult> {
  return requireAdminAPI("USER");
}

export async function requireSuperAdminAPI(): Promise<GuardResult> {
  return requireAdminAPI("SUPER_ADMIN");
}
