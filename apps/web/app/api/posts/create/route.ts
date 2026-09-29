// apps/web/app/api/posts/create/route.ts
// POST → create post with limit check
import { NextResponse } from "next/server";
import { createServerClientFromCookies, getUserId } from "@zeal/database/server";
import { withErrorHandler, AppError, ErrorCode, mapPgError } from "@/lib/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PostSchema = z.object({
  content: z.string().trim().min(1).max(2200),
  mediaUrls: z.array(z.string().url()).max(10).optional(),
  locationTag: z.string().max(100).optional(),
});

export const POST = withErrorHandler(async (req: Request) => {
  const userId = await getUserId();
  if (!userId) throw new AppError("Please sign in.", 401, ErrorCode.AUTH_UNAUTHORIZED);

  let body: unknown;
  try { body = await req.json(); } catch {
    throw new AppError("Invalid JSON", 400, ErrorCode.VALIDATION_INPUT);
  }

  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      parsed.error.issues[0]?.message ?? "Invalid post",
      422,
      ErrorCode.VALIDATION_INPUT,
    );
  }

  const supabase = await createServerClientFromCookies();

  // Pre-check limit (friendly error)
  const { data: canData } = await supabase.rpc("can_create_post");
  const can = canData as { canPost?: boolean; limit?: number; current?: number } | null;
  if (can && can.canPost === false) {
    return NextResponse.json(
      {
        error: `You've reached your post limit (${can.limit}).`,
        code: "POST_LIMIT_REACHED",
        limit: can.limit,
        current: can.current,
      },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("Post")
    .insert({
      authorId: userId,
      content: parsed.data.content,
      mediaUrls: parsed.data.mediaUrls ?? [],
      locationTag: parsed.data.locationTag ?? null,
      mediaType: (parsed.data.mediaUrls ?? []).length > 1 ? "carousel" : "image",
    })
    .select("id, content, mediaUrls, cheerCount, commentCount, createdAt")
    .single();

  if (error) {
    const mapped = mapPgError(error.code ?? "", error.message ?? "");
    throw new AppError(mapped.userMessage, mapped.httpStatus, ErrorCode.INTERNAL_SERVER);
  }

  return NextResponse.json({
    post: data,
    remaining: Math.max(0, (can?.limit ?? 3) - (can?.current ?? 0) - 1),
  });
});
