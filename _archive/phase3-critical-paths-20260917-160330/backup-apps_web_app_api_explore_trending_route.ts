import { NextResponse } from "next/server";
import { prisma } from "@zeal/database/server";
import { withErrorHandler } from "@/lib/errors";

export const GET = withErrorHandler(async () => {
  const groups = await prisma.consultant.groupBy({
    by: ["category"],
    where: { status: "VERIFIED", isActive: true },
    _count: { _all: true },
    orderBy: { _count: { category: "desc" } },
    take: 8,
  });

  const items = groups.map((g: any) => ({
    id: g.category.toLowerCase(),
    label: g.category.replace(/_/g, " ").toLowerCase(),
    count: g._count._all,
  }));

  return NextResponse.json(items);
});

