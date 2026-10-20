"use client";

import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, ArrowUpRight, Bot, Calendar, ChevronRight, Clock,
  DollarSign, IndianRupee, Activity as ActivityIcon, Radio, ShieldCheck,
  TrendingUp, UserCog, Users, Wallet, Zap, BarChart3, Globe,
  MessageSquare, Video, CreditCard, ArrowDownRight, RefreshCw,
} from "lucide-react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";
import { LiveBusPanel } from "@/components/admin/dashboard/LiveBusPanel";

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

interface AlertItem {
  id: string;
  type: "error" | "billing" | "flagged" | "info";
  message: string;
  timestamp: string;
}

interface TimeSeriesPoint {
  timestamp: string;
  revenue: number;
  bookings: number;
}

interface ActivityEvent {
  id: string;
  type: "booking" | "payment" | "signup" | "session" | "verification" | "withdrawal";
  title: string;
  description: string;
  timestamp: string;
  amount?: number;
}

interface ProbeService {
  key: string;
  label: string;
  status: "healthy" | "degraded" | "down";
  latencyMs: number;
  message?: string | null;
}

function fmtINR(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ACTIVITY_ICONS: Record<ActivityEvent["type"], typeof Zap> = {
  booking: Calendar,
  payment: CreditCard,
  signup: UserCog,
  session: Video,
  verification: ShieldCheck,
  withdrawal: Wallet,
};

const ACTIVITY_COLORS: Record<ActivityEvent["type"], string> = {
  booking: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  payment: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  signup: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  session: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  verification: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  withdrawal: "bg-rose-500/15 text-rose-400 border-rose-500/20",
};

export default function AdminDashboardPage() {
  const qc = useQueryClient();
  const [liveRevenue, setLiveRevenue] = useState(0);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [revenueHistory, setRevenueHistory] = useState<number[]>([]);

  const { data, isLoading } = useQuery<Stats>({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const { data: timeseriesData } = useQuery<{ series: Array<{ day: string; revenue: number; bookings: number }> }>({
    queryKey: ["admin", "stats", "timeseries"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats/timeseries?days=7", { cache: "no-store" });
      if (!res.ok) return { series: [] };
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const { data: alertsData } = useQuery<{ items: AlertItem[] }>({
    queryKey: ["admin", "dashboard-alerts"],
    queryFn: async () => {
      const res = await fetch("/api/admin/audit?limit=8&errors=true", { cache: "no-store" });
      if (!res.ok) return { items: [] };
      const json = await res.json();
      return {
        items: (json.logs ?? []).map((l: Record<string, unknown>, i: number) => ({
          id: String(l.id ?? i),
          type: "error" as const,
          message: `${l.action_name ?? l.action ?? "Event"}`,
          timestamp: (l.created_at ?? l.createdAt ?? new Date().toISOString()) as string,
        })),
      };
    },
    refetchInterval: 60_000,
  });

  const { data: activityData } = useQuery<{ events: ActivityEvent[] }>({
    queryKey: ["admin", "activity-feed"],
    queryFn: async () => {
      const [bookingsRes, sessionsRes] = await Promise.all([
        fetch("/api/admin/bookings?limit=5&sort=recent", { cache: "no-store" }),
        fetch("/api/admin/sessions/live", { cache: "no-store" }),
      ]);
      // Shapes mirror the routes verbatim: /api/admin/bookings -> {items:[{id, scheduledAt,
      // amount, user:{name}, consultant:{user:{name}}}]} and /api/admin/sessions/live ->
      // {items:[{id, userName, consultantName, startTime}]}. Reading invented keys made
      // every event fall back to "now", so the feed permanently claimed "just now".
      const events: ActivityEvent[] = [];
      if (bookingsRes.ok) {
        const bJson = await bookingsRes.json();
        for (const b of (bJson.items ?? []).slice(0, 5)) {
          events.push({
            id: `b-${b.id}`,
            type: "booking",
            title: b.status === "CANCELLED" ? "Booking cancelled" : "Booking update",
            description: `${b.user?.name ?? "User"} booked ${b.consultant?.user?.name ?? "consultant"}`,
            timestamp: b.scheduledAt ?? new Date().toISOString(),
            amount: b.amount,
          });
        }
      }
      if (sessionsRes.ok) {
        const sJson = await sessionsRes.json();
        for (const s of (sJson.items ?? []).slice(0, 3)) {
          events.push({
            id: `s-${s.id}`,
            type: "session",
            title: s.isAI ? "AI session live" : "Live session",
            description: `${s.userName ?? "User"} in session with ${s.consultantName ?? "consultant"}`,
            timestamp: s.startTime ?? new Date().toISOString(),
            amount: s.amount,
          });
        }
      }
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return { events: events.slice(0, 8) };
    },
    refetchInterval: 30_000,
  });

  // Measured, not asserted: each row is a live round trip run by
  // lib/monitoring/health-check.ts. Probes can take a few seconds, so they are
  // polled more slowly than the business metrics.
  const { data: probeData, dataUpdatedAt: probeUpdatedAt, isFetching: probesFetching } =
    useQuery<{ overall: ProbeService["status"]; services: ProbeService[]; portalMs: number; timestamp: string }>({
      queryKey: ["admin", "probes", "health"],
      queryFn: async () => {
        const res = await fetch("/api/admin/probes/health", { cache: "no-store" });
        if (!res.ok) throw new Error("Health probes failed");
        return res.json();
      },
      refetchInterval: 45_000,
      staleTime: 30_000,
    });

  useEffect(() => {
    if (alertsData?.items) setAlerts(alertsData.items);
  }, [alertsData]);

  useEffect(() => {
    if (!data?.revenueToday) return;
    setLiveRevenue(data.revenueToday);
    setRevenueHistory((prev) => [...prev.slice(-23), data.revenueToday]);
  }, [data?.revenueToday]);

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    void qc.invalidateQueries({ queryKey: ["admin", "stats", "timeseries"] });
    void qc.invalidateQueries({ queryKey: ["admin", "activity-feed"] });
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
  const activity = activityData?.events ?? [];
  const tsPoints: TimeSeriesPoint[] = (timeseriesData?.series ?? []).map((s) => ({
    timestamp: s.day,
    revenue: s.revenue,
    bookings: s.bookings,
  }));

  const revenueGrowth = useMemo(() => {
    if (tsPoints.length < 2) return 0;
    const first = tsPoints[0]?.revenue ?? 0;
    const last = tsPoints[tsPoints.length - 1]?.revenue ?? 0;
    return first > 0 ? Math.round(((last - first) / first) * 100) : 0;
  }, [tsPoints]);

  const bookingsGrowth = useMemo(() => {
    if (tsPoints.length < 2) return 0;
    const first = tsPoints[0]?.bookings ?? 0;
    const last = tsPoints[tsPoints.length - 1]?.bookings ?? 0;
    return first > 0 ? Math.round(((last - first) / first) * 100) : 0;
  }, [tsPoints]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-foreground flex items-center gap-3">
            Platform Pulse
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enterprise command center &middot; real-time platform intelligence
          </p>
        </div>
        <div className="hidden lg:flex items-center gap-2">
          <QuickAction href="/admin/impersonate" icon={Users} label="Impersonate" shortcut="I" />
          <QuickAction href="/admin/settings/api-keys" icon={ShieldCheck} label="API Keys" shortcut="K" />
          <QuickAction href="/admin/system" icon={Zap} label="System" shortcut="S" />
          <button
            onClick={refresh}
            className="btn-premium px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:border-rose-500/30 transition-all flex items-center gap-1.5"
            title="Refresh all data"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Kpi
          label="Total Users" value={stats.users.toLocaleString()} icon={Users}
          tone="blue" loading={isLoading}
        />
        <Kpi
          label="Consultants" value={stats.consultants.toLocaleString()} icon={UserCog}
          tone="purple" loading={isLoading}
        />
        <Kpi
          label="Bookings" value={stats.bookings.toLocaleString()} icon={Calendar}
          tone="emerald" loading={isLoading}
          trend={bookingsGrowth !== 0
            ? { direction: bookingsGrowth > 0 ? "up" : "down", value: `${bookingsGrowth > 0 ? "+" : ""}${bookingsGrowth}%` }
            : undefined}
          sparkline={tsPoints.map((p) => p.bookings)}
        />
        <Kpi
          label="Revenue (mo)" value={`\u20B9${fmtINR(stats.revenueMonth)}`} icon={DollarSign}
          tone="amber" loading={isLoading}
          trend={{ direction: revenueGrowth >= 0 ? "up" : "down", value: `${revenueGrowth >= 0 ? "+" : ""}${revenueGrowth}%` }}
          sparkline={tsPoints.map((p) => p.revenue)}
        />
      </div>

      {/* Live Operations — Cloudflare realtime bus (fail-open, hides when dormant) */}
      <LiveBusPanel />

      {/* Live Revenue Ticker + Revenue Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-950/30 via-surface to-surface p-5 flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <IndianRupee size={20} className="text-amber-400" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">Live</span>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-widest text-amber-400/70 font-black">Today&apos;s Revenue</p>
            <p className="text-3xl font-black text-amber-400 font-mono mt-1 tabular-nums">
              &#8377;{fmtINR(liveRevenue)}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">24h Razorpay:</span>
              <span className="text-xs font-bold text-emerald-400 font-mono">
                &#8377;{fmtINR(stats.razorpay24hRevenue ?? 0)}
              </span>
            </div>
          </div>
          <MiniSparkline data={revenueHistory} color="rgb(251 191 36)" height={32} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="lg:col-span-2 rounded-2xl border border-border bg-surface p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={14} className="text-blue-400" />
              <h2 className="text-xs font-black uppercase tracking-widest text-blue-400">Revenue Trend (7d)</h2>
            </div>
            {revenueGrowth !== 0 && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-black ${
                revenueGrowth > 0
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
              }`}>
                {revenueGrowth > 0 ? <TrendingUp size={10} /> : <ArrowDownRight size={10} />}
                {revenueGrowth > 0 ? "+" : ""}{revenueGrowth}%
              </span>
            )}
          </div>
          {tsPoints.length > 0 ? (
            <RevenueChart points={tsPoints} />
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-xs">
              Chart will appear once timeseries data is available
            </div>
          )}
        </motion.div>
      </div>

      {/* Financial Health */}
      {treasury && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 via-surface to-surface p-5 md:p-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wallet size={15} className="text-emerald-400" />
                <h2 className="text-xs font-black uppercase tracking-widest text-emerald-400">
                  Financial Health
                </h2>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                (treasury.totalPendingOut ?? 0) > 0
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                  : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
              }`}>
                <ShieldCheck size={10} />
                {(treasury.totalPendingOut ?? 0) > 0
                  ? `\u20B9${fmtINR(treasury.totalPendingOut)} pending payout`
                  : "No pending payouts"}
              </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Metric label="Total balance" value={`\u20B9${fmtINR(treasury.totalBalance)}`} />
              <Metric label="In escrow" value={`\u20B9${fmtINR(treasury.totalEscrow)}`} tone="amber" />
              <Metric label="Pending payouts" value={`\u20B9${fmtINR(treasury.totalPendingOut)}`} tone="rose" />
              <Metric label="Blocked" value={`\u20B9${fmtINR(treasury.totalBlocked)}`} tone="slate" />
            </div>
            <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-muted-foreground">
                  Wallets: <strong className="text-foreground font-mono">{treasury.walletCount}</strong>
                </span>
              </div>
              <a href="/admin/wallet" className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition-colors">
                View ledger <ChevronRight size={12} />
              </a>
            </div>
          </div>
        </motion.div>
      )}

      {/* Three-column: Activity Feed + Action Required + Alert Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="lg:col-span-2 rounded-2xl border border-border bg-surface p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-foreground flex items-center gap-2">
              <ActivityIcon className="w-4 h-4 text-blue-500" /> Activity Feed
            </h2>
            <a href="/admin/bookings" className="text-[10px] text-muted-foreground hover:text-foreground font-bold uppercase tracking-wider flex items-center gap-1 transition-colors">
              View all <ChevronRight size={10} />
            </a>
          </div>
          {activity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              No recent activity
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {activity.map((event, idx) => {
                  const Icon = ACTIVITY_ICONS[event.type] ?? Zap;
                  const colorClass = ACTIVITY_COLORS[event.type] ?? ACTIVITY_COLORS.booking;
                  return (
                    <motion.div
                      key={event.id}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ delay: idx * 0.03 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-surface-raised/50 hover:bg-surface-raised transition-colors group"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${colorClass}`}>
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{event.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{event.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {event.amount !== undefined && event.amount > 0 && (
                          <p className="text-xs font-bold text-emerald-400 font-mono">
                            +&#8377;{fmtINR(event.amount)}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground">{timeAgo(event.timestamp)}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        {/* Right column: Action Required + Alerts */}
        <div className="space-y-4">
          {/* Action Required */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-2xl border border-border bg-surface p-5"
          >
            <h2 className="text-sm font-black text-foreground flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-500" /> Action Required
            </h2>
            <div className="space-y-2">
              {stats.pendingVerifications > 0 && (
                <a
                  href="/admin/verification"
                  className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <ShieldCheck size={13} className="text-amber-400" />
                    </div>
                    <span className="text-xs text-amber-400 font-bold">
                      {stats.pendingVerifications} verification{stats.pendingVerifications !== 1 ? "s" : ""} pending
                    </span>
                  </div>
                  <ArrowUpRight size={13} className="text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              )}
              {stats.liveSessions > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <Radio size={13} className="text-emerald-400 animate-pulse" />
                    </div>
                    <span className="text-xs text-emerald-400 font-bold">
                      {stats.liveSessions} live session{stats.liveSessions !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">
                    &#8377;{fmtINR(stats.liveSessions * 50)}/min
                  </span>
                </div>
              )}
              {stats.pendingVerifications === 0 && stats.liveSessions === 0 && (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  All clear --- no pending actions
                </div>
              )}
            </div>
          </motion.div>

          {/* Alert Feed */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="rounded-2xl border border-border bg-surface p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black text-foreground flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-500" /> System Alerts
              </h2>
              <a href="/admin/audit" className="text-[10px] text-muted-foreground hover:text-foreground font-bold uppercase tracking-wider flex items-center gap-1 transition-colors">
                All <ChevronRight size={10} />
              </a>
            </div>
            {alerts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No recent alerts</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {alerts.map((alert) => (
                  <div key={alert.id} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg bg-surface-raised/50 hover:bg-surface-raised transition-colors">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      alert.type === "error" ? "bg-rose-400" :
                      alert.type === "billing" ? "bg-amber-400" :
                      alert.type === "flagged" ? "bg-purple-400" : "bg-blue-400"
                    }`} />
                    <span className="text-foreground/80 truncate flex-1">{alert.message}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {timeAgo(alert.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="rounded-2xl border border-border bg-surface p-5"
          >
            <h2 className="text-sm font-black text-foreground flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-purple-500" /> Platform Status
              {probeData && (
                <span className={`ml-auto text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  probeData.overall === "healthy"
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                    : probeData.overall === "degraded"
                      ? "border-amber-500/25 bg-amber-500/10 text-amber-400"
                      : "border-rose-500/25 bg-rose-500/10 text-rose-400"
                }`}>
                  {probeData.overall}
                </span>
              )}
            </h2>
            <div className="space-y-2">
              {(probeData?.services ?? []).map((s) => (
                <StatusRow
                  key={s.key}
                  label={s.label}
                  status={s.status === "healthy" ? "operational" : s.status}
                  latency={s.latencyMs > 0 ? `${s.latencyMs}ms` : "—"}
                  detail={s.message}
                />
              ))}
              {!probeData && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  {probesFetching ? "Measuring services…" : "Platform status unavailable — probes failed to load"}
                </p>
              )}
            </div>
            {probeData && (
              <p className="mt-3 text-[10px] text-muted-foreground/60">
                Measured {probeUpdatedAt ? timeAgo(new Date(probeUpdatedAt).toISOString()) : "—"} · portal round trip {probeData.portalMs}ms
              </p>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label, shortcut }: {
  href: string; icon: typeof Users; label: string; shortcut?: string;
}) {
  return (
    <a href={href}
      className="btn-premium px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:border-rose-500/30 transition-all flex items-center gap-1.5 group"
    >
      <Icon size={12} /> {label}
      {shortcut && (
        <kbd className="hidden xl:inline-flex ml-1 px-1.5 py-0.5 rounded bg-surface-raised border border-border text-[9px] font-mono text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
          {shortcut}
        </kbd>
      )}
    </a>
  );
}

function Kpi({
  label, value, icon: Icon, tone, loading, trend, sparkline,
}: {
  label: string;
  value: string;
  icon: typeof Users;
  tone: "blue" | "purple" | "emerald" | "amber";
  loading?: boolean;
  trend?: { direction: "up" | "down" | "flat"; value: string };
  sparkline?: number[];
}) {
  const tones = {
    blue: "bg-blue-500/10 text-blue-400",
    purple: "bg-purple-500/10 text-purple-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    amber: "bg-amber-500/10 text-amber-400",
  } as const;
  const sparkColors = {
    blue: "rgb(96 165 250)",
    purple: "rgb(192 132 252)",
    emerald: "rgb(52 211 153)",
    amber: "rgb(251 191 36)",
  } as const;
  const trendColors = {
    up: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    down: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    flat: "text-muted-foreground bg-surface-raised border-border",
  } as const;
  const trendArrow = { up: "\u25B2", down: "\u25BC", flat: "\u2022" } as const;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-surface p-4 card-lift relative overflow-hidden"
    >
      <div className="flex items-start justify-between">
        <div className={`inline-flex p-2 rounded-lg ${tones[tone]}`}>
          <Icon className="w-4 h-4" />
        </div>
        {trend && !loading && (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider ${trendColors[trend.direction]}`}>
            <span aria-hidden>{trendArrow[trend.direction]}</span>
            {trend.value}
          </span>
        )}
      </div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black mt-3">
        {label}
      </p>
      <p className="text-2xl font-black text-foreground mt-1 font-mono tabular-nums">
        {loading ? <span className="inline-block w-16 h-6 rounded shimmer" /> : value}
      </p>
      {sparkline && sparkline.length > 1 && !loading && (
        <div className="mt-2 -mx-1">
          <MiniSparkline data={sparkline} color={sparkColors[tone]} height={24} />
        </div>
      )}
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

function StatusRow({ label, status, latency, detail }: {
  label: string; status: "operational" | "degraded" | "down"; latency: string; detail?: string | null;
}) {
  const dotColor = status === "operational" ? "bg-emerald-400" : status === "degraded" ? "bg-amber-400" : "bg-rose-400";
  const textColor = status === "operational" ? "text-emerald-400" : status === "degraded" ? "text-amber-400" : "text-rose-400";
  return (
    <div className="flex items-start justify-between gap-3 py-1.5" title={detail ?? undefined}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        {detail && (
          <span className="ml-3.5 text-[10px] leading-tight text-muted-foreground/60 line-clamp-1">{detail}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-mono text-muted-foreground/60">{latency}</span>
        <span className={`text-[10px] font-bold uppercase ${textColor}`}>{status}</span>
      </div>
    </div>
  );
}

function MiniSparkline({ data, color, height = 24 }: {
  data: number[]; color: string; height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  const areaPoints = `0,${height} ${points} ${w},${height}`;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={`spark-grad-${color.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#spark-grad-${color.replace(/\s/g, "")})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RevenueChart({ points }: { points: TimeSeriesPoint[] }) {
  const maxRevenue = Math.max(...points.map((p) => p.revenue), 1);
  const barWidth = 100 / Math.max(points.length, 1);

  return (
    <div className="h-32 flex items-end gap-1">
      {points.map((point, i) => {
        const barHeight = (point.revenue / maxRevenue) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="relative w-full flex justify-center">
              <div className="absolute -top-6 hidden group-hover:block px-1.5 py-0.5 rounded bg-foreground text-background text-[9px] font-mono font-bold whitespace-nowrap z-10">
                &#8377;{fmtINR(point.revenue)}
              </div>
            </div>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${barHeight}%` }}
              transition={{ delay: i * 0.05, duration: 0.4, ease: "easeOut" }}
              className="w-full max-w-[32px] rounded-t-md bg-gradient-to-t from-blue-500/40 to-blue-400/80 hover:from-blue-500/60 hover:to-blue-400 transition-colors cursor-pointer"
              style={{ minHeight: 2 }}
            />
            <span className="text-[8px] text-muted-foreground/60 font-mono">
              {new Date(point.timestamp).toLocaleDateString([], { weekday: "short" })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
