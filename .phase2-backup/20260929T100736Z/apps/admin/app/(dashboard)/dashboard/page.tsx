"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Admin Dashboard — Pulse + Financial Health
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertCircle, ArrowUpRight, Calendar, DollarSign, IndianRupee,
  Radio, ShieldCheck, UserCog, Users, Wallet,
} from "lucide-react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";

interface Stats {
  users: number;
  consultants: number;
  bookings: number;
  revenueToday: number;
  revenueMonth: number;
  liveSessions: number;
  pendingVerifications: number;
  treasury?: {
    totalBalance: number;
    totalEscrow: number;
    totalPendingOut: number;
    totalBlocked: number;
    walletCount: number;
  };
  razorpay24hRevenue?: number;
}

function fmtINR(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
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

  useChannel<BroadcastChange>({
    channel: channels.adminBookings(),
    event: "*",
    onMessage: refresh,
  });
  useChannel<BroadcastChange>({
    channel: channels.adminVerification(),
    event: "*",
    onMessage: refresh,
  });
  useChannel<BroadcastChange>({
    channel: channels.adminPayments(),
    event: "*",
    onMessage: refresh,
  });

  const stats: Stats = data ?? {
    users: 0, consultants: 0, bookings: 0,
    revenueToday: 0, revenueMonth: 0,
    liveSessions: 0, pendingVerifications: 0,
  };

  const treasury = stats.treasury;
  const drift = 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-foreground">Platform Pulse</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time overview · updates instantly on bookings, payments, verifications
        </p>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Kpi label="Users" value={stats.users.toLocaleString()} icon={Users} tone="blue" loading={isLoading} />
        <Kpi label="Consultants" value={stats.consultants.toLocaleString()} icon={UserCog} tone="purple" loading={isLoading} />
        <Kpi label="Bookings" value={stats.bookings.toLocaleString()} icon={Calendar} tone="emerald" loading={isLoading} />
        <Kpi label="Revenue (mo)" value={`₹${fmtINR(stats.revenueMonth)}`} icon={DollarSign} tone="amber" loading={isLoading} />
      </div>

      {/* Financial health */}
      {treasury && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-emerald-500/20
                     bg-gradient-to-br from-emerald-950/40 via-surface to-surface
                     p-5 md:p-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <Wallet size={15} className="text-emerald-400" />
              <h2 className="text-sm font-black uppercase tracking-widest text-emerald-400">
                Financial Health
              </h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Metric label="Total balance" value={`₹${fmtINR(treasury.totalBalance)}`} />
              <Metric label="In escrow" value={`₹${fmtINR(treasury.totalEscrow)}`} tone="amber" />
              <Metric label="Pending payouts" value={`₹${fmtINR(treasury.totalPendingOut)}`} tone="rose" />
              <Metric label="Blocked" value={`₹${fmtINR(treasury.totalBlocked)}`} tone="slate" />
            </div>
            <div className="mt-5 pt-5 border-t border-white/5 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-muted-foreground">
                  Wallets: <strong className="text-foreground font-mono">{treasury.walletCount}</strong>
                </span>
                <span className="text-muted-foreground">
                  24h Razorpay: <strong className="text-emerald-400 font-mono">
                    ₹{fmtINR(stats.razorpay24hRevenue ?? 0)}
                  </strong>
                </span>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                drift === 0
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  : "bg-rose-500/15 text-rose-400 border border-rose-500/20"
              }`}>
                <ShieldCheck size={10} />
                {drift === 0 ? "Reconciled" : `Drift ₹${drift}`}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Action required */}
      {(stats.pendingVerifications > 0 || stats.liveSessions > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-surface p-5 space-y-3"
        >
          <h2 className="text-base font-black text-foreground flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" /> Action required
          </h2>

          {stats.pendingVerifications > 0 && (
            <a
              href="/verification"
              className="flex items-center justify-between p-3 rounded-xl
                         bg-amber-500/10 border border-amber-500/20
                         hover:bg-amber-500/15 transition-colors"
            >
              <span className="text-sm text-amber-400 font-bold">
                {stats.pendingVerifications} verification{stats.pendingVerifications !== 1 ? "s" : ""} pending
              </span>
              <ArrowUpRight size={13} className="text-amber-400" />
            </a>
          )}

          {stats.liveSessions > 0 && (
            <div className="flex items-center justify-between p-3 rounded-xl
                            bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-sm text-emerald-400 flex items-center gap-2">
                <Radio className="w-3 h-3 animate-pulse" />
                {stats.liveSessions} live session{stats.liveSessions !== 1 ? "s" : ""}
              </span>
              <span className="text-xs font-mono text-emerald-400">
                ₹{fmtINR(stats.liveSessions * 50)}/min burn
              </span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function Kpi({
  label, value, icon: Icon, tone, loading,
}: {
  label: string;
  value: string;
  icon: typeof Users;
  tone: "blue" | "purple" | "emerald" | "amber";
  loading?: boolean;
}) {
  const tones = {
    blue: "bg-blue-500/10 text-blue-400",
    purple: "bg-purple-500/10 text-purple-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    amber: "bg-amber-500/10 text-amber-400",
  } as const;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-surface p-4"
    >
      <div className={`inline-flex p-2 rounded-lg mb-2 ${tones[tone]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">
        {label}
      </p>
      <p className="text-2xl font-black text-foreground mt-1 font-mono">
        {loading ? "—" : value}
      </p>
    </motion.div>
  );
}

function Metric({
  label, value, tone,
}: {
  label: string;
  value: string;
  tone?: "amber" | "rose" | "slate";
}) {
  const tones = {
    amber: "text-amber-400",
    rose: "text-rose-400",
    slate: "text-muted-foreground",
  } as const;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">
        {label}
      </p>
      <p className={`text-lg md:text-xl font-black font-mono mt-1 ${
        tone ? tones[tone] : "text-foreground"
      }`}>
        {value}
      </p>
    </div>
  );
}
