// apps/web/app/api/wallet/balance/route.ts
import { NextResponse } from "next/server";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { safeQuery, withAuth } from "@/lib/infra/guards";

export const dynamic = "force-dynamic";

interface WalletRow {
  id: string;
  balance: number;
  escrow: number;
  pendingIn: number;
  pendingOut: number;
  blocked: number;
}

export const GET = withErrorHandler(async () => {
  const { user, supabase } = await withAuth();

  const wallet = await safeQuery<WalletRow | null>(
    supabase
      .from("Wallet")
      .select("id, balance, escrow, pendingIn, pendingOut, blocked")
      .eq("userId", user.id)
      .maybeSingle(),
    "wallet.balance",
  );

  return NextResponse.json({
    wallet: wallet ?? { balance: 0, escrow: 0, pendingIn: 0, pendingOut: 0, blocked: 0 },
  });
});
