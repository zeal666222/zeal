"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Admin ChatRoom — human + AI conversations
// ═══════════════════════════════════════════════════════════════════════════════
// Enterprise patterns:
//   • Streaming cursor with AbortController cancel button
//   • Friendly error mapping (no raw provider text)
//   • Connection-aware (uses useConnection if available)
//   • Keyboard shortcuts (Enter to send, Esc to cancel)
//   • Auto-scroll with bottom anchor
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCheck, Loader2, RefreshCw, Send, ShieldCheck,
  Sparkles, Square } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { useTyping } from "@/hooks/useTyping";
import type { ChatMessage } from "@/types/chat";
import { cn } from "@zeal/ui";

// ─── Friendly error mapping ──────────────────────────────────────────────────
// Never expose provider text, status codes, or stack traces to the user.
function friendlyChatError(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = String(raw).toLowerCase();
  if (s.includes("rate limit") || s.includes("429") || s.includes("too many")) {
    return "I'm receiving a lot of messages right now. Please try again in a moment.";
  }
  if (s.includes("timeout") || s.includes("aborted")) {
    return "That took a little longer than expected. Please try once more.";
  }
  if (s.includes("unauthorized") || s.includes("401")) {
    return "Your session has expired. Please sign in again.";
  }
  if (
    s.includes("not a participant") ||
    s.includes("forbidden") ||
    s.includes("403")
  ) {
    return "I can't access this conversation right now.";
  }
  if (s.includes("unavailable") || s.includes("502") || s.includes("503")) {
    return "I'm taking a brief pause to gather my thoughts. Please try again in a moment.";
  }
  if (s.includes("network") || s.includes("fetch")) {
    return "Looks like a connection hiccup. Please check your internet and try again.";
  }
  return "Something didn't go through. Please try again.";
}

interface Props {
  conversationId: string;
  currentUserId: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string | null;
  partnerIsOnline?: boolean;
  isAI?: boolean;
}

