"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellDot, Check, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useAppStore } from "@/lib/store/appStore";
import { useSoundEnabled } from "@/lib/sound";

const TYPE_STYLE: Record<string, { emoji: string; tint: string }> = {
  chat: { emoji: "💬", tint: "bg-sky-500/10 ring-sky-500/20" },
  call: { emoji: "📞", tint: "bg-emerald-500/10 ring-emerald-500/20" },
  booking: { emoji: "📅", tint: "bg-violet-500/10 ring-violet-500/20" },
  payment: { emoji: "💳", tint: "bg-amber-500/10 ring-amber-500/20" },
  referral: { emoji: "🎁", tint: "bg-pink-500/10 ring-pink-500/20" },
  quest: { emoji: "🏆", tint: "bg-orange-500/10 ring-orange-500/20" },
  new_post: { emoji: "✨", tint: "bg-cyan-500/10 ring-cyan-500/20" },
  verification: { emoji: "🛡️", tint: "bg-teal-500/10 ring-teal-500/20" },
  reminder: { emoji: "⏰", tint: "bg-indigo-500/10 ring-indigo-500/20" },
  system: { emoji: "🔔", tint: "bg-violet-500/10 ring-violet-500/20" },
};

export function NotificationBell() {
  const { notifications, markAllRead, markNotificationRead, unreadCount } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [soundOn, setSoundOn] = useSoundEnabled();
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on any click outside the bell + panel.
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen]);

  const count = unreadCount;

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="p-2 rounded-full hover:bg-[var(--color-surface-sunken)] dark:hover:bg-gray-800 transition-colors relative"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        {count > 0 ? (
          <>
            <BellDot className="w-5 h-5 text-[var(--color-primary)]" />
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
            >
              {count > 9 ? "9+" : count}
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
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute right-0 mt-2 w-80 max-h-[80vh] rounded-2xl bg-surface shadow-2xl border border-border z-50 flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface/95 backdrop-blur-xl shrink-0">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                Notifications
                {count > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400">
                    {count} new
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSoundOn(!soundOn)}
                  className="p-1.5 rounded-lg hover:bg-[var(--color-surface-sunken)] dark:hover:bg-gray-800 transition-colors"
                  aria-label={soundOn ? "Mute notification sound" : "Unmute notification sound"}
                  title={soundOn ? "Sound on" : "Sound off"}
                >
                  {soundOn ? (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                {count > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-[var(--color-primary)] hover:underline px-1"
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border/60">
              {notifications.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center gap-2">
                  <Bell className="w-8 h-8 text-[var(--color-subtle-foreground)] opacity-40" />
                  <p className="text-[var(--color-subtle-foreground)] dark:text-gray-400 text-sm">
                    No notifications yet
                  </p>
                </div>
              ) : (
                notifications.slice(0, 20).map((n) => {
                  const style = TYPE_STYLE[n.type] ?? { emoji: "🔔", tint: "bg-violet-500/10 ring-violet-500/20" };
                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                        !n.read
                          ? "bg-violet-500/[0.06] hover:bg-violet-500/[0.09]"
                          : "hover:bg-[var(--color-surface-sunken)] dark:hover:bg-gray-800"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm ring-1 ${style.tint}`}
                      >
                        {style.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm line-clamp-2 ${!n.read ? "font-medium" : "text-muted-foreground"}`}>
                          {n.message}
                        </p>
                        <p className="text-xs text-[var(--color-subtle-foreground)] dark:text-gray-400 mt-0.5">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 self-center shrink-0">
                        {n.redirectUrl && (
                          <Link
                            href={n.redirectUrl}
                            onClick={() => setIsOpen(false)}
                            className="text-xs text-[var(--color-primary)] hover:underline"
                          >
                            View
                          </Link>
                        )}
                        {!n.read && (
                          <button
                            onClick={() => markNotificationRead(n.id)}
                            className="p-1 rounded-full hover:bg-[var(--color-surface-sunken)] dark:hover:bg-gray-800 transition-colors"
                            aria-label="Mark read"
                            title="Mark read"
                          >
                            <Check className="w-4 h-4 text-[var(--color-primary)]" />
                          </button>
                        )}
                      </div>
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
