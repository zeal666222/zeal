"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// DashboardShell — client chrome for the admin dashboard.
// Role is passed as a prop from the server layout.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from "react";
import { useAdminStore, type AdminRole } from "@/lib/store/adminStore";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { AdminTopBar } from "@/components/layout/AdminTopBar";

interface Props {
  role: string;
  user: { id: string; email: string; name: string; avatar: string | null };
  children: React.ReactNode;
}

export function DashboardShell({ role, user, children }: Props) {
  const setProfile = useAdminStore((s) => s.setProfile);

  // Hydrate the store once from the server-passed role.
  useEffect(() => {
    setProfile({
      id: user.id,
      email: user.email,
      role: role as AdminRole,
      name: user.name,
      avatar: user.avatar,
      createdAt: new Date().toISOString(),
    });
  }, [setProfile, role, user]);

  return (
    <div className="flex h-screen bg-[#F4E8F7] dark:bg-gray-900 overflow-hidden">
      <ImpersonationBanner />
      <AdminSidebar role={role as AdminRole} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminTopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
