import { NextResponse } from "next/server";
import { prisma } from "@zeal/database";
import { getUserId } from "@/lib/auth";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";

export const GET = withErrorHandler(
  async (_req: Request, { params }: { params: Promise<{ userId: string }> }) => {
    const me = await getUserId();
    if (!me) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
    const { userId } = await params;
    if (userId !== me) throw new AppError("Forbidden", 403, ErrorCode.AUTH_FORBIDDEN);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://zeal.com";
    const referralLink = baseUrl + "/auth/register?ref=" + userId;

    const [referredUsers, sparksRow] = await Promise.all([
      prisma.userActivity.count({
        where: { userId: me, type: "referral" },
      }).catch(() => 0),
      prisma.user.findUnique({
        where: { id: me },
        select: { sparks: true },
      }).catch(() => null),
    ]);

    const sparksEarned = referredUsers * 50;

    return NextResponse.json({
      referralLink,
      referralCount: referredUsers,
      sparksEarned,
      totalSparks: sparksRow?.sparks ?? 0,
    });
  },
);

