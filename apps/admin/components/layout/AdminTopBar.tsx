"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeToggle } from "@zeal/ui";
import { useAdminStore } from "@/lib/store/adminStore";
import { ConnectionBadge } from "@/components/dev/ConnectionBadge";
import { AdminCommandMenu } from "@/components/layout/AdminCommandMenu";
import { cn } from "@zeal/ui";
import {
  Bell, ChevronRight, Clock, CreditCard, MessageSquare,
  Shield, UserPlus, X, Zap,
} from "lucide-react";
import Link from "next/link";

const NOTIFICATION_ICONS: Record<string, typeof Zap> = {
  chat: MessageSquare,
  booking: CreditCard,
  system: Shield,
  payment: CreditCard,
  verification: Shield,
  reminder: Clock,
  referral: UserPlus,
  call: MessageSquare,
  quest: Zap,
  new_post: MessageSquare,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  chat: "bg-blue-500/15 text-blue-400",
  booking: "bg-emerald-500/15 text-emerald-400",
  system: "bg-purple-500/15 text-purple-400",
  payment: "bg-amber-500/15 text-amber-400",
  verification: "bg-cyan-500/15 text-cyan-400",
  reminder: "bg-rose-500/15 text-rose-400",
  referral: "bg-indigo-500/15 text-indigo-400",
  call: "bg-green-500/15 text-green-400",
  quest: "bg-orange-500/15 text-orange-400",
  new_post: "bg-teal-500/15 text-teal-400",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function AdminTopBar() {
  const connectionState = useAdminStore((s) => s.isSocketConnected);
  const profile = useAdminStore((s) => s.profile);
  const notifications = useAdminStore((s) => s.notifications);
  const markNotificationRead = useAdminStore((s) => s.markNotificationRead);
  const markAllRead = useAdminStore((s) => s.markAllRead);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const recentNotifs = notifications.slice(0, 8);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-20 bg-surface/80 backdrop-blur-xl border-b border-border/50">
      <div className="flex items-center justify-between h-14 px-4 lg:px-6">
        {/* Left: Page title */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground transition-colors font-medium">
              Admin
            </Link>
            <ChevronRight size={10} className="text-muted-foreground/40" />
            <span className="text-foreground font-semibold">
              {profile?.role ? profile.role.replace("_", " ") + " Console" : "Console"}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          <AdminCommandMenu />

          {/* Notification Bell */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className={cn(
                "relative p-2 rounded-lg transition-colors",
                notifOpen
                  ? "bg-rose-500/10 text-rose-400"
                  : "hover:bg-surface-raised text-muted-foreground hover:text-foreground"
              )}
              aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center ring-2 ring-surface"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </motion.span>
              )}
            </button>

            {/* Notification Dropdown */}
            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-border/50 bg-surface shadow-2xl shadow-black/20 overflow-hidden z-50"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-black text-foreground">Notifications</h3>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-400 text-[9px] font-black">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-[10px] text-rose-400 hover:text-rose-300 font-bold px-2 py-1 rounded-md hover:bg-rose-500/10 transition-colors"
                        >
                          Mark all read
                        </button>
                      )}
                      <button
                        onClick={() => setNotifOpen(false)}
                        className="p-1 rounded-md hover:bg-surface-raised transition-colors"
                      >
                        <X size={12} className="text-muted-foreground" />
                      </button>
                    </div>
                  </div>

                  {/* Notification List */}
                  <div className="max-h-80 overflow-y-auto">
                    {recentNotifs.length === 0 ? (
                      <div className="py-8 text-center">
                        <Bell size={20} className="mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-xs text-muted-foreground">No notifications yet</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/30">
                        {recentNotifs.map((notif) => {
                          const Icon = NOTIFICATION_ICONS[notif.type] ?? Zap;
                          const colorClass = NOTIFICATION_COLORS[notif.type] ?? NOTIFICATION_COLORS.system;
                          return (
                            <button
                              key={notif.id}
                              onClick={() => {
                                markNotificationRead(notif.id);
                                if (notif.redirectUrl) {
                                  window.location.href = notif.redirectUrl;
                                  setNotifOpen(false);
                                }
                              }}
                              className={cn(
                                "flex items-start gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-surface-raised/50",
                                !notif.read && "bg-rose-500/[0.03]"
                              )}
                            >
                              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", colorClass)}>
                                <Icon size={14} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "text-xs leading-relaxed",
                                  !notif.read ? "text-foreground font-semibold" : "text-muted-foreground"
                                )}>
                                  {notif.message}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-muted-foreground/60">
                                    {timeAgo(notif.createdAt)}
                                  </span>
                                  {!notif.read && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {recentNotifs.length > 0 && (
                    <div className="px-4 py-2.5 border-t border-border/50 bg-surface-raised/30">
                      <Link
                        href="/audit"
                        onClick={() => setNotifOpen(false)}
                        className="text-[10px] text-rose-400 hover:text-rose-300 font-bold flex items-center justify-center gap-1 transition-colors"
                      >
                        View all activity <ChevronRight size={10} />
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Connection Status */}
          <ConnectionBadge />
          <span
            className={cn(
              "hidden sm:flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full font-bold",
              connectionState
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-surface-raised text-muted-foreground",
            )}
            aria-label={connectionState ? "Realtime connected" : "Realtime offline"}
          >
            <span className={cn(
              "w-1.5 h-1.5 rounded-full",
              connectionState ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
            )} />
            {connectionState ? "Live" : "Offline"}
          </span>

          <div className="w-px h-5 bg-border/50 mx-1" />

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
