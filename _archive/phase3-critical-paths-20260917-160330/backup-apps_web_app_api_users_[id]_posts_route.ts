import { NextResponse } from "next/server";
import { prisma } from "@zeal/database/server";
import { withErrorHandler } from "@/lib/errors";

export const GET = withErrorHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id: userId } = await params;

    const posts = await prisma.post.findMany({
      where: { authorId: userId, isFlagged: false },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        content: true,
        mediaUrls: true,
        cheerCount: true,
        commentCount: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      posts.map((p: any) => ({
        id: p.id,
        imageUrl: p.mediaUrls?.[0] || null,
        content: p.content,
        cheerCount: p.cheerCount,
        commentCount: p.commentCount,
        createdAt: p.createdAt,
      })),
    );
  },
);

