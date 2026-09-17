import "server-only";
import { prisma } from "@zeal/database/server";
import { getUserId } from "./server";
import { AppError, ErrorCode } from "@/lib/errors";

export type Role =
  | "USER"
  | "CLIENT_ADMIN"
  | "SUPER_ADMIN"
  | "ADMIN"
  | "SUPPORT"
  | "VIEWER";

// Numeric weight per role. Higher number = more privileged.
// This is the single source of truth for permission comparisons.
const ROLE_LEVEL: Record<Role, number> = {
  VIEWER: 10,
  USER: 20,
  CLIENT_ADMIN: 40,
  SUPPORT: 50,
  ADMIN: 80,
  SUPER_ADMIN: 100,
};

export interface ActorContext {
  userId: string;
  role: Role;
  email: string | null;
  consultantId: string | null;
}

/**
 * Load the authenticated actor from the database.
 *
 * The role is read from the User table, which is the authoritative source.
 * The database row is never writable from the client, so this cannot be
 * spoofed the way self-editable profile fields can be.
 *
 * Throws 401 when unauthenticated.
 */
export async function requireActor(): Promise<ActorContext> {
  const userId = await getUserId();
  if (!userId) {
    throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      consultant: { select: { id: true } },
    },
  });

  if (!user) {
    throw new AppError("User not found", 401, ErrorCode.AUTH_UNAUTHORIZED);
  }

  return {
    userId: user.id,
    role: user.role as Role,
    email: user.email,
    consultantId: user.consultant?.id ?? null,
  };
}

/**
 * Require the caller's role to meet or exceed the given minimum.
 * Throws 403 when the caller does not have sufficient permissions.
 */
export async function requireRole(min: Role): Promise<ActorContext> {
  const actor = await requireActor();
  if (ROLE_LEVEL[actor.role] < ROLE_LEVEL[min]) {
    throw new AppError(
      "Insufficient permissions — requires " + min,
      403,
      ErrorCode.AUTH_FORBIDDEN,
    );
  }
  return actor;
}

/**
 * Require the caller to be a verified consultant.
 * Throws 403 when the caller has no consultant profile.
 */
export async function requireConsultant(): Promise<
  ActorContext & { consultantId: string }
> {
  const actor = await requireActor();
  if (!actor.consultantId) {
    throw new AppError(
      "Consultant profile required",
      403,
      ErrorCode.AUTH_FORBIDDEN,
    );
  }
  return { ...actor, consultantId: actor.consultantId };
}

