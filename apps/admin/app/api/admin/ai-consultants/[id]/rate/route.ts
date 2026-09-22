import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  perMinuteRate: z.number().int().min(0).max(5000),
  isPaid: z.boolean(),
  reason: z.string().max(500).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId } = guard;
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
  }

  const { data, error } = await admin.rpc("admin_set_ai_rate", {
    p_ai_id: id,
    p_per_minute: parsed.data.perMinuteRate,
    p_is_paid: parsed.data.isPaid,
    p_reason: parsed.data.reason ?? "Admin update",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(admin, {
    adminId,
    action: "AI_RATE_UPDATE",
    targetType: "ai_consultant",
    targetId: id,
    metadata: { rate: parsed.data.perMinuteRate },
  });

  return NextResponse.json(data);
}
