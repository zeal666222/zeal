"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Chat interface — human + AI conversations with optional billed session
// ═══════════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Coins, Loader2, MessageCircle, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useChat, type BillingInfo, type ChatMessage } from "@/hooks/useChat";
import { useTyping } from "@/hooks/useTyping";
import { BillingPanel } from "./BillingPanel";
import { WalletGateDialog, type WalletGateInfo } from "@/components/billing/WalletGateDialog";
import { cn } from "@zeal/ui";

interface Props {
  conversationId: string;
  currentUserId: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string | null;
  isAI?: boolean;
  rate?: number;
  /** Active billed session (if any) resolved server-side on room load. */
  activeSessionId?: string | null;
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatInterface({
  conversationId,
  currentUserId,
  partnerId,
  partnerName,
  partnerAvatar,
  isAI = false,
  rate = 0,
  activeSessionId = null,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sessionId, setSessionId] = useState<string | null>(
    searchParams.get("session") ?? activeSessionId,
  );
  const [liveRate, setLiveRate] = useState<number>(rate);
  const [walletGate, setWalletGate] = useState<WalletGateInfo | null>(null);

  const { messages, isLoading, isSending, send, sendToAI } = useChat({
    conversationId,
    currentUserId,
  });
  const { typingUsers, setTyping } = useTyping(conversationId, currentUserId);

  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [fillerText, setFillerText] = useState<string | null>(null);
  const [terminationReason, setTerminationReason] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, streamingText, fillerText, typingUsers.size]);

  useEffect(() => {
    void fetch(`/api/chat/${conversationId}/read`, { method: "POST" }).catch(() => {});
  }, [conversationId]);

  const handleBilling = (billing: BillingInfo) => {
    if (billing.sessionId) setSessionId(billing.sessionId);
    if (typeof billing.rate === "number" && billing.rate > 0) setLiveRate(billing.rate);
    if (billing.success === false && billing.error === "insufficient_balance") {
      setWalletGate({
        balance: Number(billing.available ?? 0),
        required: Number(billing.required ?? billing.rate ?? liveRate ?? 0),
        consultantName: partnerName,
        consultantId: partnerId,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;
    setInput("");
    setTyping(false);
    try {
      if (isAI) {
        setStreamingText("");
        setFillerText(null);
        await sendToAI(partnerId, text, {
          onDelta: (acc) => { setStreamingText(acc); setFillerText(null); },
          onFiller: (f) => setFillerText(f),
          onBilling: handleBilling,
        });
        setStreamingText(null);
        setFillerText(null);
      } else {
        const result = await send(text);
        if (result?.billing) handleBilling(result.billing);
        const b = result?.billing;
        if (b && b.success === false && b.error === "insufficient_balance") {
          // Blocked by the billing gate — keep the draft so it can be resent
          // after the wallet is topped up.
          setInput((cur) => (cur ? cur : text));
        }
      }
    } catch {
      setInput(text);
      setStreamingText(null);
      setFillerText(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (!isAI) setTyping(e.target.value.length > 0);
  };

  const handleSessionEnd = () => {
    setSessionId(null);
    setTerminationReason(null);
  };

  const showTyping = !isAI && typingUsers.size > 0;
  const showStreaming = isAI && streamingText !== null;
  const streamDisplay = showStreaming
    ? streamingText || (fillerText ? `${fillerText}` : "")
    : "";

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Header */}
      <div className="flex-none h-16 bg-surface backdrop-blur-2xl border-b border-border px-3 md:px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <button
            onClick={() => router.push("/chat")}
            className="md:hidden p-2 -ml-1 rounded-lg hover:bg-surface-raised active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <div className="relative w-10 h-10 rounded-full bg-surface-sunken flex items-center justify-center font-black text-foreground overflow-hidden shrink-0">
            {partnerAvatar ? (
              <img src={partnerAvatar} alt={partnerName} className="w-full h-full object-cover" />
            ) : (
              partnerName.charAt(0).toUpperCase()
            )}
            {isAI && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-[8px] flex items-center justify-center">
                AI
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-foreground text-sm flex items-center gap-2 truncate">
              {partnerName}
              {isAI && <Sparkles size={13} className="text-[var(--color-primary)] shrink-0" />}
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
              {showTyping ? (
                <><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" /> typing…</>
              ) : (
                <><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {isAI ? "AI · 24/7" : "Secure Session"}</>
              )}
            </div>
          </div>
        </div>

        {/* Per-minute rate chip */}
        <div
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-black shrink-0",
            liveRate > 0
              ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30 text-[var(--color-primary)]"
              : "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
          )}
          role="status"
          aria-label={liveRate > 0 ? `Billed ₹${liveRate} per minute from your wallet` : "Free conversation"}
          title={liveRate > 0 ? `Billed ₹${liveRate} per minute from your wallet` : "Free conversation"}
        >
          <Coins size={12} />
          {liveRate > 0 ? `₹${liveRate}/min` : "Free"}
        </div>
      </div>

      {/* Billing panel — while a billed session is active */}
      {sessionId && (
        <BillingPanel
          key={sessionId}
          sessionId={sessionId}
          rate={liveRate}
          onEnd={handleSessionEnd}
          onTerminated={(reason) => { setTerminationReason(reason); setSessionId(null); }}
        />
      )}

      {/* Termination banner */}
      {terminationReason && (
        <div className="flex-none px-3 md:px-4 py-2 bg-rose-500/10 border-b border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
          <AlertTriangle size={12} /> {terminationReason}
        </div>
      )}

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-3 md:px-4 py-4 space-y-4 custom-scrollbar"
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        <div className="text-center pb-6 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] text-xs font-bold rounded-full mb-2">
            <ShieldCheck size={14} /> Encrypted Session
          </div>
          <p className="text-muted-foreground text-[11px]">
            {isAI ? "AI consultant ready." : "Your session has begun."}
          </p>
        </div>

        {isLoading && messages.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <div className="w-12 h-12 rounded-full bg-surface-sunken border border-border flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-bold text-foreground">No messages yet</p>
            <p className="text-[11px] text-muted-foreground max-w-[240px]">
              {isAI ? "Ask a question to start the conversation." : "Say hello to start the conversation."}
            </p>
          </div>
        ) : (
          messages.map((msg: ChatMessage) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                <div className={cn(
                  "max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-lg break-words",
                  isMe
                    ? "bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white rounded-br-sm"
                    : "bg-surface-sunken text-foreground border border-border rounded-bl-sm",
                  msg._optimistic && "opacity-70"
                )}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 px-1 font-medium">
                  {formatTime(msg.createdAt)}
                </span>
              </div>
            );
          })
        )}

        {showStreaming && (
          <div className="flex flex-col items-start">
            <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-bl-sm bg-surface-sunken text-foreground border border-border text-sm leading-relaxed">
              {streamDisplay ? (
                <>
                  {!streamingText && fillerText && (
                    <span className="italic text-muted-foreground">{streamDisplay}</span>
                  )}
                  {streamingText}
                </>
              ) : (
                <span className="inline-flex gap-1 items-center py-1">
                  <span className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              )}
              <span className="inline-block w-1.5 h-4 ml-1 bg-[var(--color-primary)] animate-pulse align-middle" />
            </div>
          </div>
        )}

        {showTyping && (
          <div className="flex items-center gap-2 px-3 py-2 bg-surface-sunken border border-border rounded-2xl w-max">
            <div className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full animate-bounce" />
            <div className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full animate-bounce [animation-delay:150ms]" />
            <div className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="flex-none p-3 md:p-4 bg-background backdrop-blur-3xl border-t border-border"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-center gap-2 md:gap-3">
          <input
            type="text"
            value={input}
            onChange={handleChange}
            onBlur={() => !isAI && setTyping(false)}
            placeholder={isAI ? `Message ${partnerName}…` : "Type your message…"}
            aria-label={`Message ${partnerName}`}
            maxLength={4000}
            className="flex-1 bg-surface border border-border rounded-full px-5 py-3.5 text-sm focus:outline-none focus:border-[var(--color-primary)] text-foreground shadow-inner placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending || showStreaming}
            aria-label="Send"
            className={cn(
              "w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all shrink-0",
              input.trim() && !isSending && !showStreaming
                ? "bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white shadow-[0_0_15px_rgba(157,125,197,0.3)] active:scale-95"
                : "bg-surface-sunken text-muted-foreground cursor-not-allowed"
            )}
          >
            {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
          </button>
        </form>
      </div>

      <WalletGateDialog
        open={walletGate !== null}
        onOpenChange={(open) => { if (!open) setWalletGate(null); }}
        info={walletGate}
        resume={false}
      />
    </div>
  );
}
