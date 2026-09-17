"use client";
import { useTheme } from "next-themes";
import { Sun, Moon, Sparkles, LogOut, LogIn, Wallet } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarImage, AvatarFallback } from "@zeal/ui";
import { useAuth } from "@/components/providers/SupabaseAuthProvider";
import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store/appStore";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ConnectionBadge } from "@/components/dev/ConnectionBadge";

export function TopBar() {
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const wallet = useAppStore((s) => s.wallet);
  const balance = wallet?.balance || 0;

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-[#E1C5E7] dark:bg-gray-900/80 dark:border-gray-700">
      <div className="flex items-center justify-between h-16 max-w-7xl mx-auto px-4">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="p-2 rounded-full hover:bg-[#F4E8F7] dark:hover:bg-gray-800" aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="w-5 h-5 text-[#9D7DC5]" /> : <Moon className="w-5 h-5 text-[#9D7DC5]" />}
        </motion.button>

        <Link href="/dashboard" className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
          <motion.div whileHover={{ rotate: 15 }}><Sparkles className="w-6 h-6 text-[#9D7DC5]" /></motion.div>
          <span className="text-xl font-bold text-[#5E4B8B] dark:text-white">Zeal</span>
        </Link>

        <div className="flex items-center gap-2">
          <ConnectionBadge />
          {user ? (
            <>
              <NotificationBell />
              <Link href="/wallet" className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#9D7DC5]/10 text-[#9D7DC5] text-xs font-medium hover:bg-[#9D7DC5]/20">
                <Wallet className="w-3.5 h-3.5" /> ₹{balance.toFixed(0)}
              </Link>
              <Link href="/profile" className="p-1 rounded-full hover:ring-2 hover:ring-[#9D7DC5]">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.user_metadata?.avatar_url || user.user_metadata?.avatar} alt={user.email || "User"} />
                  <AvatarFallback>{user.email?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
              </Link>
              <button onClick={signOut} className="p-2 rounded-full hover:bg-[#F4E8F7] dark:hover:bg-gray-800" aria-label="Sign out">
                <LogOut className="w-5 h-5 text-[#5E4B8B] dark:text-white" />
              </button>
            </>
          ) : (
            <Link href="/auth/login" className="flex items-center gap-1 px-3 py-2 rounded-full hover:bg-[#F4E8F7] dark:hover:bg-gray-800">
              <LogIn className="w-5 h-5 text-[#9D7DC5]" />
              <span className="text-sm font-medium text-[#9D7DC5]">Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

