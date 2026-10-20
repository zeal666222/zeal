import { NextResponse } from "next/server";
import {createServerClientFromCookies} from "@zeal/database/server";
import {getUserId} from "@/lib/auth";
import {withErrorHandler, AppError, ErrorCode} from "@/lib/errors";
import {serverPublish} from "@/lib/realtime/server";
import {z} from "zod";

export const dynamic = "force-dynamic";

// Capped to match the DB-side ceiling in claim_quest(); anything higher would
// be silently truncated by the RPC and the user would see a number we never paid.
const ClaimSchema = z.object({
  questId: z.string().min(1),
  reward: z.number().int().min(1).max(500),
});

export const POST = withErrorHandler(async (req: Request) => {
  const userId = await getUserId();
  if (!userId) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);

  const body = await req.json();
  const { questId, reward } = ClaimSchema.parse(body);

  const supabase = await createServerClientFromCookies();

  // Use claim_quest RPC (idempotent via referenceId)
  const { data, error } = await supabase.rpc("claim_quest", {
    p_user_id: userId,
    p_quest_id: questId,
    p_reward: reward,
  });

  if (error) throw new AppError(error.message, 500, ErrorCode.INTERNAL_SERVER);

  const result = data as { success?: boolean; alreadyClaimed?: boolean; awarded?: number; sparks?: number; error?: string } | null;

  if (result?.alreadyClaimed) {
    // Report the wallet truth from the RPC, not the amount the client asked for.
    return NextResponse.json({ alreadyClaimed: true, sparks: result.sparks ?? 0, awarded: 0 });
  }
  if (result && result.success === false) {
    throw new AppError(result.error || "Claim failed", 500, ErrorCode.INTERNAL_SERVER);
  }

  const awarded = result?.awarded ?? 0;
  const newSparks = result?.sparks ?? 0;

  await serverPublish("consultant:" + userId + ":sparks", "sparks:updated", {
    type: "UPDATE",
    record: { id: userId, sparkScore: newSparks, delta: awarded },
  });

  return NextResponse.json({ success: true, sparks: newSparks, awarded });
});
