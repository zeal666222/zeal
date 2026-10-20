import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { safeQueryOne } from "@/lib/infra/guards";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Uuid = z.string().uuid();

// Ledger view for the admin wallet console.
//
//   GET /api/admin/wallet                -> the acting admin's own wallet
//   GET /api/admin/wallet?userId=<uuid>  -> that user's wallet + identity
//
// The targeted form is what makes credit/debit safe: topup and debit both demand
// an explicit userId, so the console must read the same user's balance before
// and after. Reading someone else's wallet is a money operation, so the whole
// route requires ADMIN rather than the read-only SUPPORT tier.
export const GET = withErrorHandler(async (req: Request) => {
  const guard = await requireAdminAPI("ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId } = guard;

  const url = new URL(req.url);
  const targetParam = url.searchParams.get("userId");

  let targetUserId = adminId;
  let isTargeted = false;

  if (targetParam) {
    const parsed = Uuid.safeParse(targetParam);
    if (!parsed.success) {
      throw new AppError("userId must be a uuid", 400, ErrorCode.VALIDATION_INPUT);
    }
    targetUserId = parsed.data;
    isTargeted = true;
  }

  const identity = isTargeted
    ? await safeQueryOne<{ id: string; name: string | null; email: string; username: string | null; role: string | null }>(
        admin
          .from("User")
          .select("id, name, email, username, role")
          .eq("id", targetUserId)
          .maybeSingle(),
        "admin.wallet.identity",
      )
    : null;

  if (isTargeted && !identity) {
    throw new AppError("Target user not found", 404, ErrorCode.NOT_FOUND);
  }

  const wallet = await safeQueryOne<{
    id: string;
    balance: number;
    escrow: number;
    pendingIn: number;
    pendingOut: number;
    blocked: number;
    updatedAt: string | null;
  }>(
    admin
      .from("Wallet")
      .select("id, balance, escrow, pendingIn, pendingOut, blocked, updatedAt")
      .eq("userId", targetUserId)
      .maybeSingle(),
    "admin.wallet",
  );

  return NextResponse.json({
    wallet:
      wallet ??
      { id: null, balance: 0, escrow: 0, pendingIn: 0, pendingOut: 0, blocked: 0, updatedAt: null },
    targetUserId,
    isTargeted,
    user: identity,
  });
});
