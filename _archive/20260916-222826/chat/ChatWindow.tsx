"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarImage, AvatarFallback } from "@zeal/ui";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { useChat } from "@/hooks/useChat";

interface ChatWindowProps {
  conversationId: string;
  ownId: string;
  otherUser: { name: string | null; username: string; avatar: string | null } | null;
}

export function ChatWindow({ conversationId, ownId, otherUser }: ChatWindowProps) {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { messages, isLoading, error, send, isSending } = useChat(conversationId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const displayName = otherUser?.name || otherUser?.username || "Chat";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[#E1C5E7] dark:border-gray-700">
        <button
          onClick={() => router.push("/chat")}
          className="p-1.5 rounded-lg hover:bg-[#F4E8F7] dark:hover:bg-gray-800 md:hidden"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="w-5 h-5 text-[#5E4B8B] dark:text-white" />
        </button>
        <Avatar className="w-10 h-10">
          <AvatarImage src={otherUser?.avatar || undefined} alt={displayName} />
          <AvatarFallback className="bg-gradient-to-br from-[#9D7DC5] to-[#533AFD] text-white">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-semibold text-[#5E4B8B] dark:text-white truncate">{displayName}</p>
          <p className="text-xs text-[#B8A1D9]">
            {isSending ? "Sending…" : "Realtime chat"}
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#9D7DC5]" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500 text-sm" role="alert">
            Failed to load messages.
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-[#B8A1D9] text-sm">
            Say hello to start the conversation
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} ownId={ownId} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <MessageInput onSend={send} disabled={isLoading || !!error} />
    </div>
  );
}

