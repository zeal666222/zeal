"use client";

import { useState } from "react";
import { toggleOnlineStatus } from "@/actions/studio";
import { 
  Power, Video, MessageSquare, IndianRupee, 
  Star, Clock, Users, Loader2, Sparkles, Activity 
} from "lucide-react";

type ConsultantProfile = {
  full_name: string;
  wallet_balance: number;
  is_online: boolean;
};

export function StudioClient({ initialProfile }: { initialProfile: ConsultantProfile }) {
  const [isOnline, setIsOnline] = useState(initialProfile.is_online);
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    const res = await toggleOnlineStatus(isOnline);
    if (res.success && res.is_online !== undefined) {
      setIsOnline(res.is_online);
    }
    setToggling(false);
  };

  return (
    <div className="flex-1 flex flex-col z-10 animate-in fade-in duration-700">
      
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6 mb-12 border-b border-white/10 pb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold mb-4 shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)]">
            <Sparkles size={14} /> Consultant Studio
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">Command Center</h1>
          <p className="text-slate-400 text-sm mt-2 flex items-center gap-2">
            Welcome to your workspace, <strong className="text-slate-200">{initialProfile.full_name}</strong>.
          </p>
        </div>
        
        {/* Master Power Switch */}
        <div className="flex items-center gap-4 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-2xl p-2 shadow-xl">
          <div className="px-4">
            <span className={`text-xs font-bold uppercase tracking-wider ${isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
              {isOnline ? 'Accepting Sessions' : 'Currently Offline'}
            </span>
          </div>
          <button 
            onClick={handleToggle}
            disabled={toggling}
            className={`relative w-16 h-10 rounded-full transition-colors duration-300 flex items-center p-1 ${isOnline ? 'bg-emerald-500/20 border border-emerald-500/50' : 'bg-slate-800 border border-slate-700'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 transform ${isOnline ? 'translate-x-6 bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 'translate-x-0 bg-slate-600 text-slate-300'}`}>
              {toggling ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
            </div>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { label: "Studio Earnings", value: `₹${Number(initialProfile.wallet_balance).toFixed(2)}`, icon: IndianRupee, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Active Rating", value: "5.0", icon: Star, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Total Sessions", value: "0", icon: Video, color: "text-indigo-400", bg: "bg-indigo-500/10" },
          { label: "Consultation Hours", value: "0h", icon: Clock, color: "text-purple-400", bg: "bg-purple-500/10" }
        ].map((stat, i) => (
          <div key={i} className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl transition-all duration-300 hover:border-white/20 hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{stat.label}</span>
              <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color}`}><stat.icon size={20} /></div>
            </div>
            <div className="text-4xl font-black font-mono tracking-tight">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Main Workspace Areas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
        
        {/* Real-Time Incoming Queue */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-indigo-500/20 rounded-[2.5rem] p-8 shadow-2xl flex-1 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none" />
            
            <div className="flex items-center justify-between mb-8 relative z-10">
              <h3 className="text-xl font-black flex items-center gap-3">
                <Activity className="text-indigo-400" /> Live Seeker Queue
              </h3>
              {isOnline && (
                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs font-bold text-emerald-400 flex items-center gap-2 animate-pulse">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"/> Searching...
                </span>
              )}
            </div>
            
            <div className={`flex-1 flex items-center justify-center border-2 border-dashed rounded-3xl p-8 relative z-10 transition-colors duration-500 ${isOnline ? 'border-indigo-500/30 bg-indigo-950/20' : 'border-white/5 bg-slate-950/50'}`}>
              <div className="text-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 transition-colors duration-500 ${isOnline ? 'bg-indigo-500/20 text-indigo-400 animate-pulse' : 'bg-white/5 text-slate-500'}`}>
                  {isOnline ? <Users size={32} /> : <Power size={32} />}
                </div>
                <h4 className="text-xl font-bold text-slate-200 mb-2">
                  {isOnline ? "Waiting for connections..." : "Studio is Offline"}
                </h4>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">
                  {isOnline 
                    ? "Your profile is visible to seekers. Incoming chat and video requests will appear here instantly." 
                    : "Toggle your master power switch to online to start receiving live consultation requests."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Tools Sidebar */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl flex flex-col">
          <h3 className="text-xl font-black mb-8 flex items-center gap-3">
            <MessageSquare className="text-slate-400" size={24} /> Communication
          </h3>
          
          <div className="space-y-4 flex-1">
            <div className="w-full p-5 bg-white/5 border border-white/5 rounded-2xl opacity-50 cursor-not-allowed">
              <div className="flex items-center gap-3 mb-2">
                <Video size={18} className="text-slate-400" />
                <div className="text-sm font-bold text-slate-200">Video Gateway</div>
              </div>
              <div className="text-xs text-slate-500">Requires active session</div>
            </div>

            <div className="w-full p-5 bg-white/5 border border-white/5 rounded-2xl opacity-50 cursor-not-allowed">
              <div className="flex items-center gap-3 mb-2">
                <MessageSquare size={18} className="text-slate-400" />
                <div className="text-sm font-bold text-slate-200">Live Chat Bridge</div>
              </div>
              <div className="text-xs text-slate-500">Requires active session</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
