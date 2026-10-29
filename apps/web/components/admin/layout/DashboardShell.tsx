"use client";

import { useEffect } from "react";
import { useAdminStore, type AdminRole } from "@/lib/admin/store/adminStore";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { AdminSidebar } from "@/components/admin/layout/AdminSidebar";
import { AdminTopBar } from "@/components/admin/layout/AdminTopBar";
import { Breadcrumbs } from "@/components/admin/layout/Breadcrumbs";

interface Props {
 role: string;
 user: { id: string; email: string; name: string; avatar: string | null };
 children: React.ReactNode;
}

export function DashboardShell({ role, user, children }: Props) {
 const setProfile = useAdminStore((s) => s.setProfile);

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
 <div className="flex h-[100dvh] flex-col bg-[var(--color-surface-sunken)] overflow-hidden">
 <ImpersonationBanner />
 <div className="flex flex-1 overflow-hidden">
 <AdminSidebar role={role as AdminRole} />
 <div className="flex-1 flex flex-col overflow-hidden min-w-0">
 <AdminTopBar />
 <main className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 lg:p-8">
 <Breadcrumbs />
 <div className="mx-auto max-w-[1600px]">
 {children}
 </div>
 </main>
 </div>
 </div>
 </div>
 );
}
