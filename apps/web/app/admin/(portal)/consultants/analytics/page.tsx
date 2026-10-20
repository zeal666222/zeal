"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Super Admin — Consultant Performance Analytics
// ═══════════════════════════════════════════════════════════════════════════════
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BarChart3, Download, Loader2, Star, TrendingDown, TrendingUp, Users,
} from "lucide-react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";

interface ConsultantPerformance {
  id: string;
  name: string;
  avatar: string | null;
  sessionsCompleted: number;
  revenue: number;
  rating: number;
  avgResponseTime: number | null; // seconds; null until Message-table rollup exists
  trend: "up" | "down" | "stable";
}

function fmtINR(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function ConsultantAnalyticsPage() {
  const { data, isLoading, refetch } = useQuery<{
    consultants: ConsultantPerformance[];
    averages: { sessions: number; revenue: number; rating: number };
  }>({
    queryKey: ["admin", "consultants", "analytics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/consultants/analytics", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load consultant analytics");
      return res.json();
    },
    refetchInterval: 60_000,
  });
  useChannel<BroadcastChange>({
    channel: channels.adminBookings(),
    event: "*",
    onMessage: () => void refetch(),
  });

  const handleExportCSV = () => {
    if (!data?.consultants) return;
    const headers = "Name,Sessions,Revenue,Rating,Response Time (s),Trend\n";
    const rows = data.consultants.map((c) =>
      `"${c.name}",${c.sessionsCompleted},${c.revenue},${c.rating.toFixed(1)},${c.avgResponseTime ?? ""},${c.trend}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "consultant-analytics.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const consultants = data?.consultants ?? [];
  const averages = data?.averages ?? { sessions: 0, revenue: 0, rating: 0 };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-500" /> Consultant Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Performance metrics, rankings, and platform averages.
          </p>
        </div>
        <button onClick={handleExportCSV}
          className="px-3 py-2 rounded-xl bg-surface border border-border text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5">
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* Platform averages */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <AvgCard label="Avg Sessions" value={averages.sessions.toFixed(0)} />
        <AvgCard label="Avg Revenue" value={`₹${fmtINR(averages.revenue)}`} />
        <AvgCard label="Avg Rating" value={averages.rating.toFixed(1)} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : consultants.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-3xl text-muted-foreground">
          No consultant data available.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground font-black">
                <th className="text-left py-3 px-4">Consultant</th>
                <th className="text-right py-3 px-4">Sessions</th>
                <th className="text-right py-3 px-4">Revenue</th>
                <th className="text-right py-3 px-4">Rating</th>
                <th className="text-right py-3 px-4">Response</th>
                <th className="text-center py-3 px-4">Trend</th>
              </tr>
            </thead>
            <tbody>
              {consultants.map((c) => {
                const aboveAvgSessions = c.sessionsCompleted > averages.sessions;
                const aboveAvgRevenue = c.revenue > averages.revenue;
                return (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-surface-raised/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                          {c.avatar ? <img src={c.avatar} alt="" className="w-full h-full object-cover" /> : c.name.charAt(0)}
                        </div>
                        <span className="font-bold text-foreground truncate max-w-[150px]">{c.name}</span>
                      </div>
                    </td>
                    <td className={`py-3 px-4 text-right font-mono ${aboveAvgSessions ? "text-emerald-400" : "text-muted-foreground"}`}>
                      {c.sessionsCompleted}
                    </td>
                    <td className={`py-3 px-4 text-right font-mono ${aboveAvgRevenue ? "text-emerald-400" : "text-muted-foreground"}`}>
                      ₹{fmtINR(c.revenue)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center gap-1">
                        <Star size={10} className="text-amber-400 fill-amber-400" />
                        <span className="font-mono">{c.rating.toFixed(1)}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                      {c.avgResponseTime == null ? <span title="Not yet measured">--</span> : `${c.avgResponseTime}s`}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {c.trend === "up" ? <TrendingUp size={14} className="text-emerald-400 inline" /> :
                       c.trend === "down" ? <TrendingDown size={14} className="text-rose-400 inline" /> :
                       <span className="text-muted-foreground text-xs">--</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}

function AvgCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 text-center">
      <p className="text-xl font-black text-foreground font-mono">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black mt-1">{label}</p>
    </div>
  );
}
