import { NextResponse } from "next/server";
import {createServerClientFromCookies} from "@zeal/database/server";
import {getUserId} from "@/lib/auth";
import {withErrorHandler, AppError, ErrorCode} from "@/lib/errors";
import {rpcWithLiveSignatures, isMissingFunctionError} from "@/lib/infra/guards";
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

  // claim_quest(p_quest_id, p_user_id, p_reward) is the shape that actually pays:
  // it advisory-locks the (user, quest) pair, refuses a second claim, and credits
  // User.sparks. Production still only exposes claim_quest(p_quest_id text),
  // which writes an activity row and credits nothing, so that variant is used
  // only to prove the quest is on record — never to report a reward we did not pay.
  const { data, error, via } = await rpcWithLiveSignatures<{
    success?: boolean; alreadyClaimed?: boolean; awarded?: number; sparks?: number; error?: string;
  }>("claim_quest", [
    () => supabase.rpc("claim_quest", { p_quest_id: questId, p_user_id: userId, p_reward: reward }),
    () => supabase.rpc("claim_quest", { p_quest_id: questId }),
  ]);

  if (error) {
    if (isMissingFunctionError(error)) {
      throw new AppError("No claim_quest function is installed", 501, ErrorCode.INTERNAL_DATABASE);
    }
    throw new AppError(error.message, 500, ErrorCode.INTERNAL_SERVER);
  }

  const result = data as { success?: boolean; alreadyClaimed?: boolean; awarded?: number; sparks?: number; error?: string } | null;

  if (result?.alreadyClaimed) {
    // Report the wallet truth from the RPC, not the amount the client asked for.
    return NextResponse.json({ alreadyClaimed: true, sparks: result.sparks ?? 0, awarded: 0 });
  }
  if (result && result.success === false) {
    throw new AppError(result.error || "Claim failed", 500, ErrorCode.INTERNAL_SERVER);
  }

  if (via > 0) {
    return NextResponse.json({
      success: false,
      recorded: true,
      awarded: 0,
      error: "This quest is on record but not yet paid out — rewards need 20261020160000_rpc_alignment.sql applied",
    }, { status: 501 });
  }

  const awarded = result?.awarded ?? 0;
  const newSparks = result?.sparks ?? 0;

  await serverPublish("consultant:" + userId + ":sparks", "sparks:updated", {
    type: "UPDATE",
    record: { id: userId, sparkScore: newSparks, delta: awarded },
  });

  return NextResponse.json({ success: true, sparks: newSparks, awarded });
});
