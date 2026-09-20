import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { startSession } from "@/lib/billing/session-service";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  consultantId: z.string().uuid().optional(),
  aiConsultantId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
}).refine((d) => d.consultantId || d.aiConsultantId, {
  message: "consultantId or aiConsultantId required",
});

export async function POST(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 422 },
    );
  }

  const result = await startSession({
    userId: user.id,
    consultantId: parsed.data.consultantId ?? null,
    aiConsultantId: parsed.data.aiConsultantId ?? null,
    conversationId: parsed.data.conversationId ?? null,
  });

  const status =
    result.success ? 200 :
    result.code === "LOW_BALANCE" ? 402 :
    result.code === "NOT_CONSULTANT" ? 404 :
    500;

  return NextResponse.json(result, { status });
}
