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
  const pathname = usePathname();
  const balance = profile?.wallet_balance || 0;
  const hideAppNav = pathname?.startsWith("/consultant");

  return (
    <div className="flex flex-col h-screen-app overflow-hidden bg-[var(--color-background)] w-full relative">
      <TopNavBar userId={user?.id ?? null} initialBalance={balance} />

      <main className="flex-1 w-full overflow-y-auto custom-scrollbar pt-16 pb-24">
        {children}
      </main>

      {!hideAppNav && <BottomNavBar userId={user?.id ?? null} />}
    </div>
  );
}
