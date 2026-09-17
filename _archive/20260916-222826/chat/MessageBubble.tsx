"use client";

import { format } from "date-fns";
import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/useChat";

interface MessageBubbleProps {
  message: ChatMessage;
  ownId: string;
}

export function MessageBubble({ message, ownId }: MessageBubbleProps) {
  const isOwn = message.senderId === ownId;

  return (
    <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-4 py-2.5 shadow-sm",
          isOwn
            ? "bg-gradient-to-br from-[#9D7DC5] to-[#533AFD] text-white"
            : "bg-[#F4E8F7] dark:bg-gray-800 text-[#5E4B8B] dark:text-white",
        )}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <div
          className={cn(
            "flex items-center justify-end gap-1 mt-1 text-[10px]",
            isOwn ? "text-white/70" : "text-[#B8A1D9]",
          )}
        >
          <span>{format(new Date(message.createdAt), "HH:mm")}</span>
          {isOwn && (
            message.readAt
              ? <CheckCheck className="w-3 h-3" aria-label="Read" />
              : <Check className="w-3 h-3" aria-label="Sent" />
          )}
        </div>
      </div>
    </div>
  );
}

