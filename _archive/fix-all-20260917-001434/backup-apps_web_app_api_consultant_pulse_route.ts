import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { prisma } from "@zeal/database";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";

export const GET = withErrorHandler(async () => {
  const userId = await getUserId();
  if (!userId) {
    throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
  }

  const consultant = await prisma.consultant.findUnique({
    where: { userId },
    select: {
      id: true,
      status: true,
      isActive: true,
      rating: true,
      totalConsultations: true,
    },
  });

  if (!consultant) {
    throw new AppError("Not a consultant", 403, ErrorCode.AUTH_FORBIDDEN);
  }

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const [todaysBookings, liveSessions, pendingRequests, earningsToday, unreadNotifs] =
    await Promise.all([
      prisma.booking.findMany({
        where: {
          consultantId: consultant.id,
          status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] },
          scheduledAt: { gte: startOfDay, lte: endOfDay },
        },
        include: {
          user: { select: { id: true, name: true, avatar: true } },
        },
        orderBy: { scheduledAt: "asc" },
        take: 20,
      }),
      prisma.callSession.count({
        where: { consultantId: consultant.id, status: "INITIATED" },
      }),
      prisma.booking.count({
        where: { consultantId: consultant.id, status: "PENDING" },
      }),
      prisma.transaction.aggregate({
        where: {
          wallet: { user: { id: userId } },
          type: "COMMISSION",
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        _sum: { amount: true },
      }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);

  return NextResponse.json({
    consultant,
    today: {
      bookings: todaysBookings,
      liveSessions,
      pendingRequests,
      earnings: earningsToday._sum.amount ?? 0,
    },
    unreadNotifications: unreadNotifs,
  });
});

// BATCH3_APPLIED
