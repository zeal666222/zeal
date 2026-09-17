import { redirect } from "next/navigation";
import { createServerClientFromCookies, evaluateConsultantProfile } from "@zeal/database/server";
import { WorkspaceSidebar } from "@/components/consultant/WorkspaceSidebar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consultant Studio | Zeal" };

interface ProfileRow { id: string; name: string | null; email: string | null; avatar: string | null; role: string; }
interface ConsultantRow {
  id: string; status: string; subdomain: string | null; isActive: boolean;
  bio: string | null; perMinuteRate: number | null; specialties: string[] | null;
  languages: string[] | null; availability: unknown; category: string | null;
}

export default async function ConsultantLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectedFrom=/consultant/dashboard");

  const [profileRes, consultantRes] = await Promise.all([
    supabase.from("User").select("id, name, email, avatar, role").eq("id", user.id).maybeSingle(),
    supabase.from("Consultant")
      .select("id, status, subdomain, isActive, bio, perMinuteRate, specialties, languages, availability, category")
      .eq("userId", user.id).maybeSingle(),
  ]);

  const profile = profileRes.data as ProfileRow | null;
  const consultant = consultantRes.data as ConsultantRow | null;
  if (!consultant) redirect("/apply");
  if (consultant.status === "SUSPENDED") redirect("/suspended");

  const { count: pendingCount } = await supabase
    .from("Booking").select("*", { count: "exact", head: true })
    .eq("consultantId", consultant.id).eq("status", "PENDING");

  const completeness = evaluateConsultantProfile({
    bio: consultant.bio, perMinuteRate: consultant.perMinuteRate,
    specialties: consultant.specialties, languages: consultant.languages,
    availability: consultant.availability, category: consultant.category,
  });

  return (
    <div className="min-h-screen-app bg-slate-950 text-slate-50">
      <WorkspaceSidebar
        user={{ name: profile?.name ?? null, email: profile?.email ?? null, avatar: profile?.avatar ?? null }}
        consultant={{ status: consultant.status, subdomain: consultant.subdomain }}
        completeness={completeness}
        pendingBookings={pendingCount ?? 0}
      />
      <main className="lg:ml-64 min-h-screen-app pb-20 lg:pb-8">
        <div className="pt-14 lg:pt-0">
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
