import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { withErrorHandler } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id: userId } = await params;

    const supabase = await createServerClientFromCookies();
    const { data: posts } = await supabase
      .from("Post")
      .select("id, content, mediaUrls, cheerCount, commentCount, createdAt")
      .eq("authorId", userId)
      .eq("isFlagged", false)
      .order("createdAt", { ascending: false })
      .limit(60);

    return NextResponse.json(
      (posts ?? []).map((p) => ({
        id: p.id,
        imageUrl: Array.isArray(p.mediaUrls) && p.mediaUrls.length ? p.mediaUrls[0] : null,
        content: p.content,
        cheerCount: p.cheerCount,
        commentCount: p.commentCount,
        createdAt: p.createdAt,
      })),
    );
  },
);
