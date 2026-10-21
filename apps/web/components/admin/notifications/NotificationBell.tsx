'use client';
import { useEffect, useRef, useState } from 'react';
import { Bell, BellDot, Check, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { useAdminStore } from '@/lib/admin/store/adminStore';
import { useSoundEnabled } from '@/lib/sound';

const TYPE_STYLE: Record<string, { emoji: string; tint: string }> = {
  chat: { emoji: '💬', tint: 'bg-sky-500/10 ring-sky-500/20' },
  call: { emoji: '📞', tint: 'bg-emerald-500/10 ring-emerald-500/20' },
  booking: { emoji: '📅', tint: 'bg-violet-500/10 ring-violet-500/20' },
  payment: { emoji: '💳', tint: 'bg-amber-500/10 ring-amber-500/20' },
  verification: { emoji: '🛡️', tint: 'bg-teal-500/10 ring-teal-500/20' },
  system: { emoji: '🔔', tint: 'bg-violet-500/10 ring-violet-500/20' },
};

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead, markNotificationRead } = useAdminStore();
  const [isOpen, setIsOpen] = useState(false);
  const [soundOn, setSoundOn] = useSoundEnabled();
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on any click outside the bell + panel.
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isOpen]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="p-2 rounded-full hover:bg-surface-overlay dark:hover:bg-surface-overlay transition-colors relative"
        aria-label="Notifications"
        aria-expanded={isOpen}
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
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="absolute right-0 mt-2 w-80 max-h-[80vh] rounded-2xl glass-card-3d z-50 flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                Notifications
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400">
                    {unreadCount} new
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSoundOn(!soundOn)}
                  className="p-1.5 rounded-lg hover:bg-surface-overlay transition-colors"
                  aria-label={soundOn ? 'Mute notification sound' : 'Unmute notification sound'}
                  title={soundOn ? 'Sound on' : 'Sound off'}
                >
                  {soundOn ? (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-[var(--color-primary)] hover:underline px-1">
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border/60">
              {notifications.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center gap-2">
                  <Bell className="w-8 h-8 text-[var(--color-subtle-foreground)] opacity-40" />
                  <p className="text-[var(--color-subtle-foreground)] dark:text-gray-400 text-sm">No notifications</p>
                </div>
              ) : (
                notifications.slice(0, 20).map((n) => {
                  const style = TYPE_STYLE[n.type] ?? { emoji: '🔔', tint: 'bg-violet-500/10 ring-violet-500/20' };
                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                        !n.read
                          ? 'bg-violet-500/[0.06] hover:bg-violet-500/[0.09]'
                          : 'hover:bg-surface-overlay dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base ring-1 ${style.tint}`}>
                        {style.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm line-clamp-2 ${!n.read ? 'font-medium' : 'text-muted-foreground'}`}>
                          {n.message}
                        </p>
                        <p className="text-xs text-[var(--color-subtle-foreground)] dark:text-gray-400 mt-0.5">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      {!n.read && (
                        <button
                          onClick={() => markNotificationRead(n.id)}
                          className="p-1 rounded-full hover:bg-surface-overlay transition-colors self-center shrink-0"
                          aria-label="Mark read"
                          title="Mark read"
                        >
                          <Check className="w-4 h-4 text-[var(--color-primary)]" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
