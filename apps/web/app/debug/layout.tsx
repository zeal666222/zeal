// ZEAL_FIX_PHASE1_DEBUG_GATE
// Server-side layout gates the entire /debug route behind an admin role.
// The child page stays a client component; this layout enforces auth before
// the client code ever runs.
import { redirect } from "next/navigation";
import { createServerClientFromCookies } from "@zeal/database/server";

export const dynamic = "force-dynamic";

export default async function DebugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.app_metadata?.role as string) ?? "";
  const allowed = ["ADMIN", "SUPER_ADMIN"];
  if (!user || !allowed.includes(role)) {
    redirect("/login?error=not_authorized");
  }
  return <>{children}</>;
}
