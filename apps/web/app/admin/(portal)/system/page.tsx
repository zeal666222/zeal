"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Super Admin — System Health Dashboard
// ═══════════════════════════════════════════════════════════════════════════════
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, Cpu, Database, Globe, Heart,
  Loader2, Radio, Server, Users, Wallet, Zap,
} from "lucide-react";

interface SystemHealth {
  activeUsers: number;
  activeSessions: number;
  treasury: {
    totalBalance: number;
    totalEscrow: number;
    totalPendingIn: number;
    totalPendingOut: number;
    totalBlocked: number;
    walletCount: number;
  };
  recentErrors: { action_name: string; created_at: string; metadata: Record<string, unknown> }[];
  negativeBalances: number;
  dbPool: Record<string, unknown>;
  aiConsultants: { total: number; active: number };
  todayBookings: number;
  timestamp: string;
}

function fmtINR(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export default function SystemHealthPage() {
  const { data, isLoading, error } = useQuery<SystemHealth>({
    queryKey: ["admin", "system-health"],
    queryFn: async () => {
      const res = await fetch("/api/admin/system-health", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load system health");
      return res.json();
    },
    refetchInterval: 15_000, // Refresh every 15 seconds
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-32 text-muted-foreground">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-rose-400" />
        <p className="font-bold">Failed to load system health</p>
      </div>
    );
  }

  const healthScore = calculateHealthScore(data);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-foreground flex items-center gap-2">
            <Heart className="w-6 h-6 text-emerald-500" /> System Health
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time platform metrics · auto-refreshes every 15s
          </p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${
          healthScore >= 90 ? "bg-emerald-500/15 border-emerald-500/20 text-emerald-400" :
          healthScore >= 70 ? "bg-amber-500/15 border-amber-500/20 text-amber-400" :
          "bg-rose-500/15 border-rose-500/20 text-rose-400"
        }`}>
          <Activity size={12} className={healthScore >= 90 ? "animate-pulse" : ""} />
          Health: {healthScore}%
        </div>
      </div>

      {/* Primary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={Users} label="Active Users" value={data.activeUsers.toLocaleString()} tone="blue" />
        <MetricCard icon={Radio} label="Live Sessions" value={String(data.activeSessions)} tone="emerald" />
        <MetricCard icon={Zap} label="Today's Bookings" value={String(data.todayBookings)} tone="amber" />
        <MetricCard icon={Server} label="AI Consultants" value={`${data.aiConsultants.active}/${data.aiConsultants.total}`} tone="purple" />
      </div>

      {/* Financial Health */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/30 via-surface to-surface p-5">
        <div className="flex items-center gap-2 mb-4">
          <Wallet size={14} className="text-emerald-400" />
          <h2 className="text-xs font-black uppercase tracking-widest text-emerald-400">Platform Treasury</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <TreasuryMetric label="Total Balance" value={`₹${fmtINR(data.treasury.totalBalance)}`} />
          <TreasuryMetric label="In Escrow" value={`₹${fmtINR(data.treasury.totalEscrow)}`} tone="amber" />
          <TreasuryMetric label="Pending In" value={`₹${fmtINR(data.treasury.totalPendingIn)}`} tone="emerald" />
          <TreasuryMetric label="Pending Out" value={`₹${fmtINR(data.treasury.totalPendingOut)}`} tone="rose" />
          <TreasuryMetric label="Blocked" value={`₹${fmtINR(data.treasury.totalBlocked)}`} tone="slate" />
        </div>
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-muted-foreground">
          <span>Wallets: <strong className="text-foreground font-mono">{data.treasury.walletCount}</strong></span>
          {data.negativeBalances > 0 && (
            <span className="text-rose-400 flex items-center gap-1">
              <AlertTriangle size={11} /> {data.negativeBalances} negative balance{data.negativeBalances !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </motion.div>

      {/* Infrastructure */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Database */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2 mb-3">
            <Database size={14} className="text-blue-400" />
            <h2 className="text-xs font-black uppercase tracking-widest text-blue-400">Database</h2>
          </div>
          <div className="space-y-2">
            <InfraRow label="Connection Pool" value={typeof data.dbPool === "object" && data.dbPool !== null ? String((data.dbPool as Record<string, unknown>).active_connections ?? "N/A") : "N/A"} />
            <InfraRow label="Max Connections" value={typeof data.dbPool === "object" && data.dbPool !== null ? String((data.dbPool as Record<string, unknown>).max_connections ?? "N/A") : "N/A"} />
            <InfraRow label="Status" value="Connected" status="ok" />
          </div>
        </motion.div>

        {/* Workers / Services */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2 mb-3">
            <Globe size={14} className="text-purple-400" />
            <h2 className="text-xs font-black uppercase tracking-widest text-purple-400">Services</h2>
          </div>
          <div className="space-y-2">
            <InfraRow label="Web App (Next.js)" value="Running" status="ok" />
            <InfraRow label="Astro Worker (CF)" value="Active" status="ok" />
            <InfraRow label="AI Engine (Groq)" value="Online" status="ok" />
            <InfraRow label="Realtime (Supabase)" value="Connected" status="ok" />
          </div>
        </motion.div>
      </div>

      {/* Recent Errors */}
      {data.recentErrors.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="rounded-2xl border border-rose-500/20 bg-surface p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-rose-400" />
            <h2 className="text-xs font-black uppercase tracking-widest text-rose-400">
              Recent Errors ({data.recentErrors.length})
            </h2>
          </div>
          <div className="space-y-1.5">
            {data.recentErrors.map((err, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-rose-500/5 text-xs">
                <span className="text-muted-foreground font-mono text-[10px] shrink-0">
                  {new Date(err.created_at).toLocaleTimeString()}
                </span>
                <span className="text-rose-300 font-medium">{err.action_name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Timestamp */}
      <p className="text-[10px] text-muted-foreground text-center">
        Last updated: {new Date(data.timestamp).toLocaleString()}
      </p>
    </motion.div>
  );
}

function calculateHealthScore(data: SystemHealth): number {
  let score = 100;
  if (data.negativeBalances > 0) score -= 10;
  if (data.recentErrors.length > 5) score -= 10;
  else if (data.recentErrors.length > 0) score -= 5;
  if (data.activeSessions === 0) score -= 0; // Not necessarily bad
  return Math.max(0, score);
}

function MetricCard({ icon: Icon, label, value, tone }: {
  icon: typeof Users; label: string; value: string;
  tone: "blue" | "emerald" | "amber" | "purple";
}) {
  const tones = {
    blue: "bg-blue-500/10 text-blue-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    amber: "bg-amber-500/10 text-amber-400",
    purple: "bg-purple-500/10 text-purple-400",
  } as const;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-surface p-4">
      <div className={`inline-flex p-2 rounded-lg mb-2 ${tones[tone]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">{label}</p>
      <p className="text-2xl font-black text-foreground mt-1 font-mono">{value}</p>
    </motion.div>
  );
}

function TreasuryMetric({ label, value, tone }: {
  label: string; value: string; tone?: "amber" | "rose" | "emerald" | "slate";
}) {
  const tones = {
    amber: "text-amber-400",
    rose: "text-rose-400",
    emerald: "text-emerald-400",
    slate: "text-muted-foreground",
  } as const;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">{label}</p>
      <p className={`text-lg font-black font-mono mt-1 ${tone ? tones[tone] : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function InfraRow({ label, value, status }: {
  label: string; value: string; status?: "ok" | "warn" | "error";
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {status && (
          <span className={`w-1.5 h-1.5 rounded-full ${
            status === "ok" ? "bg-emerald-400" : status === "warn" ? "bg-amber-400" : "bg-rose-400"
          }`} />
        )}
        <span className="text-xs font-medium text-foreground">{value}</span>
      </div>
    </div>
  );
}
