import { NextResponse } from "next/server";
import { prisma } from "@zeal/database/server";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { requireSuperAdmin, logAdminAction } from "@/lib/auth/admin";
import * as Ledger from "@/lib/wallet/ledger";
import { z } from "zod";

const TopupSchema = z.object({ amount: z.number().positive().max(100000) });

export const POST = withErrorHandler(async (req: Request) => {
  const adminId = await requireSuperAdmin();
  const body = await req.json();
  const { amount } = TopupSchema.parse(body);

  let wallet = await prisma.wallet.findUnique({ where: { userId: adminId } });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId: adminId, balance: 0, escrow: 0, pendingIn: 0, pendingOut: 0, blocked: 0 },
    });
  }

  await Ledger.createTransaction({
    walletId: wallet.id,
    type: "TOPUP",
    amount,
    description: "Admin top-up by " + adminId,
    referenceId: "admin-topup:" + Date.now(),
  });

  await logAdminAction({ adminId, action: "WALLET_TOPUP", targetType: "wallet", targetId: wallet.id, metadata: { amount } });

  const refreshed = await prisma.wallet.findUnique({ where: { id: wallet.id } });
  return NextResponse.json({ wallet: refreshed });
});

