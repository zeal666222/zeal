import { NextResponse } from "next/server";
import { createServerClientFromCookies, getUserId } from "@zeal/database";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";

export const dynamic = "force-dynamic";

const REWARDS: Record<string, number> = {
  "daily-post": 25, "daily-cheer": 30, "daily-comment": 20,
  "daily-follow": 15, "weekly-streak": 100, "weekly-session": 75,
};

export const POST = withErrorHandler(async (_req: Request, { params }: { params: Promise<{ questId: string }> }) => {
  const userId = await getUserId();
  if (!userId) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
  const { questId } = await params;

  const reward = REWARDS[questId];
  if (!reward) throw new AppError("Unknown quest", 404, ErrorCode.NOT_FOUND);

  const supabase = await createServerClientFromCookies();
  const { data, error } = await supabase.rpc("claim_quest", { p_user_id: userId, p_quest_id: questId, p_reward: reward });
  if (error) throw new AppError(error.message, 500, ErrorCode.INTERNAL_SERVER);
  return NextResponse.json(data);
});
