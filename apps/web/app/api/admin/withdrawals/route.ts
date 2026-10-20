import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction, hasAPIScope } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { safeQuery, safeQueryOne, rpcWithLiveSignatures, isMissingFunctionError } from "@/lib/infra/guards";
import { createAdminClient, createServerClientFromCookies } from "@zeal/database/server";
import { serverPublish } from "@/lib/realtime/server";
import { sendAdminBus } from "@/lib/realtime/admin-bus";

export const dynamic = "force-dynamic";

interface TxRow { id: string; amount: number; description: string; createdAt: string; metadata: Record<string, unknown> | null; walletId: string }
interface WalletRow { id: string; userId: string }
interface UserRow { id: string; name: string | null; username: string | null; email: string }

export const GET = withErrorHandler(async () => {
  const guard = await requireAdminAPI("ADMIN");
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const txs = await safeQuery<TxRow[]>(
    admin.from("Transaction")
      .select("id, amount, description, createdAt, metadata, walletId")
      .eq("type", "WITHDRAWAL_REQUEST")
      .order("createdAt", { ascending: false })
      .limit(200),
    "admin.withdrawals.list",
  );

  const pending = (txs ?? []).filter((t) => {
    const meta = t.metadata ?? {};
    return meta.pending === true;
  });

  if (pending.length === 0) return NextResponse.json({ withdrawals: [] });

  const walletIds = Array.from(new Set(pending.map((t) => t.walletId)));
  const wallets = await safeQuery<WalletRow[]>(
    admin.from("Wallet").select("id, userId").in("id", walletIds),
    "admin.withdrawals.wallets",
  );

  const userIds = Array.from(new Set((wallets ?? []).map((w) => w.userId)));
  const users = userIds.length > 0
    ? await safeQuery<UserRow[]>(admin.from("User").select("id, name, username, email").in("id", userIds), "admin.withdrawals.users")
    : [];

  const userById = new Map<string, UserRow>();
  for (const u of (users ?? [])) userById.set(u.id, u);
  const walletById = new Map<string, WalletRow>();
  for (const w of (wallets ?? [])) walletById.set(w.id, w);

  const withdrawals = pending.map((t) => {
    const wallet = walletById.get(t.walletId);
    const user = wallet ? userById.get(wallet.userId) : null;
    return {
      id: t.id, amount: t.amount, description: t.description, createdAt: t.createdAt, metadata: t.metadata,
      wallet: { user: user ? { id: user.id, name: user.name, username: user.username, email: user.email } : { id: "unknown", name: null, username: "unknown", email: "" } },
    };
  });

  return NextResponse.json({ withdrawals });
});

export const POST = withErrorHandler(async (req: Request) => {
  const guard = await requireAdminAPI("ADMIN");
  if (!guard.ok) return guard.response;
  if (!hasAPIScope(guard, "withdraw:process")) {
    throw new AppError("API key missing scope withdraw:process", 403, ErrorCode.AUTH_FORBIDDEN);
  }
  const { admin, userId: adminId } = guard;

  let body: { transactionId?: string; action?: string; reason?: string };
  try { body = await req.json(); } catch {
    throw new AppError("Invalid JSON", 400, ErrorCode.VALIDATION_INPUT);
  }

  const { transactionId, action, reason } = body;
  if (!transactionId || !["APPROVE", "REJECT"].includes(action || "")) {
    throw new AppError("Invalid transactionId or action", 400, ErrorCode.VALIDATION_INPUT);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(transactionId)) {
    throw new AppError("Invalid transactionId or action", 400, ErrorCode.VALIDATION_INPUT);
  }

  // The live database answers process_withdrawal(p_txn_id text, p_approved
  // boolean), and that function authorises through auth_is_admin(), which reads
  // auth.uid() — always NULL on the service-role client, so it answers
  // 'forbidden' to every admin call (proven against prod). The wider shape is
  // still tried first because that is what 20261020150000_withdrawals_fix.sql
  // installs, and it carries the actor + reason into the ledger; the fallback
  // runs on the admin's own session, where auth.uid() resolves and the check
  // passes. Money is moved correctly either way: request_withdrawal already
  // debited balance into pendingOut, and approval only relabels the ledger row.
  const { data, error, via } = await rpcWithLiveSignatures<{ success?: boolean; error?: string }>(
    "process_withdrawal",
    [
      () => admin.rpc("process_withdrawal", {
        p_txn_id: transactionId, p_action: action, p_actor_id: adminId,
      }),
      async () => {
        const session = await createServerClientFromCookies();
        return session.rpc("process_withdrawal", {
          p_txn_id: transactionId, p_approved: action === "APPROVE",
        });
      },
    ],
  );

  if (isMissingFunctionError(error)) {
    throw new AppError(
      "Withdrawal processing needs 20261020150000_withdrawals_fix.sql applied",
      501, ErrorCode.INTERNAL_DATABASE,
    );
  }
  if (error) throw new AppError(error.message, 500, ErrorCode.INTERNAL_DATABASE);

  const outcome = data as { success?: boolean; error?: string } | null;
  if (outcome?.success === false) {
    if (outcome.error === "forbidden") {
      throw new AppError(
        "The database refused this payout decision: the live process_withdrawal checks the caller's own role, so sign in again as an admin — or apply 20261020150000_withdrawals_fix.sql to record the acting admin explicitly.",
        403, ErrorCode.AUTH_FORBIDDEN,
      );
    }
    throw new AppError(outcome.error || "RPC failed", 500, ErrorCode.INTERNAL_DATABASE);
  }

  // Only the live signature needs this, and only on approval: it relabels the
  // ledger row without releasing the hold, so pendingOut would keep counting
  // money that has already left the platform. (Its reject path does refund and
  // decrement in one go, so there is nothing to repair there.)
  if (via === 1 && action === "APPROVE") {
    const hold = await releasePendingOutHold(admin, transactionId, adminId);
    if (hold?.changed) {
      void serverPublish("admin:reconciliation", "reconciliation:updated", {
        type: "UPDATE",
        record: { walletId: hold.walletId, changed: true, pendingOut: hold.after },
      });
    }
  }

  await logAdminAction(admin, {
    adminId, action: action === "APPROVE" ? "WITHDRAWAL_APPROVE" : "WITHDRAWAL_REJECT",
    targetType: "withdrawal", targetId: transactionId, metadata: { reason },
  });

  void sendAdminBus({
    kind: action === "APPROVE" ? "withdrawal_approved" : "withdrawal_rejected",
    label: `Withdrawal ${transactionId.slice(0, 8)} ${action === "APPROVE" ? "approved" : "rejected"}`,
    actor: adminId,
    meta: { transactionId, reason: reason ?? null },
  });

  return NextResponse.json({ success: true, action });
});

