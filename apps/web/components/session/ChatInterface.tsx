"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Chat interface — human + AI conversations with optional billed session
// ═══════════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowLeft, Coins, Loader2, MessageCircle, Paperclip, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import Image from "next/image";
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

function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\))/g);
  const hasVisual = parts.some((p) => p.startsWith("!["));
  if (!hasVisual && !content.includes("](http")) {
    return <>{content}</>;
  }
  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        const imgMatch = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (imgMatch) {
          return (
            <img
              key={i}
              src={imgMatch[2]}
              alt={imgMatch[1] || "attachment"}
              className="max-w-full rounded-xl border border-border/50"
              loading="lazy"
            />
          );
        }
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          return (
            <a
              key={i}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[var(--color-primary)] underline underline-offset-2 text-xs"
            >
              <Paperclip size={10} /> {linkMatch[1]}
            </a>
          );
        }
        if (part.trim()) {
          return <span key={i}>{part}</span>;
        }
        return null;
      })}
    </div>
  );
}

const AI_QUICK_REPLIES = [
  "What is my Sun sign?",
  "Tell me about my career",
  "I'd like a compatibility reading",
  "Today's Horoscope",
  "Analyze my Dasha period",
];

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
    partnerId,
    partnerName,
    partnerAvatar,
    isAI,
  });
  const { typingUsers, setTyping } = useTyping(conversationId, currentUserId);

  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [fillerText, setFillerText] = useState<string | null>(null);
  const [terminationReason, setTerminationReason] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [failedText, setFailedText] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Synchronous in-flight guard — state-based disabling is async, so rapid
  // double-clicks can slip past `isSending` before React re-renders.
  const inFlightRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, streamingText, fillerText, typingUsers.size]);

  useEffect(() => {
    void fetch(`/api/chat/${conversationId}/read`, { method: "POST" }).catch(() => {});
  }, [conversationId]);

  // Mobile keyboard handling — keep composer visible when virtual keyboard opens
  useEffect(() => {
    if (!window.visualViewport) return;
    const vv = window.visualViewport;
    const handler = () => {
      const offsetBottom = window.innerHeight - vv.height - vv.offsetTop;
      document.documentElement.style.setProperty("--kb-offset", `${offsetBottom}px`);
    };
    vv.addEventListener("resize", handler);
    return () => vv.removeEventListener("resize", handler);
  }, []);

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

  const uploadFiles = async (files: File[]): Promise<Array<{ url: string; name: string; mime: string }>> => {
    const results: Array<{ url: string; name: string; mime: string }> = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`Upload failed: ${file.name}`);
      const data = await res.json();
      results.push({ url: data.url, name: file.name, mime: data.mime ?? file.type });
    }
    return results;
  };

  /** Deliver an already-composed message (text may include uploaded-file markdown). */
  const deliver = async (messageText: string, restoreText: string) => {
    if (inFlightRef.current || isSending) return;
    inFlightRef.current = true;
    try {
      if (isAI) {
        setStreamingText("");
        setFillerText(null);
        await sendToAI(partnerId, messageText, {
          onDelta: (acc) => { setStreamingText(acc); setFillerText(null); },
          onFiller: (f) => setFillerText(f),
          onBilling: handleBilling,
        });
        setStreamingText(null);
        setFillerText(null);
      } else {
        const result = await send(messageText);
        if (result?.billing) handleBilling(result.billing);
        const b = result?.billing;
        if (b && b.success === false && b.error === "insufficient_balance") {
          setInput((cur) => (cur ? cur : restoreText));
        }
      }
      setSendError(null);
      setFailedText(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setSendError(
        msg.includes("insufficient_balance")
          ? "Low wallet balance — recharge and send again."
          : msg.includes("rate limit")
            ? "You hit a rate limit — please wait a moment and try again."
            : "Message wasn't sent. Try again.",
      );
      setInput((cur) => (cur ? cur : restoreText));
      setFailedText(messageText);
      setStreamingText(null);
      setFillerText(null);
    } finally {
      inFlightRef.current = false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (uploading || (!text && attachments.length === 0) || isSending || inFlightRef.current) return;
    setSendError(null);
    setFailedText(null);
    setInput("");
    setTyping(false);

    let messageText = text;
    let uploadedFiles: Array<{ url: string; name: string; mime: string }> = [];

    if (attachments.length > 0) {
      setUploading(true);
      try {
        uploadedFiles = await uploadFiles(attachments);
        const fileLines = uploadedFiles
          .map((f) => {
            const isImage = f.mime.startsWith("image/");
            return isImage
              ? `![${f.name}](${f.url})`
              : `[${f.name}](${f.url})`;
          })
          .join("\n");
        messageText = text
          ? `${text}\n\n${fileLines}`
          : fileLines;
      } catch (err) {
        setSendError(err instanceof Error ? err.message : "Upload failed. Please try again.");
        setInput((cur) => (cur ? cur : text));
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    clearAttachments();
    await deliver(messageText, text);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (!isAI) setTyping(e.target.value.length > 0);
  };

  const handleSessionEnd = () => {
    setSessionId(null);
    setTerminationReason(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const next = [...attachments, ...files].slice(0, 5);
    setAttachments(next);
    const urls = next.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : ""));
    setPreviewUrls(urls);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearAttachments = () => {
    previewUrls.filter(Boolean).forEach((url) => URL.revokeObjectURL(url));
    setAttachments([]);
    setPreviewUrls([]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
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
            type="button"
            onClick={() => router.push("/chat")}
            className="md:hidden p-2 -ml-1 rounded-lg hover:bg-surface-raised active:scale-95"
            aria-label="Back to inbox"
          >
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <div className="relative w-10 h-10 rounded-full bg-surface-sunken flex items-center justify-center font-black text-foreground overflow-hidden shrink-0">
            {partnerAvatar ? (
              <Image src={partnerAvatar} alt={partnerName} fill sizes="48px" className="object-cover" />
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
            {isAI ? "AI consultant is ready — go ahead and ask." : "Your session has started."}
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
              {isAI ? "Start the conversation by asking a question." : "Say hello to start the conversation."}
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg: ChatMessage) => {
              const isMe = msg.senderId === currentUserId;
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className={cn("flex flex-col", isMe ? "items-end" : "items-start")}
                >
                  <div className={cn(
                    "max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words",
                    isMe
                      ? "bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white rounded-br-sm shadow-lg shadow-[var(--color-primary)]/15"
                      : "bg-surface-sunken text-foreground border border-border rounded-bl-sm",
                    msg._optimistic && "opacity-70"
                  )}>
                    <MessageContent content={msg.content} />
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 px-1 font-medium">
                    {formatTime(msg.createdAt)}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
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
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-4 py-3 bg-surface-sunken border border-border rounded-2xl w-max"
          >
            <span className="text-[10px] font-bold text-muted-foreground">{partnerName}</span>
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full animate-bounce [animation-delay:300ms]" />
            </span>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="flex-none p-3 md:p-4 bg-background backdrop-blur-3xl border-t border-border transition-[padding] duration-150"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px + var(--kb-offset, 0px))" }}
      >
        {/* Send error banner */}
        <AnimatePresence>
          {sendError && (
            <motion.div
              initial={{ opacity: 0, y: 8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              className="max-w-4xl mx-auto mb-2"
            >
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-bold">
                <AlertTriangle size={12} className="shrink-0" />
                <span className="flex-1">{sendError}</span>
                {failedText && (
                  <button
                    type="button"
                    onClick={() => void deliver(failedText, "")}
                    disabled={isSending || uploading}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 transition-colors disabled:opacity-50 disabled:cursor-wait"
                  >
                    Retry
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSendError(null)}
                  className="p-0.5 rounded-full hover:bg-rose-500/20 transition-colors"
                  aria-label="Dismiss"
                >
                  <X size={12} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Quick replies for AI */}
        {isAI && messages.length === 0 && (
          <div className="max-w-4xl mx-auto mb-3 flex flex-wrap gap-2">
            {AI_QUICK_REPLIES.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => { setInput(q); }}
                className="px-3 py-1.5 rounded-full text-[11px] font-bold glass-luxury text-muted-foreground hover:text-foreground hover:border-[var(--color-luxury-gold)]/30 transition-all active:scale-[0.97]"
              >
                <Sparkles size={10} className="inline mr-1" />{q}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 px-1">
              {attachments.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="relative group flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-sunken border border-border text-xs"
                >
                  {file.type.startsWith("image/") && previewUrls[idx] ? (
                    <img
                      src={previewUrls[idx]}
                      alt={file.name}
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
                      <Paperclip size={14} className="text-[var(--color-primary)]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-foreground font-bold truncate max-w-[120px]">{file.name}</p>
                    <p className="text-muted-foreground text-[10px]">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="p-0.5 rounded-full hover:bg-border/60 transition-colors"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X size={12} className="text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 md:gap-3">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt"
              onChange={handleFileSelect}
              className="hidden"
              aria-label="Upload file"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={attachments.length >= 5 || uploading}
              aria-label="Attach a file or photo"
              title={attachments.length >= 5 ? "Too many files — remove some first" : "Send an image or file for analysis"}
              className={cn(
                "w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center shrink-0 transition-all",
                attachments.length >= 5 || uploading
                  ? "bg-surface-sunken text-muted-foreground/50 cursor-not-allowed"
                  : "bg-surface border border-border text-muted-foreground hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/40 active:scale-95"
              )}
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
            </button>
            <textarea
              value={input}
              onChange={handleChange}
              onBlur={() => !isAI && setTyping(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }}
              placeholder={isAI ? `Write a message to ${partnerName}…` : "Type your message…"}
              aria-label={`Message ${partnerName}`}
              maxLength={4000}
              rows={1}
              className="flex-1 bg-surface border border-border rounded-3xl px-5 py-3 text-sm focus:outline-none focus:border-[var(--color-primary)] text-foreground shadow-inner placeholder:text-muted-foreground resize-none overflow-hidden min-h-[48px] max-h-[120px] leading-snug"
              style={{ height: "auto" }}
              ref={(el) => {
                if (el) {
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 120) + "px";
                }
              }}
            />
            <button
              type="submit"
              disabled={(!input.trim() && attachments.length === 0) || isSending || showStreaming || uploading}
              aria-label="Send message"
              className={cn(
                "w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all shrink-0",
                (input.trim() || attachments.length > 0) && !isSending && !showStreaming && !uploading
                  ? "bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white shadow-[0_0_15px_rgba(157,125,197,0.3)] active:scale-95"
                  : "bg-surface-sunken text-muted-foreground cursor-not-allowed"
              )}
            >
              {isSending || uploading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
            </button>
          </div>
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
