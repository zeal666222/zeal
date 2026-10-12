"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// Super Admin — Realtime Architecture Monitor
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, ArrowDown, ArrowUp, CheckCircle2, Circle, Clock,
  Gauge, Loader2, Radio, RefreshCw, Signal, SignalHigh,
  SignalLow, Wifi, WifiOff, XCircle, Zap,
} from "lucide-react";
import {
  useConnection,
  useConnectionQuality,
  type ConnectionQualityStats,
  type ConnectionState,
} from "@zeal/realtime";

const QUALITY_CONFIG: Record<string, { color: string; bg: string; icon: typeof Signal; label: string }> = {
  excellent: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: Signal, label: "Excellent" },
  good:      { color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20",       icon: SignalHigh, label: "Good" },
  poor:      { color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20",     icon: SignalLow, label: "Poor" },
  offline:   { color: "text-rose-400",    bg: "bg-rose-500/10 border-rose-500/20",       icon: WifiOff, label: "Offline" },
};

const STATE_CONFIG: Record<ConnectionState, { color: string; dot: string; label: string }> = {
  connected:    { color: "text-emerald-400", dot: "bg-emerald-400", label: "Connected" },
  connecting:   { color: "text-blue-400",    dot: "bg-blue-400",    label: "Connecting" },
  reconnecting: { color: "text-amber-400",   dot: "bg-amber-400",   label: "Reconnecting" },
  disconnected: { color: "text-rose-400",    dot: "bg-rose-400",    label: "Disconnected" },
};

function formatUptime(ms: number): string {
  if (ms <= 0) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatTime(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-IN", { hour12: false });
}

interface EventLogEntry {
  id: string;
  type: "rx" | "tx" | "state" | "error";
  message: string;
  timestamp: number;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "emerald",
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface/80 backdrop-blur-xl border border-border/60 rounded-2xl p-5"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl bg-${accent}-500/10 border border-${accent}-500/20 flex items-center justify-center`}>
          <Icon size={16} className={`text-${accent}-400`} />
        </div>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
      </div>
      <p className="text-2xl font-black text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </motion.div>
  );
}

export default function RealtimeMonitorPage() {
  const connState = useConnection();
  const quality = useConnectionQuality();
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [prevStats, setPrevStats] = useState<ConnectionQualityStats | null>(null);
  const logIdRef = useRef(0);

  useEffect(() => {
    const entries: EventLogEntry[] = [];
    if (prevStats) {
      if (quality.eventsReceived > prevStats.eventsReceived) {
        entries.push({
          id: `e-${++logIdRef.current}`,
          type: "rx" as const,
          message: `Received ${quality.eventsReceived - prevStats.eventsReceived} event(s)`,
          timestamp: Date.now(),
        });
      }
      if (quality.eventsSent > prevStats.eventsSent) {
        entries.push({
          id: `e-${++logIdRef.current}`,
          type: "tx" as const,
          message: `Sent ${quality.eventsSent - prevStats.eventsSent} event(s)`,
          timestamp: Date.now(),
        });
      }
      if (quality.quality !== prevStats.quality) {
        entries.push({
          id: `e-${++logIdRef.current}`,
          type: "state" as const,
          message: `Quality → ${quality.quality}`,
          timestamp: Date.now(),
        });
      }
    }
    setPrevStats(quality);
    if (entries.length > 0) {
      setEventLog((prev) => [...entries, ...prev].slice(0, 50));
    }
  }, [quality]);

  useEffect(() => {
    setEventLog((prev) => [{
      id: `e-${++logIdRef.current}`,
      type: "state" as const,
      message: `Connection: ${connState}`,
      timestamp: Date.now(),
    }, ...prev].slice(0, 50));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connState]);

  const qCfg = QUALITY_CONFIG[quality.quality] ?? QUALITY_CONFIG["offline"]!;
  const sCfg = STATE_CONFIG[connState];
  const QIcon = qCfg.icon;

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Radio size={20} className="text-emerald-400" />
            <h1 className="text-2xl font-black tracking-tight text-foreground">Realtime Monitor</h1>
          </div>
          <p className="text-sm text-muted-foreground">Live connection quality, event throughput & channel health</p>
        </div>
        <motion.div
          animate={{ scale: connState === "connected" ? [1, 1.2, 1] : 1 }}
          transition={{ repeat: connState === "connected" ? Infinity : 0, duration: 2 }}
          className={`flex items-center gap-2 px-4 py-2 rounded-full border ${qCfg.bg}`}
        >
          <QIcon size={14} className={qCfg.color} />
          <span className={`text-xs font-bold uppercase tracking-wider ${qCfg.color}`}>{qCfg.label}</span>
        </motion.div>
      </div>

      {/* ─── Connection status bar ───────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface/80 backdrop-blur-xl border border-border/60 rounded-2xl p-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${sCfg.dot} ${connState === "connected" ? "animate-pulse" : ""}`} />
            <span className={`text-sm font-semibold ${sCfg.color}`}>{sCfg.label}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock size={12} />
            Uptime: <span className="text-foreground font-medium">{formatUptime(quality.uptimeMs)}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw size={12} />
            Reconnects: <span className="text-foreground font-medium">{quality.reconnectCount}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Wifi size={12} className={connState === "connected" ? "text-emerald-400" : "text-rose-400"} />
          <span className="font-medium">{quality.latencyMs}ms</span>
          <span className="text-muted-foreground/60">avg latency</span>
        </div>
      </motion.div>

      {/* ─── Stats grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Radio}
          label="Active Channels"
          value={quality.activeChannels}
          sub="Subscribed topics"
          accent="emerald"
        />
        <StatCard
          icon={Activity}
          label="Listeners"
          value={quality.totalListeners}
          sub="Registered handlers"
          accent="blue"
        />
        <StatCard
          icon={ArrowDown}
          label="Events Received"
          value={quality.eventsReceived.toLocaleString()}
          sub={`Last: ${formatTime(quality.lastEventAt)}`}
          accent="violet"
        />
        <StatCard
          icon={ArrowUp}
          label="Events Sent"
          value={quality.eventsSent.toLocaleString()}
          sub={quality.eventsDropped > 0 ? `${quality.eventsDropped} dropped` : "No drops"}
          accent="amber"
        />
      </div>

      {/* ─── Quality gauge + event log ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Latency gauge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 bg-surface/80 backdrop-blur-xl border border-border/60 rounded-2xl p-6 flex flex-col items-center justify-center"
        >
          <div className="relative w-40 h-40 mb-4">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="8"
                className="text-border/40" />
              <circle cx="60" cy="60" r="50" fill="none" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${Math.min(quality.latencyMs / 300, 1) * 314} 314`}
                className={qCfg.color}
                stroke="currentColor"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Gauge size={20} className={qCfg.color} />
              <span className="text-3xl font-black text-foreground mt-1">{quality.latencyMs}</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">ms avg</span>
            </div>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              &lt;200ms
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              &lt;1s
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              &gt;1s
            </div>
          </div>
        </motion.div>

        {/* Event log */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-3 bg-surface/80 backdrop-blur-xl border border-border/60 rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-amber-400" />
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Live Event Log</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{eventLog.length} entries</span>
          </div>
          <div className="space-y-1.5 max-h-[320px] overflow-y-auto scrollbar-thin">
            <AnimatePresence initial={false}>
              {eventLog.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  <Circle size={14} className="mr-2 opacity-40" />
                  Waiting for events...
                </div>
              ) : (
                eventLog.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-overlay/50 border border-border/30"
                  >
                    {entry.type === "rx" && <ArrowDown size={12} className="text-violet-400 shrink-0" />}
                    {entry.type === "tx" && <ArrowUp size={12} className="text-amber-400 shrink-0" />}
                    {entry.type === "state" && <RefreshCw size={12} className="text-blue-400 shrink-0" />}
                    {entry.type === "error" && <XCircle size={12} className="text-rose-400 shrink-0" />}
                    <span className="text-xs text-foreground flex-1 truncate">{entry.message}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(entry.timestamp).toLocaleTimeString("en-IN", { hour12: false })}
                    </span>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* ─── Channel architecture info ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-surface/80 backdrop-blur-xl border border-border/60 rounded-2xl p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 size={14} className="text-emerald-400" />
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Architecture</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-1">Wildcard Emulation</p>
            <p className="text-foreground font-semibold">18 known events</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Dedup Window</p>
            <p className="text-foreground font-semibold">500 events</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Offline Queue</p>
            <p className="text-foreground font-semibold">50 max · 3 retries</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Backoff Strategy</p>
            <p className="text-foreground font-semibold">Exp + jitter · 10 attempts</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