interface HoldRow { id: string; amount: number; metadata: Record<string, unknown> | null }

const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

// pendingOut is a derived number: the sum of every payout request still waiting
// for a decision. The deployed process_withdrawal knows nothing about that, so
// after it stamps an approval we recompute the hold from the ledger and record
// the repair, otherwise the consultant's "processing" balance never drains.
async function releasePendingOutHold(
  admin: ReturnType<typeof createAdminClient>,
  transactionId: string,
  actorId: string,
) {
  const txn = await safeQueryOne<{ walletId: string }>(
    admin.from("Transaction").select("walletId").eq("id", transactionId).maybeSingle(),
    "admin.withdrawals.hold.lookup",
  );
  if (!txn?.walletId) return null;

  const holds = await safeQuery<HoldRow[]>(
    admin
      .from("Transaction")
      .select("id, amount, metadata")
      .eq("walletId", txn.walletId)
      .eq("type", "WITHDRAWAL_REQUEST")
      .limit(1000),
    "admin.withdrawals.hold.scan",
  );

  const outstanding = (holds ?? []).reduce((sum, hold) => (
    (hold.metadata ?? {}).pending === false ? sum : sum + Math.abs(hold.amount)
  ), 0);

  const wallet = await safeQueryOne<{ id: string; pendingOut: number }>(
    admin.from("Wallet").select("id, pendingOut").eq("id", txn.walletId).maybeSingle(),
    "admin.withdrawals.hold.wallet",
  );
  if (!wallet) return null;

  const before = round2(wallet.pendingOut);
  const after = round2(outstanding);
  if (Math.abs(before - after) < 0.01) return { walletId: wallet.id, changed: false, before, after };

  // Compare-and-set: a payout decided concurrently moves pendingOut itself, and
  // its own write must win over this stale snapshot.
  const fixed = await safeQuery<{ id: string }[]>(
    admin
      .from("Wallet")
      .update({ pendingOut: after, updatedAt: new Date().toISOString() })
      .eq("id", wallet.id)
      .eq("pendingOut", wallet.pendingOut)
      .select("id"),
    "admin.withdrawals.hold.repair",
  );
  if ((fixed ?? []).length === 0) return { walletId: wallet.id, changed: false, before, after };

  const audit = await admin.from("BillingDiscrepancy").insert({
    id: crypto.randomUUID(),
    type: "pendingout_drift",
    walletId: wallet.id,
    expected: before,
    actual: after,
    difference: round2(before - after),
    status: "resolved",
    autoCorrected: true,
    notes: `Recomputed pendingOut after payout ${transactionId.slice(0, 8)} was approved by ${actorId}; the deployed process_withdrawal does not release the hold`,
    createdAt: new Date().toISOString(),
    resolvedAt: new Date().toISOString(),
  } as never);
  if (audit.error) {
    // The payout and the repair are already committed — a missing audit row is
    // surfaced to the operator, never dressed up as a failed approval.
    console.warn("[admin.withdrawals] pendingOut audit row failed:", audit.error.message);
  }

  return { walletId: wallet.id, changed: true, before, after };
}
