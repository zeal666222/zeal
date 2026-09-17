import { NextResponse } from "next/server";
import { prisma } from "@zeal/database";
import { getUserId } from "@/lib/auth";
import { withErrorHandler } from "@/lib/errors";

export const GET = withErrorHandler(async () => {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({});

  // QuestProgress may or may not exist as a model — handle both.
  try {
    const prismaAny = prisma as unknown as {
      questProgress?: { findMany: (args: unknown) => Promise<Array<Record<string, unknown>>> };
    };
    if (prismaAny.questProgress) {
      const rows = await prismaAny.questProgress.findMany({ where: { userId } });
      const map: Record<string, unknown> = {};
      for (const r of rows) {
        const questId = r.questId as string;
        map[questId] = r;
      }
      return NextResponse.json(map);
    }
  } catch { /* fall through */ }

  return NextResponse.json({});
});

