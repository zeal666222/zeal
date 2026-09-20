// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/consultant/withdraw — Request a payout
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  amount: z.number().positive().min(100).max(100000),
  upiId: z.string().min(3).max(100),
});

export async function POST(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 422 });
  }

  const { data, error } = await supabase.rpc("request_withdrawal", {
    p_user_id: user.id,
    p_amount: parsed.data.amount,
    p_upi: parsed.data.upiId,
    p_bank: null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { success?: boolean; error?: string } | null;
  if (result && result.success === false) {
    return NextResponse.json({ error: result.error || "Withdrawal failed" }, { status: 400 });
  }
  return NextResponse.json(result ?? { success: true });
}
