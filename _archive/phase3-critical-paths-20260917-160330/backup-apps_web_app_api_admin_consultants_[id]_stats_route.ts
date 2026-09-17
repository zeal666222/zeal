import { NextResponse } from "next/server";
import { prisma } from "@zeal/database/server";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { requireRole } from "@/lib/auth/rbac";

export const GET = withErrorHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    await requireRole("ADMIN");
    const { id } = await params;

    const consultant = await prisma.consultant.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });
    if (!consultant) throw new AppError("Consultant not found", 404, ErrorCode.NOT_FOUND);

    const [totalBookings, totalCalls, earnings] = await Promise.all([
      prisma.booking.count({ where: { consultantId: id } }),
      prisma.callSession.count({ where: { consultantId: id } }),
      prisma.transaction.aggregate({
        where: {
          wallet: { user: { consultant: { id } } },
          type: "COMMISSION",
        },
        _sum: { amount: true },
      }),
    ]);

    return NextResponse.json({
      consultant,
      stats: {
        totalBookings,
        totalCalls,
        totalEarnings: Math.abs(earnings._sum.amount ?? 0),
        rating: consultant.rating,
        totalConsultations: consultant.totalConsultations,
      },
    });
  },
);

