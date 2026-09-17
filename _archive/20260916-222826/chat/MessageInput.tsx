"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({ onSend, disabled = false, placeholder = "Type a message…" }: MessageInputProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [text]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending || disabled) return;
    setSending(true);
    setText("");
    try {
      await onSend(content);
      inputRef.current?.focus();
    } catch {
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex items-end gap-2 p-3 border-t border-[#E1C5E7] dark:border-gray-700 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm">
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        maxLength={2000}
        disabled={disabled || sending}
        className={cn(
          "flex-1 resize-none rounded-xl bg-white dark:bg-gray-900 border border-[#E1C5E7] dark:border-gray-700",
          "px-4 py-2.5 text-sm text-[#5E4B8B] dark:text-white placeholder:text-[#B8A1D9]",
          "focus:ring-2 focus:ring-[#9D7DC5] outline-none transition-all",
        )}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || sending || disabled}
        className={cn(
          "p-2.5 rounded-xl bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-white transition-all",
          "shadow-lg shadow-[#9D7DC5]/25 hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed",
        )}
        aria-label="Send message"
      >
        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
      </button>
    </div>
  );
}

