// apps/web/app/api/chat/conversations/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// GET   → inbox: human rooms from Supabase + AI rooms from the zeal-chat worker
// POST  → open a room with a partner
//
// AI rooms are minted by the Cloudflare worker (`ai-<uuid>`) and live in its D1
// only — no Supabase read or write on that path, because the Conversation /
// ConversationParticipant tables are SELECT-only under RLS and their AI join
// compares a uuid column to a TEXT consultant slug. Both were 500ing the
// start-chat flow in production. Human rooms keep the existing RPC path.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { fetchUserConversations } from "@/lib/chat/fetch-conversations";
import { resolveWorkerAuth } from "@/lib/auth/access-token";
import {
  createConversation,
  listConversations,
  WorkerError,
  type WorkerConversationSummary,
} from "@/lib/chat/worker";
import type { ConversationItem } from "@/hooks/useConversations";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function workerItem(c: WorkerConversationSummary): ConversationItem {
  return {
    sessionId: c.conversationId,
    partnerId: c.consultantId ?? "",
    partnerName: c.consultantName ?? "AI Consultant",
    partnerAvatar: c.consultantAvatar,
    isOnline: true,
    isAI: true,
    lastMessage: c.lastMessageText,
    lastMessageTime: c.lastMessageAt ?? c.createdAt,
    lastMessageSenderId: null,
  };
}

function newestFirst(items: ConversationItem[]): ConversationItem[] {
  return items
    .map((item, i) => ({ item, i, t: Date.parse(item.lastMessageTime ?? "") || 0 }))
    .sort((a, b) => b.t - a.t || a.i - b.i)
    .map((e) => e.item);
}

export async function GET() {
  const auth = await resolveWorkerAuth();
  if (!auth.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = auth.userId;

  const human = await fetchUserConversations(userId);

  // The inbox must survive the worker being unreachable — AI rooms are simply
  // absent for that request rather than blanking the whole list.
  let ai: ConversationItem[] = [];
  if (auth.accessToken) {
    try {
      const { conversations } = await listConversations(auth.accessToken);
      ai = conversations.map(workerItem);
    } catch (err) {
      console.warn("[chat/conversations] worker inbox fetch failed:", errMessage(err));
    }
  }

  return NextResponse.json({ items: newestFirst([...ai, ...human]) });
}

export async function POST(req: Request) {
  const auth = await resolveWorkerAuth();
  if (!auth.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = auth.userId;

  let body: { partnerId?: string; isAI?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const partnerId = typeof body.partnerId === "string" ? body.partnerId : "";
  if (!partnerId || partnerId === userId) {
    return NextResponse.json({ error: "Invalid partnerId" }, { status: 400 });
  }

  // A non-uuid partner can only be an AI consultant slug — the human RPC is
  // declared (uuid, uuid) and would reject it at the database.
  const isAI = body.isAI === true || !UUID_RE.test(partnerId);

  if (isAI) {
    if (!auth.accessToken) {
      return NextResponse.json(
        { error: "Session is warming up — please try again in a moment." },
        { status: 503 },
      );
    }
    try {
      const { conversationId } = await createConversation(auth.accessToken, partnerId);
      return NextResponse.json({ conversationId, isAI: true });
    } catch (err) {
      const status = err instanceof WorkerError ? workerStatus(err.status) : 502;
      const message = errMessage(err);
      console.error("[chat/conversations] worker create failed:", status, message);
      return NextResponse.json({ error: message, aiConsultantId: partnerId }, { status });
    }
  }

  // Human-to-human conversation. The RPC RETURNS jsonb, so `data` is the
  // {success, conversationId, isAI} envelope — reading it as the id sent
  // every chat page to /chat/[object Object].
  const supabase = await createServerClientFromCookies();
  const { data, error } = await supabase.rpc("get_or_create_conversation", {
    p_user_a: userId,
    p_user_b: partnerId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const envelope = (data ?? {}) as { conversationId?: string };
  const conversationId = envelope.conversationId;
  if (!conversationId) {
    return NextResponse.json({ error: "Conversation could not be created" }, { status: 500 });
  }
  return NextResponse.json({ conversationId, isAI: false });
}

/** The worker's own 4xx (no such consultant, paid room, rate-limited) is the caller's answer. */
function workerStatus(status: number): number {
  return status >= 400 && status < 500 ? status : 502;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Failed";
}
