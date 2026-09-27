"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// Notifications — realtime via @zeal/realtime
// Subscribes to user:{uid}:notifications; server broadcasts TG_OP events.
// ═══════════════════════════════════════════════════════════════════════════════

import {useCallback, useEffect, useMemo, useState} from "react";
import Link from "next/link";
import {motion, AnimatePresence} from "framer-motion";
import { Bell, Check, CheckCheck, Loader2 } from "lucide-react";
import {formatDistanceToNow} from "date-fns";
import {useChannel, channels, type BroadcastChange} from "@zeal/realtime";

interface NotificationItem {
  id: string;
  type: string;
  message: string;
  redirectUrl?: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationRow {
  id?: string;
  type?: string;
  message?: string;
  redirectUrl?: string | null;
  createdAt?: string;
}

interface MeResponse {
  user?: { id: string };
}

type Filter = "all" | "unread" | "read";

export default function NotificationsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  // ─── Initial fetch (identity + notifications) ─────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meRes = await fetch("/api/users/me/profile", { cache: "no-store" });
        if (!cancelled && meRes.ok) {
          const me = (await meRes.json()) as MeResponse;
          if (me.user?.id) setUserId(me.user.id);
        }
        const res = await fetch("/api/notifications?limit=50", { cache: "no-store" });
        if (!cancelled && res.ok) {
          const data = (await res.json()) as { items?: NotificationItem[] };
          setItems(data.items ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Realtime ─────────────────────────────────────────────────────────────
  useChannel<BroadcastChange<NotificationRow>>({
    channel: userId ? channels.userNotifications(userId) : null,
    event: "*",
    onMessage: (payload) => {
      const row = payload?.record;
      if (!row?.message) return;

      // Narrow once, outside the state updater closure.
      const message: string = row.message;
      const id: string = row.id ?? `notif-${Date.now()}`;
      const type: string = row.type ?? "system";
      const redirectUrl: string | null = row.redirectUrl ?? null;
      const createdAt: string = row.createdAt ?? new Date().toISOString();

      setItems((prev) => {
        if (prev.some((n) => n.id === id)) return prev;
        const next: NotificationItem = {
          id,
          type,
          message,
          redirectUrl,
          read: false,
          createdAt,
        };
        return [next, ...prev];
      });
    },
  });

  // ─── Actions ──────────────────────────────────────────────────────────────
  const markAsRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try { await fetch(`/api/notifications/${id}/read`, { method: "POST" }); } catch { /* ignore */ }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try { await fetch("/api/notifications", { method: "PUT" }); } catch { /* ignore */ }
  }, []);

  const filtered = useMemo(
    () =>
      items.filter((n) => {
        if (filter === "unread") return !n.read;
        if (filter === "read") return n.read;
        return true;
      }),
    [items, filter],
  );

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-2xl mx-auto px-4 py-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-muted-foreground)] dark:text-foreground flex items-center gap-2">
          <Bell className="w-6 h-6" /> Notifications
          {unreadCount > 0 && (
            <span className="bg-[var(--color-primary)] text-white rounded-full px-2.5 py-0.5 text-xs">
              {unreadCount}
            </span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-surface-raised border border-border text-sm text-[var(--color-primary)] hover:bg-surface-overlay"
          >
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {(["all", "unread", "read"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${
              filter === f
                ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white"
                : "bg-surface-raised border border-border text-muted-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[280px] text-center">
          <div className="p-4 rounded-full bg-[var(--color-primary)]/10 mb-4">
            <Bell className="w-8 h-8 text-[var(--color-primary)]" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">No notifications</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filter === "unread" ? "All caught up!" : "Nothing here yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((n, idx) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                className={`flex items-start gap-3 p-4 rounded-xl border ${
                  !n.read
                    ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30 border-l-4 border-l-[var(--color-primary)]"
                    : "bg-surface border-border"
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center flex-shrink-0">
                  <Bell className="w-4 h-4 text-[var(--color-primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!n.read && (
                  <button
                    onClick={() => markAsRead(n.id)}
                    className="p-1 rounded-full hover:bg-surface-overlay"
                    aria-label="Mark read"
                  >
                    <Check className="w-4 h-4 text-[var(--color-primary)]" />
                  </button>
                )}
                {n.redirectUrl && (
                  <Link
                    href={n.redirectUrl}
                    className="text-xs text-[var(--color-primary)] hover:underline ml-2 self-center"
                  >
                    View
                  </Link>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
