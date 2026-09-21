// apps/web/app/(dashboard)/layout.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Dashboard route group — authenticated UI (chat, wallet, bookings, profile)
// ═══════════════════════════════════════════════════════════════════════════════
import { redirect } from "next/navigation";
import { createServerClientFromCookies } from "@zeal/database/server";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <>{children}</>;
}
