// ZEAL_FIX_PHASE2_DRAFT
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PutSchema = z.object({
  step: z.number().int().min(1).max(10),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export async function GET() {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("ConsultantDraft")
    .select("step, payload, updatedAt")
    .eq("userId", user.id)
    .maybeSingle();

  return NextResponse.json(data ?? { step: 1, payload: {}, updatedAt: null });
}

export async function PUT(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = PutSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 422 });

  const { error } = await supabase.from("ConsultantDraft").upsert(
    {
      userId: user.id,
      step: parsed.data.step,
      payload: parsed.data.payload as never,
      updatedAt: new Date().toISOString(),
    },
    { onConflict: "userId" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.from("ConsultantDraft").delete().eq("userId", user.id);
  return NextResponse.json({ success: true });
}
