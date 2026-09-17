import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { prisma } from "@zeal/database";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";

export const GET = withErrorHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await getUserId();
    if (!userId) {
      throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
    }
    const { id } = await params;

    const booking = await prisma.booking.findFirst({
      where: {
        id,
        OR: [
          { userId },
          { consultant: { userId } },
        ],
      },
      include: {
        consultant: { include: { user: true } },
        user: true,
        callSession: true,
      },
    });

    if (!booking) {
      throw new AppError("Booking not found", 404, ErrorCode.BOOKING_NOT_FOUND);
    }

    return NextResponse.json({ booking });
  },
);

export const DELETE = withErrorHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await getUserId();
    if (!userId) {
      throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
    }
    const { id } = await params;

    const booking = await prisma.booking.findFirst({
      where: {
        id,
        OR: [{ userId }, { consultant: { userId } }],
      },
    });

    if (!booking) {
      throw new AppError("Booking not found", 404, ErrorCode.BOOKING_NOT_FOUND);
    }

    // Soft delete → CANCELLED (refund handled elsewhere)
    const updated = await prisma.booking.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ booking: updated });
  },
);

// BATCH2_APPLIED
