"use client";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { IconHome, IconExplore, IconChat, IconProfile, IconZeal } from "@/components/icons";
import { useAppStore } from "@/lib/store/appStore";
import { cn } from "@/lib/utils";
import type { ComponentType, SVGProps } from "react";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

interface Tab {
  readonly icon: IconComponent;
  readonly label: string;
  readonly href: string;
  readonly center?: boolean;
}

const TABS: readonly Tab[] = [
  { icon: IconHome, label: "Home", href: "/dashboard" },
  { icon: IconExplore, label: "Explore", href: "/explore" },
  { icon: IconZeal, label: "Zeal", href: "/services", center: true },
  { icon: IconChat, label: "Chats", href: "/chat" },
  { icon: IconProfile, label: "Profile", href: "/profile" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const unreadCount = useAppStore((s) => s.unreadCount);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 safe-area-padding-bottom"
      aria-label="Main navigation"
    >
      <div className="absolute inset-0 bar-purple-bottom" />
      <div className="absolute inset-0 backdrop-blur-2xl bg-black/5 dark:bg-white/5" />
      <div className="relative flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {TABS.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          const Icon = tab.icon;
          const showBadge = tab.label === "Chats" && unreadCount > 0;

          if (tab.center) {
            return (
              <button
                key={tab.href}
                onClick={() => router.push(tab.href)}
                className="relative group -mt-4"
                aria-label="Zeal Services"
              >
                <motion.div
                  whileTap={{ scale: 0.92, y: 2 }}
                  whileHover={{ scale: 1.08, y: -6 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-[#9D7DC5] via-[#7A5A9E] to-[#533AFD] shadow-[0_6px_0_0_#3D2A5A,0_12px_32px_rgba(83,58,253,0.5)] border-2 border-white/20"
                >
                  <Icon className="w-6 h-6 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" />
                </motion.div>
                <span className="block text-[10px] font-semibold text-white/80 mt-1 uppercase">
                  Zeal
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              className="relative flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl hover:bg-white/15 active:scale-95 transition-all"
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "w-5 h-5 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-all",
                  isActive ? "opacity-100 scale-110" : "opacity-60",
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium text-white transition-all",
                  isActive ? "opacity-100 font-semibold" : "opacity-60",
                )}
              >
                {tab.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId={"tab-indicator-" + tab.href}
                  className="absolute -top-0.5 w-5 h-0.5 bg-white rounded-full"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              {showBadge && (
                <span className="absolute top-0 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

