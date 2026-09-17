import { NextResponse } from "next/server";
import { serverPublish } from "@/lib/realtime/server";
import { getUserId } from "@/lib/auth";
import { prisma } from "@zeal/database";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { generateMeetingLink } from "@/lib/livekit/room";
import { NotificationService } from "@/lib/notifications/service";

export const POST = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await getUserId();
  if (!userId) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);

  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { consultant: { include: { user: true } }, user: true },
  });

  if (!booking) {
    throw new AppError("Booking not found", 404, ErrorCode.BOOKING_NOT_FOUND);
  }

  // Only consultant or user can confirm
  if (booking.consultant.userId !== userId && booking.userId !== userId) {
    throw new AppError("Not authorized", 403, ErrorCode.AUTH_FORBIDDEN);
  }

  if (booking.status === "CONFIRMED") {
    await serverPublish("booking:" + id, "booking:updated", { bookingId: id, status: "CONFIRMED" });
    return NextResponse.json({ booking });
  }

  if (booking.status !== "PENDING") {
    throw new AppError("Cannot confirm booking in current status", 400, ErrorCode.BOOKING_CONFLICT);
  }

  const meetingLink = await generateMeetingLink(id);

  const updated = await prisma.booking.update({
    where: { id },
    data: {
      status: "CONFIRMED",
      meetingLink,
    },
    include: { consultant: { include: { user: true } }, user: true },
  });

  // Notify user
  if (booking.userId) {
    await NotificationService.createNotification({
      userId: booking.userId,
      type: "booking",
      message: `Your booking with ${booking.consultant.user.name} is confirmed!`,
      redirectUrl: `/booking/${booking.id}`,
      actorId: userId,
    });
  }

  return NextResponse.json({ booking: updated });
});

// BATCH2_APPLIED
