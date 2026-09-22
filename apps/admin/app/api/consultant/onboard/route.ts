import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/auth/api-guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  categoryId:    z.string().min(1).max(64),
  requestedRate: z.number().int().min(10).max(5000),
  reason:        z.string().min(30).max(1000),
});

export async function POST(req: Request) {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const { data, error } = await admin.rpc("complete_consultant_onboarding", {
    p_category_id:    parsed.data.categoryId,
    p_requested_rate: parsed.data.requestedRate,
    p_reason:         parsed.data.reason,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const result = data as { success?: boolean; error?: string } | null;
  if (result && result.success === false) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
