// apps/web/app/(dashboard)/layout.tsx
// SERVER guard. Reads role from DB. No middleware.

import { redirect } from "next/navigation";
import { getSession } from "@zeal/database/session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getSession();
  if (!user) redirect("/login");
  return <>{children}</>;
}
