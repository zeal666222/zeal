import { NextResponse } from "next/server";
import { prisma } from "@zeal/database";
import { withErrorHandler } from "@/lib/errors";
import { requireSuperAdmin } from "@/lib/auth/admin";

export const GET = withErrorHandler(async () => {
  const adminId = await requireSuperAdmin();
  let wallet = await prisma.wallet.findUnique({ where: { userId: adminId } });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId: adminId, balance: 0, escrow: 0, pendingIn: 0, pendingOut: 0, blocked: 0 },
    });
  }
  return NextResponse.json({ wallet });
});

