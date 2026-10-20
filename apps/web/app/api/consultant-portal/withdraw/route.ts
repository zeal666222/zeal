// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/consultant/withdraw — Request a payout
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import {
  createAdminClient,
  createServerClientFromCookies,
} from "@zeal/database/server";
import { getPlatformSettings } from "@/lib/config/platform-settings";
import { safeQuery, safeQueryOne, rpcWithLiveSignatures, isMissingFunctionError } from "@/lib/infra/guards";
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
  // pendingOut under a row lock. The wide shape stores UPI on the ledger row;
  // the deployed function only takes p_amount, so the fallback tags the row it
  // just created — without that tag the payout is invisible in the admin queue
  // while it keeps holding the money.
  const { data, error, via } = await rpcWithLiveSignatures<{ success?: boolean; error?: string }>(
    "request_withdrawal",
    [
      () => supabase.rpc("request_withdrawal", {
        p_amount: parsed.data.amount, p_upi: parsed.data.upiId, p_bank: null,
      }),
      () => supabase.rpc("request_withdrawal", { p_amount: parsed.data.amount }),
    ],
  );

  if (isMissingFunctionError(error)) {
    return NextResponse.json({ error: "Withdrawals are unavailable: request_withdrawal is not installed" }, { status: 500 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { success?: boolean; error?: string } | null;
  if (result && result.success === false) {
    return NextResponse.json({ error: result.error || "Withdrawal failed" }, { status: 400 });
  }

  const tagged = via === 1
    ? await tagPendingWithdrawal(createAdminClient(), user.id, parsed.data.amount, parsed.data.upiId)
    : null;
  if (via === 1 && !tagged) {
    console.warn("[consultant.withdraw] payout recorded but not tagged for review — it will not appear in the admin queue");
  }

  void sendAdminBus({
    kind: "withdrawal_requested",
    label: `Payout requested ₹${parsed.data.amount}`,
    actor: user.id,
    amount: parsed.data.amount,
    meta: { upi: parsed.data.upiId, transactionId: tagged ?? null },
  });
  return NextResponse.json(result ?? { success: true });
}

interface NewRequestRow { id: string; amount: number; metadata: Record<string, unknown> | null }

// Attaches {pending, upiId} to the request the deployed RPC just inserted. It
// only ever touches the newest row for this exact amount, and skips a row that
// already carries a decision, so a concurrent request is never relabelled.
async function tagPendingWithdrawal(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  amount: number,
  upiId: string,
): Promise<string | null> {
  const wallet = await safeQueryOne<{ id: string }>(
    admin.from("Wallet").select("id").eq("userId", userId).maybeSingle(),
    "consultant.withdraw.wallet",
  );
  if (!wallet) return null;

  const row = await safeQueryOne<NewRequestRow>(
    admin
      .from("Transaction")
      .select("id, amount, metadata")
      .eq("walletId", wallet.id)
      .eq("type", "WITHDRAWAL_REQUEST")
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "consultant.withdraw.lookup",
  );
  if (!row || Math.abs(Math.abs(row.amount) - amount) >= 0.01) return null;
  if ((row.metadata ?? {}).pending !== undefined && (row.metadata ?? {}).pending !== null) return row.id;

  const updated = await safeQuery<{ id: string }[]>(
    admin
      .from("Transaction")
      .update({
        metadata: { ...(row.metadata ?? {}), pending: true, upiId, requestedAt: new Date().toISOString() },
      })
      .eq("id", row.id)
      .eq("type", "WITHDRAWAL_REQUEST")
      .select("id"),
    "consultant.withdraw.tag",
  );
  return (updated ?? []).length > 0 ? row.id : null;
}
