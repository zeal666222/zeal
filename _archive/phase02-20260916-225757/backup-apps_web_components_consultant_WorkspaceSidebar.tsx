"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Calendar,
  Users,
  DollarSign,
  Clock,
  Palette,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { cn } from "@zeal/ui";
import { useAppStore } from "@/lib/store/appStore";

interface WorkspaceSidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
  };
  consultant: {
    status: string;
    subdomain?: string | null;
  };
}

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Pulse", href: "/consultant/dashboard" },
  { icon: Calendar, label: "Bookings", href: "/consultant/bookings" },
  { icon: Users, label: "Clients", href: "/consultant/clients" },
  { icon: DollarSign, label: "Earnings", href: "/consultant/earnings" },
  { icon: Clock, label: "Availability", href: "/consultant/availability" },
  { icon: Palette, label: "White-Label", href: "/consultant/white-label" },
  { icon: Settings, label: "Settings", href: "/consultant/settings" },
];

export function WorkspaceSidebar({ user, consultant }: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAppStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  const SidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-5 border-b border-[#E1C5E7] dark:border-gray-800">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9D7DC5] to-[#533AFD] flex items-center justify-center text-white font-semibold flex-shrink-0">
          {(user.name || user.email || "C").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#5E4B8B] dark:text-white truncate">
            {user.name || "Consultant"}
          </p>
          <p className="text-xs text-[#B8A1D9] truncate">
            {consultant.status === "VERIFIED" ? "Verified" : consultant.status}
          </p>
        </div>
      </div>

      {/* Subdomain link */}
      {consultant.subdomain && consultant.status === "VERIFIED" && (
        <Link
          href={`/white-label/${consultant.subdomain}`}
          target="_blank"
          className="mx-3 mt-3 flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[#9D7DC5]/10 hover:bg-[#9D7DC5]/20 transition-colors"
        >
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-[#9D7DC5]">
              Your Site
            </p>
            <p className="text-xs font-medium text-[#5E4B8B] dark:text-white truncate">
              {consultant.subdomain}.zeal.com
            </p>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-[#9D7DC5] flex-shrink-0" />
        </Link>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
                active
                  ? "bg-gradient-to-r from-[#9D7DC5]/20 to-[#533AFD]/10 text-[#9D7DC5]"
                  : "text-[#5E4B8B] dark:text-gray-300 hover:bg-[#F4E8F7] dark:hover:bg-gray-800",
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium flex-1">{item.label}</span>
              {active && (
                <ChevronRight className="w-4 h-4 text-[#9D7DC5]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-[#E1C5E7] dark:border-gray-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-[#E1C5E7] dark:border-gray-800 flex items-center justify-between px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-[#F4E8F7] dark:hover:bg-gray-800"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-[#5E4B8B] dark:text-white" />
        </button>
        <span className="text-sm font-semibold text-[#5E4B8B] dark:text-white">
          Workspace
        </span>
        <div className="w-9" />
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col fixed top-0 left-0 w-64 h-screen bg-white dark:bg-gray-900 border-r border-[#E1C5E7] dark:border-gray-800 z-30">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="lg:hidden fixed top-0 left-0 z-50 w-72 h-screen bg-white dark:bg-gray-900 shadow-2xl"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-[#F4E8F7] dark:hover:bg-gray-800"
                aria-label="Close menu"
              >
                <X className="w-5 h-5 text-[#5E4B8B] dark:text-white" />
              </button>
              {SidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Mobile spacer for top bar */}
      <div className="lg:hidden h-14" />
    </>
  );
}

// BATCH_F3_APPLIED
