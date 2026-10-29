"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import {
  BarChart3, Activity, Bot, Calendar, ChevronDown, CreditCard, Eye, Flag,
  Heart, Key, LayoutDashboard, LogOut, Megaphone, Menu, Radio, Scale,
  Settings, Shield, Tag, UserCog, UserPlus, Users, Wallet, X, Zap,
} from "lucide-react";
import { cn, ZealMark } from "@zeal/ui";
import { useAuth } from "@/components/admin/providers/SupabaseAuthProvider";
import { useAdminStore, type AdminRole } from "@/lib/admin/store/adminStore";
import { Avatar, AvatarImage, AvatarFallback } from "@zeal/ui";

export interface NavItem {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  minRole: AdminRole;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const ROLE_LEVEL: Record<AdminRole, number> = {
  VIEWER: 10,
  SUPPORT: 50,
  ADMIN: 80,
  SUPER_ADMIN: 100,
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard", minRole: "VIEWER" },
      { icon: BarChart3, label: "Analytics", href: "/admin/analytics", minRole: "VIEWER" },
      { icon: Activity, label: "Operations", href: "/admin/operations", minRole: "SUPER_ADMIN" },
    ],
  },
  {
    label: "Management",
    items: [
      { icon: Users, label: "Users", href: "/admin/users", minRole: "ADMIN" },
      { icon: UserCog, label: "Consultants", href: "/admin/consultants", minRole: "ADMIN" },
      { icon: Shield, label: "Verification", href: "/admin/verification", minRole: "ADMIN" },
      { icon: Flag, label: "Content", href: "/admin/content", minRole: "SUPPORT" },
      { icon: Calendar, label: "Bookings", href: "/admin/bookings", minRole: "SUPPORT" },
    ],
  },
  {
    label: "Finance",
    items: [
      { icon: Wallet, label: "Wallet", href: "/admin/wallet", minRole: "SUPPORT" },
      { icon: CreditCard, label: "Withdrawals", href: "/admin/withdrawals", minRole: "ADMIN" },
      { icon: Tag, label: "Pricing", href: "/admin/pricing-requests", minRole: "ADMIN" },
    ],
  },
  {
    label: "Communication",
    items: [
      { icon: Megaphone, label: "Broadcast", href: "/admin/broadcast", minRole: "ADMIN" },
      { icon: Scale, label: "Moderation", href: "/admin/moderation", minRole: "SUPPORT" },
    ],
  },
  {
    label: "Super Admin",
    items: [
      { icon: Heart, label: "System Health", href: "/admin/system", minRole: "SUPER_ADMIN" },
      { icon: Radio, label: "Realtime", href: "/admin/realtime", minRole: "SUPER_ADMIN" },
      { icon: Bot, label: "AI Training", href: "/admin/ai-training", minRole: "SUPER_ADMIN" },
      { icon: Zap, label: "Impersonate", href: "/admin/impersonate", minRole: "SUPER_ADMIN" },
      { icon: UserPlus, label: "Admins", href: "/admin/settings/admins", minRole: "SUPER_ADMIN" },
      { icon: Key, label: "API Keys", href: "/admin/settings/api-keys", minRole: "SUPER_ADMIN" },
      { icon: Settings, label: "Settings", href: "/admin/settings", minRole: "SUPER_ADMIN" },
    ],
  },
];

