import { NextResponse } from "next/server";
import { prisma } from "@zeal/database";
import { withErrorHandler } from "@/lib/errors";
import { requireSuperAdmin } from "@/lib/auth/admin";

export const GET = withErrorHandler(async (req: Request) => {
  const adminId = await requireSuperAdmin();
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);

  const wallet = await prisma.wallet.findUnique({ where: { userId: adminId } });
  if (!wallet) return NextResponse.json({ items: [] });

  const items = await prisma.transaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ items });
});

