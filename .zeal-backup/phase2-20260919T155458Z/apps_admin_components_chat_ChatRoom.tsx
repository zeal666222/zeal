"use client";
import {useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowLeft, Send, Loader2, ShieldCheck, CheckCheck} from "lucide-react";
import {useChat} from "@/hooks/useChat";
import {useTyping} from "@/hooks/useTyping";
import type { ChatMessage } from "@/types/chat";
import {cn} from "@zeal/ui";

interface Props {
  conversationId: string; currentUserId: string; partnerId: string;
  partnerName: string; partnerAvatar?: string | null; partnerIsOnline?: boolean;
}
const fmt = (t: string) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function ChatRoom({ conversationId, currentUserId, partnerName, partnerAvatar, partnerIsOnline }: Props) {
  const router = useRouter();
  const { messages, isLoading, isSending, send } = useChat({ conversationId, currentUserId });
  const { typingUsers, setTyping } = useTyping(conversationId, currentUserId);
  const [input, setInput] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, typingUsers.size]);
  useEffect(() => { void fetch(`/api/consultant/chat/${conversationId}/read`, { method: "POST" }).catch(() => {}); }, [conversationId, messages.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = input.trim();
    if (!t || isSending) return;
    setInput(""); setTyping(false);
    try { await send(t); } catch { setInput(t); }
  };

  const showTyping = typingUsers.size > 0;

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="flex-none h-16 bg-slate-900/80 backdrop-blur-2xl border-b border-white/10 px-3 md:px-4 flex items-center gap-3">
        <button onClick={() => router.push("/consultant/chat")} className="md:hidden p-2 -ml-1 rounded-lg hover:bg-white/5" aria-label="Back">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div className="relative w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-black text-white overflow-hidden shrink-0">
          {partnerAvatar ? <img src={partnerAvatar} alt={partnerName} className="w-full h-full object-cover" /> : partnerName.charAt(0).toUpperCase()}
          {partnerIsOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-white text-sm truncate">{partnerName}</h2>
          <div className="flex items-center gap-1.5 text-[10px] font-bold">
            {showTyping ? (<><span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" /><span className="text-purple-400">typing…</span></>) :
             partnerIsOnline ? (<><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /><span className="text-emerald-400">Online</span></>) :
             <span className="text-slate-500">Offline</span>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 md:px-4 py-4 space-y-4">
        <div className="text-center pb-6 border-b border-white/5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold rounded-full">
            <ShieldCheck size={14} /> Secure session
          </div>
        </div>
        {isLoading && messages.length === 0 ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>
        ) : messages.map((m: ChatMessage) => {
          const me = m.senderId === currentUserId;
          return (
            <div key={m.id} className={cn("flex flex-col", me ? "items-end" : "items-start")}>
              <div className={cn("max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words",
                me ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-br-sm"
                   : "bg-slate-800 text-slate-200 border border-white/5 rounded-bl-sm",
                m._optimistic && "opacity-70")}>{m.content}</div>
              <div className="flex items-center gap-1 mt-1 px-1">
                <span className="text-[10px] text-slate-600 font-medium">{fmt(m.createdAt)}</span>
                {me && <CheckCheck size={11} className="text-purple-400" />}
              </div>
            </div>
          );
        })}
        {showTyping && (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 border border-white/5 rounded-2xl w-max">
            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" />
            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:150ms]" />
            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        )}
        <div ref={bottom} />
      </div>

      <div className="flex-none p-3 md:p-4 bg-slate-950/90 backdrop-blur-3xl border-t border-white/10" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
        <form onSubmit={submit} className="max-w-4xl mx-auto flex items-center gap-2 md:gap-3">
          <input type="text" value={input}
            onChange={(e) => { setInput(e.target.value); setTyping(e.target.value.length > 0); }}
            onBlur={() => setTyping(false)}
            placeholder="Type your message..." maxLength={4000}
            className="flex-1 bg-slate-900 border border-white/10 rounded-full px-5 py-3.5 text-sm focus:outline-none focus:border-purple-500 text-slate-200 placeholder:text-slate-500" />
          <button type="submit" disabled={!input.trim() || isSending} aria-label="Send"
            className={cn("w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all shrink-0",
              input.trim() && !isSending ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white active:scale-95"
                : "bg-slate-800 text-slate-500 cursor-not-allowed")}>
            {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
