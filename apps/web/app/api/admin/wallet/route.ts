import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/auth/api-guard";
import { withErrorHandler } from "@/lib/errors";
import { safeQueryOne } from "@/lib/infra/guards";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async () => {
  const guard = await requireAdminAPI("SUPPORT");
  if (!guard.ok) return guard.response;
  const { admin, userId } = guard;

  const wallet = await safeQueryOne<{
    balance: number; escrow: number; pendingIn: number; pendingOut: number; blocked: number;
  }>(
    admin.from("Wallet").select("id, balance, escrow, pendingIn, pendingOut, blocked").eq("userId", userId).maybeSingle(),
    "admin.wallet",
  );

  return NextResponse.json({
    wallet: wallet ?? { balance: 0, escrow: 0, pendingIn: 0, pendingOut: 0, blocked: 0 },
  });
});
