"use client";
import {useState} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {Search, MessageCircle, Sparkles, ChevronRight, Edit3} from "lucide-react";
import {useConversations} from "@/hooks/useConversations";
import type { ConversationItem } from "@/hooks/useConversations";
import {cn} from "@zeal/ui";

interface Props { currentUserId: string; initialConversations: ConversationItem[]; }
const rel = (ts: string | null) => {
  if (!ts) return "";
  const d = Math.max(0, Date.now() - new Date(ts).getTime());
  const m = Math.floor(d / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const dy = Math.floor(h / 24);
  if (dy < 7) return `${dy}d`;
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
};

export function InboxList({ currentUserId, initialConversations }: Props) {
  const pathname = usePathname();
  const { conversations } = useConversations(currentUserId, initialConversations);
  const [q, setQ] = useState("");
  const filtered = conversations.filter((c) => c.partnerName.toLowerCase().includes(q.toLowerCase()));
  const online = conversations.filter((c) => c.isOnline);

  return (
    <div className="flex flex-col h-full bg-slate-950 select-none">
      <div className="flex-none h-16 px-5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black tracking-tight text-white">Messages</h1>
          <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold border border-purple-500/30">{conversations.length}</span>
        </div>
        <Link href="/explore" className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white active:scale-95" title="New consultation">
          <Edit3 size={18} />
        </Link>
      </div>
      <div className="p-3">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-3 text-slate-500" />
          <input type="text" placeholder="Search seekers..." value={q} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900/90 border border-white/5 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50" />
        </div>
      </div>
      {online.length > 0 && (
        <div className="py-2 px-4 border-b border-white/5 flex items-center gap-3 overflow-x-auto hide-scrollbar">
          {online.map((p) => (
            <Link key={p.sessionId} href={`/consultant/chat/${p.sessionId}`} className="flex flex-col items-center gap-1 shrink-0 active:scale-95">
              <div className="relative">
                <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-purple-500 via-pink-500 to-emerald-400">
                  {p.partnerAvatar ? <img src={p.partnerAvatar} alt={p.partnerName} className="w-full h-full rounded-full object-cover bg-slate-900 border border-slate-950" />
                    : <div className="w-full h-full rounded-full bg-slate-900 border border-slate-950 flex items-center justify-center font-bold text-xs text-white">{p.partnerName.charAt(0)}</div>}
                </div>
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-950 rounded-full" />
              </div>
              <span className="text-[10px] text-slate-400 font-medium max-w-[54px] truncate">{p.partnerName.split(" ")[0]}</span>
            </Link>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-y-auto divide-y divide-white/5">
        {filtered.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center p-6 text-center">
            <MessageCircle size={32} className="text-slate-600 mb-2" />
            <p className="text-sm font-bold text-slate-300">No chats found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-[200px]">Seekers who start a chat will appear here.</p>
          </div>
        ) : filtered.map((conv) => {
          const on = pathname === `/consultant/chat/${conv.sessionId}`;
          const meLast = conv.lastMessageSenderId === currentUserId;
          return (
            <Link key={conv.sessionId} href={`/consultant/chat/${conv.sessionId}`}
              className={cn("flex items-center gap-3.5 px-4 py-3.5 transition-colors group relative",
                on ? "bg-purple-500/15 border-l-4 border-purple-500" : "hover:bg-white/[0.03]")}>
              <div className="relative shrink-0">
                {conv.partnerAvatar ? <img src={conv.partnerAvatar} alt={conv.partnerName} className="w-12 h-12 rounded-full object-cover bg-slate-900" />
                  : <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 border border-white/10 flex items-center justify-center font-bold text-sm text-white">{conv.partnerName.charAt(0)}</div>}
                {conv.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <h3 className="text-sm font-bold text-slate-200 truncate flex items-center gap-1.5">
                    {conv.partnerName}
                    {conv.isAI && <Sparkles size={12} className="text-purple-400 shrink-0" />}
                  </h3>
                  <span className="text-[11px] text-slate-500 shrink-0">{rel(conv.lastMessageTime)}</span>
                </div>
                <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                  {meLast && <span className="text-slate-500">You:</span>}
                  <span>{conv.lastMessage || "Start a conversation"}</span>
                </p>
              </div>
              <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-300 transition-colors shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
