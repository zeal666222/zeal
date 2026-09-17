import { NextResponse } from "next/server";
import { prisma } from "@zeal/database";
import { withErrorHandler } from "@/lib/errors";
import { requireSuperAdmin } from "@/lib/auth/admin";

export const GET = withErrorHandler(async () => {
  await requireSuperAdmin();
  const items = await prisma.callSession.findMany({
    where: { recordingUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      booking: {
        include: {
          consultant: { include: { user: { select: { name: true } } } },
        },
      },
    },
  });
  return NextResponse.json({ items, total: items.length });
});

