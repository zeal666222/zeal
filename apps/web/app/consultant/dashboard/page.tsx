import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { StudioClient } from "@/components/consultant/StudioClient";

export default async function ConsultantDashboardPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  // Authenticate
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch Full Profile for Studio Bootup
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, wallet_balance, is_online")
    .eq("id", user.id)
    .single();

  const role = profile?.role || "user";
  
  // Ensure only Consultants or Admins can access the studio
  if (role !== "consultant" && !["admin", "superadmin", "super_admin"].includes(role)) {
    redirect("/explore");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-4 sm:p-10 relative overflow-hidden flex flex-col">
      {/* Studio Ambient Lighting */}
      <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-indigo-600/10 blur-[200px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-purple-600/10 blur-[200px] rounded-full pointer-events-none" />
      
      <div className="max-w-7xl mx-auto w-full relative z-10 pt-4 flex-1 flex flex-col">
        {/* Inject the Interactive Client Workspace */}
        <StudioClient initialProfile={{
          full_name: profile?.full_name || "Consultant",
          wallet_balance: profile?.wallet_balance || 0,
          is_online: profile?.is_online || false
        }} />
      </div>
    </div>
  );
}
