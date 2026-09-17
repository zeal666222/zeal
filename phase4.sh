#!/usr/bin/env bash
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo /d/zeal)" || exit 1
G=$'\033[32m'; R=$'\033[31m'; M=$'\033[35m'; B=$'\033[1m'; N=$'\033[0m'
[[ ! -t 1 ]] && { G=''; R=''; M=''; B=''; N=''; }
OK(){ printf "${G}OK${N} %s\n" "$1"; }
BAD(){ printf "${R}FAIL${N} %s\n" "$1"; }
FIX(){ printf "${M}FIX${N} %s\n" "$1"; }
FAILED=0
BK="_archive/p4-$(date +%s)"; mkdir -p "$BK"
wf(){ local t="$1" tmp="${1}.tmp.$$"; mkdir -p "$(dirname "$t")"; cat > "$tmp"; [[ ! -s "$tmp" ]] && { rm -f "$tmp"; BAD "$t empty"; FAILED=1; return 1; }; [[ -f "$t" ]] && cp "$t" "$BK/$(basename "$t").bak" 2>/dev/null; mv "$tmp" "$t"; FIX "$t"; }

# ═══════════ consultant/layout.tsx ═══════════
wf apps/web/app/consultant/layout.tsx << 'EOF'
import { redirect } from "next/navigation";
import { createServerClientFromCookies, evaluateConsultantProfile } from "@zeal/database/server";
import { WorkspaceSidebar } from "@/components/consultant/WorkspaceSidebar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consultant Studio | Zeal" };

interface ProfileRow { id: string; name: string | null; email: string | null; avatar: string | null; role: string; }
interface ConsultantRow {
  id: string; status: string; subdomain: string | null; isActive: boolean;
  bio: string | null; perMinuteRate: number | null; specialties: string[] | null;
  languages: string[] | null; availability: unknown; category: string | null;
}

export default async function ConsultantLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectedFrom=/consultant/dashboard");

  const [profileRes, consultantRes] = await Promise.all([
    supabase.from("User").select("id, name, email, avatar, role").eq("id", user.id).maybeSingle(),
    supabase.from("Consultant")
      .select("id, status, subdomain, isActive, bio, perMinuteRate, specialties, languages, availability, category")
      .eq("userId", user.id).maybeSingle(),
  ]);

  const profile = profileRes.data as ProfileRow | null;
  const consultant = consultantRes.data as ConsultantRow | null;
  if (!consultant) redirect("/apply");
  if (consultant.status === "SUSPENDED") redirect("/suspended");

  const { count: pendingCount } = await supabase
    .from("Booking").select("*", { count: "exact", head: true })
    .eq("consultantId", consultant.id).eq("status", "PENDING");

  const completeness = evaluateConsultantProfile({
    bio: consultant.bio, perMinuteRate: consultant.perMinuteRate,
    specialties: consultant.specialties, languages: consultant.languages,
    availability: consultant.availability, category: consultant.category,
  });

  return (
    <div className="min-h-screen-app bg-slate-950 text-slate-50">
      <WorkspaceSidebar
        user={{ name: profile?.name ?? null, email: profile?.email ?? null, avatar: profile?.avatar ?? null }}
        consultant={{ status: consultant.status, subdomain: consultant.subdomain }}
        completeness={completeness}
        pendingBookings={pendingCount ?? 0}
      />
      <main className="lg:ml-64 min-h-screen-app pb-20 lg:pb-8">
        <div className="pt-14 lg:pt-0">
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
EOF

# ═══════════ WorkspaceSidebar.tsx ═══════════
wf apps/web/components/consultant/WorkspaceSidebar.tsx << 'EOF'
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Calendar, Users, DollarSign, Clock, Palette,
  Settings, LogOut, ExternalLink, Menu, X, Copy, Check,
} from "lucide-react";
import { cn } from "@zeal/ui";
import type { CompletenessReport } from "@zeal/database/server";

