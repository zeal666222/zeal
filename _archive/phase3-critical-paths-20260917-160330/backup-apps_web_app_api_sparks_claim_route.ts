import { NextResponse } from "next/server";
import { prisma, withTransaction } from "@zeal/database/server";
import { getUserId } from "@/lib/auth";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { serverPublish } from "@/lib/realtime/server";
import { z } from "zod";

const ClaimSchema = z.object({
  questId: z.string().cuid(),
  reward: z.number().int().min(1).max(10000),
});

export const POST = withErrorHandler(async (req: Request) => {
  const userId = await getUserId();
  if (!userId) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);

  const body = await req.json();
  const { questId, reward } = ClaimSchema.parse(body);

  // Idempotency via a deterministic referenceId
  const referenceId = "quest-claim:" + userId + ":" + questId;
  const existing = await prisma.transaction.findFirst({
    where: { referenceId },
  });
  if (existing) {
    return NextResponse.json({ alreadyClaimed: true, sparks: reward });
  }

  const user = await withTransaction(async (tx: any) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { sparks: { increment: reward } },
      select: { sparks: true },
    });

    // Audit trail via a zero-amount transaction (sparks aren't wallet money)
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (wallet) {
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: "TOPUP",
          amount: 0,
          balance: wallet.balance,
          description: "Quest reward: +" + reward + " Sparks",
          referenceId,
          metadata: { questId, reward, kind: "sparks" },
        },
      });
    }
    return updated;
  });

  await serverPublish("user:" + userId, "sparks:updated", { sparks: user.sparks, delta: reward });

  return NextResponse.json({ success: true, sparks: user.sparks });
});

