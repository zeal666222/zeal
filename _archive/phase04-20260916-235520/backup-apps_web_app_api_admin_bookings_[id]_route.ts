import { NextResponse } from "next/server";
import { prisma } from "@zeal/database";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { requireSuperAdmin, logAdminAction } from "@/lib/auth/admin";
import { z } from "zod";

const BodySchema = z.object({
  status: z.enum([
    "PENDING", "CONFIRMED", "IN_PROGRESS",
    "COMPLETED", "CANCELLED", "MISSED", "DISPUTED",
  ]),
});

export const PUT = withErrorHandler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const adminId = await requireSuperAdmin();
    const { id } = await params;
    const { status } = BodySchema.parse(await req.json());

    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) throw new AppError("Booking not found", 404, ErrorCode.BOOKING_NOT_FOUND);

    const booking = await prisma.booking.update({
      where: { id },
      data: { status: status as never },
    });

    await logAdminAction({
      adminId,
      action: "BOOKING_UPDATE_STATUS",
      targetType: "booking",
      targetId: id,
      metadata: { status },
    });

    return NextResponse.json({ booking });
  },
);