interface NavItem { icon: typeof LayoutDashboard; label: string; href: string; mobile?: boolean; }
const NAV: NavItem[] = [
  { icon: LayoutDashboard, label: "Pulse",       href: "/consultant/dashboard",    mobile: true },
  { icon: Calendar,        label: "Bookings",    href: "/consultant/bookings",     mobile: true },
  { icon: Users,           label: "Clients",     href: "/consultant/clients",      mobile: true },
  { icon: DollarSign,      label: "Earnings",    href: "/consultant/earnings",     mobile: true },
  { icon: Clock,           label: "Schedule",    href: "/consultant/availability", mobile: false },
  { icon: Palette,         label: "White-Label", href: "/consultant/settings",     mobile: false },
  { icon: Settings,        label: "Settings",    href: "/consultant/settings",     mobile: true },
];

interface Props {
  user: { name: string | null; email: string | null; avatar: string | null };
  consultant: { status: string; subdomain: string | null };
  completeness: CompletenessReport;
  pendingBookings?: number;
}

export function WorkspaceSidebar({ user, consultant, completeness, pendingBookings = 0 }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const displayName = user.name || user.email?.split("@")[0] || "Consultant";
  const initial = displayName.charAt(0).toUpperCase();

  const copySubdomain = async () => {
    if (!consultant.subdomain) return;
    const url = `https://${consultant.subdomain}.zeal.app`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  const logout = async () => {
    try { await fetch("/api/auth/signout", { method: "POST" }); } catch {}
    router.push("/login");
  };

  const Body = (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="flex items-center gap-3 p-5 border-b border-white/5">
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9D7DC5] to-[#533AFD] flex items-center justify-center text-white font-semibold overflow-hidden">
            {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : initial}
          </div>
          <svg className="absolute -inset-0.5 w-11 h-11 -rotate-90" viewBox="0 0 44 44" aria-hidden>
            <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
            <circle cx="22" cy="22" r="20" fill="none"
              stroke={completeness.isLive ? "#10b981" : "#f59e0b"} strokeWidth="2" strokeLinecap="round"
              strokeDasharray={`${(completeness.score / 100) * 125.6} 125.6`}
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{displayName}</p>
          <p className="text-xs text-slate-400 truncate">
            {completeness.isLive ? "Verified Guide" : `${completeness.score}% complete`}
          </p>
        </div>
      </div>

      {consultant.subdomain && (
        <button onClick={copySubdomain}
          className="mx-3 mt-3 flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[#9D7DC5]/10 hover:bg-[#9D7DC5]/20 transition-colors text-left"
        >
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-[#9D7DC5]">Your Site</p>
            <p className="text-xs font-medium text-white truncate">{consultant.subdomain}.zeal.app</p>
          </div>
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Copy className="w-3.5 h-3.5 text-[#9D7DC5] shrink-0" />}
        </button>
      )}

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
        {NAV.map((item) => {
          const Icon = item.icon;
          const on = active(item.href);
          return (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                on ? "bg-gradient-to-r from-[#9D7DC5]/20 to-[#533AFD]/10 text-[#9D7DC5]" : "text-slate-300 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium flex-1">{item.label}</span>
              {item.href === "/consultant/bookings" && pendingBookings > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 bg-rose-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
                  {pendingBookings > 9 ? "9+" : pendingBookings}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/5">
        <button onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-red-400 hover:bg-red-500/10 transition-colors">
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex lg:flex-col fixed top-0 left-0 w-64 h-screen bg-slate-950 border-r border-white/5 z-30">{Body}</aside>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-slate-950/95 backdrop-blur-3xl border-b border-white/5 flex items-center justify-between px-4">
        <button onClick={() => setOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-white/5" aria-label="Open menu">
          <Menu className="w-5 h-5 text-white" />
        </button>
        <span className="text-sm font-bold text-white tracking-wide">Zeal Studio</span>
        <div className="w-9" />
      </div>
      {open && (
        <>
          <div onClick={() => setOpen(false)} className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <aside className="lg:hidden fixed top-0 left-0 z-50 w-72 h-screen bg-slate-950 shadow-2xl">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/5" aria-label="Close menu">
              <X className="w-5 h-5 text-white" />
            </button>
            {Body}
          </aside>
        </>
      )}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-slate-950/95 backdrop-blur-3xl border-t border-white/5 flex items-center justify-around px-2">
        {NAV.filter((i) => i.mobile).map((item) => {
          const Icon = item.icon;
          const on = active(item.href);
          return (
            <Link key={item.href} href={item.href} className="relative flex flex-col items-center gap-1 min-w-[52px] py-1">
              <span className={cn("absolute -top-0.5 w-6 h-0.5 rounded-full transition-all", on ? "bg-[#9D7DC5]" : "opacity-0")} />
              <Icon className={cn("w-5 h-5", on ? "text-[#9D7DC5]" : "text-slate-500")} />
              <span className={cn("text-[9px] font-bold uppercase tracking-wider", on ? "text-[#9D7DC5]" : "text-slate-600")}>{item.label}</span>
              {item.href === "/consultant/bookings" && pendingBookings > 0 && (
                <span className="absolute top-0 right-1 min-w-[16px] h-4 px-1 bg-rose-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                  {pendingBookings > 9 ? "9+" : pendingBookings}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
EOF

# ═══════════ StudioClient.tsx ═══════════
wf apps/web/components/consultant/StudioClient.tsx << 'EOF'
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Power, Video, MessageSquare, IndianRupee, Star, Clock, Users,
  Loader2, Sparkles, Activity, Flame, ChevronRight,
} from "lucide-react";
import { getBrowserClient } from "@zeal/database";
import type { CompletenessReport } from "@zeal/database/server";

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
EOF

# ═══════════ consultant/dashboard/page.tsx ═══════════
wf apps/web/app/consultant/dashboard/page.tsx << 'EOF'
import { createServerClientFromCookies, evaluateConsultantProfile } from "@zeal/database/server";
import { redirect } from "next/navigation";
import { StudioClient } from "@/components/consultant/StudioClient";

export const dynamic = "force-dynamic";

interface UserRow { id: string; name: string | null; is_online: boolean | null; }
interface WalletRow { balance: number; }
interface ConsultantRow {
  id: string; bio: string | null; perMinuteRate: number | null;
  specialties: string[] | null; languages: string[] | null;
  availability: unknown; category: string | null; subdomain: string | null;
  rating: number | null; totalConsultations: number | null; sparkScore: number | null;
}

export default async function ConsultantDashboardPage() {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [uRes, wRes, cRes] = await Promise.all([
    supabase.from("User").select("id, name, is_online").eq("id", user.id).maybeSingle(),
    supabase.from("Wallet").select("balance").eq("userId", user.id).maybeSingle(),
    supabase.from("Consultant")
      .select("id, bio, perMinuteRate, specialties, languages, availability, category, subdomain, rating, totalConsultations, sparkScore")
      .eq("userId", user.id).maybeSingle(),
  ]);

  const u = uRes.data as UserRow | null;
  const w = wRes.data as WalletRow | null;
  const c = cRes.data as ConsultantRow | null;
  if (!c) redirect("/apply");

  const completeness = evaluateConsultantProfile({
    bio: c.bio, perMinuteRate: c.perMinuteRate, specialties: c.specialties,
    languages: c.languages, availability: c.availability, category: c.category,
  });

  return (
    <StudioClient
      initialProfile={{
        id: user.id,
        full_name: u?.name ?? "Consultant",
        wallet_balance: w?.balance ?? 0,
        is_online: u?.is_online ?? false,
      }}
      completeness={completeness}
      subdomain={c.subdomain}
      stats={{
        sessions: c.totalConsultations ?? 0,
        rating: c.rating ?? 5.0,
        sparkScore: c.sparkScore ?? 0,
      }}
    />
  );
}
EOF

# ═══════════ api/consultant/online/route.ts ═══════════
wf apps/web/app/api/consultant/online/route.ts << 'EOF'
import { NextResponse } from "next/server";
import { createServerClientFromCookies, evaluateConsultantProfile } from "@zeal/database/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { is_online?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.is_online !== "boolean") {
    return NextResponse.json({ error: "is_online must be boolean" }, { status: 400 });
  }

  if (body.is_online === true) {
    const { data: c } = await supabase
      .from("Consultant")
      .select('bio, "perMinuteRate", specialties, languages, availability, category, status')
      .eq("userId", user.id)
      .maybeSingle();

    if (!c) return NextResponse.json({ error: "NO_CONSULTANT_PROFILE" }, { status: 403 });
    if (c.status === "SUSPENDED") return NextResponse.json({ error: "SUSPENDED", message: "Account suspended" }, { status: 403 });

    const report = evaluateConsultantProfile(c);
    if (!report.isLive) {
      return NextResponse.json(
        { error: "PROFILE_INCOMPLETE", message: "Complete your profile to accept sessions", score: report.score, checks: report.checks },
        { status: 403 }
      );
    }
  }

  const { error } = await supabase.from("User").update({ is_online: body.is_online }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const { serverPublish } = await import("@/lib/realtime/server");
    await serverPublish(`consultant:${user.id}:status`, "status_updated", {
      consultantId: user.id, is_online: body.is_online,
    });
  } catch {}

  return NextResponse.json({ success: true, is_online: body.is_online });
}
EOF

# ═══════════ apply/page.tsx (5-step builder) ═══════════
wf apps/web/app/apply/page.tsx << 'EOF'
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Loader2, Check, ChevronLeft, ChevronRight, Plus, Trash2,
  IndianRupee, Upload, Camera, AlertCircle,
} from "lucide-react";

const CATEGORIES = [
  { id: "ASTROLOGER",       icon: "🔮", label: "Vedic Astrology", desc: "Jyotish, Dasha, Kundali" },
  { id: "TAROT",            icon: "🃏", label: "Tarot Reading",   desc: "Rider-Waite, Oracle" },
  { id: "NUMEROLOGIST",     icon: "🔢", label: "Numerology",      desc: "Life Path, Chaldean" },
  { id: "VASTU",            icon: "🏛️", label: "Vastu Shastra",   desc: "Spatial alignment" },
  { id: "PSYCHOLOGIST",     icon: "🧠", label: "Psychology",      desc: "CBT, therapy" },
  { id: "LIFE_COACH",       icon: "🎯", label: "Life Coaching",   desc: "Career & life" },
  { id: "HEALER",           icon: "✨", label: "Energy Healing",  desc: "Reiki, pranic" },
  { id: "SPIRITUAL_GUIDE",  icon: "🕉️", label: "Spiritual Guide", desc: "Meditation, guidance" },
];

const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const;
type Day = typeof DAYS[number];
type Block = { start: string; end: string };
type Availability = Record<Day, Block[]>;

const DEFAULT_AVAIL: Availability = {
  monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [],
};

interface ConsultantState {
  category: string | null;
  specialties: string[] | null;
  bio: string | null;
  perMinuteRate: number | null;
  languages: string[] | null;
  availability: unknown;
}

export default function ApplyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [category, setCategory] = useState<string>("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specialtyInput, setSpecialtyInput] = useState("");
  const [rate, setRate] = useState(50);
  const [bio, setBio] = useState("");
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [langInput, setLangInput] = useState("");
  const [availability, setAvailability] = useState<Availability>(DEFAULT_AVAIL);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/consultant/pulse", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const c: ConsultantState | undefined = data?.consultant;
          if (c) {
            if (c.category) setCategory(c.category);
            if (c.specialties?.length) setSpecialties(c.specialties);
            if (c.bio) setBio(c.bio);
            if (c.perMinuteRate) setRate(c.perMinuteRate);
            if (c.languages?.length) setLanguages(c.languages);
            if (c.availability && typeof c.availability === "object") {
              setAvailability({ ...DEFAULT_AVAIL, ...(c.availability as Availability) });
            }
          }
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const save = async (patch: Record<string, unknown>): Promise<{ ok: boolean; isLive?: boolean; error?: string }> => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/consultant/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");
      setSaving(false);
      return { ok: true, isLive: data?.isLive };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
      return { ok: false, error: String(err) };
    }
  };

  const finish = async () => {
    // Final save with full state
    const res = await save({
      category, specialties, bio, perMinuteRate: rate, languages, availability,
    });
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => router.push("/consultant/dashboard"), 1500);
    }
  };

  const uploadAvatar = async (): Promise<void> => {
    if (!avatarFile) return;
    const fd = new FormData();
    fd.append("avatar", avatarFile);
    try {
      const res = await fetch("/api/users/me/avatar", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
    } catch (err) { setError(err instanceof Error ? err.message : "Upload failed"); }
  };

  const addSpecialty = () => {
    const t = specialtyInput.trim();
    if (t && !specialties.includes(t)) setSpecialties([...specialties, t]);
    setSpecialtyInput("");
  };
  const addLang = () => {
    const t = langInput.trim();
    if (t && !languages.includes(t)) setLanguages([...languages, t]);
    setLangInput("");
  };

  const addBlock = (d: Day) =>
    setAvailability({ ...availability, [d]: [...availability[d], { start: "09:00", end: "12:00" }] });
  const rmBlock = (d: Day, i: number) =>
    setAvailability({ ...availability, [d]: availability[d].filter((_, idx) => idx !== i) });
  const updBlock = (d: Day, i: number, key: "start" | "end", v: string) => {
    const next = availability[d].map((b, idx) => (idx === i ? { ...b, [key]: v } : b));
    setAvailability({ ...availability, [d]: next });
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#9D7DC5]" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6">
            <Check size={36} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">You're live</h1>
          <p className="text-slate-400 text-sm">Routing to your Command Center…</p>
        </div>
      </div>
    );
  }

  const totalSteps = 5;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold mb-3">
          <Sparkles size={13} /> Profile Builder
        </div>
        <h1 className="text-2xl lg:text-3xl font-black text-white">Complete your profile</h1>
        <p className="text-sm text-slate-400 mt-1">Step {step} of {totalSteps} — save any time, resume later.</p>
      </div>

      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((n) => (
          <div key={n} className="flex-1 flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
              step >= n ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white" : "bg-slate-800 text-slate-500"
            }`}>
              {step > n ? <Check size={13} /> : n}
            </div>
            {n < totalSteps && (
              <div className={`flex-1 h-0.5 rounded-full transition-all ${step > n ? "bg-indigo-500" : "bg-slate-800"}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-bold flex items-center gap-2.5">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 lg:p-8">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-xl font-black text-white mb-1">Discipline & Specialties</h2>
              <p className="text-sm text-slate-400 mb-6">Choose your primary practice and list specializations.</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {CATEGORIES.map((c) => (
                  <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                      category === c.id ? "border-indigo-500 bg-indigo-500/10" : "border-white/5 bg-slate-950 hover:border-white/20"
                    }`}>
                    <div className="text-2xl mb-2">{c.icon}</div>
                    <p className="font-bold text-slate-100 text-xs">{c.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{c.desc}</p>
                  </button>
                ))}
              </div>

              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Specialties</label>
              <div className="flex gap-2 mb-3">
                <input type="text" value={specialtyInput} onChange={(e) => setSpecialtyInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSpecialty())}
                  placeholder="e.g., KP Astrology"
                  className="flex-1 px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-sm text-white outline-none focus:border-indigo-500" />
                <button type="button" onClick={addSpecialty}
                  className="px-4 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-500">Add</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {specialties.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold">
                    {s}
                    <button onClick={() => setSpecialties(specialties.filter((x) => x !== s))} className="hover:text-white">×</button>
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-xl font-black text-white mb-1">Set your rate</h2>
              <p className="text-sm text-slate-400 mb-6">Per-minute consultation charge (₹10 – ₹500).</p>

              <div className="p-6 bg-slate-950/50 rounded-3xl border border-white/5 mb-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <IndianRupee className="w-8 h-8 text-emerald-400" />
                  <span className="text-5xl font-black font-mono text-white">{rate}</span>
                </div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-6">per minute</p>
                <input type="range" min={10} max={500} step={10} value={rate}
                  onChange={(e) => setRate(Number(e.target.value))} className="w-full accent-indigo-500" />
                <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-mono">
                  <span>₹10</span><span>₹500</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/5">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Your cut (90%)</p>
                    <p className="text-lg font-black font-mono text-emerald-400">₹{Math.round(rate * 0.9)}/min</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Platform (10%)</p>
                    <p className="text-lg font-black font-mono text-slate-400">₹{Math.round(rate * 0.1)}/min</p>
                  </div>
                </div>
              </div>

              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Languages</label>
              <div className="flex gap-2 mb-3">
                <input type="text" value={langInput} onChange={(e) => setLangInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLang())}
                  placeholder="e.g., Hindi"
                  className="flex-1 px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-sm text-white outline-none focus:border-indigo-500" />
                <button type="button" onClick={addLang}
                  className="px-4 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-500">Add</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {languages.map((l) => (
                  <span key={l} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 text-xs font-bold">
                    {l}
                    <button onClick={() => setLanguages(languages.filter((x) => x !== l))} className="hover:text-white">×</button>
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-xl font-black text-white mb-1">Professional bio</h2>
              <p className="text-sm text-slate-400 mb-6">Describe your lineage, certifications, and approach (min 20 chars).</p>

              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={8}
                placeholder="I have practiced Vedic astrology for over 15 years, trained under…"
                className={`w-full p-5 bg-slate-950 border rounded-2xl text-sm outline-none text-slate-200 resize-none transition-colors ${
                  bio.length > 0 && bio.trim().length < 20 ? "border-rose-500/40" : "border-white/10 focus:border-indigo-500"
                }`} />
              <div className="flex justify-between text-[11px] mt-2">
                <span className={bio.trim().length >= 20 ? "text-emerald-400 font-medium" : "text-slate-500"}>
                  {bio.trim().length >= 20 ? "✓ Bio meets minimum" : `Minimum 20 characters (${bio.trim().length}/20)`}
                </span>
                <span className="text-slate-600 font-mono">{bio.length}/1000</span>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-xl font-black text-white mb-1">Weekly availability</h2>
              <p className="text-sm text-slate-400 mb-6">When can seekers book you? Add time blocks per day.</p>

              <div className="space-y-3">
                {DAYS.map((d) => (
                  <div key={d} className="p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-white capitalize">{d}</p>
                      <button type="button" onClick={() => addBlock(d)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 text-xs font-bold hover:bg-indigo-500/20">
                        <Plus size={11} /> Add
                      </button>
                    </div>
                    {availability[d].length === 0 ? (
                      <p className="text-xs text-slate-600 italic">No availability</p>
                    ) : (
                      <div className="space-y-2">
                        {availability[d].map((b, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input type="time" value={b.start} onChange={(e) => updBlock(d, i, "start", e.target.value)}
                              className="flex-1 px-3 py-2 bg-slate-900 border border-white/5 rounded-lg text-sm text-white font-mono" />
                            <span className="text-slate-500 text-xs">to</span>
                            <input type="time" value={b.end} onChange={(e) => updBlock(d, i, "end", e.target.value)}
                              className="flex-1 px-3 py-2 bg-slate-900 border border-white/5 rounded-lg text-sm text-white font-mono" />
                            <button type="button" onClick={() => rmBlock(d, i)}
                              className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-400">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div key="s5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-xl font-black text-white mb-1">Profile photo</h2>
              <p className="text-sm text-slate-400 mb-6">A clear headshot builds trust with seekers.</p>

              <div className="flex flex-col items-center gap-4">
                <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden border-4 border-slate-900">
                  {avatarFile ? (
                    <img src={URL.createObjectURL(avatarFile)} alt="Avatar preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-10 h-10 text-white/50" />
                  )}
                </div>
                <label className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold cursor-pointer hover:bg-white/10 inline-flex items-center gap-2">
                  <Upload size={14} /> {avatarFile ? "Change photo" : "Choose photo"}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} />
                </label>
                <p className="text-[11px] text-slate-500 max-w-xs text-center">
                  Optional. You can add this later from Settings.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-3 mt-8">
          {step > 1 && (
            <button type="button" onClick={() => setStep(step - 1)} disabled={saving}
              className="px-5 py-3.5 rounded-2xl bg-slate-900/60 border border-white/5 text-white text-sm font-bold hover:bg-slate-900 flex items-center gap-1.5 disabled:opacity-50">
              <ChevronLeft size={15} /> Back
            </button>
          )}

          {step < totalSteps ? (
            <button type="button"
              disabled={saving || (step === 1 && !category)}
              onClick={async () => {
                // Persist current step before advancing
                let patch: Record<string, unknown> = {};
                if (step === 1) patch = { category, specialties };
                if (step === 2) patch = { perMinuteRate: rate, languages };
                if (step === 3) patch = { bio };
                if (step === 4) patch = { availability };
                if (Object.keys(patch).length > 0) {
                  const r = await save(patch);
                  if (!r.ok) return;
                }
                setStep(step + 1);
              }}
              className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-black hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : <>Continue <ChevronRight size={15} /></>}
            </button>
          ) : (
            <button type="button" onClick={async () => { if (avatarFile) await uploadAvatar(); await finish(); }}
              disabled={saving || !category || bio.trim().length < 20}
              className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-black hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <><Loader2 size={15} className="animate-spin" /> Finalizing…</> : <><Check size={15} /> Go Live</>}
            </button>
          )}
        </div>
      </div>

      <div className="text-center">
        <Link href="/consultant/dashboard" className="text-xs text-slate-500 hover:text-slate-300">
          Skip for now — finish later
        </Link>
      </div>
    </div>
  );
}
EOF

# ═══════════ api/consultant/profile/route.ts ═══════════
wf apps/web/app/api/consultant/profile/route.ts << 'EOF'
import { NextResponse } from "next/server";
import { createServerClientFromCookies, evaluateConsultantProfile } from "@zeal/database/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  category: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  bio: z.string().max(1000).optional(),
  perMinuteRate: z.number().min(10).max(500).optional(),
  languages: z.array(z.string()).optional(),
  availability: z.record(z.array(z.object({ start: z.string(), end: z.string() }))).optional(),
}).strict();

export async function PATCH(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
  }

  const patch = parsed.data;
  const { data: consultant } = await supabase
    .from("Consultant").select("id").eq("userId", user.id).maybeSingle();
  if (!consultant) return NextResponse.json({ error: "No consultant profile" }, { status: 404 });

  const { error } = await supabase.from("Consultant").update(patch).eq("id", consultant.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: updated } = await supabase
    .from("Consultant")
    .select("bio, perMinuteRate, specialties, languages, availability, category")
    .eq("id", consultant.id).maybeSingle();

  const report = evaluateConsultantProfile(updated);
  return NextResponse.json({ success: true, isLive: report.isLive, score: report.score });
}
EOF

# ═══════════ availability/page.tsx ═══════════
wf apps/web/app/consultant/availability/page.tsx << 'EOF'
"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Save, Check } from "lucide-react";

const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const;
type Day = typeof DAYS[number];
type Block = { start: string; end: string };
type Availability = Record<Day, Block[]>;

const EMPTY: Availability = {
  monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [],
};

export default function AvailabilityPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [availability, setAvailability] = useState<Availability>(EMPTY);
  const [bufferMinutes, setBufferMinutes] = useState(10);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/consultant/availability", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.availability && typeof data.availability === "object") {
            setAvailability({ ...EMPTY, ...data.availability });
          }
          if (typeof data.bufferMinutes === "number") setBufferMinutes(data.bufferMinutes);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const add = (d: Day) =>
    setAvailability({ ...availability, [d]: [...availability[d], { start: "09:00", end: "12:00" }] });
  const rm = (d: Day, i: number) =>
    setAvailability({ ...availability, [d]: availability[d].filter((_, idx) => idx !== i) });
  const upd = (d: Day, i: number, key: "start" | "end", v: string) => {
    const next = availability[d].map((b, idx) => (idx === i ? { ...b, [key]: v } : b));
    setAvailability({ ...availability, [d]: next });
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/consultant/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability, bufferMinutes }),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } catch {}
    setSaving(false);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#9D7DC5]" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-white">Weekly Schedule</h1>
        <p className="text-sm text-slate-400 mt-1">Configure when seekers can book you.</p>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-5 lg:p-6 space-y-4">
        {DAYS.map((d) => (
          <div key={d} className="p-4 bg-slate-950/50 rounded-2xl border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-white capitalize">{d}</p>
              <button onClick={() => add(d)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 text-xs font-bold hover:bg-indigo-500/20">
                <Plus size={11} /> Add block
              </button>
            </div>
            {availability[d].length === 0 ? (
              <p className="text-xs text-slate-600 italic">Unavailable</p>
            ) : (
              <div className="space-y-2">
                {availability[d].map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="time" value={b.start} onChange={(e) => upd(d, i, "start", e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-900 border border-white/5 rounded-lg text-sm text-white font-mono" />
                    <span className="text-slate-500 text-xs">to</span>
                    <input type="time" value={b.end} onChange={(e) => upd(d, i, "end", e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-900 border border-white/5 rounded-lg text-sm text-white font-mono" />
                    <button onClick={() => rm(d, i)} className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-400">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="pt-4 border-t border-white/5">
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
            Buffer between sessions
          </label>
          <select value={bufferMinutes} onChange={(e) => setBufferMinutes(Number(e.target.value))}
            className="px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-sm text-white outline-none focus:border-indigo-500">
            {[5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n} minutes</option>)}
          </select>
        </div>

        <button onClick={save} disabled={saving}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-black hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> :
           saved  ? <><Check size={15} /> Saved</> :
                    <><Save size={15} /> Save changes</>}
        </button>
      </div>
    </div>
  );
}
EOF

# ═══════════ Verify ═══════════
for ws in packages/database apps/web apps/admin; do
  pushd "$ws" >/dev/null 2>&1 || continue
  if npx --no-install tsc --noEmit --pretty false >/tmp/p4-$ws.log 2>&1; then
    OK "$ws clean"
  else
    n=$(grep -c 'error TS' /tmp/p4-$ws.log 2>/dev/null | tr -d '[:space:]'); [[ -z "$n" ]] && n=0
    BAD "$ws — $n errors"
    grep 'error TS' /tmp/p4-$ws.log | head -12 | sed 's/^/   /'
    FAILED=1
  fi
  popd >/dev/null 2>&1
done

if [[ $FAILED -eq 0 ]]; then
  git add -A 2>/dev/null
  git reset -- _archive/ .zeal/ 2>/dev/null
  staged=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d '[:space:]')
  if [[ "${staged:-0}" -gt 0 ]]; then
    git commit -m "Phase 4: consultant dashboard + profile builder + online gate

- layout: loads consultant + wallet + completeness
- WorkspaceSidebar: completeness ring, subdomain copy, mobile nav
- StudioClient: banner when incomplete, gated online toggle
- apply: 5-step profile builder (category/rate/bio/availability/avatar)
- availability: weekly grid editor
- /api/consultant/online: 403 PROFILE_INCOMPLETE if not live
- /api/consultant/profile: PATCH with zod validation" >/dev/null 2>&1 \
      && OK "committed $(git rev-parse --short HEAD)" \
      && git push origin main >/dev/null 2>&1 \
      && OK "pushed"
  else
    OK "nothing to commit"
  fi
else
  BAD "typecheck failed — not committing"
fi
