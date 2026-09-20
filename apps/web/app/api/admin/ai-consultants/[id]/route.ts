// PUT/DELETE /api/admin/ai-consultants/[id]
import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  avatar: z.string().url().optional(),
  category: z.string().min(2).max(64).optional(),
  bio: z.string().max(1000).optional(),
  persona: z.string().max(2000).optional(),
  systemPrompt: z.string().max(4000).optional(),
  isPaid: z.boolean().optional(),
  perMinuteRate: z.number().int().min(0).max(500).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  specialties: z.array(z.string()).max(20).optional(),
  languages: z.array(z.string()).max(20).optional(),
}).strict();

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminAPI("ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId } = guard;
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 422 });
  }

  const { data, error } = await admin
    .from("AIConsultant")
    .update({ ...parsed.data, updatedAt: new Date().toISOString() })
    .eq("id", id).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(admin, {
    adminId, action: "AI_CONSULTANT_UPDATE", targetType: "ai_consultant",
    targetId: id, metadata: { fields: Object.keys(parsed.data) },
  });

  return NextResponse.json({ consultant: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId } = guard;
  const { id } = await params;

  // Soft delete — preserves conversation history
  const { error } = await admin
    .from("AIConsultant")
    .update({ isActive: false, updatedAt: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(admin, {
    adminId, action: "AI_CONSULTANT_DEACTIVATE", targetType: "ai_consultant",
    targetId: id, metadata: { softDelete: true },
  });

  return NextResponse.json({ success: true, id });
}
