"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarImage, AvatarFallback } from "@zeal/ui";
import { MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Conversation } from "@/hooks/useChat";

interface ConversationListProps {
  conversations: Conversation[];
  activeId?: string | null;
}

export function ConversationList({ conversations, activeId }: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No conversations yet"
        description="Start a chat with a consultant or client."
      />
    );
  }

  return (
    <div className="divide-y divide-[#E1C5E7] dark:divide-gray-700">
      {conversations.map((conv, idx) => {
        const other = conv.otherUser;
        const displayName = other?.name || other?.username || "Unknown";
        const isActive = conv.id === activeId;

        return (
          <motion.div
            key={conv.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.03, 0.3) }}
          >
            <Link
              href={"/chat/" + conv.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-colors",
                isActive
                  ? "bg-[#F4E8F7] dark:bg-gray-800"
                  : "hover:bg-[#F4E8F7]/60 dark:hover:bg-gray-800/60",
              )}
            >
              <Avatar className="w-12 h-12 flex-shrink-0">
                <AvatarImage src={other?.avatar || undefined} alt={displayName} />
                <AvatarFallback className="bg-gradient-to-br from-[#9D7DC5] to-[#533AFD] text-white">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-[#5E4B8B] dark:text-white truncate">{displayName}</p>
                  <span className="text-xs text-[#B8A1D9] flex-shrink-0">
                    {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-[#B8A1D9] truncate">
                  {conv.lastMessageText || "Start a conversation"}
                </p>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}

import { cn } from "@/lib/utils";

