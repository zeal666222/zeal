#!/usr/bin/env bash
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo /d/zeal)" || exit 1

G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; M=$'\033[35m'; B=$'\033[1m'; N=$'\033[0m'
[[ ! -t 1 ]] && { G=''; R=''; Y=''; M=''; B=''; N=''; }

OK(){ printf "${G}OK${N}   %s\n" "$1"; }
BAD(){ printf "${R}FAIL${N} %s\n" "$1"; }
FIX(){ printf "${M}FIX${N}  %s\n" "$1"; }
SKIP(){ printf "${Y}SKIP${N} %s\n" "$1"; }

run_tsc() {
  local ws="$1" log="$2"
  pushd "$ws" >/dev/null 2>&1 || return 1
  npx --no-install tsc --noEmit --pretty false > "$log" 2>&1
  local rc=$?
  popd >/dev/null 2>&1
  return $rc
}

BASE="/tmp/zeal-p7-$$"
mkdir -p "$BASE"

printf "\n${B}── BASELINE ──${N}\n"
BASE_FAIL=0
for ws in packages/database apps/web apps/admin; do
  log="$BASE/base-$(echo "$ws" | tr '/' '_').log"
  if run_tsc "$ws" "$log"; then
    OK "$ws clean"
  else
    n=$(grep -c 'error TS' "$log" | tr -d '[:space:]'); [[ -z "$n" ]] && n=0
    BAD "$ws — $n baseline errors"
    grep 'error TS' "$log" | head -10 | sed 's/^/   /'
    BASE_FAIL=1
  fi
done

if [[ $BASE_FAIL -eq 1 ]]; then
  printf "\n${R}Baseline broken — fix baseline before adding Phase 7.${N}\n"
  exit 1
fi

BK="_archive/phase7-$(date +%s)"
mkdir -p "$BK"

wf() {
  local t="$1" tmp="${1}.tmp.$$"
  mkdir -p "$(dirname "$t")"
  cat > "$tmp"
  [[ ! -s "$tmp" ]] && { rm -f "$tmp"; BAD "$t empty"; return 1; }
  [[ -f "$t" ]] && cmp -s "$tmp" "$t" && { rm -f "$tmp"; SKIP "$t unchanged"; return 0; }
  [[ -f "$t" ]] && cp "$t" "$BK/$(echo "$t" | tr '/' '_').bak" 2>/dev/null
  mv "$tmp" "$t"
  FIX "$t ($(wc -l < "$t" | tr -d ' ') lines)"
}

printf "\n${B}── PHASE 7 FILES ──${N}\n"

# ═══════════════════════════════════════════════════════════════════════
# 1. Server helper — fetch conversations with typed shape
# ═══════════════════════════════════════════════════════════════════════
wf apps/web/lib/chat/fetch-conversations.ts << 'CONV_END'
// apps/web/lib/chat/fetch-conversations.ts
// Shared typed helper — single source of truth for inbox queries.
// Used by /api/chat/conversations (GET) and /chat/layout (server fetch).

import "server-only";
import { createServerClientFromCookies } from "@zeal/database/server";

export interface ConversationItem {
  sessionId: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
  isOnline: boolean;
  isAI: boolean;
  lastMessage: string | null;
  lastMessageTime: string | null;
  lastMessageSenderId: string | null;
}

interface MembershipRow { conversationId: string; }
interface ConversationRow {
  id: string;
  lastMessageAt: string | null;
  lastMessageText: string | null;
}
interface ParticipantRow { conversationId: string; userId: string; }
interface PartnerRow {
  id: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  is_online: boolean | null;
  role: string | null;
}

