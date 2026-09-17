import { NextResponse } from "next/server";
import { prisma } from "@zeal/database/server";
import { getUserId } from "@/lib/auth";
import { withErrorHandler } from "@/lib/errors";

export const GET = withErrorHandler(async () => {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ count: 0 });
  const count = await prisma.notification.count({ where: { userId, read: false } });
  return NextResponse.json({ count });
});

