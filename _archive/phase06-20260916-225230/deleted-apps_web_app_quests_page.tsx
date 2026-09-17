"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createBrowserClient } from "@supabase/ssr";
import { Trophy, Sparkles, ArrowRight, ShieldCheck, CheckCircle2, Home, Compass, Coins } from "lucide-react";
import Link from "next/link";

interface Quest {
  id: string;
  title: string;
  description: string;
  reward: number;
  completed: boolean;
}

const FALLBACK_QUESTS: Quest[] = [
  { id: "1", title: "Initialize Daily Ephemeris", description: "Generate your daily horoscope or transit chart on the explore dashboard.", reward: 50, completed: false },
  { id: "2", title: "Explore Verified Roster", description: "Browse the master consultant directory and review community feedback.", reward: 30, completed: true },
  { id: "3", title: "Synastry Matchmaking Trial", description: "Test relationship compatibility metrics with the AI engine.", reward: 100, completed: false }
];

export default function QuestsPage() {
  const [quests, setQuests] = useState<Quest[]>(FALLBACK_QUESTS);
  const [loading, setLoading] = useState(true);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
  const supabase = createBrowserClient(supabaseUrl, supabaseKey);

  useEffect(() => {
    let isMounted = true;
    const fetchQuests = async () => {
      try {
        const { data, error } = await supabase.from("user_quests").select("*");
        if (!isMounted) return;
        if (!error && data && data.length > 0) {
          setQuests(data);
        }
      } catch (err) {
        // Fallbacks remain active if table doesn't exist yet
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchQuests();
    return () => { isMounted = false; };
  }, [supabase]);

  const handleCompleteQuest = (id: string) => {
    setQuests(prev => prev.map(q => q.id === id ? { ...q, completed: true } : q));
  };

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
                <Trophy size={14} /> Engagement Rewards
              </div>
              <h1 className="text-4xl sm:text-6xl font-medium tracking-tight">Cosmic Quests.</h1>
              <p className="text-slate-600 dark:text-slate-400 font-light mt-2 text-lg">Complete neural milestones and earn Sparks to elevate your standing across the network.</p>
            </div>
            
            <Link href="/explore" className="px-6 py-3.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-medium text-sm hover:bg-purple-600 dark:hover:bg-purple-400 transition-all shadow-md inline-flex items-center gap-2">
              Explore Suite <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Quests Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-64 bg-slate-200 dark:bg-slate-900/30 rounded-[2.5rem]" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <AnimatePresence>
              {quests.map((q, idx) => (
                <motion.div 
                  key={q.id} 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl dark:hover:border-purple-500/30 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-inner">
                        <Sparkles size={22} />
                      </div>
                      <span className="px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1">
                        <Coins size={14} /> +{q.reward} Sparks
                      </span>
                    </div>

                    <h3 className="text-2xl font-medium text-slate-900 dark:text-white mb-2">{q.title}</h3>
                    <p className="text-slate-600 dark:text-slate-400 font-light text-sm leading-relaxed mb-6">{q.description}</p>
                  </div>

                  <div className="pt-6 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                    {q.completed ? (
                      <span className="text-xs text-emerald-500 font-medium flex items-center gap-1.5">
                        <CheckCircle2 size={16} /> Completed
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">In Progress</span>
                    )}

                    <button 
                      onClick={() => handleCompleteQuest(q.id)}
                      disabled={q.completed}
                      className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-medium text-sm hover:bg-purple-600 dark:hover:bg-purple-400 transition-all shadow-md disabled:opacity-50"
                    >
                      {q.completed ? "Claimed" : "Complete"}
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
