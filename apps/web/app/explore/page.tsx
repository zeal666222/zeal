"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Search, Sparkles, User, Bot, Star, IndianRupee, ShieldCheck, ArrowRight, Filter, Compass } from "lucide-react";
import Link from "next/link";

const CATEGORIES = ["All", "Vedic Astrology", "Tarot Reading", "Numerology", "Vastu Shastra", "Face Reading"];

export default function ExploreHubPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [filterType, setFilterType] = useState<"all" | "human" | "ai">("all");
  
  const [consultants, setConsultants] = useState<any[]>([]);
  const [aiProfiles, setAiProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zyrunsnweznyrhuroduo.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5cnVuc253ZXpueXJodXJvZHVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0OTc2MDgsImV4cCI6MjEwMzA3MzYwOH0.kOPtlaJvT0fnGYit6dG43rekXDin3HoinUNrFB8vtL0";
  const supabase = createBrowserClient(supabaseUrl, supabaseKey);

  useEffect(() => {
    fetchRealtimeData();
  }, []);

  const fetchRealtimeData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Human Consultants from profiles
      const { data: humanData, error: humanErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "consultant");

      if (!humanErr && humanData) {
        setConsultants(humanData);
      } else {
        // Fallback mock data if table is empty
        setConsultants([
          { id: "1", full_name: "Acharya Rajesh", specialty: "Vedic Astrology", is_online: true, wallet_balance: 0 },
          { id: "2", full_name: "Master Vikram", specialty: "Tarot Reading", is_online: false, wallet_balance: 0 },
          { id: "3", full_name: "Dr. Ananya Sharma", specialty: "Numerology", is_online: true, wallet_balance: 0 }
        ]);
      }

      // 2. Fetch AI Profiles
      const { data: aiData, error: aiErr } = await supabase
        .from("ai_profiles")
        .select("*");

      if (!aiErr && aiData && aiData.length > 0) {
        setAiProfiles(aiData);
      } else {
        // Fallback mock AI profiles
        setAiProfiles([
          { id: "ai-1", name: "Vedic AI Core", specialty: "Vedic Astrology & Transits" },
          { id: "ai-2", name: "Oracle Tarot AI", specialty: "Synastry & Oracle Spreads" },
          { id: "ai-3", name: "Numerology AI", specialty: "Pythagorean Matrix" }
        ]);
      }
    } catch (err) {
      console.error("Error fetching discovery nodes:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter logic
  const filteredHumans = consultants.filter(c => {
    const matchesSearch = c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || c.specialty?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === "All" || c.specialty?.toLowerCase().includes(selectedCategory.toLowerCase());
    return matchesSearch && matchesCat;
  });

  const filteredAi = aiProfiles.filter(a => {
    const matchesSearch = a.name?.toLowerCase().includes(searchQuery.toLowerCase()) || a.specialty?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === "All" || a.specialty?.toLowerCase().includes(selectedCategory.toLowerCase());
    return matchesSearch && matchesCat;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-500">
      
      {/* Ambient background glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/10 blur-[150px] rounded-full pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/10 blur-[150px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-[88rem] mx-auto relative z-10">
        
        {/* Header Title */}
        <div className="mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-bold mb-4">
            <Compass size={14} /> Enterprise Discovery Hub
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3">Explore Masters & AI Avatars</h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl font-light">
            Connect with verified human masters or consult our real-time LPU neural AI engines instantly.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 shadow-2xl mb-10 space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            
            {/* Search Input */}
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="Search by name or specialty..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-white/10 rounded-2xl outline-none focus:border-purple-500 text-sm transition-colors"
              />
            </div>

            {/* Type Filters (All / Human / AI) */}
            <div className="flex items-center gap-2 w-full md:w-auto bg-slate-100 dark:bg-slate-950/60 p-1.5 rounded-2xl border border-slate-200 dark:border-white/10">
              <button 
                onClick={() => setFilterType("all")}
                className={`flex-1 md:flex-none px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${filterType === 'all' ? 'bg-white dark:bg-slate-800 text-purple-600 shadow-sm' : 'text-slate-500'}`}
              >
                All Nodes
              </button>
              <button 
                onClick={() => setFilterType("human")}
                className={`flex-1 md:flex-none px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${filterType === 'human' ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-sm' : 'text-slate-500'}`}
              >
                Human Masters
              </button>
              <button 
                onClick={() => setFilterType("ai")}
                className={`flex-1 md:flex-none px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${filterType === 'ai' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
              >
                AI Avatars
              </button>
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${selectedCategory === cat ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'bg-slate-100 dark:bg-slate-950/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-24 text-slate-500 font-mono animate-pulse">
            SYNCHRONIZING REALTIME METAPHYSICAL NODES...
          </div>
        ) : (
          <div className="space-y-16">
            
            {/* HUMAN CONSULTANTS SECTION */}
            {(filterType === 'all' || filterType === 'human') && filteredHumans.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <User className="text-emerald-500" /> Verified Human Masters
                  </h2>
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">{filteredHumans.length} Active Nodes</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredHumans.map((consultant) => (
                    <div key={consultant.id} className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-6 shadow-xl hover:shadow-2xl hover:border-emerald-500/40 transition-all group flex flex-col justify-between">
                      <div>
                        <div className="flex items-start gap-4 mb-4">
                          <div className="relative w-16 h-16 rounded-3xl bg-gradient-to-tr from-slate-800 to-slate-900 text-white flex items-center justify-center font-bold text-2xl shadow-md">
                            {consultant.full_name?.charAt(0) || "M"}
                            {consultant.is_online && (
                              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-bold text-lg flex items-center gap-1.5">
                              {consultant.full_name || "Master Consultant"} 
                              <ShieldCheck size={14} className="text-emerald-500" />
                            </h3>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-1">{consultant.specialty || "Vedic Astrology"}</p>
                            <p className="text-xs text-slate-400">15+ Years Experience • 4.98 Rating</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/50 rounded-2xl mb-6 border border-slate-100 dark:border-white/5">
                          <span className="text-xs text-slate-400 font-medium">Chat Rate</span>
                          <span className="font-mono font-bold text-sm flex items-center text-emerald-600 dark:text-emerald-400">
                            <IndianRupee size={14} className="mr-0.5" />20.00 / min
                          </span>
                        </div>
                      </div>

                      <Link 
                        href={`/consultant/${consultant.full_name?.toLowerCase().replace(/\s+/g, '-') || 'acharya-rajesh'}`} 
                        className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-2xl font-bold text-sm text-center hover:bg-emerald-600 dark:hover:bg-emerald-400 transition-all shadow-lg flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                      >
                        Consult Master <ArrowRight size={16} />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI AVATARS SECTION */}
            {(filterType === 'all' || filterType === 'ai') && filteredAi.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Bot className="text-purple-500" /> Zeal Neural AI Avatars
                  </h2>
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">{filteredAi.length} Neural Nodes</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAi.map((ai) => {
                    const slug = ai.name.toLowerCase().replace(/\s+/g, '-').replace('ai', '') + 'ai';
                    return (
                      <div key={ai.id} className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-6 shadow-xl hover:shadow-2xl hover:border-purple-500/40 transition-all group flex flex-col justify-between">
                        <div>
                          <div className="flex items-start gap-4 mb-4">
                            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                              <Bot size={28} />
                            </div>
                            <div>
                              <h3 className="font-bold text-lg">{ai.name}</h3>
                              <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold mb-1">{ai.specialty}</p>
                              <p className="text-xs text-slate-400">Groq LPU Powered • Instant Sync</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/50 rounded-2xl mb-6 border border-slate-100 dark:border-white/5">
                            <span className="text-xs text-slate-400 font-medium">Neural Rate</span>
                            <span className="font-mono font-bold text-sm flex items-center text-purple-600 dark:text-purple-400">
                              <IndianRupee size={14} className="mr-0.5" />5.00 / min
                            </span>
                          </div>
                        </div>

                        <Link 
                          href={`/consultant/${slug}`} 
                          className="w-full py-3.5 bg-purple-600 text-white rounded-2xl font-bold text-sm text-center hover:bg-purple-500 transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                        >
                          Initialize Neural Link <Sparkles size={16} />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
