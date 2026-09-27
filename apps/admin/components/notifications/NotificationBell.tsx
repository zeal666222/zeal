'use client';
import {useState} from 'react';
import { Bell, BellDot, Check } from "lucide-react";
import {motion, AnimatePresence} from 'framer-motion';
import {formatDistanceToNow} from 'date-fns';
import {useAdminStore} from '@/lib/store/adminStore';

export function NotificationBell() {
 const { notifications, unreadCount, markAllRead, markNotificationRead } = useAdminStore();
 const [isOpen, setIsOpen] = useState(false);

 return (
 <div className="relative">
 <button
 onClick={() => setIsOpen(!isOpen)}
 className="p-2 rounded-full hover:bg-surface-overlay dark:hover:bg-surface-overlay transition-colors relative"
 aria-label="Notifications"
 >
 {unreadCount > 0 ? (
 <>
 <BellDot className="w-5 h-5 text-[var(--color-primary)]" />
 <motion.span
 initial={{ scale: 0 }}
 animate={{ scale: 1 }}
 className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
 >
 {unreadCount > 9 ? '9+' : unreadCount}
 </motion.span>
 </>
 ) : (
 <Bell className="w-5 h-5 text-[var(--color-subtle-foreground)] dark:text-gray-500" />
 )}
 </button>

 <AnimatePresence>
 {isOpen && (
 <motion.div
 initial={{ opacity: 0, y: -10, scale: 0.95 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: -10, scale: 0.95 }}
 className="absolute right-0 mt-2 w-80 max-h-[80vh] overflow-y-auto glass-card-3d z-50"
 >
 <div className="flex items-center justify-between p-3 border-b border-border">
 <h3 className="font-semibold text-muted-foreground">Notifications</h3>
 {unreadCount > 0 && (
 <button onClick={markAllRead} className="text-xs text-[var(--color-primary)] hover:underline">
 Mark all read
 </button>
 )}
 </div>
 <div className="divide-y divide-border">
 {notifications.length === 0 ? (
 <div className="p-8 text-center text-[var(--color-subtle-foreground)] dark:text-gray-400">No notifications</div>
 ) : (
 notifications.slice(0, 20).map((n) => (
 <div
 key={n.id}
 className={`flex items-start gap-3 px-4 py-3 hover:bg-surface-overlay dark:hover:bg-gray-800/50 transition-colors ${!n.read ? 'bg-[var(--color-primary)]/10' : ''}`}
 >
 <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center flex-shrink-0">
 <span className="text-lg">
 {n.type === 'chat' ? '💬' : n.type === 'call' ? '📞' : n.type === 'booking' ? '📅' : '🔔'}
 </span>
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm text-muted-foreground">{n.message}</p>
 <p className="text-xs text-[var(--color-subtle-foreground)] dark:text-gray-400">
 {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
 </p>
 </div>
 {!n.read && (
 <button
 onClick={() => markNotificationRead(n.id)}
 className="p-1 rounded-full hover:bg-surface-overlay transition-colors"
 aria-label="Mark read"
 >
 <Check className="w-4 h-4 text-[var(--color-primary)]" />
 </button>
 )}
 </div>
 ))
 )}
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
}
