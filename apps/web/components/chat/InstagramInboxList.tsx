"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  Compass,
  MessageCircle,
  Search,
  Sparkles,
  Users,
  Bot,
  CircleDot,
  Pin,
} from "lucide-react";
import { useConversations, type ConversationItem } from "@/hooks/useConversations";
import { cn } from "@zeal/ui";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  currentUserId: string;
  initialConversations: ConversationItem[];
}

type TabKey = "all" | "ai" | "human" | "unread";

const TABS: { key: TabKey; label: string; icon: typeof MessageCircle }[] = [
  { key: "all", label: "All", icon: MessageCircle },
  { key: "ai", label: "AI", icon: Bot },
  { key: "human", label: "Experts", icon: Users },
  { key: "unread", label: "Unread", icon: CircleDot },
];

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

type GroupKey = "Today" | "Yesterday" | "This Week" | "Older";

function groupKey(ts: string | null): GroupKey {
  if (!ts) return "Older";
  const d = new Date(ts);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);
  const startOfWeek = new Date(startOfToday.getTime() - 6 * 86_400_000);
  if (d >= startOfToday) return "Today";
  if (d >= startOfYesterday) return "Yesterday";
  if (d >= startOfWeek) return "This Week";
  return "Older";
}

export function InstagramInboxList({ currentUserId, initialConversations }: Props) {
  const pathname = usePathname();
  const { conversations, refresh } = useConversations(currentUserId, initialConversations);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  const filtered = useMemo(() => {
    let list = conversations;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((c) => c.partnerName.toLowerCase().includes(q));
    }
    switch (activeTab) {
      case "ai":
        return list.filter((c) => c.isAI);
      case "human":
        return list.filter((c) => !c.isAI);
      case "unread":
        return list.filter((c) => (c.unreadCount ?? 0) > 0);
      default:
        return list;
    }
  }, [conversations, query, activeTab]);

  const grouped = useMemo(() => {
    const groups = new Map<GroupKey, ConversationItem[]>();
    for (const c of filtered) {
      const key = groupKey(c.lastMessageTime);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }
    return groups;
  }, [filtered]);

  const groupOrder: GroupKey[] = ["Today", "Yesterday", "This Week", "Older"];
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
  const aiCount = conversations.filter((c) => c.isAI).length;
  const humanCount = conversations.filter((c) => !c.isAI).length;

  return (
    <div className="flex flex-col h-full bg-background select-none">
      {/* Header */}
      <div className="flex-none px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-foreground">Messages</h1>
            {totalUnread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="px-2 py-0.5 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-black min-w-[20px] text-center"
              >
                {totalUnread > 99 ? "99+" : totalUnread}
              </motion.span>
            )}
          </div>
          <Link
            href="/explore"
            className="p-2.5 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[var(--color-primary)]/20"
            title="Find a Consultant"
          >
            <Compass size={16} />
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-surface-raised border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--color-primary)]/50 focus:ring-1 focus:ring-[var(--color-primary)]/20 transition-all"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-surface-raised rounded-xl border border-border">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            const count = tab.key === "ai" ? aiCount : tab.key === "human" ? humanCount : tab.key === "unread" ? totalUnread : conversations.length;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                  isActive
                    ? "bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white shadow-md"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon size={11} />
                <span className="hidden sm:inline">{tab.label}</span>
                {count > 0 && (
                  <span className={cn(
                    "px-1 rounded-full text-[8px] min-w-[14px] text-center",
                    isActive ? "bg-white/20" : "bg-surface",
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filtered.length === 0 ? (
          <EmptyState tab={activeTab} hasQuery={query.trim().length > 0} />
        ) : (
          <div className="pb-4">
            {groupOrder.map((group) => {
              const items = grouped.get(group);
              if (!items || items.length === 0) return null;
              return (
                <div key={group}>
                  <div className="sticky top-0 z-10 px-5 py-2 bg-background/95 backdrop-blur-sm border-b border-border/50">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {group}
                    </span>
                  </div>
                  <AnimatePresence initial={false}>
                    {items.map((conv) => (
                      <ConversationRow
                        key={conv.sessionId}
                        conv={conv}
                        isActive={pathname === `/chat/${conv.sessionId}`}
                        currentUserId={currentUserId}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}

        {/* Pull to refresh indicator */}
        <button
          type="button"
          onClick={() => void refresh()}
          className="w-full py-3 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
        >
          Refresh conversations
        </button>
      </div>
    </div>
  );
}

function ConversationRow({
  conv,
  isActive,
  currentUserId,
}: {
  conv: ConversationItem;
  isActive: boolean;
  currentUserId: string;
}) {
  const isMeLast = conv.lastMessageSenderId === currentUserId;
  const unread = conv.unreadCount ?? 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      <Link
        href={`/chat/${conv.sessionId}`}
        className={cn(
          "flex items-center gap-3 px-5 py-3 transition-all relative group",
          isActive
            ? "bg-[var(--color-primary)]/10"
            : "hover:bg-surface-raised",
          unread > 0 && !isActive && "bg-[var(--color-primary)]/[0.03]",
        )}
      >
        {/* Active indicator */}
        {isActive && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-gradient-to-b from-[var(--color-primary)] to-[var(--color-primary-hover)]"
          />
        )}

        {/* Avatar */}
        <div className="relative shrink-0">
          <div className={cn(
            "w-12 h-12 rounded-full overflow-hidden border-2 transition-all",
            isActive
              ? "border-[var(--color-primary)]"
              : "border-border group-hover:border-[var(--color-primary)]/30",
            conv.isAI && "ring-2 ring-[var(--color-primary)]/20",
          )}>
            {conv.partnerAvatar ? (
              <img
                src={conv.partnerAvatar}
                alt={conv.partnerName}
                className="w-full h-full object-cover bg-surface"
              />
            ) : (
              <div className={cn(
                "w-full h-full flex items-center justify-center font-black text-sm",
                conv.isAI
                  ? "bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white"
                  : "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white",
              )}>
                {conv.partnerName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Online indicator */}
          {conv.isOnline && (
            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-background rounded-full">
              <div className="w-full h-full rounded-full bg-emerald-500 animate-ping opacity-75" />
            </div>
          )}

          {/* AI badge */}
          {conv.isAI && (
            <span className="absolute -top-0.5 -right-0.5 px-1 py-0.5 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white text-[6px] font-black flex items-center gap-0.5 shadow-sm">
              <Sparkles className="w-2 h-2" /> AI
            </span>
          )}

          {/* Pinned badge */}
          {conv.isPinned && (
            <span className="absolute -top-0.5 -left-0.5 p-0.5 rounded-full bg-amber-500 text-white shadow-sm">
              <Pin className="w-2 h-2" fill="currentColor" />
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <h2 className={cn(
              "text-sm truncate flex items-center gap-1.5",
              unread > 0 ? "font-black text-foreground" : "font-bold text-foreground",
            )}>
              {conv.partnerName}
              {conv.isTyping && (
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-[var(--color-primary)] animate-bounce" />
                  <span className="w-1 h-1 rounded-full bg-[var(--color-primary)] animate-bounce [animation-delay:150ms]" />
                  <span className="w-1 h-1 rounded-full bg-[var(--color-primary)] animate-bounce [animation-delay:300ms]" />
                </span>
              )}
            </h2>
            <span className={cn(
              "text-[10px] shrink-0 font-medium",
              unread > 0 ? "text-[var(--color-primary)] font-bold" : "text-muted-foreground",
            )}>
              {formatRelative(conv.lastMessageTime)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1">
            <p className={cn(
              "text-xs truncate flex items-center gap-1",
              unread > 0 ? "text-foreground font-medium" : "text-muted-foreground",
            )}>
              {isMeLast && <span className="text-muted-foreground">You:</span>}
              <span>{conv.lastMessage || "Start a conversation"}</span>
            </p>
            {unread > 0 && (
              <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-[var(--color-primary)] text-white text-[9px] font-black min-w-[18px] text-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </div>
        </div>

        {/* Chevron */}
        <ChevronRight
          size={14}
          className="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0"
        />
      </Link>
    </motion.div>
  );
}

function EmptyState({ tab, hasQuery }: { tab: TabKey; hasQuery: boolean }) {
  if (hasQuery) {
    return (
      <div className="h-64 flex flex-col items-center justify-center p-6 text-center">
        <Search size={28} className="text-muted-foreground/50 mb-3" />
        <p className="text-sm font-bold text-muted-foreground">No results found</p>
        <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>
      </div>
    );
  }

  const messages: Record<TabKey, { title: string; desc: string; icon: typeof MessageCircle }> = {
    all: {
      title: "No conversations yet",
      desc: "Start a session from a consultant's profile or try a free service.",
      icon: MessageCircle,
    },
    ai: {
      title: "No AI chats yet",
      desc: "Try a free AI service or start a chat with an AI consultant.",
      icon: Bot,
    },
    human: {
      title: "No expert chats yet",
      desc: "Browse online experts and start a consultation.",
      icon: Users,
    },
    unread: {
      title: "All caught up!",
      desc: "No unread messages. You're all set.",
      icon: CircleDot,
    },
  };

  const msg = messages[tab];
  const Icon = msg.icon;

  return (
    <div className="h-64 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-raised border border-border flex items-center justify-center mb-3">
        <Icon size={24} className="text-muted-foreground/50" />
      </div>
      <p className="text-sm font-bold text-foreground">{msg.title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">{msg.desc}</p>
      <Link
        href="/explore"
        className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white text-xs font-bold hover:opacity-90 active:scale-95 transition-all"
      >
        Browse Consultants
      </Link>
    </div>
  );
}
