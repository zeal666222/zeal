import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {adminSignOutAction} from "@/actions/auth";
import {Users, DollarSign, Activity, LogOut, ShieldCheck, Briefcase, Calendar, Star} from "lucide-react";

export default async function AdminLandingPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {cookies: {getAll() { return cookieStore.getAll(); }, setAll() {}}},
  );

  const {data: {user}} = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const {data: profile} = await supabase
    .from("User")
    .select("name, role, wallet_balance")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role as string) || "USER";
  const isConsultant = role === "CLIENT_ADMIN";
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(role);

  return (
    <div className="min-h-screen bg-black text-zinc-200 p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${
            isConsultant
              ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
              : "bg-rose-500/10 border-rose-500/20 text-rose-500"
          }`}>
            {isConsultant ? <Briefcase size={24}/> : <ShieldCheck size={24}/>}
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">{profile?.name || user.email}</h1>
            <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold">
              {isConsultant ? "Consultant Portal" : "Admin Console"}
            </p>
          </div>
        </div>

        <form action={adminSignOutAction}>
          <button type="submit" className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all">
            <LogOut size={14} /> Sign Out
          </button>
        </form>
      </div>

      <div className="max-w-7xl mx-auto">
        {isConsultant && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard icon={Calendar} iconClass="text-indigo-400" title="Active Sessions" value="0" note="Appointments pending this week." />
            <StatCard icon={DollarSign} iconClass="text-emerald-400" title="Consultation Revenue" value={`₹${profile?.wallet_balance ?? 0}`} note="Available for withdrawal." />
            <StatCard icon={Star} iconClass="text-amber-400" title="Seeker Rating" value="5.0" note="Based on verified reviews." />
          </div>
        )}

        {isAdmin && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard icon={Users} iconClass="text-blue-400" title="Total Network Users" value="—" note="Loading…" />
              <StatCard icon={DollarSign} iconClass="text-emerald-400" title="Platform Treasury" value={`₹${profile?.wallet_balance ?? 0}`} note="Total liquid volume." />
              <StatCard icon={Activity} iconClass="text-rose-400" title="System Load" value="Optimum" note="Realtime online." />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({icon: Icon, iconClass, title, value, note}: {
  icon: React.ComponentType<{size?: number; className?: string}>;
  iconClass: string; title: string; value: string; note: string;
}) {
  return (
    <div className="p-6 bg-zinc-900/50 border border-white/5 rounded-2xl">
      <Icon size={28} className={`${iconClass} mb-4`} />
      <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
      <p className="text-3xl font-black mt-4 text-white">{value}</p>
      <p className="text-zinc-500 text-xs mt-2">{note}</p>
    </div>
  );
}
