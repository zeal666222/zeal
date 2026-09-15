"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { ShieldAlert, Users, Wallet, Activity, ArrowUpRight, CheckCircle2, RefreshCw } from "lucide-react";

export default function AdminDashboardPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalUsers: 0, totalConsultants: 0, totalVolume: 124500 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zyrunsnweznyrhuroduo.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5cnVuc253ZXpueXJodXJvZHVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0OTc2MDgsImV4cCI6MjEwMzA3MzYwOH0.kOPtlaJvT0fnGYit6dG43rekXDin3HoinUNrFB8vtL0";
  const supabase = createBrowserClient(supabaseUrl, supabaseKey);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (!error && data) {
      setProfiles(data);
      const users = data.filter(p => p.role === 'user').length;
      const consultants = data.filter(p => p.role === 'consultant').length;
      setStats({ totalUsers: users, totalConsultants: consultants, totalVolume: 124500 });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 sm:p-10">
      <div className="max-w-[88rem] mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold mb-3">
              <ShieldAlert size={14} /> SuperAdmin Secure Command Center
            </div>
            <h1 className="text-4xl font-black tracking-tight">Platform Telemetry & Governance</h1>
          </div>

          <button 
            onClick={fetchAdminData}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 border border-white/10 rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh Nodes
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-6 shadow-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">Total Seekers</p>
              <h3 className="text-3xl font-black font-mono">{stats.totalUsers}</h3>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Users size={24} />
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-6 shadow-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">Active Consultants</p>
              <h3 className="text-3xl font-black font-mono">{stats.totalConsultants}</h3>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-6 shadow-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">Platform Volume (INR)</p>
              <h3 className="text-3xl font-black font-mono text-emerald-400">₹{stats.totalVolume.toLocaleString('en-IN')}</h3>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Wallet size={24} />
            </div>
          </div>
        </div>

        {/* Profiles Table */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-6 sm:p-8 shadow-xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Activity size={18} className="text-purple-400" /> Real-Time User & Consultant Directory
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs font-mono text-slate-400 uppercase">
                  <th className="py-4 px-4">User / Partner</th>
                  <th className="py-4 px-4">Role Tier</th>
                  <th className="py-4 px-4">Wallet Balance</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-4">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-4 px-4 font-semibold">{p.full_name || "Anonymous Member"}</td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${p.role === 'consultant' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : p.role === 'admin' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                        {p.role}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono text-emerald-400">₹{Number(p.wallet_balance || 0).toFixed(2)}</td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                        <span className={`w-2 h-2 rounded-full ${p.is_online ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                        {p.is_online ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs font-mono text-slate-500">{new Date(p.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
