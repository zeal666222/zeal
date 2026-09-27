"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Breadcrumbs — derived from the pathname, mounted inside the dashboard shell.
// ═══════════════════════════════════════════════════════════════════════════════

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LayoutDashboard } from "lucide-react";

const LABELS: Record<string, string> = {
 dashboard: "Dashboard",
 "ai-consultants": "AI Consultants",
 analytics: "Analytics",
 audit: "Audit Log",
 bookings: "Bookings",
 broadcast: "Broadcast",
 consultants: "Consultants",
 content: "Content Moderation",
 impersonate: "Impersonation",
 "pricing-requests": "Pricing Requests",
 recordings: "Recordings",
 sessions: "Sessions",
 settings: "Settings",
 admins: "Admins",
 users: "Users",
 verification: "Verification",
 wallet: "Wallet",
 withdrawals: "Withdrawals",
};

export function Breadcrumbs() {
 const pathname = usePathname();
 const segments = pathname.split("/").filter(Boolean);
 if (segments.length === 0) return null;

 return (
 <nav
 aria-label="Breadcrumb"
 className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] mb-4 flex-wrap"
 >
 <Link
 href="/dashboard"
 aria-label="Dashboard"
 className="p-1 rounded-md hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-foreground)] transition-colors"
 >
 <LayoutDashboard size={13} />
 </Link>
 {segments.map((seg, i) => {
 const href = "/" + segments.slice(0, i + 1).join("/");
 const label = LABELS[seg] ?? decodeURIComponent(seg);
 const isLast = i === segments.length - 1;
 return (
 <span key={href} className="flex items-center gap-1">
 <ChevronRight size={12} className="text-[var(--color-subtle-foreground)]" aria-hidden />
 {isLast ? (
 <span aria-current="page" className="font-bold text-[var(--color-foreground)]">
 {label}
 </span>
 ) : (
 <Link
 href={href}
 className="hover:text-[var(--color-foreground)] transition-colors"
 >
 {label}
 </Link>
 )}
 </span>
 );
 })}
 </nav>
 );
}
