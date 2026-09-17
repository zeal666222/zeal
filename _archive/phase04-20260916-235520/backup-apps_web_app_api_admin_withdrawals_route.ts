import { NextResponse } from "next/server";
import { prisma, withTransaction } from "@zeal/database";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { requireSuperAdmin, logAdminAction } from "@/lib/auth/admin";
import { z } from "zod";

const ActionSchema = z.object({
  transactionId: z.string(),
  action: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().max(500).optional(),
});

export const GET = withErrorHandler(async () => {
  await requireSuperAdmin();

  const pending = await prisma.transaction.findMany({
    where: {
      type: "PAYOUT",
      metadata: { path: ["pending"], equals: true },
    },
    include: {
      wallet: {
        include: {
          user: {
            select: { id: true, name: true, email: true, username: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ withdrawals: pending });
});

export const POST = withErrorHandler(async (req: Request) => {
  const adminId = await requireSuperAdmin();

  const body = await req.json();
  const { transactionId, action, reason } = ActionSchema.parse(body);

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { wallet: { select: { id: true, userId: true } } },
  });
  if (!tx) {
    throw new AppError("Transaction not found", 404, ErrorCode.TRANSACTION_NOT_FOUND);
  }

  const meta = (tx.metadata as Record<string, unknown>) ?? {};
  if (meta.pending !== true) {
    throw new AppError(
      "Transaction is not pending",
      400,
      ErrorCode.BOOKING_CONFLICT,
    );
  }

  if (action === "APPROVE") {
    await withTransaction(async (t: any) => {
      await t.transaction.update({
        where: { id: transactionId },
        data: {
          metadata: { ...meta, pending: false, approvedAt: new Date().toISOString() },
        },
      });
      await t.wallet.update({
        where: { id: tx.wallet.id },
        data: { pendingOut: { decrement: Math.abs(tx.amount) } },
      });
    });
  } else {
    // REJECT: restore balance
    await withTransaction(async (t: any) => {
      await t.transaction.update({
        where: { id: transactionId },
        data: {
          metadata: {
            ...meta,
            pending: false,
            rejectedAt: new Date().toISOString(),
            reason: reason || "Not specified",
          },
        },
      });
      await t.wallet.update({
        where: { id: tx.wallet.id },
        data: {
          balance: { increment: Math.abs(tx.amount) },
          pendingOut: { decrement: Math.abs(tx.amount) },
        },
      });
    });
  }

  await logAdminAction({
    adminId,
    action,
    targetType: "withdrawal",
    targetId: transactionId,
    metadata: { reason },
  });

  return NextResponse.json({ success: true, action });
});

// BATCH3_APPLIED