export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function AdminSidebar({ role: roleProp }: { role?: AdminRole } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const profile = useAdminStore((s) => s.profile);
  const setProfile = useAdminStore((s) => s.setProfile);
  const notifications = useAdminStore((s) => s.notifications);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    const role = (user.app_metadata?.role as AdminRole | undefined) || "VIEWER";
    setProfile({
      id: user.id,
      email: user.email || "",
      role,
      name: (user.user_metadata?.full_name as string | undefined) || user.email?.split("@")[0] || "Admin",
      avatar: (user.user_metadata?.avatar_url as string | undefined) || null,
      createdAt: user.created_at || new Date().toISOString(),
    });
  }, [user, setProfile]);

  const role = roleProp ?? profile?.role ?? "VIEWER";
  const unreadCount = notifications.filter((n) => !n.read).length;

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const filteredGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => ROLE_LEVEL[role] >= ROLE_LEVEL[item.minRole]),
    })).filter((group) => group.items.length > 0);
  }, [role]);

  const handleLogout = async () => {
    await signOut();
    router.push("/admin/login");
  };

  const content = (
    <div className="flex flex-col h-full bg-surface/95 backdrop-blur-xl">
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-border/50">
        <Link href="/admin/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center">
            <ZealMark size={32} />
          </div>
          <div>
            <span className="text-base font-black tracking-[0.14em]" style={{ color: "var(--zeal-g2)" }}>
              ZEAL
            </span>
            <span className="block text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 -mt-0.5">
              Command Center
            </span>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-2.5 rounded-xl hover:bg-surface-raised transition-colors -mr-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Close menu"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin overscroll-contain">
        {filteredGroups.map((group) => {
          const isCollapsed = collapsedGroups[group.label] ?? false;
          const hasActive = group.items.some(
            (item) => pathname === item.href || pathname.startsWith(item.href + "/")
          );

          return (
            <div key={group.label} className="mb-3">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.label)}
                className={cn(
                  "flex items-center justify-between w-full px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] transition-colors min-h-[36px]",
                  hasActive ? "text-rose-400/80" : "text-muted-foreground/50 hover:text-muted-foreground"
                )}
              >
                <span>{group.label}</span>
                <motion.div
                  animate={{ rotate: isCollapsed ? -90 : 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <ChevronDown size={11} />
                </motion.div>
              </button>

              {/* Group Items */}
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-0.5 mt-0.5">
                      {group.items.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group relative min-h-[44px]",
                              isActive
                                ? "bg-gradient-to-r from-rose-500/15 to-rose-500/5 text-rose-400 shadow-sm shadow-rose-500/5"
                                : "text-muted-foreground hover:bg-surface-raised/80 hover:text-foreground"
                            )}
                          >
                            {isActive && (
                              <motion.div
                                layoutId="sidebar-active"
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full bg-rose-500"
                                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                              />
                            )}
                            <item.icon className={cn(
                              "w-[18px] h-[18px] transition-colors shrink-0",
                              isActive ? "text-rose-400" : "text-muted-foreground group-hover:text-foreground"
                            )} />
                            <span className="text-[13px] font-medium flex-1">{item.label}</span>
                            {item.badge && (
                              <span className="px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-400 text-[9px] font-black border border-rose-500/20">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-border/50 space-y-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {/* Notification count */}
        {unreadCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[11px] font-bold text-rose-400">
              {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Profile card */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-raised/50 border border-border/30">
          <Avatar className="w-10 h-10 ring-2 ring-rose-500/20">
            <AvatarImage src={profile?.avatar || undefined} alt={profile?.name || ""} />
            <AvatarFallback className="bg-gradient-to-br from-rose-500 to-rose-700 text-white text-sm font-bold">
              {(profile?.name || profile?.email || "A")[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground truncate">{profile?.name || "Admin"}</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <p className="text-[10px] text-muted-foreground font-medium">
                {role.replace("_", " ")}
              </p>
            </div>
          </div>
          <Eye size={13} className="text-muted-foreground/40" />
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors group min-h-[44px]"
        >
          <LogOut className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          <span className="text-xs font-medium">Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-40 p-2.5 rounded-xl bg-surface/90 backdrop-blur-xl border border-border/60 shadow-lg shadow-black/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-muted-foreground" />
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[268px] shrink-0 h-full border-r border-border/50 bg-surface">
        {content}
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="lg:hidden fixed top-0 left-0 z-50 w-[280px] h-screen bg-surface border-r border-border"
            >
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
