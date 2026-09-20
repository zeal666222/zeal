import {redirect} from "next/navigation";
import {createServerClientFromCookies} from "@zeal/database/server";
import {AppShell} from "@/components/consultant/AppShell";

export const dynamic = "force-dynamic";

function evaluateCompleteness(c: any): number {
  let s = 0;
  if ((c.bio ?? "").trim().length >= 20) s += 25;
  if ((c.perMinuteRate ?? 0) >= 10) s += 15;
  if ((c.specialties ?? []).length >= 1) s += 15;
  if ((c.languages ?? []).length >= 1) s += 10;
  if (c.category) s += 5;
  const av = c.availability;
  if (av && typeof av === "object" && Object.values(av).some((b: any) => Array.isArray(b) && b.length > 0)) s += 30;
  return s;
}

export default async function ConsultantLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectedFrom=/consultant/dashboard");

  const [profileRes, consultantRes] = await Promise.all([
    supabase.from("User").select("id, name, email, avatar, role, is_online").eq("id", user.id).maybeSingle(),
    supabase.from("Consultant").select("id, status, subdomain, isActive, bio, perMinuteRate, specialties, languages, availability, category").eq("userId", user.id).maybeSingle(),
  ]);

  let consultant = consultantRes.data;
  if (!consultant) {
    await supabase.rpc("self_heal_user");
    consultant = (await supabase.from("Consultant").select("id, status, subdomain, isActive, bio, perMinuteRate, specialties, languages, availability, category").eq("userId", user.id).maybeSingle()).data;
  }
  if (!consultant) redirect("/login");

  const pending = await supabase
    .from("Booking")
    .select("*", { count: "exact", head: true })
    .eq("consultantId", consultant.id)
    .eq("status", "PENDING");

  const profile = profileRes.data;
  const score = evaluateCompleteness(consultant);

  return (
    <AppShell
      user={{ name: profile?.name ?? null, email: profile?.email ?? user.email ?? "", avatar: profile?.avatar ?? null }}
      role={(profile?.role as any) ?? "CLIENT_ADMIN"}
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
