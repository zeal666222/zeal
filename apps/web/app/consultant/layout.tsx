// apps/web/app/consultant/layout.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Consultant Workspace Layout
//   • Auth check + role guard
//   • Loads consultant profile + wallet
//   • Renders WorkspaceSidebar + main shell
// ═══════════════════════════════════════════════════════════════════════════════

import { redirect } from "next/navigation";
import { createServerClientFromCookies } from "@zeal/database/server";
import { WorkspaceSidebar } from "@/components/consultant/WorkspaceSidebar";

export const metadata = {
  title: "Consultant Studio | Zeal",
  description: "Manage your practice on Zeal",
};

export const dynamic = "force-dynamic";

interface ProfileRow {
  id: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: string;
}
interface ConsultantRow {
  id: string;
  status: string;
  subdomain: string | null;
  isActive: boolean;
}

export default async function ConsultantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClientFromCookies();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectedFrom=/consultant/dashboard");

  const [profileRes, consultantRes] = await Promise.all([
    supabase
      .from("User")
      .select("id, name, email, avatar, role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("Consultant")
      .select("id, status, subdomain, isActive")
      .eq("userId", user.id)
      .maybeSingle(),
  ]);

  const profile = profileRes.data as ProfileRow | null;
  const consultant = consultantRes.data as ConsultantRow | null;

  // Not a consultant → route to /apply
  if (!consultant) {
    redirect("/apply");
  }

  // Count pending bookings for badge
  const { count: pendingCount } = await supabase
    .from("Booking")
    .select("*", { count: "exact", head: true })
    .eq("consultantId", consultant.id)
    .eq("status", "PENDING");

  return (
    <div className="min-h-screen-app bg-slate-950 text-slate-50">
      <WorkspaceSidebar
        user={{
          name: profile?.name ?? null,
          email: profile?.email ?? null,
          avatar: profile?.avatar ?? null,
        }}
        consultant={{
          status: consultant.status,
          subdomain: consultant.subdomain,
        }}
        pendingBookings={pendingCount ?? 0}
      />

      <main className="lg:ml-64 min-h-screen-app pb-20 lg:pb-8">
        <div className="pt-14 lg:pt-0">
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
