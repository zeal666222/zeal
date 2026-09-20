"use client";

import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import {useState} from "react";
import {LayoutDashboard, Calendar, Users, DollarSign, Clock, Palette, Settings, LogOut, Menu, X, Copy, Check, MessageCircle, type LucideIcon} from "lucide-react";
import {cn} from "@zeal/ui";
import type { CompletenessReport } from "@zeal/types";

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  mobile?: boolean;
}

const NAV: NavItem[] = [
  { icon: LayoutDashboard, label: "Pulse",       href: "/consultant/dashboard",    mobile: true },
  { icon: MessageCircle,   label: "Chat",        href: "/consultant/chat",         mobile: true },
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
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const logout = async () => {
    try { await fetch("/api/auth/signout", { method: "POST" }); } catch { /* ignore */ }
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
          <button type="button" aria-label="Close overlay" onClick={() => setOpen(false)} className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
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
