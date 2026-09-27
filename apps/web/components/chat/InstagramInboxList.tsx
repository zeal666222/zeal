"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// InstagramInboxList — real-time inbox with presence
// Theme: dark slate + Zeal purple. Mobile-first.
// ═══════════════════════════════════════════════════════════════════════════════

import {useState} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import { ChevronRight, Edit3, MessageCircle, Search, Sparkles } from "lucide-react";
import {useConversations, type ConversationItem} from "@/hooks/useConversations";
import {cn} from "@zeal/ui";

interface Props {
  currentUserId: string;
  initialConversations: ConversationItem[];
}

function formatRelative(ts: string | null): string {
  if (!ts) return "";
  const now = Date.now();
  const then = new Date(ts).getTime();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function InstagramInboxList({ currentUserId, initialConversations }: Props) {
  const pathname = usePathname();
  const { conversations } = useConversations(currentUserId, initialConversations);
  const [query, setQuery] = useState("");

  const filtered = conversations.filter((c) =>
    c.partnerName.toLowerCase().includes(query.toLowerCase())
  );

  const onlinePartners = conversations.filter((c) => c.isOnline);

  return (
    <div className="flex flex-col h-full bg-background select-none">
      {/* Header */}
      <div className="flex-none h-16 px-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black tracking-tight text-foreground">Messages</h1>
          <span className="px-2 py-0.5 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-xs font-bold border border-[var(--color-primary)]/30">
            {conversations.length}
          </span>
        </div>
        <Link
          href="/explore"
          className="p-2 rounded-xl bg-surface-raised hover:bg-surface-overlay text-muted-foreground hover:text-foreground transition-all active:scale-95"
          title="New Consultation"
        >
          <Edit3 size={18} />
        </Link>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search Direct Messages..."
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--color-primary)]/50 transition-colors"
          />
        </div>
      </div>

      {/* Online row */}
      {onlinePartners.length > 0 && (
        <div className="py-2 px-4 border-b border-border flex items-center gap-3 overflow-x-auto hide-scrollbar">
          {onlinePartners.map((p) => (
            <Link
              key={p.sessionId}
              href={`/chat/${p.sessionId}`}
              className="flex flex-col items-center gap-1 shrink-0 group active:scale-95 transition-transform"
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-[var(--color-primary)] via-pink-500 to-emerald-400">
                  {p.partnerAvatar ? (
                    <img
                      src={p.partnerAvatar}
                      alt={p.partnerName}
                      className="w-full h-full rounded-full object-cover bg-surface border border-background"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-surface border border-background flex items-center justify-center font-bold text-xs text-foreground">
                      {p.partnerName.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-background rounded-full" />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium max-w-[54px] truncate group-hover:text-foreground transition-colors">
                {p.partnerName.split(" ")[0]}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-white/5">
        {filtered.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center p-6 text-center">
            <MessageCircle size={32} className="text-muted-foreground mb-2" />
            <p className="text-sm font-bold text-muted-foreground">No chats found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
              Start a session from a consultant&apos;s profile to begin chatting.
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
                className={cn(
                  "flex items-center gap-3.5 px-4 py-3.5 transition-colors group relative",
                  isActive
                    ? "bg-[var(--color-primary)]/15 border-l-4 border-[var(--color-primary)]"
                    : "hover:bg-surface-raised"
                )}
              >
                <div className="relative shrink-0">
                  {conv.partnerAvatar ? (
                    <img
                      src={conv.partnerAvatar}
                      alt={conv.partnerName}
                      className="w-12 h-12 rounded-full object-cover bg-surface"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] border border-border flex items-center justify-center font-bold text-sm text-white">
                      {conv.partnerName.charAt(0)}
                    </div>
                  )}
                  {conv.isOnline && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-background rounded-full" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h2 className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                      {conv.partnerName}
                      {conv.isAI && <Sparkles size={12} className="text-[var(--color-primary)] shrink-0" />}
                    </h2>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatRelative(conv.lastMessageTime)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    {isMeLast && <span className="text-muted-foreground">You:</span>}
                    <span>{conv.lastMessage || "Start a conversation"}</span>
                  </p>
                </div>

                <ChevronRight
                  size={16}
                  className="text-muted-foreground group-hover:text-muted-foreground transition-colors shrink-0"
                />
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
