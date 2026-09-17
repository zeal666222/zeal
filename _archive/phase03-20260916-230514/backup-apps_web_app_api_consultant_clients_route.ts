import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { prisma } from "@zeal/database";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";

export const GET = withErrorHandler(async (req: Request) => {
  const userId = await getUserId();
  if (!userId) {
    throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
  }

  const consultant = await prisma.consultant.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!consultant) {
    throw new AppError("Not a consultant", 403, ErrorCode.AUTH_FORBIDDEN);
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("search") || "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const page = Math.max(parseInt(url.searchParams.get("page") || "1"), 1);

  // Distinct clients from bookings
  const where = {
    consultantId: consultant.id,
    userId: { not: null },
  };

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          email: true,
        },
      },
    },
    orderBy: { scheduledAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  // Deduplicate clients
  const clientMap = new Map<string, unknown>();
  for (const b of bookings) {
    if (b.user && !clientMap.has(b.user.id)) {
      clientMap.set(b.user.id, {
        ...b.user,
        lastSessionAt: b.scheduledAt,
        totalSessions: 0,
      });
    }
  }

  let clients = Array.from(clientMap.values());
  if (search) {
    const lower = search.toLowerCase();
    clients = clients.filter((c) => {
      const cl = c as { name?: string | null; username?: string; email?: string };
      return (
        (cl.name || "").toLowerCase().includes(lower) ||
        (cl.username || "").toLowerCase().includes(lower) ||
        (cl.email || "").toLowerCase().includes(lower)
      );
    });
  }

  return NextResponse.json({ clients, total: clients.length });
});

// BATCH3_APPLIED
