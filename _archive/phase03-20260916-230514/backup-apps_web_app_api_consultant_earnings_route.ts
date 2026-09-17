import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { prisma } from "@zeal/database";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";

export const GET = withErrorHandler(async (req: Request) => {
  const userId = await getUserId();
  if (!userId) {
    throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
  }

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    throw new AppError("Wallet not found", 404, ErrorCode.WALLET_NOT_FOUND);
  }

  const url = new URL(req.url);
  const days = Math.min(parseInt(url.searchParams.get("days") || "30"), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [transactions, totals] = await Promise.all([
    prisma.transaction.findMany({
      where: { walletId: wallet.id, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.transaction.groupBy({
      by: ["type"],
      where: { walletId: wallet.id, createdAt: { gte: since } },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  // Daily buckets
  const dailyMap = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== "COMMISSION" && tx.type !== "PAYOUT") continue;
    const day = tx.createdAt.toISOString().slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + tx.amount);
  }
  const daily = Array.from(dailyMap.entries())
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    balance: wallet.balance,
    pendingIn: wallet.pendingIn,
    pendingOut: wallet.pendingOut,
    daily,
    totals,
    recent: transactions,
  });
});

export const POST = withErrorHandler(async (req: Request) => {
  const userId = await getUserId();
  if (!userId) {
    throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
  }

  const body = await req.json();
  const { amount, upiId, bankAccount } = body as {
    amount?: number;
    upiId?: string;
    bankAccount?: string;
  };

  if (!amount || amount <= 0) {
    throw new AppError("Invalid amount", 400, ErrorCode.VALIDATION_INPUT);
  }
  if (!upiId && !bankAccount) {
    throw new AppError(
      "UPI or bank account required",
      400,
      ErrorCode.VALIDATION_INPUT,
    );
  }

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    throw new AppError("Wallet not found", 404, ErrorCode.WALLET_NOT_FOUND);
  }
  if (wallet.balance < amount) {
    throw new AppError(
      "Insufficient balance",
      400,
      ErrorCode.WALLET_INSUFFICIENT_BALANCE,
    );
  }

  // Create a pending withdrawal transaction
  const tx = await prisma.transaction.create({
    data: {
      walletId: wallet.id,
      type: "PAYOUT",
      amount: -amount,
      balance: wallet.balance - amount,
      description: "Withdrawal request",
      referenceId: `withdrawal-${Date.now()}`,
      metadata: {
        pending: true,
        upiId,
        bankAccount,
        requestedAt: new Date().toISOString(),
      },
    },
  });

  // Move to pendingOut
  await prisma.wallet.update({
    where: { id: wallet.id },
    data: {
      balance: { decrement: amount },
      pendingOut: { increment: amount },
    },
  });

  return NextResponse.json({ transaction: tx, status: "PENDING" });
});

// BATCH3_APPLIED
