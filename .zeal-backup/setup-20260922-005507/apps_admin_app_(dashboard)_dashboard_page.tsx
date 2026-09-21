"use client";

import {useCallback} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {motion} from "framer-motion";
import { AlertCircle, Calendar, DollarSign, Radio, UserCog, Users } from "lucide-react";
import {useChannel, channels, type BroadcastChange} from "@zeal/realtime";

interface Stats {
  users: number;
  consultants: number;
  bookings: number;
  revenueToday: number;
  revenueMonth: number;
  liveSessions: number;
  pendingVerifications: number;
}

export default function AdminDashboardPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<Stats>({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["admin", "stats"] });
  }, [qc]);

  // Instant refetch on any booking change
  useChannel<BroadcastChange>({
    channel: channels.adminBookings(),
    event: "*",
    onMessage: refresh,
  });

  // Instant refetch on any consultant verification change
  useChannel<BroadcastChange>({
    channel: channels.adminVerification(),
    event: "*",
    onMessage: refresh,
  });

  const stats: Stats = data ?? {
    users: 0,
    consultants: 0,
    bookings: 0,
    revenueToday: 0,
    revenueMonth: 0,
    liveSessions: 0,
    pendingVerifications: 0,
  };

  const cards = [
    { label: "Users",       value: stats.users.toLocaleString(),       icon: Users,        color: "text-blue-400",    bg: "bg-blue-500/10" },
    { label: "Consultants", value: stats.consultants.toLocaleString(), icon: UserCog,      color: "text-purple-400",  bg: "bg-purple-500/10" },
    { label: "Bookings",    value: stats.bookings.toLocaleString(),    icon: Calendar,     color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Revenue",     value: `₹${stats.revenueToday.toLocaleString("en-IN")}`, icon: DollarSign, color: "text-amber-400", bg: "bg-amber-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-white">Platform Pulse</h1>
        <p className="text-sm text-slate-400 mt-1">Real-time overview · updates instantly on bookings and verifications</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {cards.map((c, idx) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4"
          >
            <div className={`inline-flex p-2 rounded-lg ${c.bg} ${c.color} mb-2`}>
              <c.icon className="w-4 h-4" />
            </div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{c.label}</p>
            <p className="text-2xl font-black text-white mt-1 font-mono">
              {isLoading ? "—" : c.value}
            </p>
          </motion.div>
        ))}
      </div>

      {(stats.pendingVerifications > 0 || stats.liveSessions > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 space-y-3"
        >
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" /> Action required
          </h2>

          {stats.pendingVerifications > 0 && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-sm text-amber-400">
                {stats.pendingVerifications} verification{stats.pendingVerifications !== 1 ? "s" : ""} pending
              </span>
              <a href="/verification" className="text-xs text-amber-400 hover:underline font-bold">Review →</a>
            </div>
          )}

          {stats.liveSessions > 0 && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-sm text-emerald-400 flex items-center gap-2">
                <Radio className="w-3 h-3 animate-pulse" />
                {stats.liveSessions} live session{stats.liveSessions !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
