import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/admin/auth/api-guard";

export const dynamic = "force-dynamic";

// RPC error codes -> copy a consultant can act on.
const RPC_ERRORS: Record<string, string> = {
  reason_too_short: "Tell us why in at least 30 characters — approvals depend on it.",
  already_pending: "You already have a rate change under review. Wait for the decision.",
  no_rates_requested: "Set at least one rate before submitting.",
  not_authenticated: "Your session expired. Sign in again and resubmit.",
  forbidden: "This request can only be filed for your own consultant profile.",
  consultant_not_found: "No consultant profile found for this account.",
  internal_error: "The request could not be saved. Try again in a moment.",
};

export async function GET() {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  const { data: consultant } = await admin
    .from("Consultant")
    .select('id, "perMinuteRate", "chatRate", "audioRate", "videoRate", "physicalRate"')
    .eq("userId", userId)
    .maybeSingle();
  if (!consultant) return NextResponse.json({ requests: [], currentRates: null, ownerId: userId });

  const { data } = await admin
    .from("PricingChangeRequest")
    .select("*")
    .eq("consultantId", (consultant as { id: string }).id)
    .order("createdAt", { ascending: false })
    .limit(50);

  return NextResponse.json({
    requests: data ?? [],
    // The page subscribes to user:<ownerId>:pricing to hear the admin's decision;
    // the client cannot derive that id from the request rows alone.
    ownerId: userId,
    // The form must open on the rates the consultant actually charges, not on
    // numbers hard-coded in the page.
    currentRates: {
      perMinuteRate: consultant.perMinuteRate,
      chatRate: consultant.chatRate,
      audioRate: consultant.audioRate,
      videoRate: consultant.videoRate,
      physicalRate: consultant.physicalRate,
    },
  });
}

export async function POST(req: Request) {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  let body: { requestedRates?: Record<string, number>; reason?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: consultant } = await admin
    .from("Consultant").select("id").eq("userId", userId).maybeSingle();
  if (!consultant) return NextResponse.json({ error: "Not a consultant" }, { status: 403 });

  const { data, error } = await admin.rpc("request_pricing_change", {
    p_consultant_id: (consultant as { id: string }).id,
    p_requested: body.requestedRates ?? {},
    p_reason: body.reason ?? "",
    // The RPC runs under the service-role key, where auth.uid() is always NULL,
    // so the acting consultant has to be named explicitly.
    p_actor_id: userId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { success?: boolean; error?: string } | null;
  if (result && result.success === false) {
    const code = result.error ?? "";
    const message = RPC_ERRORS[code]
      ?? (code.startsWith("invalid_rate_")
        ? `Rates must be a number between ₹10 and ₹5000 (${code.replace("invalid_rate_", "")}).`
        : "Could not file the request. Check the rates and reason, then try again.");
    return NextResponse.json({ error: message, code }, { status: code === "already_pending" ? 409 : 400 });
  }
  return NextResponse.json(result);
}
