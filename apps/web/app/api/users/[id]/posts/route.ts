// apps/web/app/api/users/[id]/posts/route.ts
// GET → paginated posts for a user (excludes archived)
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { withErrorHandler } from "@/lib/errors";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PostRow {
  id: string;
  content: string;
  mediaUrls: string[] | null;
  cheerCount: number | null;
  commentCount: number | null;
  createdAt: string;
  mediaType: string | null;
}

export const GET = withErrorHandler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id: userId } = await params;
    if (!UUID_RE.test(userId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "12", 10), 1), 60);
    const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10), 0);

    const supabase = await createServerClientFromCookies();

    const { data, error, count } = await supabase
      .from("Post")
      .select(
        'id, content, "mediaUrls", "cheerCount", "commentCount", "createdAt", "mediaType"',
        { count: "exact" },
      )
      .eq("authorId", userId)
      .eq("isArchived", false)
      .eq("isFlagged", false)
      .order("createdAt", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as PostRow[];
    return NextResponse.json({
      items: rows.map((p) => ({
        id: p.id,
        content: p.content,
        imageUrl: Array.isArray(p.mediaUrls) && p.mediaUrls.length > 0 ? p.mediaUrls[0] : null,
        mediaUrls: p.mediaUrls ?? [],
        mediaType: p.mediaType ?? "image",
        cheerCount: p.cheerCount ?? 0,
        commentCount: p.commentCount ?? 0,
        createdAt: p.createdAt,
      })),
      total: count ?? 0,
      offset,
      limit,
      hasMore: (count ?? 0) > offset + limit,
    });
  },
);
