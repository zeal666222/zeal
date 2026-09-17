import { NextResponse } from "next/server";
import { prisma } from "@zeal/database/server";
import { NotificationService } from "@/lib/notifications/service";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";

export const GET = withErrorHandler(async (req: Request) => {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && auth !== "Bearer " + secret) {
    throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
  }

  const now = new Date();
  const in15Min = new Date(now.getTime() + 15 * 60 * 1000);

  const upcoming = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      scheduledAt: { gte: now, lte: in15Min },
    },
    include: { user: true, consultant: { include: { user: true } } },
  });

  for (const booking of upcoming) {
    const minutesUntil = Math.floor((booking.scheduledAt.getTime() - now.getTime()) / 60000);
    if (minutesUntil <= 5 && minutesUntil > 0) {
      await NotificationService.createNotification({
        userId: booking.userId!,
        type: "reminder",
        message: "Your booking with " + booking.consultant.user.name + " starts in 5 minutes!",
        redirectUrl: "/booking/" + booking.id,
        actorId: booking.consultant.userId,
      });
    } else if (minutesUntil <= 15 && minutesUntil > 5) {
      await NotificationService.createNotification({
        userId: booking.userId!,
        type: "reminder",
        message: "Reminder: Your booking with " + booking.consultant.user.name + " starts in 15 minutes.",
        redirectUrl: "/booking/" + booking.id,
        actorId: booking.consultant.userId,
      });
    }
  }

  return NextResponse.json({ remindersSent: upcoming.length });
});

