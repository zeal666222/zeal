import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/auth/api-guard";
import { withErrorHandler } from "@/lib/errors";
import { safeQuery, safeQueryOne } from "@/lib/infra/guards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface WalletRow { id: string; balance: number }
interface TxRow {
  id: string; type: string; amount: number; balance: number;
  description: string; createdAt: string;
}

export const GET = withErrorHandler(async () => {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  const wallet = await safeQueryOne<WalletRow>(
    admin.from("Wallet").select("id, balance").eq("userId", userId).maybeSingle(),
    "earnings.wallet",
  );

  if (!wallet) {
    return NextResponse.json({ balance: 0, transactions: [] });
  }

  const transactions = await safeQuery<TxRow[]>(
    admin.from("Transaction")
      .select("id, type, amount, balance, description, createdAt")
      .eq("walletId", wallet.id)
      .order("createdAt", { ascending: false })
      .limit(50),
    "earnings.transactions",
  );

  return NextResponse.json({
    balance: wallet.balance,
    transactions: transactions ?? [],
  });
});
