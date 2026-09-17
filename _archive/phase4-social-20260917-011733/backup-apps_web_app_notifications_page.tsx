"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, CheckCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/providers/SupabaseAuthProvider";
import { Badge, Button } from "@zeal/ui";
import { formatDistanceToNow } from "date-fns";
import { useRealtimeNotifications, type RealtimeNotification } from "@/hooks/useRealtimeNotifications";
import { EmptyState } from "@/components/shared/EmptyState";

type Filter = "all" | "unread" | "read";

export default function NotificationsPage() {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useRealtimeNotifications(user?.id);
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "read") return n.read;
    return true;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#5E4B8B] dark:text-white flex items-center gap-2">
          <Bell className="w-6 h-6" /> Notifications
          {unreadCount > 0 && <Badge variant="default" className="bg-[#9D7DC5] text-white">{unreadCount}</Badge>}
        </h1>
        {unreadCount > 0 && <Button variant="secondary" size="sm" onClick={markAllAsRead}><CheckCheck className="w-4 h-4 mr-1" /> Mark all read</Button>}
      </div>

      <div className="flex gap-2 mb-4">
        {(["all", "unread", "read"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "primary" : "secondary"} size="sm" onClick={() => setFilter(f)} className="capitalize">{f}</Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description={filter === "unread" ? "All caught up!" : "Nothing here yet."} />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((n, idx) => (
              <motion.div key={n.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ delay: idx * 0.03 }} className={"flex items-start gap-3 p-4 rounded-xl border " + (!n.read ? "bg-[#F4E8F7] dark:bg-gray-800/50 border-l-4 border-l-[#9D7DC5] border-[#E1C5E7]" : "bg-white dark:bg-gray-900 border-[#E1C5E7] dark:border-gray-700")}>
                <div className="w-10 h-10 rounded-full bg-[#F4E8F7] dark:bg-gray-700 flex items-center justify-center flex-shrink-0"><Bell className="w-4 h-4 text-[#9D7DC5]" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#5E4B8B] dark:text-white">{n.message}</p>
                  <p className="text-xs text-[#B8A1D9] mt-0.5">{formatDistanceToNow(n.createdAt, { addSuffix: true })}</p>
                </div>
                {!n.read && <button onClick={() => markAsRead(n.id)} className="p-1 rounded-full hover:bg-[#E1C5E7]"><Check className="w-4 h-4 text-[#9D7DC5]" /></button>}
                {n.redirectUrl && <Link href={n.redirectUrl} className="text-xs text-[#9D7DC5] hover:underline ml-2 self-center">View</Link>}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

