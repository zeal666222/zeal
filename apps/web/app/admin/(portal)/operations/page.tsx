"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity, Bot, CheckCircle2, Database, Server, ShieldAlert, Timer,
  XCircle, Zap, Cloud,
} from "lucide-react";
import { useChannel, useConnectionQuality, channels, type BroadcastChange } from "@zeal/realtime";
import { ActiveVisitors } from "@/components/admin/ActiveVisitors";
import { cn } from "@zeal/ui";

interface AiSnapshot {
  samples: number;
  ttft: { p50: number; p95: number; p99: number; max: number };
  tpot: { p50: number; p95: number };
  total: { p50: number; p95: number; p99: number };
  errorRate: number;
  cacheHitRate: number;
  byProvider: Record<string, { samples: number; ttftP95: number; errorRate: number }>;
  byConsultant: Record<string, { samples: number; ttftP95?: number; errorRate?: number }>;
}

interface OpsMetrics {
  ts: string;
  tookMs: number;
  ai: AiSnapshot;
  db: { status: "ok" | "down"; latencyMs: number; error?: string };
  worker: {
    configured: boolean;
    status: "ok" | "down" | "unconfigured";
    latencyMs: number;
    error?: string;
    detail?: unknown;
  };
  audit: Array<{
    id: string | number;
    action_name: string | null;
    actor_email: string | null;
    actor_role: string | null;
    target_type: string | null;
    success: boolean | null;
    created_at: string;
  }>;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs(mins) < 24) return `${hrs(mins)}h ago`;
  return `${Math.floor(hrs(mins) / 24)}d ago`;
}
function hrs(mins: number): number {
  return Math.floor(mins / 60);
}

type Status = "ok" | "down" | "warn" | "idle";

function StatusCard({
  label, icon: Icon, status, primary, secondary,
}: {
  label: string;
  icon: typeof Activity;
  status: Status;
  primary: string;
  secondary?: string;
}) {
  const ring: Record<Status, string> = {
    ok: "border-emerald-500/30 bg-emerald-500/[0.04]",
    down: "border-rose-500/30 bg-rose-500/[0.04]",
    warn: "border-amber-500/30 bg-amber-500/[0.04]",
    idle: "border-border/40 bg-surface-raised/30",
  };
  const dot: Record<Status, string> = {
    ok: "bg-emerald-400 animate-pulse",
    down: "bg-rose-400 animate-pulse",
    warn: "bg-amber-400",
    idle: "bg-slate-500",
  };
  return (
    <div className={cn("glass-card-3d p-4 border", ring[status])}>
      <div className="flex items-center justify-between mb-2">
        <Icon size={15} className="text-muted-foreground" />
        <span className={cn("w-2 h-2 rounded-full", dot[status])} />
      </div>
      <p className="text-lg font-black text-foreground tabular-nums">{primary}</p>
      <p className="text-[11px] font-bold text-muted-foreground mt-0.5">{label}</p>
      {secondary && <p className="text-[10px] text-muted-foreground/70 mt-1 truncate">{secondary}</p>}
    </div>
  );
}

