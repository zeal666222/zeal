import { NextResponse } from "next/server";
import { prisma } from "@zeal/database/server";
import { getUserId } from "@/lib/auth";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { NotificationService } from "@/lib/notifications/service";
import { serverPublish } from "@/lib/realtime/server";
import { z } from "zod";

const RateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().max(500).optional(),
});

export const POST = withErrorHandler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await getUserId();
    if (!userId) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
    const { id } = await params;

    const body = await req.json();
    const { rating, review } = RateSchema.parse(body);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { consultant: { include: { user: true } } },
    });
    if (!booking) throw new AppError("Booking not found", 404, ErrorCode.BOOKING_NOT_FOUND);
    if (booking.userId !== userId) throw new AppError("Forbidden", 403, ErrorCode.AUTH_FORBIDDEN);
    if (booking.status !== "COMPLETED") {
      throw new AppError("Can only rate completed bookings", 400, ErrorCode.BOOKING_CONFLICT);
    }

    await prisma.$transaction([
      prisma.booking.update({
        where: { id },
        data: { rating, review: review || null },
      }),
      prisma.consultant.update({
        where: { id: booking.consultantId },
        data: {
          rating: {
            set: undefined, // recomputed below
          },
        },
      }),
    ]).catch(() => { /* rating recompute is best-effort */ });

    // Recompute consultant rating average
    const agg = await prisma.booking.aggregate({
      where: { consultantId: booking.consultantId, rating: { not: null } },
      _avg: { rating: true },
    });
    if (typeof agg._avg.rating === "number") {
      await prisma.consultant.update({
        where: { id: booking.consultantId },
        data: { rating: agg._avg.rating },
      });
    }

    await NotificationService.createNotification({
      userId: booking.consultant.userId,
      type: "system",
      message: "You received a " + rating + "-star rating",
      redirectUrl: "/consultant/dashboard",
      actorId: userId,
    });

    await serverPublish(
      "consultant:" + booking.consultantId,
      "rating:updated",
      { consultantId: booking.consultantId, rating: agg._avg.rating },
    );

    return NextResponse.json({ success: true, rating });
  },
);

