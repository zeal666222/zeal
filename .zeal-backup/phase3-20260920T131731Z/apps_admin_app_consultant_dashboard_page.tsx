"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Consultant Dashboard
// Enterprise-grade, mobile-first, realtime-enabled dashboard.
//
// Features:
//   • Live status toggle (Accepting Sessions / Offline)
//   • Realtime wallet balance (Supabase Broadcast)
//   • Realtime spark score (Supabase Broadcast)
//   • KPI grid (Balance, Rating, Sessions, Sparks)
//   • Quick action tiles (Chat, Bookings, Clients, Earnings)
//   • Onboarding prompt when sessions = 0
// ═══════════════════════════════════════════════════════════════════════════════

import {useEffect, useState} from "react";
import Link from "next/link";
import {motion} from "framer-motion";
import {Sparkles, IndianRupee, Star, Flame, Users, ChevronRight, Power, Loader2, Activity, MessageCircle, Calendar, Wallet} from "lucide-react";
import {useChannel, channels, type BroadcastChange} from "@zeal/realtime";

interface PulseData {
  balance: number;
  rating: number;
  sessions: number;
  sparks: number;
}

export default function ConsultantDashboardPage() {
  const [profile, setProfile] = useState<any>(null);
  const [pulse, setPulse] = useState<PulseData>({ balance: 0, rating: 5, sessions: 0, sparks: 0 });
  const [online, setOnline] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initial fetch
  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/users/me/profile", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (me?.user) {
          setProfile(me.user);
          setOnline(Boolean(me.user.is_online));
        }

        const p = await fetch("/api/consultant/pulse", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (p) {
          setPulse({
            balance: p.wallet?.balance ?? 0,
            rating: p.consultant?.rating ?? 5,
            sessions: p.consultant?.totalConsultations ?? 0,
            sparks: p.consultant?.sparkScore ?? 0,
          });
        }
      } finally { setLoading(false); }
    })();
  }, []);

  // Realtime wallet balance
  useChannel<BroadcastChange<{ balance?: number }>>({
    channel: profile?.id ? channels.userWallet(profile.id) : null,
    event: "*",
    onMessage: (p) => {
      const b = p?.record?.balance;
      if (typeof b === "number") setPulse((s) => ({ ...s, balance: b }));
    },
  });

  // Realtime spark score
  useChannel<BroadcastChange<{ sparkScore?: number }>>({
    channel: profile?.id ? channels.consultantSparks(profile.id) : null,
    event: "*",
    onMessage: (p) => {
      const s = p?.record?.sparkScore;
      if (typeof s === "number") setPulse((prev) => ({ ...prev, sparks: s }));
    },
  });

  const toggleOnline = async () => {
    setToggling(true);
    try {
      const res = await fetch("/api/consultant/online", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_online: !online }),
      });
      if (res.ok) setOnline(!online);
    } finally { setToggling(false); }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  const kpis = [
    { icon: IndianRupee, label: "Balance",  value: `₹${Number(pulse.balance).toFixed(0)}`, accent: "text-emerald-400", bg: "bg-emerald-500/10", delay: 0.1 },
    { icon: Star,        label: "Rating",   value: `${pulse.rating.toFixed(1)}★`,          accent: "text-amber-400",   bg: "bg-amber-500/10",   delay: 0.15 },
    { icon: Activity,    label: "Sessions", value: String(pulse.sessions),                 accent: "text-indigo-400",  bg: "bg-indigo-500/10",  delay: 0.2 },
    { icon: Flame,       label: "Sparks",   value: pulse.sparks.toLocaleString(),          accent: "text-orange-400",  bg: "bg-orange-500/10",  delay: 0.25 },
  ];

  const quickActions = [
    { href: "/consultant/chat",     icon: MessageCircle, label: "Messages", color: "text-blue-400",    bg: "bg-blue-500/10" },
    { href: "/consultant/bookings", icon: Calendar,      label: "Bookings", color: "text-purple-400",  bg: "bg-purple-500/10" },
    { href: "/consultant/clients",  icon: Users,         label: "Clients",  color: "text-pink-400",    bg: "bg-pink-500/10" },
    { href: "/consultant/earnings", icon: Wallet,        label: "Earnings", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl lg:text-3xl font-black text-white">
          Welcome back{profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-slate-400 mt-1">Your practice at a glance</p>
      </motion.div>

      {/* Live toggle */}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        onClick={toggleOnline}
        disabled={toggling}
        className={`w-full flex items-center justify-between p-5 rounded-3xl border-2 transition-all ${
          online
            ? "bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border-emerald-500/40 shadow-lg shadow-emerald-500/10"
            : "bg-slate-900/60 border-white/10 hover:border-white/20"
        }`}
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            online ? "bg-emerald-500/20" : "bg-slate-800"
          }`}>
            {toggling
              ? <Loader2 className="w-6 h-6 animate-spin text-white" />
              : <Power className={`w-6 h-6 ${online ? "text-emerald-400 animate-pulse" : "text-slate-500"}`} />}
          </div>
          <div className="text-left">
            <p className={`text-base font-black ${online ? "text-emerald-300" : "text-white"}`}>
              {online ? "Accepting Sessions" : "Currently Offline"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {online ? "Seekers can reach you now" : "Tap to go live"}
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-500" />
      </motion.button>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((s) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: s.delay }}
              className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4"
            >
              <div className={`w-9 h-9 rounded-xl ${s.bg} ${s.accent} flex items-center justify-center mb-3`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{s.label}</p>
              <p className="text-2xl font-black font-mono text-white mt-1">{s.value}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl p-5"
      >
        <h3 className="text-xs font-black mb-4 text-slate-400 uppercase tracking-widest">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((q) => {
            const Icon = q.icon;
            return (
              <Link
                key={q.href}
                href={q.href}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all group active:scale-95"
              >
                <div className={`w-10 h-10 rounded-xl ${q.bg} ${q.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-300">{q.label}</span>
              </Link>
            );
          })}
        </div>
      </motion.div>

      {/* Onboarding prompt */}
      {pulse.sessions === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 rounded-3xl p-5"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-black text-amber-300">Complete your profile</h3>
              <p className="text-xs text-slate-400 mt-1">
                Finish onboarding to appear in the directory and start earning.
              </p>
              <Link
                href="/consultant/settings"
                className="inline-flex items-center gap-1 mt-3 text-xs font-bold text-amber-400 hover:text-amber-300"
              >
                Open settings <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
