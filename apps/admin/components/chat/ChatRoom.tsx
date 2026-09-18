// apps/admin/components/chat/ChatRoom.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Send, Loader2, ShieldCheck, ImagePlus, X, CheckCheck,
} from "lucide-react";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { useTyping } from "@/hooks/useTyping";
import { cn } from "@zeal/ui";

interface ChatRoomProps {
  conversationId: string;
  currentUserId: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string | null;
  partnerIsOnline?: boolean;
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function ChatRoom({
  conversationId,
  currentUserId,
  partnerName,
  partnerAvatar,
  partnerIsOnline,
}: ChatRoomProps) {
  const router = useRouter();
  const { messages, isLoading, isSending, send } = useChat({ conversationId, currentUserId });
  const { typingUsers, setTyping } = useTyping(conversationId, currentUserId);

  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, typingUsers.size]);

  // Read receipt: mark as read on mount + whenever new messages arrive
  useEffect(() => {
    void fetch(`/api/consultant/chat/${conversationId}/read`, { method: "POST" }).catch(() => {});
  }, [conversationId, messages.length]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    setTyping(e.target.value.length > 0);
  };

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

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("Image must be under 5 MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files are allowed");
      return;
    }
    setPendingImage({ file, preview: URL.createObjectURL(file) });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const cancelImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    setPendingImage(null);
    setUploadError(null);
  };

  const sendImage = async () => {
    if (!pendingImage) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", pendingImage.file);
      fd.append("folder", `chat/${conversationId}`);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: { message?: string } | string })?.error
          ? typeof (body as { error?: unknown }).error === "string"
            ? (body as { error: string }).error
            : ((body as { error: { message?: string } }).error?.message ?? `HTTP ${res.status}`)
          : `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { url: string };
      await send(`[image]${data.url}`);
      cancelImage();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const showTyping = typingUsers.size > 0;
  const hasImage = pendingImage !== null;

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="flex-none h-16 bg-slate-900/80 backdrop-blur-2xl border-b border-white/10 px-3 md:px-4 flex items-center gap-3">
        <button
          onClick={() => router.push("/consultant/chat")}
          className="md:hidden p-2 -ml-1 rounded-lg hover:bg-white/5 active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div className="relative w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-black text-white overflow-hidden shrink-0">
          {partnerAvatar ? (
            <img src={partnerAvatar} alt={partnerName} className="w-full h-full object-cover" />
          ) : (
            partnerName.charAt(0).toUpperCase()
          )}
          {partnerIsOnline && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-white text-sm truncate">{partnerName}</h2>
          <div className="flex items-center gap-1.5 text-[10px] font-bold">
            {showTyping ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[#9D7DC5] animate-pulse" />
                <span className="text-[#9D7DC5]">typing…</span>
              </>
            ) : partnerIsOnline ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-400">Online</span>
              </>
            ) : (
              <span className="text-slate-500">Offline</span>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 md:px-4 py-4 space-y-4 custom-scrollbar">
        <div className="text-center pb-6 border-b border-white/5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#9D7DC5]/10 border border-[#9D7DC5]/20 text-[#9D7DC5] text-xs font-bold rounded-full">
            <ShieldCheck size={14} /> Secure session
          </div>
        </div>

        {isLoading && messages.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[#9D7DC5]" />
          </div>
        ) : (
          messages.map((msg: ChatMessage) => {
            const isMe = msg.senderId === currentUserId;
            const isImage = msg.content.startsWith("[image]");
            const imageUrl = isImage ? msg.content.slice(7) : null;
            return (
              <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                {isImage && imageUrl ? (
                  <a
                    href={imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "max-w-[70%] rounded-2xl overflow-hidden border shadow-lg block",
                      isMe ? "border-[#9D7DC5]/30 rounded-br-sm" : "border-white/10 rounded-bl-sm",
                    )}
                  >
                    <img src={imageUrl} alt="Shared" className="w-full h-auto max-h-96 object-cover" loading="lazy" />
                  </a>
                ) : (
                  <div
                    className={cn(
                      "max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-lg break-words",
                      isMe
                        ? "bg-gradient-to-br from-[#9D7DC5] to-[#533AFD] text-white rounded-br-sm"
                        : "bg-slate-800 text-slate-200 border border-white/5 rounded-bl-sm",
                      msg._optimistic && "opacity-70",
                    )}
                  >
                    {msg.content}
                  </div>
                )}
                <div className="flex items-center gap-1 mt-1 px-1">
                  <span className="text-[10px] text-slate-600 font-medium">{formatTime(msg.createdAt)}</span>
                  {isMe && <CheckCheck size={11} className="text-[#9D7DC5]" />}
                </div>
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

      {/* Composer */}
      <div
        className="flex-none p-3 md:p-4 bg-slate-950/90 backdrop-blur-3xl border-t border-white/10"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        {uploadError && (
          <div className="max-w-4xl mx-auto mb-2 p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-center justify-between">
            <span>{uploadError}</span>
            <button onClick={() => setUploadError(null)} className="p-1 hover:bg-rose-500/10 rounded">
              <X size={12} />
            </button>
          </div>
        )}

        {hasImage && (
          <div className="max-w-4xl mx-auto mb-2 p-3 rounded-2xl bg-slate-900 border border-white/10 flex items-center gap-3">
            <img src={pendingImage.preview} alt="Preview" className="w-14 h-14 rounded-lg object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-bold truncate">{pendingImage.file.name}</p>
              <p className="text-xs text-slate-500">{(pendingImage.file.size / 1024).toFixed(0)} KB</p>
            </div>
            <button
              onClick={sendImage}
              disabled={uploading}
              className="px-3 py-2 rounded-lg bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              {uploading ? "Uploading" : "Send"}
            </button>
            <button
              onClick={cancelImage}
              disabled={uploading}
              className="p-2 rounded-lg hover:bg-white/5 text-slate-400 disabled:opacity-50"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-center gap-2 md:gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={pickImage}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || hasImage}
            className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center shrink-0 transition-colors disabled:opacity-40"
            aria-label="Attach image"
          >
            <ImagePlus size={18} />
          </button>
          <input
            type="text"
            value={input}
            onChange={handleChange}
            onBlur={() => setTyping(false)}
            placeholder="Type your message..."
            maxLength={4000}
            className="flex-1 bg-slate-900 border border-white/10 rounded-full px-5 py-3.5 text-sm focus:outline-none focus:border-[#9D7DC5] text-slate-200 placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            aria-label="Send"
            className={cn(
              "w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all shrink-0",
              input.trim() && !isSending
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
