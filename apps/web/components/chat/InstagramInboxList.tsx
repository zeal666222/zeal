"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { ConversationItem } from "@/actions/inbox";
import { 
  Search, Sparkles, MessageCircle, Edit3, 
  ChevronRight 
} from "lucide-react";

function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return "";
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function InstagramInboxList({
  initialConversations,
  currentUserId,
}: {
  initialConversations: ConversationItem[];
  currentUserId: string;
}) {
  const [conversations, setConversations] = useState<ConversationItem[]>(initialConversations);
  const [searchQuery, setSearchQuery] = useState("");
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const messageChannel = supabase
      .channel("inbox:realtime_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "session_messages" },
        (payload) => {
          const newMsg = payload.new as { session_id: string; content: string; created_at: string; sender_id: string };
          
          let preview = newMsg.content;
          if (preview.startsWith("[WEBRTC_")) {
            preview = "📹 Video call";
          }

          setConversations((prev: ConversationItem[]) => {
            const index = prev.findIndex((c) => c.sessionId === newMsg.session_id);
            if (index === -1) return prev;
            
            const existing = prev[index];
            if (!existing) return prev;

            // TS FIX: Explicit mapping completely eliminates "possibly undefined" spread errors
            const target: ConversationItem = {
              sessionId: existing.sessionId,
              partnerId: existing.partnerId,
              partnerName: existing.partnerName,
              partnerAvatar: existing.partnerAvatar,
              isOnline: existing.isOnline,
              isAI: existing.isAI,
              status: existing.status,
              lastMessage: preview,
              lastMessageTime: newMsg.created_at,
              lastMessageSenderId: newMsg.sender_id,
            };

            const remaining = prev.filter((_, i) => i !== index);
            return [target, ...remaining];
          });
        }
      )
      .subscribe();

    const profileChannel = supabase
      .channel("inbox:realtime_presence")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          const updated = payload.new as { id: string; is_online: boolean };
          if (typeof updated.is_online === "boolean") {
            setConversations((prev: ConversationItem[]) =>
              prev.map((c): ConversationItem => {
                if (c.partnerId === updated.id) {
                  return {
                    sessionId: c.sessionId,
                    partnerId: c.partnerId,
                    partnerName: c.partnerName,
                    partnerAvatar: c.partnerAvatar,
                    isOnline: Boolean(updated.is_online),
                    isAI: c.isAI,
                    status: c.status,
                    lastMessage: c.lastMessage,
                    lastMessageTime: c.lastMessageTime,
                    lastMessageSenderId: c.lastMessageSenderId,
                  };
                }
                return c;
              })
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(profileChannel);
    };
  }, []);

  const filtered = conversations.filter((c) =>
    c.partnerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onlinePartners = conversations.filter((c) => c.isOnline);

  return (
    <div className="flex flex-col h-full bg-slate-950 border-r border-white/10 select-none">
      
      <div className="flex-none h-16 px-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            Messages
          </h1>
          <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30">
            {conversations.length}
          </span>
        </div>
        <Link
          href="/explore"
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-95"
          title="New Consultation"
        >
          <Edit3 size={18} />
        </Link>
      </div>

      <div className="p-3">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search Direct Messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900/90 border border-white/5 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors"
          />
        </div>
      </div>

      {onlinePartners.length > 0 && (
        <div className="py-2 px-4 border-b border-white/5 flex items-center gap-3 overflow-x-auto hide-scrollbar">
          {onlinePartners.map((p) => (
            <Link
              key={p.sessionId}
              href={`/chat/${p.sessionId}`}
              className="flex flex-col items-center gap-1 shrink-0 group active:scale-95 transition-transform"
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-purple-500 via-pink-500 to-emerald-400">
                  {p.partnerAvatar ? (
                    <img
                      src={p.partnerAvatar}
                      alt={p.partnerName}
                      className="w-full h-full rounded-full object-cover bg-slate-900 border border-slate-950"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-slate-900 border border-slate-950 flex items-center justify-center font-bold text-xs text-white">
                      {p.partnerName.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-950 rounded-full" />
              </div>
              <span className="text-[10px] text-slate-400 font-medium max-w-[54px] truncate group-hover:text-white transition-colors">
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
              Initiate a session from a consultant's profile to start chatting.
            </p>
          </div>
        ) : (
          filtered.map((conv) => {
            const isActive = pathname === `/chat/${conv.sessionId}`;
            const isMeLast = conv.lastMessageSenderId === currentUserId;

            return (
              <Link
                key={conv.sessionId}
                href={`/chat/${conv.sessionId}`}
                className={`flex items-center gap-3.5 px-4 py-3.5 transition-colors group relative ${
                  isActive
                    ? "bg-purple-600/15 border-l-4 border-purple-500"
                    : "hover:bg-white/[0.03]"
                }`}
              >
                <div className="relative shrink-0">
                  {conv.partnerAvatar ? (
                    <img
                      src={conv.partnerAvatar}
                      alt={conv.partnerName}
                      className="w-12 h-12 rounded-full object-cover bg-slate-900"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-900 to-indigo-900 border border-white/10 flex items-center justify-center font-bold text-sm text-white">
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
                      {conv.isAI && <Sparkles size={12} className="text-purple-400 shrink-0" />}
                    </h3>
                    <span className="text-[11px] text-slate-500 shrink-0">
                      {formatRelativeTime(conv.lastMessageTime)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                    {isMeLast && <span className="text-slate-500">You:</span>}
                    <span>{conv.lastMessage}</span>
                  </p>
                </div>

                <ChevronRight
                  size={16}
                  className="text-slate-600 group-hover:text-slate-300 transition-colors shrink-0"
                />
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
