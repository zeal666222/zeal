// ZEAL_PHASE2_V1
// apps/web/app/api/chat/[id]/messages/route.ts
// GET  → paginated messages
// POST → insert + best-effort auto_start_chat_billing
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await params;
  const url = new URL(req.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1),
    200,
  );

  const supabase = await createServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: participant } = await supabase
    .from("ConversationParticipant")
    .select("userId")
    .eq("conversationId", conversationId)
    .eq("userId", user.id)
    .maybeSingle();
  if (!participant)
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  const { data: messages, error } = await supabase
    .from("Message")
    .select(
      "id, conversationId, senderId, content, type, createdAt, editedAt, deletedAt",
    )
    .eq("conversationId", conversationId)
    .order("createdAt", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: (messages ?? []).slice().reverse() });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await params;
  const supabase = await createServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { content?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const content = (body.content || "").trim();
  if (!content) return NextResponse.json({ error: "Empty content" }, { status: 400 });
  if (content.length > 4000) return NextResponse.json({ error: "Too long" }, { status: 400 });

  // ─── Billing gate ─────────────────────────────────────────────────────────
  // Resolve the per-minute session BEFORE persisting. A paid human chat with an
  // unfunded wallet must not be delivered for free: `auto_start_chat_billing`
  // returns a definitive `insufficient_balance` in that case, so reject (402)
  // without inserting. Everything else — reused session, free/no-billable
  // partner, or a transient RPC fault — proceeds.
  let billing: Record<string, unknown> | null = null;
  try {
    const { data: billingData, error: billingErr } = await supabase.rpc(
      "auto_start_chat_billing",
      { p_conversation_id: conversationId, p_user_id: user.id },
    );
    if (billingErr) console.warn("[messages] auto_start_chat_billing:", billingErr.message);
    billing = (billingData ?? null) as Record<string, unknown> | null;
  } catch (err) {
    console.warn("[messages] auto_start_chat_billing failed:", err);
  }

  if (billing && billing.success === false && billing.error === "insufficient_balance") {
    return NextResponse.json(
      {
        error: "Insufficient wallet balance for this per-minute session.",
        code: "insufficient_balance",
        billing,
        required: billing.required,
        available: billing.available,
      },
      { status: 402 },
    );
  }

  const { data: message, error } = await supabase
    .from("Message")
    .insert({ conversationId, senderId: user.id, content, type: "text" })
    .select("id, conversationId, senderId, content, type, createdAt")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message, billing });
}
