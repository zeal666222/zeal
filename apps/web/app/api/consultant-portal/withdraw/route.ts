// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/consultant/withdraw — Request a payout
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import {
  createAdminClient,
  createServerClientFromCookies,
} from "@zeal/database/server";
import { getPlatformSettings } from "@/lib/config/platform-settings";
import { sendAdminBus } from "@/lib/realtime/admin-bus";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  amount: z.number().positive().max(100_000),
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

  // The floor is an operator setting (Admin Settings), so raising it takes
  // effect without a deploy. Read with the service client: the table has no
  // policy for the consultant's own role.
  const settings = await getPlatformSettings(createAdminClient());
  if (parsed.data.amount < settings.minimumWithdrawalRupees) {
    return NextResponse.json(
      { error: `Minimum withdrawal is ₹${settings.minimumWithdrawalRupees}` },
      { status: 422 },
    );
  }

  // request_withdrawal reads the consultant from auth.uid() (this route uses the
  // user-scoped client, so it is populated) and atomically moves balance →
  // pendingOut under a row lock. UPI is stored on the resulting Transaction.
  const { data, error } = await supabase.rpc("request_withdrawal", {
    p_amount: parsed.data.amount,
    p_upi: parsed.data.upiId,
    p_bank: null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { success?: boolean; error?: string } | null;
  if (result && result.success === false) {
    return NextResponse.json({ error: result.error || "Withdrawal failed" }, { status: 400 });
  }
  void sendAdminBus({
    kind: "withdrawal_requested",
    label: `Payout requested ₹${parsed.data.amount}`,
    actor: user.id,
    amount: parsed.data.amount,
    meta: { upi: parsed.data.upiId },
  });
  return NextResponse.json(result ?? { success: true });
}
