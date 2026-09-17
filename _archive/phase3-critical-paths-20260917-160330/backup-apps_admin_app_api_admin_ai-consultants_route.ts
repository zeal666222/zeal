import { NextResponse } from "next/server";
import { prisma } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const items = await prisma.aIConsultant.findMany({
      orderBy: [{ isFeatured: "desc" }, { rating: "desc" }, { name: "asc" }],
    });

    return NextResponse.json(
      { items, total: items.length },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("[Admin AI Consultants]", error);
    return NextResponse.json({ items: [], total: 0 }, { status: 500 });
  }
}
