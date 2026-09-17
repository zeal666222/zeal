import { NextResponse } from "next/server";
import { prisma } from "@zeal/database/server";
import { getUserId } from "@/lib/auth";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";

export const GET = withErrorHandler(async () => {
  const userId = await getUserId();
  if (!userId) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);

  const [user, wallet, transactions, bookings, posts, notifications, consultant] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, email: true, username: true, name: true, avatar: true,
          role: true, sparks: true, isVerified: true, createdAt: true,
        },
      }),
      prisma.wallet.findUnique({ where: { userId } }),
      prisma.transaction.findMany({
        where: { wallet: { userId } },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
      prisma.booking.findMany({
        where: { userId },
        orderBy: { scheduledAt: "desc" },
        take: 500,
      }),
      prisma.post.findMany({
        where: { authorId: userId },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.consultant.findUnique({ where: { userId } }),
    ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    user,
    wallet,
    transactions,
    bookings,
    posts,
    notifications,
    consultant,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": "attachment; filename=\"zeal-data-export.json\"",
    },
  });
});

