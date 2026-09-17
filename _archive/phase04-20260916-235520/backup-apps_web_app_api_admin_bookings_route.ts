import { NextResponse } from "next/server";
import { prisma } from "@zeal/database";
import { withErrorHandler } from "@/lib/errors";
import { requireSuperAdmin } from "@/lib/auth/admin";

export const GET = withErrorHandler(async (req: Request) => {
  await requireSuperAdmin();

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const page = Math.max(parseInt(url.searchParams.get("page") || "1"), 1);

  const where = status ? { status: status as never } : {};

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        consultant: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { scheduledAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  return NextResponse.json({
    bookings,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

