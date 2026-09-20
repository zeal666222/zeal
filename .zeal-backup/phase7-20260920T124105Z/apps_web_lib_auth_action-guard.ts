// apps/web/lib/auth/action-guard.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Server Action security guard — Zod validation + auth + rate limiting.
// ─────────────────────────────────────────────────────────────────────────────
// Every "use server" function is a public POST endpoint. Middleware can be
// bypassed (CVE-2025-29927); the only safe pattern is to re-verify inside the
// action. This module provides a composable wrapper.
//
// Usage:
//   export const myAction = guardedAction({
//     schema: z.object({ name: z.string().min(1) }),
//     require: "USER",
//     rateLimit: { key: "my-action", max: 10, windowSec: 60 },
//   }, async ({ data, session }) => {
//     // session is guaranteed authenticated, data is validated
//     return { ok: true };
//   });
// ═══════════════════════════════════════════════════════════════════════════════

import "server-only";
import { z } from "zod";
import { getSession, type AppRole } from "./dal";
import { checkRateLimit, generalLimiter, authLimiter } from "@/lib/rate-limit";

const ROLE_LEVEL: Record<AppRole, number> = {
  VIEWER: 10, USER: 20, CLIENT_ADMIN: 40, SUPPORT: 50, ADMIN: 80, SUPER_ADMIN: 100,
};

export class ActionError extends Error {
  constructor(
    public readonly code:
      | "UNAUTHENTICATED"
      | "FORBIDDEN"
      | "VALIDATION"
      | "RATE_LIMITED"
      | "INTERNAL",
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

interface GuardOptions<S extends z.ZodTypeAny> {
  schema: S;
  require?: AppRole;
  requireMfa?: boolean;
  rateLimit?:
    | { key: string; max: number; windowSec: number }
    | "general"
    | "auth"
    | false;
}

type GuardedCtx<D> = {
  data: D;
  userId: string;
  role: AppRole;
  hasMfa: boolean;
};

/**
 * guardedAction — wrap a Server Action body with validation + auth + rate limit.
 * Returns a function that always resolves to a discriminated union.
 */
export function guardedAction<S extends z.ZodTypeAny, R>(
  options: GuardOptions<S>,
  handler: (ctx: GuardedCtx<z.infer<S>>) => Promise<R>,
): (input: unknown) => Promise<ActionResult<R>> {
  return async (input: unknown): Promise<ActionResult<R>> => {
    // ── 1. Validate input ──────────────────────────────────────────────────
    const parsed = options.schema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
          details: parsed.error.issues,
        },
      };
    }

    // ── 2. Verify auth INSIDE the action (never trust middleware) ─────────
    const session = await getSession();
    if (session.kind === "anonymous") {
      return { ok: false, error: { code: "UNAUTHENTICATED", message: "Please sign in." } };
    }

    // ── 3. Authorization (role + MFA) ─────────────────────────────────────
    if (options.require) {
      const userLevel = ROLE_LEVEL[session.role] ?? 0;
      const requiredLevel = ROLE_LEVEL[options.require] ?? 100;
      if (userLevel < requiredLevel) {
        return { ok: false, error: { code: "FORBIDDEN", message: "Insufficient permissions." } };
      }
    }
    if (options.requireMfa && !session.hasMfa) {
      return { ok: false, error: { code: "FORBIDDEN", message: "MFA required. Please complete step-up." } };
    }

    // ── 4. Rate limit ─────────────────────────────────────────────────────
    if (options.rateLimit !== false) {
      const rl =
        options.rateLimit === "auth" ? authLimiter :
        options.rateLimit === "general" || !options.rateLimit ? generalLimiter :
        null;

      const identifier = options.rateLimit && typeof options.rateLimit === "object"
        ? `${options.rateLimit.key}:${session.userId}`
        : `action:${session.userId}`;

      if (rl) {
        const check = await checkRateLimit(rl, identifier);
        if (!check.ok) {
          return {
            ok: false,
            error: {
              code: "RATE_LIMITED",
              message: "Too many requests. Please wait.",
              details: { retryAfter: check.retryAfter },
            },
          };
        }
      }
    }

    // ── 5. Execute ────────────────────────────────────────────────────────
    try {
      const result = await handler({
        data: parsed.data as z.infer<S>,
        userId: session.user.id,
        role: session.role,
        hasMfa: session.hasMfa,
      });
      return { ok: true, data: result };
    } catch (err) {
      console.error("[guardedAction]", err);
      return {
        ok: false,
        error: {
          code: "INTERNAL",
          message: err instanceof ActionError ? err.message : "Something went wrong.",
        },
      };
    }
  };
}