export async function fetchUserConversations(
  userId: string,
): Promise<ConversationItem[]> {
  const supabase = await createServerClientFromCookies();

  const { data: membershipsRaw } = await supabase
    .from("ConversationParticipant")
    .select("conversationId")
    .eq("userId", userId);

  const memberships = (membershipsRaw ?? []) as MembershipRow[];
  const conversationIds = memberships.map((m) => m.conversationId);
  if (conversationIds.length === 0) return [];

  const { data: conversationsRaw } = await supabase
    .from("Conversation")
    .select("id, lastMessageAt, lastMessageText")
    .in("id", conversationIds)
    .order("lastMessageAt", { ascending: false });

  const conversations = (conversationsRaw ?? []) as ConversationRow[];

  const { data: partnersRaw } = await supabase
    .from("ConversationParticipant")
    .select("conversationId, userId")
    .in("conversationId", conversationIds)
    .neq("userId", userId);

  const partners = (partnersRaw ?? []) as ParticipantRow[];
  const partnerIdByConv = new Map<string, string>();
  for (const p of partners) partnerIdByConv.set(p.conversationId, p.userId);

  const partnerIds = Array.from(new Set(partnerIdByConv.values()));
  let users: PartnerRow[] = [];
  if (partnerIds.length > 0) {
    const { data: usersRaw } = await supabase
      .from("User")
      .select("id, name, username, avatar, is_online, role")
      .in("id", partnerIds);
    users = (usersRaw ?? []) as PartnerRow[];
  }

  const userById = new Map<string, PartnerRow>();
  for (const u of users) userById.set(u.id, u);

  return conversations.map((c): ConversationItem => {
    const partnerId = partnerIdByConv.get(c.id) ?? "";
    const partner = userById.get(partnerId);
    return {
      sessionId: c.id,
      partnerId,
      partnerName: partner?.name ?? partner?.username ?? "Zeal Member",
      partnerAvatar: partner?.avatar ?? null,
      isOnline: Boolean(partner?.is_online),
      isAI: partner?.role === "AI",
      lastMessage: c.lastMessageText ?? null,
      lastMessageTime: c.lastMessageAt ?? null,
      lastMessageSenderId: null,
    };
  });
}
CONV_END

# ═══════════════════════════════════════════════════════════════════════
# 2. useConversations — inbox list with realtime user:{id}:inbox
# ═══════════════════════════════════════════════════════════════════════
wf apps/web/hooks/useConversations.ts << 'HOOK_CONV_END'
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@zeal/database";

export interface ConversationItem {
  sessionId: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
  isOnline: boolean;
  isAI: boolean;
  lastMessage: string | null;
  lastMessageTime: string | null;
  lastMessageSenderId: string | null;
}

interface RawMessage {
  id?: string;
  conversationId?: string;
  senderId?: string;
  content?: string;
  createdAt?: string;
}

export function useConversations(
  userId: string,
  initial: ConversationItem[] = [],
) {
  const [conversations, setConversations] = useState<ConversationItem[]>(initial);
  const clientRef = useRef<ReturnType<typeof getBrowserClient> | null>(null);

  if (!clientRef.current && typeof window !== "undefined") {
    try { clientRef.current = getBrowserClient(); } catch { /* ignore */ }
  }

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: ConversationItem[] };
      if (Array.isArray(data.items)) setConversations(data.items);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const sb = clientRef.current;
    if (!sb || !userId) return;

    const ch = sb
      .channel(`user:${userId}:inbox`)
      .on("broadcast", { event: "*" }, (payload: any) => {
        const rec = (payload as { payload?: { record?: RawMessage } })?.payload?.record;
        if (!rec?.conversationId || !rec?.content) return;

        setConversations((prev) => {
          const exists = prev.some((c) => c.sessionId === rec.conversationId);
          if (!exists) { void refresh(); return prev; }
          const updated = prev.map((c) =>
            c.sessionId === rec.conversationId
              ? {
                  ...c,
                  lastMessage: rec.content ?? c.lastMessage,
                  lastMessageTime: rec.createdAt ?? c.lastMessageTime,
                  lastMessageSenderId: rec.senderId ?? c.lastMessageSenderId,
                }
              : c,
          );
          return updated.sort((a, b) => {
            const ta = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
            const tb = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
            return tb - ta;
          });
        });
      })
      .subscribe();

    return () => {
      try { sb.removeChannel(ch); } catch { /* ignore */ }
    };
  }, [userId, refresh]);

  return { conversations, setConversations, refresh };
}
HOOK_CONV_END

