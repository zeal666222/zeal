import { z } from "zod";
import { NextResponse } from "next/server";
import {createAdminClient} from "@zeal/database/server";
import {withErrorHandler} from "@/lib/errors";
import {requireRole} from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withErrorHandler(async () => {
  await requireRole("SUPPORT");
  const admin = createAdminClient();

  const { data: items, error } = await admin
    .from("AIConsultant")
    .select("*")
    .order("isFeatured", { ascending: false })
    .order("rating", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return NextResponse.json({
    items: items ?? [],
    total: (items ?? []).length,
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
});

// ─── POST: create new AI consultant ─────────────────────────────────────────
const CreateSchema = z.object({
  name: z.string().min(2).max(80),
  avatar: z.string().url(),
  category: z.string().min(2).max(64),
  bio: z.string().max(1000),
  persona: z.string().max(2000).optional(),
  systemPrompt: z.string().min(20).max(4000),
  isPaid: z.boolean().default(false),
  perMinuteRate: z.number().int().min(0).max(500).default(0),
  isFeatured: z.boolean().default(false),
  specialties: z.array(z.string()).max(20).default([]),
  languages: z.array(z.string()).max(20).default(["English"]),
});

export const POST = withErrorHandler(async (req: Request) => {
  const guard = await requireAdminAPI("ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId } = guard;

  const body = await req.json();
  const data = CreateSchema.parse(body);

  const base = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 20);
  const username = `${base}_${Date.now().toString(36).slice(-4)}`;

  // 1. Create shadow User row (role='AI')
  const { data: userRow, error: userErr } = await admin
    .from("User")
    .insert({
      email: `${username}@ai.zeal.local`,
      username, name: data.name, avatar: data.avatar,
      role: "AI", isVerified: true, is_online: true,
    })
    .select("id").single();

  if (userErr || !userRow) throw new AppError(userErr?.message || "User create failed", 500, ErrorCode.INTERNAL_SERVER);

  // 2. Wallet for AI
  await admin.from("Wallet").insert({ userId: userRow.id, balance: 0 });

  // 3. AIConsultant row
  const { data: ai, error: aiErr } = await admin
    .from("AIConsultant")
    .insert({ id: userRow.id, username, ...data, model: "groq", responseTime: 200, accuracy: 0.95 })
    .select("*").single();

  if (aiErr || !ai) throw new AppError(aiErr?.message || "AI create failed", 500, ErrorCode.INTERNAL_SERVER);

  await logAdminAction(admin, {
    adminId, action: "AI_CONSULTANT_CREATE", targetType: "ai_consultant",
    targetId: ai.id, metadata: { name: data.name, category: data.category },
  });

  return NextResponse.json({ consultant: ai });
});
