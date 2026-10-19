// apps/web/app/admin/(portal)/layout.tsx
// Server-side gate for the authenticated admin console.
// Anonymous visitors, non-admin users, and SUPER_ADMINs still holding
// must_change_password are redirected before any admin component renders.

import { requireAdminPortal } from "@zeal/database/session";
import { SupabaseAuthProvider } from "@/components/admin/providers/SupabaseAuthProvider";
import { RealtimeProvider } from "@/components/admin/providers/RealtimeProvider";
import { DashboardShell } from "@/components/admin/layout/DashboardShell";

export const dynamic = "force-dynamic";

export default async function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requireAdminPortal({
    loginPath: "/admin/login",
    passwordChangePath: "/admin/change-temporary-password",
  });

  return (
    <SupabaseAuthProvider>
      <RealtimeProvider>
        <DashboardShell
          role={role}
          user={{
            id: user.id,
            email: user.email ?? "",
            name:
              (user.user_metadata?.full_name as string | undefined) ??
              (user.user_metadata?.name as string | undefined) ??
              user.email?.split("@")[0] ??
              "Admin",
            avatar: (user.user_metadata?.avatar_url as string | undefined) ?? null,
          }}
        >
          {children}
        </DashboardShell>
      </RealtimeProvider>
    </SupabaseAuthProvider>
  );
}
