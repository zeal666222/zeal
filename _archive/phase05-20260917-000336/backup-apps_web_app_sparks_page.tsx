"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createBrowserClient } from "@supabase/ssr";
import { Sparkles, Trophy, ArrowRight, Home, Flame, Activity } from "lucide-react";
import Link from "next/link";

interface SparkActivity {
  id: string;
  action: string;
  amount: number;
  created_at: string;
}

const FALLBACK_ACTIVITIES: SparkActivity[] = [
  { id: "1", action: "Daily Platform Login", amount: 10, created_at: "Today" },
  { id: "2", action: "Consultant Post Upvote", amount: 5, created_at: "Yesterday" },
  { id: "3", action: "Synastry Matchmaking Query", amount: 25, created_at: "2 days ago" }
];

export default function SparksPage() {
  const [activities, setActivities] = useState<SparkActivity[]>(FALLBACK_ACTIVITIES);
  const [totalSparks, setTotalSparks] = useState(340);
  const [loading, setLoading] = useState(true);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
  const supabase = createBrowserClient(supabaseUrl, supabaseKey);

  useEffect(() => {
    let isMounted = true;
    const fetchSparksData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profileData } = await supabase.from("profiles").select("sparks").eq("id", user.id).single();
          if (profileData && isMounted) {
            setTotalSparks(profileData.sparks || 340);
          }
        }
      } catch (err) {}
      finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchSparksData();
    return () => { isMounted = false; };
  }, [supabase]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 py-16 px-4 sm:px-6 lg:px-8 selection:bg-purple-500/30 transition-colors duration-500 relative overflow-hidden">
      
      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-200 dark:bg-purple-600/10 blur-[150px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-[72rem] mx-auto relative z-10">
        
        {/* Header */}
        <div className="mb-12">
          <button 
            onClick={() => window.location.href = "/"} 
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400 mb-4 transition-colors"
          >
            <Home size={16} /> Return to Cosmos
          </button>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-100 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-purple-700 dark:text-purple-300 font-medium text-xs uppercase tracking-widest mb-4">
                <Flame size={14} /> Clout & Engagement Ledger
              </div>
              <h1 className="text-4xl sm:text-6xl font-medium tracking-tight">Your Sparks.</h1>
              <p className="text-slate-600 dark:text-slate-400 font-light mt-2 text-lg">Track your social clout, community impressions, likes, and follower engagement.</p>
            </div>
            
            {/* Sparks Balance Card */}
            <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-3xl p-6 shadow-lg flex items-center gap-6">
              <div className="w-14 h-14 bg-purple-100 dark:bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-inner">
                <Sparkles size={28} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Sparks Balance</p>
                <p className="text-4xl font-medium text-slate-900 dark:text-white">{totalSparks}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <Activity className="text-purple-500" size={24} />
            <h3 className="text-2xl font-medium text-slate-900 dark:text-white">Recent Spark Activity</h3>
          </div>

          {loading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-200 dark:bg-slate-900/30 rounded-2xl" />)}
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((act) => (
                <div key={act.id} className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-sm">
                      +
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-slate-200 text-sm">{act.action}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{act.created_at}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-purple-600 dark:text-purple-400">+{act.amount} Sparks</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

      </div>
    </div>
  );
}
