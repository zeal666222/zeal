import { NextResponse } from "next/server";
import { prisma } from "@zeal/database";
import { withErrorHandler } from "@/lib/errors";

function tierFor(sparks: number): "gold" | "silver" | "bronze" {
  if (sparks >= 10000) return "gold";
  if (sparks >= 5000) return "silver";
  return "bronze";
}

export const GET = withErrorHandler(async (req: Request) => {
  const url = new URL(req.url);
  const tierFilter = url.searchParams.get("tier");

  const consultants = await prisma.consultant.findMany({
    where: { status: "VERIFIED", isActive: true },
    orderBy: [{ totalConsultations: "desc" }, { rating: "desc" }],
    take: 50,
    include: {
      user: {
        select: { id: true, name: true, username: true, avatar: true, sparks: true },
      },
    },
  });

  const items = consultants.map((c: any, idx: number) => {
    const sparks = c.user.sparks;
    const tier = tierFor(sparks);
    return {
      id: c.id,
      userId: c.userId,
      user: {
        id: c.user.id,
        name: c.user.name,
        email: "",
        avatar: c.user.avatar,
        sparks: c.user.sparks,
        role: "USER",
      },
      sparks,
      rank: idx + 1,
      tier,
      isAvailable: true,
    };
  });

  const filtered = tierFilter && tierFilter !== "all"
    ? items.filter((i: any) => i.tier === tierFilter)
    : items;

  return NextResponse.json(filtered);
});

