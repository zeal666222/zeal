"use client";

// LiveBusPanel — Cloudflare admin-realtime bus strip.
//
// Renders the sub-minute live cadence from the zeal-admin-realtime WebSocket
// bus: connected operators, events/min, per-minute counters and a rolling
// event feed. Supabase remains the source of truth; this is an additive live
// pulse. When the bus is disabled (NEXT_PUBLIC_ADMIN_BUS_URL unset) or
// unauthorized the panel renders nothing, so the dashboard falls back to the
// Supabase-driven activity feed without a dead hole.

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, Calendar, CreditCard, MessageSquare, Radio, Wallet, Zap,
} from "lucide-react";
import { useAdminLiveBus, type LiveBusEvent, type LiveBusStatus } from "@/lib/realtime/useAdminLiveBus";

const KIND_META: Record<string, { icon: typeof Zap; color: string }> = {
  booking_confirmed:  { icon: Calendar,    color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  payment_topup:      { icon: CreditCard,  color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  withdrawal_requested: { icon: Wallet,    color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
  withdrawal_approved:  { icon: Wallet,    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  withdrawal_rejected:  { icon: Wallet,    color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  pricing_approved:   { icon: Zap,         color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  pricing_rejected:   { icon: Zap,         color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  consultant_verified:  { icon: Activity,  color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  consultant_rejected:  { icon: Activity,  color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
  chat_started:       { icon: MessageSquare, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
};

const STATUS_STYLE: Record<LiveBusStatus, { dot: string; label: string; text: string }> = {
  disabled:    { dot: "bg-slate-400",   label: "Dormant",      text: "text-muted-foreground" },
  connecting:  { dot: "bg-amber-400",   label: "Connecting",   text: "text-amber-400" },
  live:        { dot: "bg-emerald-400", label: "Live bus",     text: "text-emerald-400" },
  reconnecting:{ dot: "bg-orange-400",  label: "Reconnecting", text: "text-orange-400" },
  unauthorized:{ dot: "bg-rose-400",    label: "Offline",      text: "text-rose-400" },
};

function relTime(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 5) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

export function LiveBusPanel() {
  const { status, operators, rates, feed } = useAdminLiveBus();

  // Hide entirely when the bus isn't wired up or the operator isn't allowed —
  // no dead panel, the Supabase activity feed below already covers it.
  if (status === "disabled" || status === "unauthorized") return null;

  const s = STATUS_STYLE[status];
  const r = rates.last60s;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-gradient-to-r from-sky-950/25 via-surface to-surface p-5 relative overflow-hidden"
    >
      <div className="absolute -top-8 right-10 w-56 h-56 bg-sky-500/10 blur-[90px] rounded-full pointer-events-none" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio size={14} className="text-sky-400" />
            <h2 className="text-xs font-black uppercase tracking-widest text-sky-400">
              Live Operations
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground font-bold">
              <span className="font-mono text-foreground">{operators}</span> operator{operators === 1 ? "" : "s"}
            </span>
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${s.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status === "live" ? "animate-pulse" : ""}`} />
              {s.label}
            </span>
          </div>
        </div>

        {/* Per-minute counters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
          <PulseCell label="Events/min" value={rates.eventsPerMin} icon={Zap} tone="sky" />
          <PulseCell label="Bookings" value={r.bookings} icon={Calendar} tone="blue" />
          <PulseCell label="Payments" value={r.payments} icon={CreditCard} tone="emerald" />
          <PulseCell label="Withdrawals" value={r.withdrawals} icon={Wallet} tone="rose" />
          <PulseCell label="Chats" value={r.chats} icon={MessageSquare} tone="amber" />
        </div>

        {/* Live feed */}
        <div className="rounded-xl border border-white/5 bg-surface-raised/40 p-2">
          <p className="px-2 pb-1 pt-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
            Streaming feed
          </p>
          {feed.length === 0 ? (
            <div className="px-2 py-4 text-center text-[11px] text-muted-foreground">
              {status === "live" ? "Bus connected — events will stream in live." : "Waiting for the live bus…"}
            </div>
          ) : (
            <div className="space-y-1 max-h-44 overflow-y-auto">
              <AnimatePresence initial={false}>
                {feed.slice(0, 20).map((ev, i) => (
                  <FeedRow key={`${ev.ts}-${i}`} event={ev} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function PulseCell({ label, value, icon: Icon, tone }: {
  label: string; value: number; icon: typeof Zap;
  tone: "sky" | "blue" | "emerald" | "rose" | "amber";
}) {
  const tones = {
    sky: "text-sky-400 bg-sky-500/10",
    blue: "text-blue-400 bg-blue-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
    rose: "text-rose-400 bg-rose-500/10",
    amber: "text-amber-400 bg-amber-500/10",
  } as const;
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-surface/60 border border-white/5 px-3 py-2">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-black font-mono tabular-nums text-foreground leading-none">{value}</p>
        <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-black mt-0.5 truncate">{label}</p>
      </div>
    </div>
  );
}

function FeedRow({ event }: { event: LiveBusEvent }) {
  const meta = KIND_META[event.kind] ?? { icon: Activity, color: "text-muted-foreground bg-surface-raised border-border" };
  const Icon = meta.icon;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface-raised/70 transition-colors"
    >
      <div className={`w-6 h-6 rounded-md flex items-center justify-center border shrink-0 ${meta.color}`}>
        <Icon size={11} />
      </div>
      <span className="text-[11px] text-foreground/90 truncate flex-1 font-medium">{event.label}</span>
      {event.amount != null && event.amount > 0 && (
        <span className="text-[11px] font-bold text-emerald-400 font-mono shrink-0">
          +&#8377;{event.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
        </span>
      )}
      <span className="text-[9px] text-muted-foreground font-mono shrink-0 w-8 text-right">{relTime(event.ts)}</span>
    </motion.div>
  );
}