const formatTime = (t: string) =>
  new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function ChatRoom({
  conversationId,
  currentUserId,
  partnerId,
  partnerName,
  partnerAvatar,
  partnerIsOnline,
  isAI = false,
}: Props) {
  const router = useRouter();
  const {
    messages,
    isLoading,
    isSending,
    isStreaming,
    error,
    send,
    sendToAI,
    cancelStream,
    retry,
  } = useChat({ conversationId, currentUserId });

  const { typingUsers, setTyping } = useTyping(conversationId, currentUserId);

  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const bottom = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new content
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, streamingText, typingUsers.size]);

  // Mark as read on open + new messages
  useEffect(() => {
    void fetch(`/api/consultant/chat/${conversationId}/read`, {
      method: "POST",
    }).catch(() => {});
  }, [conversationId, messages.length]);

  // Surface hook-level errors as friendly text
  useEffect(() => {
    if (error) setLocalError(friendlyChatError(error));
  }, [error]);

  // Keyboard shortcuts: Enter sends, Esc cancels stream
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isStreaming) {
        cancelStream();
        setStreamingText(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isStreaming, cancelStream]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;
    setInput("");
    setLocalError(null);
    setTyping(false);

    try {
      if (isAI) {
        setStreamingText("");
        await sendToAI(partnerId, text, (acc: string) => {
          setStreamingText(acc);
        });
        setStreamingText(null);
      } else {
        await send(text);
      }
    } catch (err: unknown) {
      setInput(text);
      setStreamingText(null);
      setLocalError(
        friendlyChatError(err instanceof Error ? err.message : "send failed"),
      );
    }
  };

  const handleCancel = () => {
    cancelStream();
    setStreamingText(null);
  };

  const handleRetry = async () => {
    setLocalError(null);
    try {
      await retry();
    } catch (err: unknown) {
      setLocalError(
        friendlyChatError(err instanceof Error ? err.message : "retry failed"),
      );
    }
  };

  const showTyping = !isAI && typingUsers.size > 0;
  const showStreaming = isAI && streamingText !== null;
  const showCancel = isAI && isStreaming;

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="flex-none h-16 bg-slate-900/80 backdrop-blur-2xl border-b border-white/10 px-3 md:px-4 flex items-center gap-3">
        <button
          onClick={() => router.push("/consultant/chat")}
          className="md:hidden p-2 -ml-1 rounded-lg hover:bg-white/5"
          aria-label="Back"
        >
          <ArrowLeft size={18} className="text-white" />
        </button>

        <div className="relative w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-black text-white overflow-hidden shrink-0">
          {partnerAvatar ? (
            <img
              src={partnerAvatar}
              alt={partnerName}
              className="w-full h-full object-cover"
            />
          ) : (
            partnerName.charAt(0).toUpperCase()
          )}
          {isAI && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-[8px] flex items-center justify-center text-white font-bold">
              AI
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-white text-sm truncate flex items-center gap-1.5">
            {partnerName}
            {isAI && <Sparkles size={12} className="text-[#9D7DC5]" />}
          </h2>
          <div className="flex items-center gap-1.5 text-[10px] font-bold">
            {showTyping ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                <span className="text-purple-400">typing…</span>
              </>
            ) : partnerIsOnline || isAI ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-400">
                  {isAI ? "AI · 24/7" : "Online"}
                </span>
              </>
            ) : (
              <span className="text-slate-500">Offline</span>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 md:px-4 py-4 space-y-4">
        <div className="text-center pb-6 border-b border-white/5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold rounded-full">
            <ShieldCheck size={14} /> Secure session
          </div>
        </div>

        {isLoading && messages.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
          </div>
        ) : (
          messages.map((m: ChatMessage) => {
            const me = m.senderId === currentUserId;
            return (
              <div
                key={m.id}
                className={cn(
                  "flex flex-col",
                  me ? "items-end" : "items-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words",
                    me
                      ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-br-sm"
                      : "bg-slate-800 text-slate-200 border border-white/5 rounded-bl-sm",
                    m._optimistic && "opacity-70",
                  )}
                >
                  {m.content}
                </div>
                <div className="flex items-center gap-1 mt-1 px-1">
                  <span className="text-[10px] text-slate-600 font-medium">
                    {formatTime(m.createdAt)}
                  </span>
                  {me && <CheckCheck size={11} className="text-purple-400" />}
                </div>
              </div>
            );
          })
        )}

        {showStreaming && (
          <div className="flex flex-col items-start">
            <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-bl-sm bg-slate-800 text-slate-200 border border-white/5 text-sm leading-relaxed">
              {streamingText}
              <span className="inline-block w-1.5 h-4 ml-1 bg-purple-400 animate-pulse align-middle" />
            </div>
            <div className="flex items-center gap-2 mt-1 px-1">
              <span className="text-[10px] text-slate-500">
                {partnerName} is thinking…
              </span>
            </div>
          </div>
        )}

        {showTyping && (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 border border-white/5 rounded-2xl w-max">
            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" />
            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:150ms]" />
            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        )}

        <div ref={bottom} />
      </div>

      {/* Friendly error banner with retry */}
      {localError && (
        <div className="flex-none mx-3 md:mx-4 mb-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" />
          <span className="flex-1">{localError}</span>
          <button
            onClick={handleRetry}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-bold shrink-0"
          >
            <RefreshCw size={11} /> Retry
          </button>
        </div>
      )}

      {/* Input */}
      <div
        className="flex-none p-3 md:p-4 bg-slate-950/90 backdrop-blur-3xl border-t border-white/10"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <form
          onSubmit={submit}
          className="max-w-4xl mx-auto flex items-center gap-2 md:gap-3"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setInput(e.target.value);
              if (!isAI) setTyping(e.target.value.length > 0);
            }}
            onBlur={() => !isAI && setTyping(false)}
            placeholder={
              isStreaming
                ? `${partnerName} is responding… (Esc to cancel)`
                : "Type your message…"
            }
            maxLength={4000}
            disabled={showCancel}
            className="flex-1 bg-slate-900 border border-white/10 rounded-full px-5 py-3.5 text-sm focus:outline-none focus:border-purple-500 text-slate-200 placeholder:text-slate-500 disabled:opacity-60"
          />

          {showCancel ? (
            <button
              type="button"
              onClick={handleCancel}
              aria-label="Stop response"
              className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 shrink-0 transition-all"
            >
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              aria-label="Send"
              className={cn(
                "w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all shrink-0",
                input.trim() && !isSending
                  ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white active:scale-95"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed",
              )}
            >
              {isSending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} className="ml-0.5" />
              )}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
