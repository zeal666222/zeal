import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction, hasAPIScope } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { safeQuery, safeRpc } from "@/lib/infra/guards";
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

  const rpcData = await safeRpc<{ success?: boolean; error?: string }>(
    admin.rpc("process_withdrawal", { p_txn_id: transactionId, p_action: action, p_actor_id: adminId }),
    "admin.withdrawals.process",
  );

  if (rpcData?.success === false) {
    throw new AppError(rpcData.error || "RPC failed", 500, ErrorCode.INTERNAL_DATABASE);
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
