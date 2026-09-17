"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// ChatInterface — Real-time text chat (Phase 1)
// Uses: useChat (broadcast) + useTyping (presence)
// Theme: dark slate + Zeal purple. Mobile-first.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { useTyping } from "@/hooks/useTyping";
import { cn } from "@zeal/ui";

interface ChatInterfaceProps {
  conversationId: string;
  currentUserId: string;
  partnerName: string;
  partnerAvatar?: string | null;
  isAI?: boolean;
}

function formatTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatInterface({
  conversationId,
  currentUserId,
  partnerName,
  partnerAvatar,
  isAI = false,
}: ChatInterfaceProps) {
  const router = useRouter();
  const { messages, isLoading, isSending, send } = useChat({
    conversationId,
    currentUserId,
  });
  const { typingUsers, setTyping } = useTyping(conversationId, currentUserId);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, typingUsers.size]);

  // Mark read on mount
  useEffect(() => {
    void fetch(`/api/chat/${conversationId}/read`, { method: "POST" }).catch(() => {});
  }, [conversationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;
    setInput("");
    setTyping(false);
    try {
      await send(text);
    } catch {
      setInput(text);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    setTyping(e.target.value.length > 0);
  };

  const showTyping = typingUsers.size > 0;

  return (
    <div className="flex flex-col h-full bg-slate-950 relative">
      {/* Header */}
      <div className="flex-none h-16 bg-slate-900/80 backdrop-blur-2xl border-b border-white/10 px-3 md:px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <button
            onClick={() => router.push("/chat")}
            className="md:hidden p-2 -ml-1 rounded-lg hover:bg-white/5 active:scale-95"
            aria-label="Back to inbox"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-black text-white overflow-hidden shrink-0">
            {partnerAvatar ? (
              <img src={partnerAvatar} alt={partnerName} className="w-full h-full object-cover" />
            ) : (
              partnerName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-white text-sm flex items-center gap-2 truncate">
              {partnerName}
              {isAI && <Sparkles size={13} className="text-[#9D7DC5] shrink-0" />}
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
              {showTyping ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9D7DC5] animate-pulse" />
                  typing...
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Secure Session
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 md:px-4 py-4 space-y-4 custom-scrollbar">
        <div className="text-center pb-6 border-b border-white/5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#9D7DC5]/10 border border-[#9D7DC5]/20 text-[#9D7DC5] text-xs font-bold rounded-full mb-2">
            <ShieldCheck size={14} /> End-to-End Encrypted
          </div>
          <p className="text-slate-500 text-[11px]">
            Your session has begun. Messages are secured.
          </p>
        </div>

        {isLoading && messages.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[#9D7DC5]" />
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div
                key={msg.id}
                className={cn("flex flex-col", isMe ? "items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-lg break-words",
                    isMe
                      ? "bg-gradient-to-br from-[#9D7DC5] to-[#533AFD] text-white rounded-br-sm"
                      : "bg-slate-800 text-slate-200 border border-white/5 rounded-bl-sm",
                    msg._optimistic && "opacity-70"
                  )}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-slate-600 mt-1 px-1 font-medium">
                  {formatTime(msg.createdAt)}
                </span>
              </div>
            );
          })
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

      {/* Input */}
      <div
        className="flex-none p-3 md:p-4 bg-slate-950/90 backdrop-blur-3xl border-t border-white/10"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <form
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto flex items-center gap-2 md:gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={handleChange}
            onBlur={() => setTyping(false)}
            placeholder="Type your message..."
            maxLength={4000}
            className="flex-1 bg-slate-900 border border-white/10 rounded-full px-5 py-3.5 text-sm focus:outline-none focus:border-[#9D7DC5] text-slate-200 shadow-inner placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            aria-label="Send"
            className={cn(
              "w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all shrink-0",
              input.trim() && !isSending
                ? "bg-gradient-to-br from-[#9D7DC5] to-[#533AFD] text-white shadow-[0_0_15px_rgba(157,125,197,0.3)] active:scale-95"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            )}
          >
            {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
          </button>
        </form>
      </div>
    </div>
  );
}