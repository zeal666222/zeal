"use client";
import {useCallback, useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {Power, Video, MessageSquare, IndianRupee, Star, Clock, Users, Loader2, Sparkles, Activity, Flame, ChevronRight} from "lucide-react";
import {getBrowserClient} from "@zeal/database";
import type { CompletenessReport } from "@zeal/types";

interface Profile { id: string; full_name: string; wallet_balance: number; is_online: boolean; }
interface Stats { sessions: number; rating: number; sparkScore: number; }
interface Incoming { id: string; seekerName: string; rate: number; modality: string; receivedAt: string; }
interface Props { initialProfile: Profile; completeness: CompletenessReport; subdomain: string | null; stats: Stats; }

export function StudioClient({ initialProfile, completeness, subdomain, stats }: Props) {
  const router = useRouter();
  const [online, setOnline] = useState(initialProfile.is_online);
  const [toggling, setToggling] = useState(false);
  const [balance, setBalance] = useState(initialProfile.wallet_balance);
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const sbRef = useRef<ReturnType<typeof getBrowserClient> | null>(null);

  if (!sbRef.current && typeof window !== "undefined") {
    try { sbRef.current = getBrowserClient(); } catch {}
  }

  useEffect(() => {
    const sb = sbRef.current;
    if (!sb) return;
    const ch = sb.channel(`consultant:${initialProfile.id}:incoming`)
      .on("broadcast", { event: "incoming_request" }, (payload: any) => {
        const r = payload.payload as Incoming;
        if (r?.id) {
          setIncoming((prev) => [r, ...prev].slice(0, 10));
          if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([100, 50, 100]);
        }
      }).subscribe();
    const w = sb.channel(`user:${initialProfile.id}:wallet`)
      .on("broadcast", { event: "*" }, (payload: any) => {
        const b = payload.payload?.balance ?? payload.payload?.record?.balance;
        if (typeof b === "number") setBalance(b);
      }).subscribe();
    return () => { try { sb.removeChannel(ch); } catch {} try { sb.removeChannel(w); } catch {} };
  }, [initialProfile.id]);

  const toggle = useCallback(async () => {
    setToggling(true);
    setToast(null);
    const next = !online;
    try {
      const res = await fetch("/api/consultant/online", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_online: next }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err?.error === "PROFILE_INCOMPLETE") {
          setToast(`Complete your profile to go live (${err.score ?? 0}%)`);
        } else {
          setToast(err?.message || "Could not toggle status");
        }
        return;
      }
      setOnline(next);
      const sb = sbRef.current;
      if (sb) {
        const ch = sb.channel(`consultant:${initialProfile.id}:status`);
        await ch.subscribe();
        await ch.send({ type: "broadcast", event: "status_updated", payload: { consultantId: initialProfile.id, is_online: next } });
        try { await sb.removeChannel(ch); } catch {}
      }
    } catch {
      setToast("Network error");
    } finally { setToggling(false); }
  }, [online, initialProfile.id]);

  const accept = (r: Incoming) => { setIncoming((p) => p.filter((x) => x.id !== r.id)); router.push(`/chat/${r.id}`); };

  return (
    <div className="space-y-6">
      {!completeness.isLive && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/25 p-6 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-[80px] rounded-full pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest mb-2">
              <Sparkles size={13} /> Complete your profile
            </div>
            <h2 className="text-xl font-black text-white mb-1">
              {completeness.score}% complete — unlock going live
            </h2>
            <p className="text-sm text-slate-400 mb-4">Finish the checklist to accept sessions and earn.</p>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-5">
              <div className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all" style={{ width: `${completeness.score}%` }} />
            </div>
            <ul className="space-y-2 mb-5">
              {completeness.checks.map((c) => (
                <li key={c.id} className="flex items-center gap-3 text-sm">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${c.passed ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-500"}`}>
                    {c.passed ? "✓" : "○"}
                  </span>
                  <span className={c.passed ? "text-slate-500 line-through" : "text-slate-200"}>{c.label}</span>
                  {!c.passed && (
                    <a href={c.actionHref} className="ml-auto text-xs text-amber-400 hover:text-amber-300 font-bold">
                      Fix <ChevronRight size={11} className="inline" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
            <a href="/apply" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg">
              Complete profile <ChevronRight size={14} />
            </a>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-white">Welcome back, {initialProfile.full_name}</h1>
          <p className="text-sm text-slate-400 mt-1">Your practice at a glance</p>
        </div>
        <button onClick={toggle} disabled={toggling || !completeness.isLive}
          title={!completeness.isLive ? "Complete profile to go live" : undefined}
          className={`flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            online ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400"
          }`}
        >
          {toggling ? <Loader2 size={18} className="animate-spin" /> : <Power size={18} className={online ? "animate-pulse" : ""} />}
          <span className="text-sm font-bold uppercase tracking-wider">
            {toggling ? "Updating…" : online ? "Accepting Sessions" : "Currently Offline"}
          </span>
        </button>
      </div>

      {toast && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-bold">{toast}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <Metric label="Balance"  value={`₹${Number(balance).toFixed(0)}`} icon={IndianRupee} accent="text-emerald-400" bg="bg-emerald-500/10" />
        <Metric label="Rating"   value={`${stats.rating.toFixed(1)}★`}     icon={Star}         accent="text-amber-400"   bg="bg-amber-500/10" />
        <Metric label="Sessions" value={String(stats.sessions)}            icon={Video}        accent="text-indigo-400"  bg="bg-indigo-500/10" />
        <Metric label="Sparks"   value={stats.sparkScore.toLocaleString()} icon={Flame}        accent="text-orange-400"  bg="bg-orange-500/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-indigo-500/20 rounded-3xl p-6 shadow-2xl min-h-[420px]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-white flex items-center gap-3">
                <Activity className="text-indigo-400 w-5 h-5" /> Live Seeker Queue
              </h3>
              {online && (
                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs font-bold text-emerald-400 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Searching
                </span>
              )}
            </div>

            {incoming.length > 0 ? (
              <div className="space-y-3">
                {incoming.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl">
                    <div className="min-w-0">
                      <p className="font-bold text-white text-sm truncate">{r.seekerName}</p>
                      <p className="text-xs text-slate-400">₹{r.rate}/min · {r.modality}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => setIncoming((p) => p.filter((x) => x.id !== r.id))}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold">Skip</button>
                      <button onClick={() => accept(r)}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-white text-xs font-bold">Accept</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`flex items-center justify-center border-2 border-dashed rounded-3xl p-8 min-h-[340px] ${
                online ? "border-indigo-500/30 bg-indigo-950/20" : "border-white/5 bg-slate-950/50"
              }`}>
                <div className="text-center">
                  <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
                    online ? "bg-indigo-500/20 text-indigo-400 animate-pulse" : "bg-white/5 text-slate-500"
                  }`}>
                    {online ? <Users size={28} /> : <Power size={28} />}
                  </div>
                  <h4 className="text-base font-bold text-slate-200 mb-2">
                    {online ? "Waiting for connections…" : completeness.isLive ? "You're offline" : "Studio locked"}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {online
                      ? "Your profile is visible to seekers. Requests appear here instantly."
                      : completeness.isLive
                      ? "Toggle the switch above to start receiving sessions."
                      : "Complete your profile to unlock the studio."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-sm font-black mb-4 text-white uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="text-slate-400" size={16} /> Quick Actions
            </h3>
            <div className="space-y-3">
              <Quick icon={Clock} label="Set Availability" href="/consultant/availability" />
              <Quick icon={IndianRupee} label="View Earnings" href="/consultant/earnings" />
              <Quick icon={Users} label="My Clients" href="/consultant/clients" />
            </div>
          </div>
          {subdomain && (
            <div className="bg-slate-900/60 backdrop-blur-xl border border-[#9D7DC5]/20 rounded-3xl p-6 shadow-2xl">
              <p className="text-[10px] uppercase tracking-widest text-[#9D7DC5] font-bold mb-1">Your White-Label Site</p>
              <p className="text-sm font-mono text-white break-all">{subdomain}.zeal.app</p>
              <a href={`/white-label/${subdomain}`} target="_blank"
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#9D7DC5] hover:text-white font-bold">
                Open site <ChevronRight size={12} />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon, accent, bg }: { label: string; value: string; icon: typeof IndianRupee; accent: string; bg: string }) {
  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl lg:rounded-3xl p-4 lg:p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-400 text-[10px] lg:text-xs font-bold uppercase tracking-wider">{label}</span>
        <div className={`p-2 rounded-lg ${bg} ${accent}`}><Icon size={16} /></div>
      </div>
      <div className="text-xl lg:text-3xl font-black font-mono tracking-tight text-white">{value}</div>
    </div>
  );
}

function Quick({ icon: Icon, label, href }: { icon: typeof Clock; label: string; href: string }) {
  return (
    <a href={href} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors group">
      <Icon size={16} className="text-[#9D7DC5]" />
      <span className="text-sm text-slate-200 flex-1">{label}</span>
      <ChevronRight size={12} className="text-slate-500 group-hover:text-[#9D7DC5]" />
    </a>
  );
}
