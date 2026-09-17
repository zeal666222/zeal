"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createBrowserClient } from "@supabase/ssr";
import { Users, Sparkles, Copy, Check, ArrowRight, Home, Share2, Gift } from "lucide-react";
import Link from "next/link";

export default function ReferralPage() {
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState("ZEAL-COSMIC-88");
  const [stats, setStats] = useState({ totalReferred: 3, sparksEarned: 300 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
  const supabase = createBrowserClient(supabaseUrl, supabaseKey);

  useEffect(() => {
    let isMounted = true;
    const fetchReferralData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && isMounted) {
          setReferralCode(`ZEAL-${user.id.slice(0, 6).toUpperCase()}`);
        }
      } catch (err) {}
    };
    fetchReferralData();
    return () => { isMounted = false; };
  }, [supabase]);

  const handleCopy = () => {
    navigator.clipboard.writeText(`https://zeal-main.netlify.app/login?ref=${referralCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
                <Users size={14} /> Referral Network
              </div>
              <h1 className="text-4xl sm:text-6xl font-medium tracking-tight">Invite Seekers.</h1>
              <p className="text-slate-600 dark:text-slate-400 font-light mt-2 text-lg">Share your unique cosmic link and earn Sparks for every seeker who connects to the network.</p>
            </div>
            
            <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-3xl p-6 shadow-lg flex items-center gap-6">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Referred</p>
                <p className="text-3xl font-medium text-slate-900 dark:text-white">{stats.totalReferred}</p>
              </div>
              <div className="h-10 w-[1px] bg-slate-200 dark:bg-white/10" />
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Sparks Earned</p>
                <p className="text-3xl font-medium text-purple-600 dark:text-purple-400">{stats.sparksEarned}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Referral Link Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl max-w-3xl mx-auto text-center mb-16">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 mx-auto mb-6 shadow-inner">
            <Gift size={32} />
          </div>
          <h3 className="text-2xl font-medium text-slate-900 dark:text-white mb-3">Your Unique Referral Link</h3>
          <p className="text-slate-600 dark:text-slate-400 font-light text-sm mb-8">Share this node address with friends. When they initialize their account, you both receive bonus Sparks.</p>

          <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-white/10">
            <input 
              type="text" 
              readOnly 
              value={`https://zeal-main.netlify.app/login?ref=${referralCode}`} 
              className="w-full bg-transparent px-4 py-2 text-sm text-slate-700 dark:text-slate-300 font-mono outline-none truncate"
            />
            <button 
              onClick={handleCopy}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-medium text-sm hover:bg-purple-600 dark:hover:bg-purple-400 transition-all shadow-md flex items-center justify-center gap-2 shrink-0"
            >
              {copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy Link</>}
            </button>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
