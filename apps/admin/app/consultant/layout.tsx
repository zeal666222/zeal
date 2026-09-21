// apps/admin/app/consultant/layout.tsx
// SERVER guard. Reads role from DB. No middleware.

import { redirect } from "next/navigation";
import { getSession } from "@zeal/database/session";
import { AppShell } from "@/components/consultant/AppShell";

export const dynamic = "force-dynamic";

interface ProfileRow {
  id: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: string;
  is_online: boolean | null;
}
interface ConsultantRow {
  id: string;
  status: string;
  subdomain: string | null;
  isActive: boolean;
  bio: string | null;
  perMinuteRate: number | null;
  specialties: string[] | null;
  languages: string[] | null;
  availability: unknown;
  category: string | null;
}

function evaluateCompleteness(c: ConsultantRow): number {
  let s = 0;
  if ((c.bio ?? "").trim().length >= 20) s += 25;
  if ((c.perMinuteRate ?? 0) >= 10) s += 15;
  if ((c.specialties ?? []).length >= 1) s += 15;
  if ((c.languages ?? []).length >= 1) s += 10;
  if (c.category) s += 5;
  const av = c.availability;
  if (av && typeof av === "object" && Object.values(av).some(
    (b: unknown) => Array.isArray(b) && b.length > 0,
  )) s += 30;
  return s;
}

export default async function ConsultantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role, supabase } = await getSession();
  if (!user) redirect("/login?redirectedFrom=/consultant/dashboard");
  if (role !== "CLIENT_ADMIN") redirect("/login?error=wrong_portal");

  const [profileRes, consultantRes] = await Promise.all([
    supabase
      .from("User")
      .select("id, name, email, avatar, role, is_online")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("Consultant")
      .select(
        "id, status, subdomain, isActive, bio, perMinuteRate, specialties, languages, availability, category",
      )
      .eq("userId", user.id)
      .maybeSingle(),
  ]);

  const profile = profileRes.data as ProfileRow | null;
  let consultant = consultantRes.data as ConsultantRow | null;

  if (!consultant) {
    await supabase.rpc("self_heal_user");
    const retry = await supabase
      .from("Consultant")
      .select(
        "id, status, subdomain, isActive, bio, perMinuteRate, specialties, languages, availability, category",
      )
      .eq("userId", user.id)
      .maybeSingle();
    consultant = retry.data as ConsultantRow | null;
  }

  if (!consultant) redirect("/login");

  const pending = await supabase
    .from("Booking")
    .select("*", { count: "exact", head: true })
    .eq("consultantId", consultant.id)
    .eq("status", "PENDING");

  const score = evaluateCompleteness(consultant);

  return (
    <AppShell
      user={{
        name: profile?.name ?? null,
        email: profile?.email ?? user.email ?? "",
        avatar: profile?.avatar ?? null,
      }}
      role="CLIENT_ADMIN"
      subdomain={consultant.subdomain}
      completeness={score}
      isLive={score >= 60 && consultant.status === "VERIFIED"}
      pendingBookings={pending.count ?? 0}
      online={Boolean(profile?.is_online)}
    >
      {children}
    </AppShell>
  );
}
