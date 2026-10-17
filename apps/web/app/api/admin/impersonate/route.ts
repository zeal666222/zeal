import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { safeQueryOne } from "@/lib/infra/guards";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  targetUserId: z.string().uuid().optional(),
  targetId: z.string().uuid().optional(),
  targetType: z.enum(["user", "consultant", "ai"]).default("user"),
});

export const POST = withErrorHandler(async (req: Request) => {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId } = guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    throw new AppError("Invalid JSON", 400, ErrorCode.VALIDATION_INPUT);
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("targetUserId/targetId (uuid) and targetType required", 400, ErrorCode.VALIDATION_INPUT);
  }

  const { targetType } = parsed.data;
  const targetId = parsed.data.targetUserId ?? parsed.data.targetId;
  if (!targetId) throw new AppError("targetUserId or targetId is required", 400, ErrorCode.VALIDATION_INPUT);
  if (targetId === adminId && targetType !== "ai") {
    throw new AppError("Cannot impersonate yourself", 400, ErrorCode.AUTH_FORBIDDEN);
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  if (targetType === "ai") {
    const consultant = await safeQueryOne<{ id: string; userId: string; bio: string | null; specialties: string[] | null }>(
      admin.from("Consultant").select("id, userId, bio, specialties").eq("id", targetId).maybeSingle(),
      "impersonate.ai-consultant",
    );
    if (!consultant) throw new AppError("AI consultant not found", 404, ErrorCode.NOT_FOUND);

    const aiUser = await safeQueryOne<{ id: string; email: string; name: string | null; username: string | null }>(
      admin.from("User").select("id, email, name, username").eq("id", consultant.userId).maybeSingle(),
      "impersonate.ai-user",
    );

    await logAdminAction(admin, {
      adminId, action: "IMPERSONATE_AI_START", targetType: "ai_consultant", targetId,
      metadata: { startedAt: new Date().toISOString(), expiresAt, consultantName: aiUser?.name ?? "AI Consultant" },
    });

    return NextResponse.json({
      success: true, targetType: "ai", targetId, targetUserId: consultant.userId,
      targetName: aiUser?.name ?? "AI Consultant", targetEmail: aiUser?.email ?? null, expiresAt,
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
