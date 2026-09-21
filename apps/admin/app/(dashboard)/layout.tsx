// apps/admin/app/(dashboard)/layout.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// SERVER guard. Reads role from DB. No middleware, no JWT claims.
// ═══════════════════════════════════════════════════════════════════════════════

import { requireAdminPortal } from "@zeal/database/session";
import { DashboardShell } from "@/components/layout/DashboardShell";

export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role } = await requireAdminPortal();

  return (
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
        avatar:
          (user.user_metadata?.avatar_url as string | undefined) ?? null,
      }}
    >
      {children}
    </DashboardShell>
  );
}