# ═══════════════════════════════════════════════════════════════════════
# 3. useChat — realtime messages + optimistic send
# ═══════════════════════════════════════════════════════════════════════
wf apps/web/hooks/useChat.ts << 'HOOK_CHAT_END'
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@zeal/database";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  content: string;
  type: string;
  createdAt: string;
  _optimistic?: boolean;
}

interface UseChatOptions {
  conversationId: string | null;
  currentUserId: string;
}

interface IncomingRecord {
  id?: string;
  conversationId?: string;
  senderId?: string | null;
  content?: string;
  type?: string;
  createdAt?: string;
}

export function useChat({ conversationId, currentUserId }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(conversationId));
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seen = useRef<Set<string>>(new Set());
  const clientRef = useRef<ReturnType<typeof getBrowserClient> | null>(null);

  if (!clientRef.current && typeof window !== "undefined") {
    try { clientRef.current = getBrowserClient(); } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!conversationId) { setMessages([]); setIsLoading(false); return; }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    seen.current = new Set();

    fetch(`/api/chat/${conversationId}/messages?limit=50`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: { messages?: ChatMessage[] }) => {
        if (cancelled) return;
        const list = data.messages ?? [];
        list.forEach((m) => seen.current.add(m.id));
        setMessages(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed");
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    const sb = clientRef.current;
    if (!sb) return;

    const ch = sb
      .channel(`room:${conversationId}:messages`)
      .on("broadcast", { event: "*" }, (payload: unknown) => {
        const rec = (payload as { payload?: { record?: IncomingRecord } })?.payload?.record;
        if (!rec?.id || !rec.content) return;
        if (seen.current.has(rec.id)) return;
        seen.current.add(rec.id);

        const incoming: ChatMessage = {
          id: rec.id,
          conversationId: rec.conversationId ?? conversationId,
          senderId: rec.senderId ?? null,
          content: rec.content,
          type: rec.type ?? "text",
          createdAt: rec.createdAt ?? new Date().toISOString(),
        };

        setMessages((prev) => {
          const cleaned = prev.filter(
            (m) => !(m._optimistic && m.content === incoming.content && m.senderId === incoming.senderId),
          );
          return [...cleaned, incoming].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
        });
      })
      .subscribe();

    return () => { try { sb.removeChannel(ch); } catch { /* ignore */ } };
  }, [conversationId]);

  const send = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || !conversationId) return;

    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: ChatMessage = {
      id: tempId,
      conversationId,
      senderId: currentUserId,
      content: trimmed,
      type: "text",
      createdAt: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setIsSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/chat/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string })?.error || `HTTP ${res.status}`);
      }
      const { message } = (await res.json()) as { message: ChatMessage };
      if (message?.id) seen.current.add(message.id);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...message, _optimistic: false } : m)),
      );
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(err instanceof Error ? err.message : "Failed to send");
      throw err;
    } finally {
      setIsSending(false);
    }
  }, [conversationId, currentUserId]);

  const sendToAI = useCallback(
    async (consultantId: string, content: string, onDelta: (acc: string) => void) => {
      const trimmed = content.trim();
      if (!trimmed || !conversationId) return;

      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: ChatMessage = {
        id: tempId,
        conversationId,
        senderId: currentUserId,
        content: trimmed,
        type: "text",
        createdAt: new Date().toISOString(),
        _optimistic: true,
      };
      setMessages((prev) => [...prev, optimistic]);
      setIsSending(true);
      setError(null);

      try {
        const res = await fetch(`/api/chat/ai/${consultantId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, content: trimmed }),
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string })?.error || `HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let acc = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) { acc += delta; onDelta(acc); }
            } catch { /* skip */ }
          }
        }
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setError(err instanceof Error ? err.message : "AI chat failed");
        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, currentUserId],
  );

  return { messages, isLoading, isSending, error, send, sendToAI };
}
HOOK_CHAT_END

# ═══════════════════════════════════════════════════════════════════════
# 4. useTyping — presence-based typing indicator
# ═══════════════════════════════════════════════════════════════════════
wf apps/web/hooks/useTyping.ts << 'HOOK_TYPING_END'
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@zeal/database";

