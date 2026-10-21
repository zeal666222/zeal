import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction, hasAPIScope, type GuardSuccess } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { safeQueryOne } from "@/lib/infra/guards";
import { z } from "zod";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BodySchema = z.object({
  targetUserId: z.string().min(1).optional(),
  targetId: z.string().min(1).optional(),
  targetType: z.enum(["user", "consultant", "ai"]).default("user"),
});

export const POST = withErrorHandler(async (req: Request) => {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  // Impersonation is the highest-privilege action in the panel. An API key
  // without the dedicated scope cannot open a session as another identity,
  // even if it authenticates as a SUPER_ADMIN user record.
  if (!hasAPIScope(guard as GuardSuccess, "impersonate:session")) {
    throw new AppError("API key missing scope impersonate:session", 403, ErrorCode.AUTH_FORBIDDEN);
  }
  const { admin, userId: adminId } = guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    throw new AppError("Invalid JSON", 400, ErrorCode.VALIDATION_INPUT);
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("targetUserId or targetId is required", 400, ErrorCode.VALIDATION_INPUT);
  }

  const { targetType } = parsed.data;
  const targetId = parsed.data.targetUserId ?? parsed.data.targetId;
  if (!targetId) throw new AppError("targetUserId or targetId is required", 400, ErrorCode.VALIDATION_INPUT);
  // AI consultants are keyed by a TEXT slug (`ai-astro-arjun`), not a User uuid;
  // only a user or human-consultant target has to be a uuid.
  if (targetType !== "ai" && !UUID_RE.test(targetId)) {
    throw new AppError("targetUserId/targetId must be a valid user id", 400, ErrorCode.VALIDATION_INPUT);
  }
  if (targetId === adminId && targetType !== "ai") {
    throw new AppError("Cannot impersonate yourself", 400, ErrorCode.AUTH_FORBIDDEN);
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  if (targetType === "ai") {
    // AI consultants are rows of `AIConsultant` keyed by a TEXT slug and have no
    // `userId` — they are not User records, so there is no auth user to assume.
    const consultant = await safeQueryOne<{
      id: string; name: string; category: string; model: string | null; isPaid: boolean;
    }>(
      admin.from("AIConsultant").select("id, name, category, model, isPaid").eq("id", targetId).maybeSingle(),
      "impersonate.ai-consultant",
    );
    if (!consultant) throw new AppError("AI consultant not found", 404, ErrorCode.NOT_FOUND);

    await logAdminAction(admin, {
      adminId, action: "IMPERSONATE_AI_START", targetType: "ai_consultant", targetId,
      metadata: { startedAt: new Date().toISOString(), expiresAt, consultantName: consultant.name },
    });

    return NextResponse.json({
      success: true, targetType: "ai", targetId, targetUserId: consultant.id,
      targetName: consultant.name, targetEmail: null, expiresAt,
    });
  }

  const target = await safeQueryOne<{ id: string; email: string; name: string | null; username: string | null; role: string }>(
    admin.from("User").select("id, email, name, username, role").eq("id", targetId).maybeSingle(),
    "impersonate.user",
  );
  if (!target) throw new AppError("Target user not found", 404, ErrorCode.NOT_FOUND);

  await logAdminAction(admin, {
    adminId, action: targetType === "consultant" ? "IMPERSONATE_CONSULTANT_START" : "IMPERSONATE_START",
    targetType, targetId, metadata: { startedAt: new Date().toISOString(), expiresAt, targetEmail: target.email },
  });

  return NextResponse.json({
    success: true, targetType, targetUserId: targetId, targetEmail: target.email,
    targetName: target.name ?? target.username, expiresAt,
  });
});
