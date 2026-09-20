"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Consultant Dashboard
// Realtime pulse · KPI strip · live queue · today's schedule
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles, IndianRupee, Star, Flame, Users, ChevronRight, Power,
  Loader2, Activity, MessageCircle, Calendar, Wallet, Radio,
} from "lucide-react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";
import { KpiCard } from "@zeal/ui";

interface PulseData {
  balance: number;
  rating: number;
  sessions: number;
  sparks: number;
}

interface QueueItem {
  id: string;
  seekerName: string;
  rate: number;
  modality: string;
  receivedAt: string;
}

interface ScheduleItem {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  amount: number;
  userName: string | null;
}

export default function ConsultantDashboardPage() {
  const [profile, setProfile] = useState<{ id: string; name?: string; is_online?: boolean } | null>(null);
  const [pulse, setPulse] = useState<PulseData>({ balance: 0, rating: 5, sessions: 0, sparks: 0 });
  const [online, setOnline] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);

  // ─── Initial fetch ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [me, p, bk] = await Promise.all([
          fetch("/api/users/me/profile", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch("/api/consultant/pulse", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch("/api/consultant/bookings", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        if (me?.user) {
          setProfile(me.user);
          setOnline(Boolean(me.user.is_online));
        }
        if (p) {
          setPulse({
            balance: p.wallet?.balance ?? p.consultant?.wallet?.balance ?? 0,
            rating: p.consultant?.rating ?? 5,
            sessions: p.consultant?.totalConsultations ?? 0,
            sparks: p.consultant?.sparkScore ?? 0,
          });
        }
        if (bk?.bookings) {
          const today = new Date().toDateString();
          setSchedule(
            (bk.bookings as ScheduleItem[]).filter(
              (b) => new Date(b.scheduledAt).toDateString() === today,
            ).slice(0, 6),
          );
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ─── Realtime: wallet, sparks, incoming queue ──────────────────────────
  useChannel<BroadcastChange<{ balance?: number }>>({
    channel: profile?.id ? channels.userWallet(profile.id) : null,
    event: "*",
    onMessage: useCallback((p) => {
      const b = p?.record?.balance;
      if (typeof b === "number") setPulse((s) => ({ ...s, balance: b }));
    }, []),
  });

  useChannel<BroadcastChange<{ sparkScore?: number }>>({
    channel: profile?.id ? channels.consultantSparks(profile.id) : null,
    event: "*",
    onMessage: useCallback((p) => {
      const s = p?.record?.sparkScore;
      if (typeof s === "number") setPulse((prev) => ({ ...prev, sparks: s }));
    }, []),
  });

  useChannel<QueueItem>({
    channel: profile?.id ? channels.consultantIncoming(profile.id) : null,
    event: "*",
    onMessage: useCallback((p) => {
      if (!p?.id) return;
      setQueue((prev) => [p, ...prev].slice(0, 10));
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate?.([100, 50, 100]); } catch { /* ignore */ }
      }
    }, []),
  });

  // ─── Toggle online ──────────────────────────────────────────────────────
  const toggleOnline = async () => {
    setToggling(true);
    try {
      const res = await fetch("/api/consultant/online", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_online: !online }),
      });
      if (res.ok) setOnline(!online);
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl lg:text-3xl font-black text-[var(--color-foreground)]">
          Welcome back{profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)] mt-1">Your practice at a glance</p>
      </motion.div>

      {/* Live toggle */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        onClick={toggleOnline}
        disabled={toggling}
        className={`w-full flex items-center justify-between p-5 rounded-3xl border-2 transition-all ${
          online
            ? "bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border-emerald-500/40 shadow-lg shadow-emerald-500/10"
            : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-primary)]/30"
        }`}
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            online ? "bg-emerald-500/20" : "bg-[var(--color-surface-raised)]"
          }`}>
            {toggling
              ? <Loader2 className="w-6 h-6 animate-spin text-[var(--color-foreground)]" />
              : <Power className={`w-6 h-6 ${online ? "text-emerald-500 animate-pulse" : "text-[var(--color-muted-foreground)]"}`} />}
          </div>
          <div className="text-left">
            <p className={`text-base font-black ${online ? "text-emerald-500" : "text-[var(--color-foreground)]"}`}>
              {online ? "Accepting Sessions" : "Currently Offline"}
            </p>
            <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
              {online ? "Seekers can reach you now" : "Tap to go live"}
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-[var(--color-muted-foreground)]" />
      </motion.button>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Balance"  value={`₹${Number(pulse.balance).toFixed(0)}`} icon={IndianRupee} accent="success" />
        <KpiCard label="Rating"   value={`${pulse.rating.toFixed(1)}★`}          icon={Star}        accent="warning" />
        <KpiCard label="Sessions" value={String(pulse.sessions)}                 icon={Activity}    accent="primary" />
        <KpiCard label="Sparks"   value={pulse.sparks.toLocaleString()}          icon={Flame}       accent="destructive" />
      </div>

      {/* Live queue + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-3xl border border-[var(--color-primary)]/20 bg-[var(--color-surface)] p-6 min-h-[360px]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-[var(--color-foreground)] flex items-center gap-2">
                <Activity className="text-[var(--color-primary)] w-5 h-5" /> Live Seeker Queue
              </h3>
              {online && (
                <span className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-black uppercase text-emerald-500 flex items-center gap-1.5">
                  <Radio size={10} className="animate-pulse" /> Searching
                </span>
              )}
            </div>

            {queue.length > 0 ? (
              <div className="space-y-3">
                {queue.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-primary-muted)]">
                    <div className="min-w-0">
                      <p className="font-bold text-[var(--color-foreground)] text-sm truncate">{r.seekerName}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">₹{r.rate}/min · {r.modality}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setQueue((p) => p.filter((x) => x.id !== r.id))}
                        className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-raised)] text-[var(--color-muted-foreground)] text-xs font-bold"
                      >
                        Skip
                      </button>
                      <Link
                        href={`/consultant/chat/${r.id}`}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-[var(--color-primary-foreground)] text-xs font-bold"
                      >
                        Accept
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`flex items-center justify-center border-2 border-dashed rounded-3xl p-8 min-h-[280px] ${
                online ? "border-[var(--color-primary)]/30 bg-[var(--color-primary-muted)]" : "border-[var(--color-border)]"
              }`}>
                <div className="text-center">
                  <div className={`w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center ${
                    online ? "bg-[var(--color-primary-muted)] text-[var(--color-primary)] animate-pulse" : "bg-[var(--color-surface-raised)] text-[var(--color-muted-foreground)]"
                  }`}>
                    {online ? <Users size={24} /> : <Power size={24} />}
                  </div>
                  <h4 className="text-sm font-bold text-[var(--color-foreground)] mb-1">
                    {online ? "Waiting for connections…" : "You're offline"}
                  </h4>
                  <p className="text-xs text-[var(--color-muted-foreground)] max-w-xs mx-auto">
                    {online ? "Requests appear here instantly." : "Toggle the switch above to start receiving."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-muted-foreground)] mb-4 flex items-center gap-2">
              <MessageCircle size={14} /> Quick Actions
            </h3>
            <div className="space-y-2">
              <QuickLink icon={Calendar} label="Set availability" href="/consultant/availability" />
              <QuickLink icon={Wallet}   label="View earnings"    href="/consultant/earnings" />
              <QuickLink icon={Users}    label="My clients"       href="/consultant/clients" />
            </div>
          </div>
        </div>
      </div>

      {/* Today's schedule */}
      <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-[var(--color-foreground)] flex items-center gap-2">
            <Calendar size={18} className="text-[var(--color-primary)]" /> Today&apos;s Schedule
          </h3>
          <Link href="/consultant/bookings" className="text-xs font-bold text-[var(--color-primary)] hover:underline">
            View all →
          </Link>
        </div>

        {schedule.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)] text-center py-8">
            No bookings scheduled for today
          </p>
        ) : (
          <div className="space-y-2">
            {schedule.map((b) => {
              const t = new Date(b.scheduledAt);
              const canJoin = b.status === "CONFIRMED" || b.status === "IN_PROGRESS";
              return (
                <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-raised)]">
                  <div className="text-center shrink-0">
                    <p className="text-sm font-bold text-[var(--color-foreground)] font-mono">
                      {t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="text-[10px] text-[var(--color-muted-foreground)]">{b.durationMinutes}m</p>
                  </div>
                  <div className="w-px h-8 bg-[var(--color-border)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--color-foreground)] truncate">{b.userName || "Client"}</p>
                    <p className="text-xs text-[var(--color-muted-foreground)] capitalize">{b.status.toLowerCase()}</p>
                  </div>
                  {canJoin && (
                    <Link
                      href={`/consultant/chat`}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-[var(--color-primary-foreground)] text-xs font-bold"
                    >
                      Join
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickLink({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof Calendar;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-overlay)] transition-colors group"
    >
      <Icon size={16} className="text-[var(--color-primary)]" />
      <span className="text-sm text-[var(--color-foreground)] flex-1">{label}</span>
      <ChevronRight size={12} className="text-[var(--color-muted-foreground)] group-hover:text-[var(--color-primary)]" />
    </Link>
  );
}
