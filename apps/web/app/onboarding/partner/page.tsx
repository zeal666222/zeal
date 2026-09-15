"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Sparkles, ShieldCheck, IndianRupee, ArrowRight, Award, Compass } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ConsultantOnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [form, setForm] = useState({
    fullName: "",
    specialty: "Vedic Astrology",
    experience: "5+ Years",
    ratePerMinute: "20",
    bio: ""
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zyrunsnweznyrhuroduo.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5cnVuc253ZXpueXJodXJvZHVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0OTc2MDgsImV4cCI6MjEwMzA3MzYwOH0.kOPtlaJvT0fnGYit6dG43rekXDin3HoinUNrFB8vtL0";
  const supabase = createBrowserClient(supabaseUrl, supabaseKey);

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You must be logged in to apply as a consultant.");
      }

      // Update profile role to consultant & store metadata
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          full_name: form.fullName,
          role: "consultant",
          onboarding_completed: true
        })
        .eq("id", user.id);

      if (profileErr) throw profileErr;

      // Insert into sparks/consultant directory mapping if needed
      await supabase.from("sparks").upsert({
        consultant_id: user.id,
        total_sparks: 150
      });

      router.push("/explore");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to complete onboarding.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-xl w-full bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative z-10">
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-4">
            <Award size={14} /> Master Partner Onboarding
          </div>
          <h1 className="text-3xl font-black tracking-tight">Join Zeal Master Network</h1>
          <p className="text-slate-400 text-sm mt-2">Publish your astrological expertise and provide live INR consultations.</p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleOnboarding} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Full Legal Name</label>
            <input 
              type="text" 
              required
              placeholder="Acharya Shrikanth" 
              value={form.fullName}
              onChange={(e) => setForm({...form, fullName: e.target.value})}
              className="w-full px-4 py-3.5 bg-slate-950 border border-white/10 rounded-2xl text-sm focus:border-purple-500 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Core Specialty</label>
              <select 
                value={form.specialty}
                onChange={(e) => setForm({...form, specialty: e.target.value})}
                className="w-full px-4 py-3.5 bg-slate-950 border border-white/10 rounded-2xl text-sm focus:border-purple-500 outline-none transition-all"
              >
                <option value="Vedic Astrology">Vedic Astrology</option>
                <option value="Tarot Reading">Tarot Reading</option>
                <option value="Numerology">Numerology</option>
                <option value="Vastu Shastra">Vastu Shastra</option>
                <option value="Face Reading">Face Reading</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Rate per Minute (₹)</label>
              <div className="relative">
                <IndianRupee size={16} className="absolute left-4 top-4 text-slate-400" />
                <input 
                  type="number" 
                  required
                  min="5"
                  max="500"
                  value={form.ratePerMinute}
                  onChange={(e) => setForm({...form, ratePerMinute: e.target.value})}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-950 border border-white/10 rounded-2xl text-sm focus:border-purple-500 outline-none transition-all font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Professional Bio</label>
            <textarea 
              rows={3}
              required
              placeholder="Describe your spiritual background, lineage, and prediction accuracy..." 
              value={form.bio}
              onChange={(e) => setForm({...form, bio: e.target.value})}
              className="w-full px-4 py-3.5 bg-slate-950 border border-white/10 rounded-2xl text-sm focus:border-purple-500 outline-none transition-all resize-none"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-purple-600/30 hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? "Initializing Node..." : "Complete Master Registration"} <ArrowRight size={16} />
          </button>
        </form>

      </div>
    </div>
  );
}
