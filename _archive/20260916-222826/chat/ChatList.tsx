'use client';
import { Avatar, AvatarImage, AvatarFallback, Badge } from '@zeal/ui';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Chat {
  id: string;
  name: string;
  username: string;
  avatar: string;
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
  isOnline: boolean;
  isAI?: boolean;
}

interface ChatListProps {
  chats: Chat[];
  onSelect: (id: string) => void;
  selectedId?: string;
}

export function ChatList({ chats, onSelect, selectedId }: ChatListProps) {
  if (!chats.length) {
    return <div className="p-8 text-center text-[#B8A1D9] dark:text-gray-400 text-sm">No conversations yet. Start chatting with a healer!</div>;
  }

  return (
    <div className="divide-y divide-[#E1C5E7] dark:divide-gray-700">
      {chats.map((chat, idx) => (
        <motion.button
          key={chat.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
          onClick={() => onSelect(chat.id)}
          className={cn(
            'w-full text-left px-4 py-3 hover:bg-[#F4E8F7] dark:hover:bg-gray-800 transition-colors flex items-center gap-3',
            selectedId === chat.id && 'bg-[#F4E8F7] dark:bg-gray-800'
          )}
        >
          <div className="relative">
            <Avatar className="w-12 h-12">
              <AvatarImage src={chat.avatar} alt={chat.name} />
              <AvatarFallback>{chat.name?.[0] || '?'}</AvatarFallback>
            </Avatar>
            {chat.isOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
            )}
            {chat.isAI && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#9D7DC5] rounded-full flex items-center justify-center text-[8px] text-white font-bold">AI</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="font-medium text-[#5E4B8B] dark:text-white truncate">{chat.name}</p>
              <span className="text-xs text-[#B8A1D9] dark:text-gray-400">
                {formatDistanceToNow(chat.lastMessageAt, { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm text-[#B8A1D9] dark:text-gray-400 truncate">{chat.lastMessage}</p>
          </div>
          {chat.unreadCount > 0 && (
            <Badge className="ml-auto bg-[#9D7DC5] text-white text-xs px-2 py-0.5 rounded-full">
              {chat.unreadCount}
            </Badge>
          )}
        </motion.button>
      ))}
    </div>
  );
}
