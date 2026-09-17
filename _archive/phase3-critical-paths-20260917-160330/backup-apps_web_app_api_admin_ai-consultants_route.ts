import { NextResponse } from "next/server";
import { prisma } from "@zeal/database/server";
import { withErrorHandler } from "@/lib/errors";
import { requireRole } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withErrorHandler(async () => {
  await requireRole("SUPPORT");

  const items = await prisma.aIConsultant.findMany({
    orderBy: [{ isFeatured: "desc" }, { rating: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({
    items,
    total: items.length,
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
});

