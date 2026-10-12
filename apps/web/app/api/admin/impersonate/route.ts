// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/impersonate — Start a 15-min impersonation session
// ═══════════════════════════════════════════════════════════════════════════════
// Super admin only. Every impersonated action is logged with BOTH the actor
// (original admin) and the effective user (target). Time-boxed at 15 minutes.
//
// Supports three target types:
//   - "user"      — impersonate a regular user
//   - "consultant" — impersonate a human consultant
//   - "ai"        — impersonate an AI consultant persona ("Talk as AI")
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  targetUserId: z.string().uuid().optional(),
  targetId: z.string().uuid().optional(),
  targetType: z.enum(["user", "consultant", "ai"]).default("user"),
});

export async function POST(req: Request) {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId } = guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "targetUserId/targetId (uuid) and targetType required" },
      { status: 400 },
    );
  }

  const { targetType } = parsed.data;
  const targetId = parsed.data.targetUserId ?? parsed.data.targetId;

  if (!targetId) {
    return NextResponse.json(
      { error: "targetUserId or targetId is required" },
      { status: 400 },
    );
  }

  if (targetId === adminId && targetType !== "ai") {
    return NextResponse.json({ error: "Cannot impersonate yourself" }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  // ─── AI Consultant impersonation ──────────────────────────────────────────
  if (targetType === "ai") {
    const { data: consultant } = await admin
      .from("Consultant")
      .select("id, userId, bio, specialties")
      .eq("id", targetId)
      .maybeSingle();

    if (!consultant) {
      return NextResponse.json({ error: "AI consultant not found" }, { status: 404 });
    }

    // Fetch the user row linked to this consultant for name/email
    const { data: aiUser } = await admin
      .from("User")
      .select("id, email, name, username")
      .eq("id", consultant.userId as string)
      .maybeSingle();

    await logAdminAction(admin, {
      adminId,
      action: "IMPERSONATE_AI_START",
      targetType: "ai_consultant",
      targetId,
      metadata: {
        startedAt: new Date().toISOString(),
        expiresAt,
        consultantName: aiUser?.name ?? "AI Consultant",
      },
    });

    return NextResponse.json({
      success: true,
      targetType: "ai",
      targetId,
      targetUserId: consultant.userId,
      targetName: aiUser?.name ?? "AI Consultant",
      targetEmail: aiUser?.email ?? null,
      expiresAt,
    });
  }

  // ─── User / Consultant impersonation ──────────────────────────────────────
  const { data: target } = await admin
    .from("User")
    .select("id, email, name, username, role")
    .eq("id", targetId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "Target user not found" }, { status: 404 });
  }

  const auditAction = targetType === "consultant"
    ? "IMPERSONATE_CONSULTANT_START"
    : "IMPERSONATE_START";

  await logAdminAction(admin, {
    adminId,
    action: auditAction,
    targetType,
    targetId,
    metadata: { startedAt: new Date().toISOString(), expiresAt, targetEmail: target.email },
  });

  return NextResponse.json({
    success: true,
    targetType,
    targetUserId: targetId,
    targetEmail: target.email,
    targetName: target.name ?? target.username,
    expiresAt,
  });
}
