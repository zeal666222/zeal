"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { TopNavBar } from "./TopNavBar";
import { BottomNavBar } from "./BottomNavBar";

export type Profile = {
  id: string;
  role: string;
  wallet_balance: number;
  full_name: string;
  avatar_url: string | null;
} | null;

export function AppLayout({
  children,
  user,
  profile,
}: {
  children: React.ReactNode;
  user: { id: string } | null;
  profile: Profile;
}) {
  // ZEAL_PHASE1_APPLIED: app-layout-scroll-root
  // Non-immersive routes use document scroll so Lenis can attach to window.
  // Immersive routes (chat, call) keep a fixed shell with internal scroll.
  const pathname = usePathname();
  const balance = profile?.wallet_balance || 0;
  const hideAppNav = pathname?.startsWith("/consultant");
  const immersive =
    pathname?.startsWith("/chat") || pathname?.startsWith("/call");

  if (immersive) {
    return (
      <div className="flex flex-col h-screen-app overflow-hidden bg-[var(--color-background)] w-full relative">
        <TopNavBar userId={user?.id ?? null} initialBalance={balance} />
        <main
          id="main-content"
          data-lenis-prevent
          className="flex-1 w-full overflow-y-auto custom-scrollbar pt-16"
        >
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen-app bg-[var(--color-background)] w-full relative">
      <TopNavBar userId={user?.id ?? null} initialBalance={balance} />
      <main id="main-content" className="w-full pt-16 pb-28">
        {children}
      </main>
      {!hideAppNav && <BottomNavBar userId={user?.id ?? null} />}
    </div>
  );
}
