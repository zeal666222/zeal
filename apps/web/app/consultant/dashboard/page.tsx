"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { IndianRupee, Zap, PhoneCall, Check, X, LogOut, ShieldCheck, Activity } from "lucide-react";

export default function ConsultantWorkspace() {
  const [profile, setProfile] = useState<any>(null);
  const [earnings, setEarnings] = useState(0);
  const [sparks, setSparks] = useState(0);
  const [requests, setRequests] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
  const supabase = createBrowserClient(supabaseUrl, supabaseKey);

  useEffect(() => {
    fetchWorkspaceData();
    
    // Real-Time Incoming Request Listener
    const channel = supabase.channel('consultant_requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'consultations', filter: `status=eq.PENDING` }, 
        (payload) => {
          // If the request is for THIS consultant, add to queue
          if (payload.new.consultant_id === profile?.id) {
            setRequests(prev => [payload.new, ...prev]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, supabase]);

  const fetchWorkspaceData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch Profile
    const { data: pData } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(pData);
    setIsOnline(pData?.is_online || false);

    // Fetch Total Earnings
    const { data: cData } = await supabase.from("consultations").select("total_cost").eq("consultant_id", user.id);
    const total = cData?.reduce((acc, curr) => acc + (curr.total_cost || 0), 0) || 0;
    setEarnings(total);

    // Fetch Sparks
    const { data: sData } = await supabase.from("sparks").select("total_sparks").eq("consultant_id", user.id).single();
    setSparks(sData?.total_sparks || 0);

    // Fetch Pending Requests
    const { data: rData } = await supabase.from("consultations").select("*").eq("consultant_id", user.id).eq("status", "PENDING");
    if (rData) setRequests(rData);
  };

  const toggleStatus = async () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    await supabase.from("profiles").update({ is_online: newStatus }).eq("id", profile.id);
  };

  const handleAction = async (id: string, action: 'ACTIVE' | 'CANCELLED') => {
    await supabase.from("consultations").update({ status: action }).eq("id", id);
    setRequests(requests.filter(req => req.id !== id));
    
    if (action === 'ACTIVE') {
      window.location.href = `/chat/${id}`;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Master Workspace</h1>
            <p className="text-slate-500 font-medium text-sm flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-500"/> Enterprise Partner Node
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleStatus}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm shadow-md transition-colors ${isOnline ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-200 text-slate-500 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}
            >
              <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {isOnline ? 'Accepting Network Pings' : 'Node Offline'}
            </button>
            <button onClick={() => supabase.auth.signOut().then(() => window.location.href='/login')} className="p-2.5 text-rose-500 bg-rose-50 dark:bg-rose-950/30 rounded-full hover:bg-rose-100 transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Global Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
          <div className="bg-gradient-to-tr from-emerald-600 to-teal-500 p-8 rounded-[2rem] shadow-xl text-white">
            <p className="text-emerald-100 font-bold uppercase text-xs tracking-widest mb-2">Lifetime Generation</p>
            <h2 className="text-4xl font-black flex items-center"><IndianRupee size={32} className="mr-1 opacity-80" /> {earnings.toFixed(2)}</h2>
          </div>
          <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/5 p-8 rounded-[2rem] shadow-xl">
            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest mb-2 flex items-center gap-2"><Zap size={14} className="text-purple-500"/> Algorithmic Sparks</p>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white">{sparks}</h2>
          </div>
          <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/5 p-8 rounded-[2rem] shadow-xl">
            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest mb-2 flex items-center gap-2"><Activity size={14} className="text-blue-500"/> Success Rate</p>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white">98.4%</h2>
          </div>
        </div>

        {/* Incoming Queue */}
        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2rem] shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-center gap-3">
            <PhoneCall className="text-purple-500 animate-pulse" size={24} />
            <h3 className="text-xl font-bold">Incoming Transmissions Queue ({requests.length})</h3>
          </div>
          
          <div className="p-6">
            {requests.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                No active pings. Ensure your status is set to 'Accepting Network Pings'.
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map(req => (
                  <div key={req.id} className="flex flex-col sm:flex-row justify-between items-center p-6 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-white/10">
                    <div className="mb-4 sm:mb-0 text-center sm:text-left">
                      <p className="font-bold text-lg mb-1">{req.service_type} Consultation Request</p>
                      <p className="text-sm text-emerald-500 font-medium">Billed at <IndianRupee size={12} className="inline"/>{req.rate_per_minute}/min</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <button onClick={() => handleAction(req.id, 'CANCELLED')} className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 hover:bg-rose-100 transition-colors flex justify-center items-center gap-2">
                        <X size={18} /> Reject
                      </button>
                      <button onClick={() => handleAction(req.id, 'ACTIVE')} className="flex-1 sm:flex-none px-8 py-3 rounded-xl font-bold bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 transition-colors flex justify-center items-center gap-2">
                        <Check size={18} /> Accept Node
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
