import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { safeQuery, safeQueryOne, withAuth } from "@/lib/infra/guards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PutSchema = z.object({
  step: z.number().int().min(1).max(10),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const GET = withErrorHandler(async () => {
  const { user, supabase } = await withAuth();

  const draft = await safeQueryOne<{ step: number; payload: Record<string, unknown>; updatedAt: string | null }>(
    supabase.from("ConsultantDraft")
      .select("step, payload, updatedAt")
      .eq("userId", user.id)
      .maybeSingle(),
    "draft.read",
  );

  return NextResponse.json(draft ?? { step: 1, payload: {}, updatedAt: null });
});

export const PUT = withErrorHandler(async (req: Request) => {
  const { user, supabase } = await withAuth();

  let raw: unknown;
  try { raw = await req.json(); } catch {
    throw new AppError("Invalid JSON", 400, ErrorCode.VALIDATION_INPUT);
  }

  const parsed = PutSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("Invalid draft data", 422, ErrorCode.VALIDATION_INPUT);
  }

  await safeQuery(
    supabase.from("ConsultantDraft").upsert(
      { userId: user.id, step: parsed.data.step, payload: parsed.data.payload as never, updatedAt: new Date().toISOString() },
      { onConflict: "userId" },
    ),
    "draft.upsert",
  );

  return NextResponse.json({ success: true });
});

export const DELETE = withErrorHandler(async () => {
  const { user, supabase } = await withAuth();

  await safeQuery(
    supabase.from("ConsultantDraft").delete().eq("userId", user.id),
    "draft.delete",
  );

  return NextResponse.json({ success: true });
});
