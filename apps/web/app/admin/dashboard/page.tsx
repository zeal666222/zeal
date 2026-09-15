import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { 
  Shield, Users, IndianRupee, Activity, Sparkles, 
  AlertTriangle, Terminal, Server, ChevronRight 
} from "lucide-react";
import { ApplicationReviewBoard } from "@/components/admin/ApplicationReviewBoard";

export default async function AdminDashboardPage() {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  const role = profile?.role || "user";
  if (!["admin", "superadmin", "super_admin"].includes(role)) {
    redirect("/explore");
  }

  // Fetch Core Metrics
  const { count: totalUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true });
  
  // Fetch Pending Applications to seed the UI
  const { data: pendingApps } = await supabase
    .from("consultant_applications")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-4 sm:p-10 relative overflow-hidden flex flex-col">
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-rose-600/10 blur-[200px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-purple-600/10 blur-[200px] rounded-full pointer-events-none" />
      
      <div className="max-w-7xl mx-auto w-full relative z-10 pt-4 flex-1 flex flex-col animate-in fade-in duration-700">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6 mb-12 border-b border-white/10 pb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold mb-4 shadow-[0_0_15px_-3px_rgba(244,63,94,0.3)]">
              <Shield size={14} /> {role === "superadmin" ? "Super Administrator" : "System Administrator"}
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">God-View Console</h1>
            <p className="text-slate-400 text-sm mt-2 flex items-center gap-2">
              <Terminal size={14} /> Session authenticated for <strong className="text-slate-200">{profile?.full_name || "Admin"}</strong>.
            </p>
          </div>
          
          <div className="px-5 py-3 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-2xl flex items-center gap-3 shadow-xl">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_2px_rgba(16,185,129,0.5)]" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Server size={14} className="text-emerald-500"/> Core Online
            </span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {[
            { label: "Total Seekers", value: totalUsers || 0, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
            { label: "Platform Revenue", value: "₹---", icon: IndianRupee, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { label: "Pending Apps", value: pendingApps?.length || 0, icon: Sparkles, color: "text-purple-400", bg: "bg-purple-500/10" },
            { label: "System Health", value: "99.9%", icon: Activity, color: "text-rose-400", bg: "bg-rose-500/10" }
          ].map((stat, i) => (
            <div key={i} className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl transition-all duration-300 hover:border-white/20">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{stat.label}</span>
                <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color}`}><stat.icon size={20} /></div>
              </div>
              <div className="text-4xl font-black font-mono tracking-tight">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Administration Modules */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
          
          {/* Main Action Area: Real-Time Applications */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black flex items-center gap-3">
                  <Users className="text-purple-400" /> Pending Consultant Applications
                </h3>
                <span className="px-3 py-1 bg-rose-500/20 border border-rose-500/30 rounded-lg text-xs font-bold text-rose-300 flex items-center gap-2 animate-pulse">
                  <div className="w-1.5 h-1.5 bg-rose-400 rounded-full"/> Live Feed
                </span>
              </div>
              
              {/* Inject the Client Review Board Here */}
              <ApplicationReviewBoard initialApplications={pendingApps || []} />
            </div>
          </div>

          {/* Quick Actions Sidebar */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-rose-500/20 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-40 h-40 bg-rose-500/10 blur-[50px] rounded-full pointer-events-none" />
            <h3 className="text-xl font-black mb-8 flex items-center gap-3 text-rose-400">
              <AlertTriangle size={24} /> God-Tier Controls
            </h3>
            <div className="space-y-4 flex-1">
              {[{ name: "Global Ledger Audit", desc: "Monitor all platform transactions." }, { name: "User Management", desc: "Suspend or elevate accounts." }].map((action, i) => (
                <button key={i} className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-left transition-all group flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-200 mb-1">{action.name}</div>
                    <div className="text-xs text-slate-500">{action.desc}</div>
                  </div>
                  <ChevronRight size={18} className="text-slate-600 group-hover:text-white" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
