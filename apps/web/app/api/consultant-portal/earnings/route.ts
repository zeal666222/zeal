// apps/admin/app/api/consultant/earnings/route.ts
import {NextResponse} from "next/server";
import {createAdminClient, createServerClientFromCookies} from "@zeal/database/server";
import {getPlatformSettings} from "@/lib/config/platform-settings";

export const dynamic = "force-dynamic";

interface WalletRow { id: string; balance: number; escrow: number; pendingOut: number }
interface TxRow {
  id: string; type: string; amount: number; balance: number;
  description: string; createdAt: string;
}

export async function GET() {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: walletRaw } = await supabase
    .from("Wallet").select("id, balance, escrow, pendingOut").eq("userId", user.id).maybeSingle();

  // The payout form enforces this floor, so it has to come from the same place
  // the API checks it — a client-side constant drifts the moment an operator
  // raises the minimum in Admin Settings.
  const settings = await getPlatformSettings(createAdminClient());

  const wallet = walletRaw as WalletRow | null;
  if (!wallet) {
    return NextResponse.json({
      balance: 0,
      escrow: 0,
      pendingOut: 0,
      minimumWithdrawal: settings.minimumWithdrawalRupees,
      platformFeePercent: settings.platformFeePercent,
      transactions: [],
    });
  }

  const { data: txRaw } = await supabase
    .from("Transaction")
    .select("id, type, amount, balance, description, createdAt")
    .eq("walletId", wallet.id)
    .order("createdAt", { ascending: false })
    .limit(50);

  return NextResponse.json({
    balance: wallet.balance,
    escrow: wallet.escrow,
    pendingOut: wallet.pendingOut,
    minimumWithdrawal: settings.minimumWithdrawalRupees,
    platformFeePercent: settings.platformFeePercent,
    transactions: (txRaw ?? []) as TxRow[],
  });
}
