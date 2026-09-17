"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { ShieldCheck, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function ConsultantsPage() {
  const [consultants, setConsultants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key"
      );
      
      // We now fetch the "sparks" column which represents their popularity/impressions
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, sparks")
        .in("role", ["admin", "superadmin"])
        .order("sparks", { ascending: false });
      
      if (data && data.length > 0) {
        setConsultants(data);
      } else {
        setConsultants([
          { id: "1", full_name: "Acharya Rajesh", role: "admin", sparks: 14500 },
          { id: "2", full_name: "Dr. Elena Vance", role: "superadmin", sparks: 9800 },
          { id: "3", full_name: "Master Chen", role: "admin", sparks: 5420 },
        ]);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-32 px-4 sm:px-6 lg:px-8 transition-colors duration-500 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/10 dark:bg-purple-600/10 blur-[150px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-[84rem] mx-auto relative z-10">
        <div className="mb-16 text-center max-w-2xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-medium text-slate-900 dark:text-white tracking-tight">Verified Master Roster</h1>
          <p className="text-slate-600 dark:text-slate-400 font-light mt-4 text-lg">Connect with elite, globally vetted practitioners for profound, encrypted human guidance.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
             {[1,2,3].map(i => <div key={i} className="h-64 bg-slate-200 dark:bg-slate-900/30 rounded-[2.5rem]" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {consultants.map((c, idx) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl dark:hover:border-purple-500/30 transition-all group">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-light text-2xl shadow-inner group-hover:scale-110 transition-transform">
                      {c.full_name ? c.full_name.charAt(0) : "A"}
                    </div>
                    <div>
                      <h4 className="font-medium text-lg text-slate-900 dark:text-white">{c.full_name || "Senior Astrologer"}</h4>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-1">
                        <ShieldCheck size={14} /> KYC Verified
                      </p>
                    </div>
                  </div>
                </div>

                {/* SPARKS METRIC: Displays Clout/Popularity */}
                <div className="mb-8 flex items-center gap-2 bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 px-4 py-2 rounded-xl w-max">
                  <Sparkles size={16} className="text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-bold text-purple-700 dark:text-purple-300">{c.sparks?.toLocaleString() || 0} Sparks</span>
                </div>

                <Link
                  href={`/login?next=/chat?consultant=${c.id}`}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-purple-600 dark:hover:bg-purple-600 text-white text-sm font-medium transition-colors shadow-md"
                >
                  Schedule Consultation <ArrowRight size={16} />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
