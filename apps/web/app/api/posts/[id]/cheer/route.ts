import { NextResponse } from "next/server";
import {createServerClientFromCookies, getUserId} from "@zeal/database/server";
import {withErrorHandler, AppError, ErrorCode} from "@/lib/errors";
import {serverPublish} from "@/lib/realtime/server";

export const dynamic = "force-dynamic";

export const POST = withErrorHandler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await getUserId();
  if (!userId) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
  const { id: postId } = await params;

  const supabase = await createServerClientFromCookies();
  const { data, error } = await supabase.rpc("toggle_cheer", { p_user_id: userId, p_post_id: postId });
  if (error) throw new AppError(error.message, 500, ErrorCode.INTERNAL_SERVER);

  const result = data as { cheered: boolean; cheers: number } | null;

  void serverPublish("feed:posts", "UPDATE", {
    type: "UPDATE",
    record: { id: postId, cheerCount: result?.cheers ?? 0 },
  });

  return NextResponse.json(result);
});
