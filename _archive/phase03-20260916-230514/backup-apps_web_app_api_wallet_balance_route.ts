import { NextResponse } from "next/server";
import { createServerClientFromCookies, getUserId } from "@zeal/database";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async () => {
  const userId = await getUserId();
  if (!userId) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);

  const supabase = await createServerClientFromCookies();
  const { data, error } = await supabase
    .from("Wallet")
    .select("id, balance, escrow, pendingIn, pendingOut, blocked")
    .eq("userId", userId)
    .single();

  if (error && error.code !== "PGRST116") throw new AppError(error.message, 500, ErrorCode.INTERNAL_SERVER);
  return NextResponse.json({ wallet: data || { balance: 0 } });
});
