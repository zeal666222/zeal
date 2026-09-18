// apps/admin/app/consultant/dashboard/page.tsx
import { createServerClientFromCookies, evaluateConsultantProfile } from "@zeal/database/server";
import { redirect } from "next/navigation";
import { StudioClient } from "@/components/consultant/StudioClient";

export const dynamic = "force-dynamic";

interface UserRow { id: string; name: string | null; is_online: boolean | null }
interface WalletRow { balance: number }
interface ConsultantRow {
  id: string; bio: string | null; perMinuteRate: number | null;
  specialties: string[] | null; languages: string[] | null;
  availability: unknown; category: string | null; subdomain: string | null;
  rating: number | null; totalConsultations: number | null; sparkScore: number | null;
}

export default async function ConsultantDashboardPage() {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [uRes, wRes, cRes] = await Promise.all([
    supabase.from("User").select("id, name, is_online").eq("id", user.id).maybeSingle(),
    supabase.from("Wallet").select("balance").eq("userId", user.id).maybeSingle(),
    supabase.from("Consultant")
      .select("id, bio, perMinuteRate, specialties, languages, availability, category, subdomain, rating, totalConsultations, sparkScore")
      .eq("userId", user.id).maybeSingle(),
  ]);

  const u = uRes.data as UserRow | null;
  const w = wRes.data as WalletRow | null;
  const c = cRes.data as ConsultantRow | null;
  if (!c) redirect("/register?type=consultant");

  const completeness = evaluateConsultantProfile({
    bio: c.bio, perMinuteRate: c.perMinuteRate, specialties: c.specialties,
    languages: c.languages, availability: c.availability, category: c.category,
  });

  return (
    <StudioClient
      initialProfile={{
        id: user.id,
        full_name: u?.name ?? "Consultant",
        wallet_balance: w?.balance ?? 0,
        is_online: u?.is_online ?? false,
      }}
      completeness={completeness}
      subdomain={c.subdomain}
      stats={{
        sessions: c.totalConsultations ?? 0,
        rating: c.rating ?? 5.0,
        sparkScore: c.sparkScore ?? 0,
      }}
    />
  );
}