export function useTyping(conversationId: string | null, currentUserId: string) {
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const clientRef = useRef<ReturnType<typeof getBrowserClient> | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof getBrowserClient>["channel"]> | null>(null);
  const timeoutRef = useRef<number | null>(null);

  if (!clientRef.current && typeof window !== "undefined") {
    try { clientRef.current = getBrowserClient(); } catch { /* ignore */ }
  }

  useEffect(() => {
    const sb = clientRef.current;
    if (!sb || !conversationId) return;

    const ch = sb.channel(`room:${conversationId}:typing`, {
      config: { presence: { key: currentUserId } },
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, Array<{ typing?: boolean }>>;
      const next = new Set<string>();
      for (const key of Object.keys(state)) {
        if (key === currentUserId) continue;
        const entries = state[key];
        if (entries?.[0]?.typing) next.add(key);
      }
      setTypingUsers(next);
    }).subscribe();

    channelRef.current = ch;

    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      try { sb.removeChannel(ch); } catch { /* ignore */ }
      channelRef.current = null;
    };
  }, [conversationId, currentUserId]);

  const setTyping = useCallback((isTyping: boolean) => {
    const ch = channelRef.current;
    if (!ch) return;
    try { ch.track({ typing: isTyping }); } catch { /* ignore */ }
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (isTyping) {
      timeoutRef.current = window.setTimeout(() => {
        try { channelRef.current?.track({ typing: false }); } catch { /* ignore */ }
      }, 2000);
    }
  }, []);

  return { typingUsers, setTyping };
}
HOOK_TYPING_END

# ═══════════════════════════════════════════════════════════════════════
# 5. /api/chat/[id]/messages — GET + POST
# ═══════════════════════════════════════════════════════════════════════
wf "apps/web/app/api/chat/[id]/messages/route.ts" << 'MSG_END'
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await params;
  const url = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50"), 1), 200);

  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: participant } = await supabase
    .from("ConversationParticipant")
    .select("userId")
    .eq("conversationId", conversationId)
    .eq("userId", user.id)
    .maybeSingle();

  if (!participant) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  const { data: messages, error } = await supabase
    .from("Message")
    .select("id, conversationId, senderId, content, type, createdAt")
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { content?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const content = (body.content || "").trim();
  if (!content) return NextResponse.json({ error: "Empty content" }, { status: 400 });
  if (content.length > 4000) return NextResponse.json({ error: "Too long" }, { status: 400 });

  // Verify participant before insert
  const { data: participant } = await supabase
    .from("ConversationParticipant")
    .select("userId")
    .eq("conversationId", conversationId)
    .eq("userId", user.id)
    .maybeSingle();

  if (!participant) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  const { data: message, error } = await supabase
    .from("Message")
    .insert({ conversationId, senderId: user.id, content, type: "text" })
    .select("id, conversationId, senderId, content, type, createdAt")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message });
}
MSG_END

# ═══════════════════════════════════════════════════════════════════════
# 6. /api/chat/[id]/read — mark as read
# ═══════════════════════════════════════════════════════════════════════
wf "apps/web/app/api/chat/[id]/read/route.ts" << 'READ_END'
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await params;
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("ConversationParticipant")
    .update({ lastReadAt: new Date().toISOString() })
    .eq("conversationId", conversationId)
    .eq("userId", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
READ_END

# ═══════════════════════════════════════════════════════════════════════
# 7. InstagramInboxList — left sidebar of inbox
# ═══════════════════════════════════════════════════════════════════════
wf apps/web/components/chat/InstagramInboxList.tsx << 'INBOX_END'
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Sparkles, MessageCircle, Edit3, ChevronRight } from "lucide-react";
import { useConversations, type ConversationItem } from "@/hooks/useConversations";
import { cn } from "@zeal/ui";

