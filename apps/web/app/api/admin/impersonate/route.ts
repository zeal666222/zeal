// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/impersonate — Start a 15-min impersonation session
// ═══════════════════════════════════════════════════════════════════════════════
// Super admin only. Every impersonated action is logged with BOTH the actor
// (original admin) and the effective user (target). Time-boxed at 15 minutes.
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({ targetUserId: z.string().uuid() });

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
    return NextResponse.json({ error: "targetUserId (uuid) required" }, { status: 400 });
  }
  const { targetUserId } = parsed.data;

  if (targetUserId === adminId) {
    return NextResponse.json({ error: "Cannot impersonate yourself" }, { status: 400 });
  }

  const { data: target } = await admin
    .from("User")
    .select("id, email, name, username, role")
    .eq("id", targetUserId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "Target user not found" }, { status: 404 });
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await logAdminAction(admin, {
    adminId,
    action: "IMPERSONATE_START",
    targetType: "user",
    targetId: targetUserId,
    metadata: { startedAt: new Date().toISOString(), expiresAt, targetEmail: target.email },
  });

  return NextResponse.json({
    success: true,
    targetUserId,
    targetEmail: target.email,
    targetName: target.name ?? target.username,
    expiresAt,
  });
}
