import { NextResponse } from "next/server";
import {createServerClientFromCookies, getUserId} from "@zeal/database/server";
import {withErrorHandler, AppError, ErrorCode} from "@/lib/errors";
import {rpcWithLiveSignatures, safeQueryOne} from "@/lib/infra/guards";
import {serverPublish} from "@/lib/realtime/server";

export const dynamic = "force-dynamic";

export const POST = withErrorHandler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await getUserId();
  if (!userId) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
  const { id: postId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId)) {
    throw new AppError("Invalid post id", 400, ErrorCode.VALIDATION_INPUT);
  }

  const supabase = await createServerClientFromCookies();

  // The deployed toggle_cheer only takes p_post_id (it reads the cheerer from
  // auth.uid()), so the two-argument call answers 404 and the heart button does
  // nothing. The wider shape is tried first because that is what
  // 20261020160000_rpc_alignment.sql installs with a self-healing count.
  const { data, error } = await rpcWithLiveSignatures<{
    success?: boolean; cheered?: boolean; cheers?: number; error?: string;
  }>("toggle_cheer", [
    () => supabase.rpc("toggle_cheer", { p_post_id: postId, p_user_id: userId }),
    () => supabase.rpc("toggle_cheer", { p_post_id: postId }),
  ]);

  if (error) throw new AppError(error.message, 500, ErrorCode.INTERNAL_SERVER);
  const result = data as { success?: boolean; cheered?: boolean; cheers?: number; error?: string } | null;
  if (result?.success === false) {
    if (result.error === "not_authenticated" || result.error === "forbidden") {
      throw new AppError("Sign in to cheer this post", 401, ErrorCode.AUTH_UNAUTHORIZED);
    }
    if (result.error === "post_not_found") {
      throw new AppError("Post not found", 404, ErrorCode.NOT_FOUND);
    }
    throw new AppError(result.error || "Could not update your cheer", 500, ErrorCode.INTERNAL_SERVER);
  }

  // Both shapes update Post.cheerCount, but the live one returns no count. Read
  // the stored number instead of trusting the payload, otherwise the feed card
  // and every other viewer get told the post has zero cheers.
  const post = await safeQueryOne<{ cheerCount: number | null }>(
    supabase.from("Post").select("cheerCount").eq("id", postId).maybeSingle(),
    "posts.cheer.count",
  );
  const cheers = post?.cheerCount ?? result?.cheers ?? 0;

  void serverPublish("feed:posts", "UPDATE", {
    type: "UPDATE",
    record: { id: postId, cheerCount: cheers },
  });

  return NextResponse.json({ success: true, cheered: result?.cheered ?? false, cheers });
});
