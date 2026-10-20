// apps/web/app/api/chat/conversations/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// GET   → list conversations (typed via shared helper)
// POST  → get_or_create_conversation with a partner
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import {createServerClientFromCookies, createAdminClient} from "@zeal/database/server";
import {fetchUserConversations} from "@/lib/chat/fetch-conversations";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await fetchUserConversations(user.id);
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { partnerId?: string; isAI?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const partnerId = body.partnerId;
  if (!partnerId || partnerId === user.id) {
    return NextResponse.json({ error: "Invalid partnerId" }, { status: 400 });
  }

  // AI consultants don't have User records — create a solo conversation
  if (body.isAI) {
    const admin = createAdminClient();

    // Find an existing AI conversation for this user + consultant. Match in JS
    // instead of a `Conversation!inner(metadata->>…)` filter: that embedded
    // JSON-path query is fragile right after a migration (PostgREST schema
    // cache lag) and would 500 the whole start-chat flow.
    const { data: mine, error: mineErr } = await supabase
      .from("ConversationParticipant")
      .select("conversationId")
      .eq("userId", user.id);
    if (mineErr) {
      return NextResponse.json({ error: mineErr.message }, { status: 500 });
    }
    const myIds = ((mine ?? []) as { conversationId: string }[]).map((r) => r.conversationId);
    if (myIds.length > 0) {
      const { data: existing } = await admin
        .from("Conversation")
        .select("id, metadata")
        .in("id", myIds);
      const found = ((existing ?? []) as { id: string; metadata: Record<string, unknown> | null }[])
        .find((c) => c.metadata?.aiConsultantId === partnerId);
      if (found) {
        return NextResponse.json({ conversationId: found.id });
      }
    }

    // Create new conversation for AI chat
    const { data: newConv, error: convError } = await admin
      .from("Conversation")
      .insert({
        isGroup: false,
        metadata: { aiConsultantId: partnerId, type: "ai" },
      })
      .select("id")
      .maybeSingle();

    if (convError || !newConv) {
      const hint =
        convError && /column .*metadata|does not exist|schema cache|PGRST/i.test(convError.message)
          ? "Conversation metadata is not available yet — apply the latest Supabase migration."
          : convError?.message ?? "Failed to create conversation";
      return NextResponse.json({ error: hint }, { status: 500 });
    }

    // Add user as participant
    const { error: partError } = await admin
      .from("ConversationParticipant")
      .insert({
        conversationId: (newConv as { id: string }).id,
        userId: user.id,
      });

    if (partError) {
      return NextResponse.json({ error: partError.message }, { status: 500 });
    }

    return NextResponse.json({ conversationId: (newConv as { id: string }).id });
  }

  // Human-to-human conversation
  const { data: conversationId, error } = await supabase.rpc(
    "get_or_create_conversation",
    { p_user_a: user.id, p_user_b: partnerId }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversationId });
}
