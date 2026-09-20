// ═══════════════════════════════════════════════════════════════════════════════
// /api/admin/ai-consultants — list + create AI consultants
// ═══════════════════════════════════════════════════════════════════════════════
// GET  → list all AIConsultant rows (admin console)
// POST → create a new AI consultant (shadow User + Wallet + AIConsultant)
//
// The create path is transaction-like: if AIConsultant insert fails, the
// shadow User + Wallet are rolled back, preventing orphan rows.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════════════════════════
// GET — list all AI consultants
// ═══════════════════════════════════════════════════════════════════════════════
export const GET = withErrorHandler(async () => {
  const guard = await requireAdminAPI("SUPPORT");
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { data: items, error } = await admin
    .from("AIConsultant")
    .select("*")
    .order("isFeatured", { ascending: false })
    .order("rating", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    throw new AppError(error.message, 500, ErrorCode.INTERNAL_SERVER);
  }

  return NextResponse.json(
    {
      items: items ?? [],
      total: (items ?? []).length,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST — create new AI consultant
// ═══════════════════════════════════════════════════════════════════════════════
const CreateSchema = z.object({
  name: z.string().min(2).max(80),
  avatar: z.string().url(),
  category: z.string().min(2).max(64),
  bio: z.string().max(1000),
  persona: z.string().max(2000).optional().nullable(),
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

  // ─── Validate body ────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError("Invalid JSON", 400, ErrorCode.VALIDATION_INPUT);
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      parsed.error.issues[0]?.message || "Invalid input",
      422,
      ErrorCode.VALIDATION_INPUT,
    );
  }
  const data = parsed.data;

  // ─── Derive unique username ───────────────────────────────────────────
  const base = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
  const username = `${base || "ai"}_${Date.now().toString(36).slice(-4)}`;

  // ─── 1. Shadow User row (role='AI') ───────────────────────────────────
  const { data: userRow, error: userErr } = await admin
    .from("User")
    .insert({
      email: `${username}@ai.zeal.local`,
      username,
      name: data.name,
      avatar: data.avatar,
      role: "AI",
      isVerified: true,
      is_online: true,
    })
    .select("id")
    .single();

  if (userErr || !userRow) {
    throw new AppError(
      userErr?.message || "Failed to create shadow user",
      500,
      ErrorCode.INTERNAL_SERVER,
    );
  }

  const shadowUserId = userRow.id as string;

  // ─── 2. Wallet for AI user ────────────────────────────────────────────
  const { error: walletErr } = await admin
    .from("Wallet")
    .insert({
      userId: shadowUserId,
      balance: 0,
      escrow: 0,
      pendingIn: 0,
      pendingOut: 0,
      blocked: 0,
    });

  if (walletErr) {
    // Rollback: delete shadow user
    await admin.from("User").delete().eq("id", shadowUserId);
    throw new AppError(
      walletErr.message || "Failed to create wallet",
      500,
      ErrorCode.INTERNAL_SERVER,
    );
  }

  // ─── 3. AIConsultant row ──────────────────────────────────────────────
  const { data: ai, error: aiErr } = await admin
    .from("AIConsultant")
    .insert({
      id: shadowUserId,
      username,
      name: data.name,
      avatar: data.avatar,
      category: data.category,
      bio: data.bio,
      persona: data.persona ?? null,
      systemPrompt: data.systemPrompt,
      isPaid: data.isPaid,
      perMinuteRate: data.perMinuteRate,
      isFeatured: data.isFeatured,
      specialties: data.specialties,
      languages: data.languages,
      model: "groq",
      responseTime: 200,
      accuracy: 0.95,
      isActive: true,
    })
    .select("*")
    .single();

  if (aiErr || !ai) {
    // Rollback: delete shadow user + wallet
    await admin.from("Wallet").delete().eq("userId", shadowUserId);
    await admin.from("User").delete().eq("id", shadowUserId);
    throw new AppError(
      aiErr?.message || "Failed to create AI consultant",
      500,
      ErrorCode.INTERNAL_SERVER,
    );
  }

  // ─── 4. Audit log ─────────────────────────────────────────────────────
  await logAdminAction(admin, {
    adminId,
    action: "AI_CONSULTANT_CREATE",
    targetType: "ai_consultant",
    targetId: ai.id as string,
    metadata: { name: data.name, category: data.category },
  });

  return NextResponse.json({ consultant: ai });
});