function fmtRelative(ts: string | null): string {
  if (!ts) return "";
  const diff = Math.max(0, Date.now() - new Date(ts).getTime());
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function InstagramInboxList({
  currentUserId,
  initialConversations,
}: {
  currentUserId: string;
  initialConversations: ConversationItem[];
}) {
  const pathname = usePathname();
  const { conversations } = useConversations(currentUserId, initialConversations);
  const [query, setQuery] = useState("");

  const filtered = conversations.filter((c) =>
    c.partnerName.toLowerCase().includes(query.toLowerCase()),
  );
  const online = conversations.filter((c) => c.isOnline);

  return (
    <div className="flex flex-col h-full bg-slate-950 select-none">
      <div className="flex-none h-16 px-5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black tracking-tight text-white">Messages</h1>
          <span className="px-2 py-0.5 rounded-full bg-[#9D7DC5]/20 text-[#9D7DC5] text-xs font-bold border border-[#9D7DC5]/30">
            {conversations.length}
          </span>
        </div>
        <Link href="/explore" className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all" title="New conversation">
          <Edit3 size={18} />
        </Link>
      </div>

      <div className="p-3">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search messages…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900/90 border border-white/5 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#9D7DC5]/50 transition-colors"
          />
        </div>
      </div>

      {online.length > 0 && (
        <div className="py-2 px-4 border-b border-white/5 flex items-center gap-3 overflow-x-auto hide-scrollbar">
          {online.map((p) => (
            <Link key={p.sessionId} href={`/chat/${p.sessionId}`} className="flex flex-col items-center gap-1 shrink-0 group active:scale-95 transition-transform">
              <div className="relative">
                <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-[#9D7DC5] via-pink-500 to-emerald-400">
                  {p.partnerAvatar ? (
                    <img src={p.partnerAvatar} alt={p.partnerName} className="w-full h-full rounded-full object-cover bg-slate-900 border border-slate-950" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-slate-900 border border-slate-950 flex items-center justify-center font-bold text-xs text-white">
                      {p.partnerName.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-950 rounded-full" />
              </div>
              <span className="text-[10px] text-slate-400 font-medium max-w-[54px] truncate">
                {p.partnerName.split(" ")[0]}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-white/5">
        {filtered.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center p-6 text-center">
            <MessageCircle size={32} className="text-slate-600 mb-2" />
            <p className="text-sm font-bold text-slate-300">No chats found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
              Start a conversation from a consultant&apos;s profile.
            </p>
          </div>
        ) : (
          filtered.map((conv) => {
            const active = pathname === `/chat/${conv.sessionId}`;
            const isMeLast = conv.lastMessageSenderId === currentUserId;
            return (
              <Link
                key={conv.sessionId}
                href={`/chat/${conv.sessionId}`}
                className={cn(
                  "flex items-center gap-3.5 px-4 py-3.5 transition-colors group relative",
                  active ? "bg-[#9D7DC5]/15 border-l-4 border-[#9D7DC5]" : "hover:bg-white/[0.03]",
                )}
              >
                <div className="relative shrink-0">
                  {conv.partnerAvatar ? (
                    <img src={conv.partnerAvatar} alt={conv.partnerName} className="w-12 h-12 rounded-full object-cover bg-slate-900" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#9D7DC5] to-[#533AFD] border border-white/10 flex items-center justify-center font-bold text-sm text-white">
                      {conv.partnerName.charAt(0)}
                    </div>
                  )}
                  {conv.isOnline && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h3 className="text-sm font-bold text-slate-200 truncate flex items-center gap-1.5">
                      {conv.partnerName}
                      {conv.isAI && <Sparkles size={12} className="text-[#9D7DC5] shrink-0" />}
                    </h3>
                    <span className="text-[11px] text-slate-500 shrink-0">
                      {fmtRelative(conv.lastMessageTime)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                    {isMeLast && <span className="text-slate-500">You:</span>}
                    <span>{conv.lastMessage || "Start a conversation"}</span>
                  </p>
                </div>
                <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-300 transition-colors shrink-0" />
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
INBOX_END

# ═══════════════════════════════════════════════════════════════════════
# 8. ChatShell — mobile-first responsive wrapper
# ═══════════════════════════════════════════════════════════════════════
wf apps/web/app/chat/ChatShell.tsx << 'SHELL_END'
"use client";

import { usePathname } from "next/navigation";
import { InstagramInboxList } from "@/components/chat/InstagramInboxList";
import type { ConversationItem } from "@/hooks/useConversations";
import { cn } from "@zeal/ui";

export function ChatShell({
  currentUserId,
  initialConversations,
  children,
}: {
  currentUserId: string;
  initialConversations: ConversationItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const roomOpen = pathname !== "/chat";

  return (
    <div className="flex h-screen-app bg-slate-950 overflow-hidden">
      <aside className={cn("w-full md:w-80 lg:w-96 shrink-0 h-full border-r border-white/5", roomOpen && "hidden md:block")}>
        <InstagramInboxList currentUserId={currentUserId} initialConversations={initialConversations} />
      </aside>
      <main className={cn("flex-1 h-full flex-col bg-slate-950", roomOpen ? "flex" : "hidden md:flex")}>
        {children}
      </main>
    </div>
  );
}
SHELL_END

# ═══════════════════════════════════════════════════════════════════════
# 9. ChatInterface — message view with streaming AI support
# ═══════════════════════════════════════════════════════════════════════
wf apps/web/components/session/ChatInterface.tsx << 'INTERFACE_END'
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { useTyping } from "@/hooks/useTyping";
import { cn } from "@zeal/ui";

interface Props {
  conversationId: string;
  currentUserId: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string | null;
  isAI?: boolean;
}

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatInterface({
  conversationId,
  currentUserId,
  partnerId,
  partnerName,
  partnerAvatar,
  isAI = false,
}: Props) {
  const router = useRouter();
  const { messages, isLoading, isSending, send, sendToAI } = useChat({ conversationId, currentUserId });
  const { typingUsers, setTyping } = useTyping(conversationId, currentUserId);

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, streaming, typingUsers.size]);

  useEffect(() => {
    void fetch(`/api/chat/${conversationId}/read`, { method: "POST" }).catch(() => {});
  }, [conversationId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;
    setInput("");
    setTyping(false);

    try {
      if (isAI) {
        setStreaming("");
        await sendToAI(partnerId, text, (acc) => setStreaming(acc));
        setStreaming(null);
      } else {
        await send(text);
      }
    } catch {
      setInput(text);
      setStreaming(null);
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (!isAI) setTyping(e.target.value.length > 0);
  };

  const showTyping = !isAI && typingUsers.size > 0;
  const showStreaming = isAI && streaming !== null;

  return (
    <div className="flex flex-col h-full bg-slate-950 relative">
      <div className="flex-none h-16 bg-slate-900/80 backdrop-blur-2xl border-b border-white/10 px-3 md:px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <button onClick={() => router.push("/chat")} className="md:hidden p-2 -ml-1 rounded-lg hover:bg-white/5 active:scale-95" aria-label="Back">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="relative w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-black text-white overflow-hidden shrink-0">
            {partnerAvatar ? <img src={partnerAvatar} alt={partnerName} className="w-full h-full object-cover" /> : partnerName.charAt(0).toUpperCase()}
            {isAI && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-[8px] flex items-center justify-center">
                AI
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-white text-sm flex items-center gap-2 truncate">
              {partnerName}
              {isAI && <Sparkles size={13} className="text-[#9D7DC5] shrink-0" />}
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
              {showTyping ? (
                <><span className="w-1.5 h-1.5 rounded-full bg-[#9D7DC5] animate-pulse" /> typing…</>
              ) : (
                <><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {isAI ? "AI · 24/7" : "Secure session"}</>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 md:px-4 py-4 space-y-4 custom-scrollbar">
        <div className="text-center pb-6 border-b border-white/5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#9D7DC5]/10 border border-[#9D7DC5]/20 text-[#9D7DC5] text-xs font-bold rounded-full mb-2">
            <ShieldCheck size={14} /> Encrypted session
          </div>
          <p className="text-slate-500 text-[11px]">{isAI ? "AI consultant ready." : "Your session has begun."}</p>
        </div>

        {isLoading && messages.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[#9D7DC5]" />
          </div>
        ) : (
          messages.map((msg: ChatMessage) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                <div className={cn(
                  "max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-lg break-words",
                  isMe
                    ? "bg-gradient-to-br from-[#9D7DC5] to-[#533AFD] text-white rounded-br-sm"
                    : "bg-slate-800 text-slate-200 border border-white/5 rounded-bl-sm",
                  msg._optimistic && "opacity-70",
                )}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-slate-600 mt-1 px-1 font-medium">
                  {fmtTime(msg.createdAt)}
                </span>
              </div>
            );
          })
        )}

        {showStreaming && (
          <div className="flex flex-col items-start">
            <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-bl-sm bg-slate-800 text-slate-200 border border-white/5 text-sm leading-relaxed">
              {streaming}
              <span className="inline-block w-1.5 h-4 ml-1 bg-[#9D7DC5] animate-pulse align-middle" />
            </div>
          </div>
        )}

        {showTyping && (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 border border-white/5 rounded-2xl w-max">
            <div className="w-1.5 h-1.5 bg-[#9D7DC5] rounded-full animate-bounce" />
            <div className="w-1.5 h-1.5 bg-[#9D7DC5] rounded-full animate-bounce [animation-delay:150ms]" />
            <div className="w-1.5 h-1.5 bg-[#9D7DC5] rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div
        className="flex-none p-3 md:p-4 bg-slate-950/90 backdrop-blur-3xl border-t border-white/10"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <form onSubmit={submit} className="max-w-4xl mx-auto flex items-center gap-2 md:gap-3">
          <input
            type="text"
            value={input}
            onChange={onChange}
            onBlur={() => !isAI && setTyping(false)}
            placeholder={isAI ? `Message ${partnerName}…` : "Type your message…"}
            maxLength={4000}
            className="flex-1 bg-slate-900 border border-white/10 rounded-full px-5 py-3.5 text-sm focus:outline-none focus:border-[#9D7DC5] text-slate-200 shadow-inner placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending || showStreaming}
            aria-label="Send"
            className={cn(
              "w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all shrink-0",
              input.trim() && !isSending && !showStreaming
                ? "bg-gradient-to-br from-[#9D7DC5] to-[#533AFD] text-white shadow-[0_0_15px_rgba(157,125,197,0.3)] active:scale-95"
                : "bg-slate-800 text-slate-500 cursor-not-allowed",
            )}
          >
            {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
INTERFACE_END

# ═══════════════════════════════════════════════════════════════════════
# 10. /chat/layout — server shell
# ═══════════════════════════════════════════════════════════════════════
wf apps/web/app/chat/layout.tsx << 'LAYOUT_END'
import { redirect } from "next/navigation";
import { createServerClientFromCookies } from "@zeal/database/server";
import { ChatShell } from "./ChatShell";
import { fetchUserConversations } from "@/lib/chat/fetch-conversations";

export const dynamic = "force-dynamic";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectedFrom=/chat");

  const conversations = await fetchUserConversations(user.id);

  return (
    <ChatShell currentUserId={user.id} initialConversations={conversations}>
      {children}
    </ChatShell>
  );
}
LAYOUT_END

# ═══════════════════════════════════════════════════════════════════════
# 11. /chat — empty state
# ═══════════════════════════════════════════════════════════════════════
wf apps/web/app/chat/page.tsx << 'EMPTY_END'
import Link from "next/link";
import { Send, Sparkles } from "lucide-react";

export default function ChatIndexPage() {
  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center bg-slate-950 relative overflow-hidden">
      <div className="absolute w-[450px] h-[450px] bg-purple-600/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="relative z-10 max-w-sm flex flex-col items-center">
        <div className="w-24 h-24 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center mb-6 shadow-2xl relative">
          <div className="absolute inset-0 rounded-full border border-purple-500/20 animate-ping opacity-30" />
          <Send size={36} className="text-purple-400 translate-x-0.5 -translate-y-0.5" />
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight mb-2">Your Direct Messages</h2>
        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          Send private inquiries, review previous readings, or start a real-time session.
        </p>
        <Link
          href="/explore"
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-600/20 transition-all active:scale-95 flex items-center gap-2"
        >
          <Sparkles size={16} /> Explore consultants
        </Link>
      </div>
    </div>
  );
}
EMPTY_END

# ═══════════════════════════════════════════════════════════════════════
# 12. /chat/[id] — conversation view
# ═══════════════════════════════════════════════════════════════════════
wf "apps/web/app/chat/[id]/page.tsx" << 'ROOM_END'
import { createServerClientFromCookies } from "@zeal/database/server";
import { notFound, redirect } from "next/navigation";
import { ChatInterface } from "@/components/session/ChatInterface";

export const dynamic = "force-dynamic";

interface UserRow {
  name: string | null;
  username: string;
  avatar: string | null;
  role: string;
}

export default async function ChatRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = await params;
  const supabase = await createServerClientFromCookies();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectedFrom=/chat/${conversationId}`);

  const { data: participant } = await supabase
    .from("ConversationParticipant")
    .select("userId")
    .eq("conversationId", conversationId)
    .eq("userId", user.id)
    .maybeSingle();

  if (!participant) notFound();

  const { data: partnersRaw } = await supabase
    .from("ConversationParticipant")
    .select("userId")
    .eq("conversationId", conversationId)
    .neq("userId", user.id)
    .limit(1);

  const partnerId = (partnersRaw ?? [])[0]?.userId ?? "";
  let partnerName = "Chat";
  let partnerAvatar: string | null = null;
  let isAI = false;

  if (partnerId) {
    const { data: partnerRaw } = await supabase
      .from("User")
      .select("name, username, avatar, role")
      .eq("id", partnerId)
      .maybeSingle();
    const partner = partnerRaw as UserRow | null;
    if (partner) {
      partnerName = partner.name || partner.username || "Chat";
      partnerAvatar = partner.avatar ?? null;
      isAI = partner.role === "AI";
    }
  }

  return (
    <ChatInterface
      conversationId={conversationId}
      currentUserId={user.id}
      partnerId={partnerId}
      partnerName={partnerName}
      partnerAvatar={partnerAvatar}
      isAI={isAI}
    />
  );
}
ROOM_END

# ═══════════════════════════════════════════════════════════════════════
# TYPECHECK + COMMIT
# ═══════════════════════════════════════════════════════════════════════
printf "\n${B}── TYPECHECK ──${N}\n"
FAIL=0
for ws in packages/database apps/web apps/admin; do
  log="$BASE/final-$(echo "$ws" | tr '/' '_').log"
  if run_tsc "$ws" "$log"; then
    OK "$ws clean"
  else
    n=$(grep -c 'error TS' "$log" | tr -d '[:space:]'); [[ -z "$n" ]] && n=0
    BAD "$ws — $n errors"
    grep 'error TS' "$log" | head -20 | sed 's/^/   /'
    FAIL=1
  fi
done

printf "\n${B}── COMMIT ──${N}\n"
if [[ $FAIL -eq 0 ]]; then
  git add -A 2>/dev/null
  git reset -- _archive/ .zeal/ 2>/dev/null
  staged=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d '[:space:]')
  if [[ "${staged:-0}" -gt 0 ]]; then
    git commit -m "Phase 7: chat interface end-to-end

Wires /chat, /chat/[id], and the realtime message pipeline that
Phase 6's Start Chat button routes into.

- lib/chat/fetch-conversations.ts: typed server helper (single
  source of truth for inbox queries)
- hooks/useConversations.ts: inbox list with user:{id}:inbox broadcast
- hooks/useChat.ts: realtime room:{convId}:messages + optimistic send
  + streaming AI (sendToAI tees Groq SSE)
- hooks/useTyping.ts: presence-based typing indicator (2s auto-clear)
- api/chat/[id]/messages/route.ts: GET history + POST with participant
  check + 4000-char cap
- api/chat/[id]/read/route.ts: mark read endpoint
- components/chat/InstagramInboxList.tsx: searchable inbox, online
  strip, presence dots, AI sparkles indicator
- app/chat/ChatShell.tsx: mobile-first responsive (list-or-room on
  small, split on desktop)
- components/session/ChatInterface.tsx: message view, encrypted banner,
  typing dots, streaming AI cursor, safe-area input
- app/chat/layout.tsx + page.tsx + [id]/page.tsx: server shells

All workspaces typecheck clean." >/dev/null 2>&1 \
      && OK "committed $(git rev-parse --short HEAD)" \
      && git push origin main >/dev/null 2>&1 \
      && OK "pushed origin/main"
  else
    SKIP "nothing to commit"
  fi
else
  BAD "typecheck failed — not committing"
fi