export default function AdminOperationsPage() {
  const qc = useQueryClient();
  const quality = useConnectionQuality();
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const { data, error, refetch } = useQuery<OpsMetrics>({
    queryKey: ["admin", "ops", "metrics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/ops/metrics", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as OpsMetrics;
      setUpdatedAt(json.ts);
      return json;
    },
    refetchInterval: 5000,
  });

  // Admin audit writes and system health ticks refresh the feed without waiting
  // for the 5s poll.
  useChannel<BroadcastChange>({
    channel: channels.adminAudit(),
    event: "*",
    onMessage: () => { void qc.invalidateQueries({ queryKey: ["admin", "ops", "metrics"] }); },
  });
  useChannel<BroadcastChange>({
    channel: channels.systemHealth(),
    event: "*",
    onMessage: () => { void refetch(); },
  });

  const ai = data?.ai;
  const providers = Object.entries(ai?.byProvider ?? {}).sort((a, b) => b[1].samples - a[1].samples);
  const consultants = Object.entries(ai?.byConsultant ?? {})
    .sort((a, b) => b[1].samples - a[1].samples)
    .slice(0, 6);
  const failedAudit = (data?.audit ?? []).filter((a) => a.success === false).length;

  if (error) {
    return (
      <div className="glass-card-3d p-6 text-center text-red-500">
        <p>Failed to load operations metrics: {(error as Error).message}</p>
        <button onClick={() => void refetch()} className="mt-2 text-[var(--color-primary)] hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-[var(--color-primary)]" /> Operations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live AI usage, Cloudflare worker health and failure feed — refreshed every 5s
            {updatedAt && ` · updated ${timeAgo(updatedAt)}`}
          </p>
        </div>
      </div>

      {/* Status strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatusCard
          label="Database"
          icon={Database}
          status={!data ? "idle" : data.db.status === "ok" ? "ok" : "down"}
          primary={!data ? "—" : `${data.db.latencyMs}ms`}
          secondary={data?.db.error}
        />
        <StatusCard
          label="Chat Worker"
          icon={Server}
          status={!data ? "idle" : data.worker.status === "ok" ? "ok" : data.worker.status === "down" ? "down" : "warn"}
          primary={!data ? "—" : data.worker.status === "ok" ? `${data.worker.latencyMs}ms` : data.worker.status === "unconfigured" ? "Not configured" : "Down"}
          secondary={data?.worker.error}
        />
        <StatusCard
          label="Realtime"
          icon={Zap}
          status={quality.quality === "offline" ? "down" : quality.quality === "poor" ? "warn" : "ok"}
          primary={`${quality.latencyMs}ms`}
          secondary={`${quality.quality} · ${quality.activeChannels} channels · ${quality.reconnectCount} reconnects`}
        />
        <StatusCard
          label="AI Engine"
          icon={Bot}
          status={!ai ? "idle" : ai.errorRate > 0.2 ? "down" : ai.errorRate > 0.05 ? "warn" : ai.samples === 0 ? "idle" : "ok"}
          primary={!ai || ai.samples === 0 ? "No traffic" : `${fmtPct(ai.errorRate)} errors`}
          secondary={ai && ai.samples > 0 ? `${ai.samples} samples · TTFT p95 ${Math.round(ai.ttft.p95)}ms` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* AI usage */}
        <div className="xl:col-span-2 glass-card-3d p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              <Bot size={15} className="text-[var(--color-primary)]" /> AI Usage
            </h3>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Session-lifetime telemetry
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
            {[
              { label: "Samples", value: ai ? String(ai.samples) : "—" },
              { label: "TTFT p50", value: ai ? `${Math.round(ai.ttft.p50)}ms` : "—" },
              { label: "TTFT p95", value: ai ? `${Math.round(ai.ttft.p95)}ms` : "—" },
              { label: "TTFT p99", value: ai ? `${Math.round(ai.ttft.p99)}ms` : "—" },
              { label: "TPOT p95", value: ai ? `${Math.round(ai.tpot.p95)}ms` : "—" },
              { label: "Cache hit", value: ai ? fmtPct(ai.cacheHitRate) : "—" },
            ].map((m) => (
              <div key={m.label} className="rounded-xl bg-surface-raised/40 border border-border/30 p-2.5">
                <p className="text-sm font-black text-foreground tabular-nums truncate">{m.value}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Providers */}
          <h4 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
            Providers
          </h4>
          {providers.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3">No AI traffic recorded yet this session.</p>
          ) : (
            <div className="space-y-1.5 mb-5">
              {providers.map(([name, p]) => (
                <div key={name} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-raised/40 border border-border/30">
                  <Cloud size={13} className="text-muted-foreground shrink-0" />
                  <span className="text-xs font-bold text-foreground flex-1 truncate">{name}</span>
                  <span className="text-[10px] text-muted-foreground font-bold tabular-nums">{p.samples} calls</span>
                  <span className="text-[10px] text-muted-foreground font-bold tabular-nums">TTFT p95 {Math.round(p.ttftP95)}ms</span>
                  <span className={cn(
                    "text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums",
                    p.errorRate > 0.2 ? "bg-rose-500/15 text-rose-400"
                      : p.errorRate > 0.05 ? "bg-amber-500/15 text-amber-400"
                      : "bg-emerald-500/15 text-emerald-400",
                  )}>
                    {fmtPct(p.errorRate)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Top consultants */}
          {consultants.length > 0 && (
            <>
              <h4 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
                Busiest consultants
              </h4>
              <div className="space-y-1.5">
                {consultants.map(([id, c]) => (
                  <div key={id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-raised/40 border border-border/30">
                    <Timer size={13} className="text-muted-foreground shrink-0" />
                    <a href={`/admin/ai-training`} className="text-xs font-bold text-foreground flex-1 truncate hover:text-[var(--color-primary)]">
                      {id.slice(0, 8)}…
                    </a>
                    <span className="text-[10px] text-muted-foreground font-bold tabular-nums">{c.samples} turns</span>
                    {typeof c.ttftP95 === "number" && (
                      <span className="text-[10px] text-muted-foreground font-bold tabular-nums">TTFT p95 {Math.round(c.ttftP95)}ms</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Visitors + failures */}
        <div className="space-y-4">
          <ActiveVisitors />

          <div className="glass-card-3d p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <ShieldAlert size={15} className="text-rose-400" /> Failure Feed
              </h3>
              {failedAudit > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-400 text-[9px] font-black">
                  {failedAudit} failed
                </span>
              )}
            </div>
            {(data?.audit ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">No admin activity recorded yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto scrollbar-thin pr-1">
                {(data?.audit ?? []).map((a) => (
                  <motion.div
                    key={String(a.id)}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex items-start gap-2.5 px-3 py-2 rounded-xl border",
                      a.success === false
                        ? "bg-rose-500/[0.06] border-rose-500/25"
                        : "bg-surface-raised/40 border-border/30",
                    )}
                  >
                    {a.success === false
                      ? <XCircle size={12} className="text-rose-400 mt-0.5 shrink-0" />
                      : <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-foreground truncate">{a.action_name ?? "event"}</p>
                      <p className="text-[9px] text-muted-foreground truncate">
                        {a.actor_email ?? "system"} · {a.target_type ?? "—"} · {timeAgo(a.created_at)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
