"use client";

import { useState } from "react";
import { completeOnboardingAction } from "@/actions/onboarding";
import { useRouter } from "next/navigation";
import { Sparkles, IndianRupee, ArrowRight, Loader2, Calendar, User, Moon } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleNext = () => setStep(2);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const formData = new FormData(e.currentTarget);
    const res = await completeOnboardingAction(formData);

    if (res.success) {
      // The middleware will now unlock the gate and allow them into /explore
      router.push("/explore");
      router.refresh(); // Force middleware re-evaluation
    } else {
      setErrorMsg(res.error || "Failed to complete onboarding.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-lg w-full bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl relative z-10">
        
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`h-2 rounded-full transition-all duration-500 ${step >= 1 ? 'w-16 bg-purple-500' : 'w-4 bg-slate-800'}`} />
          <div className={`h-2 rounded-full transition-all duration-500 ${step >= 2 ? 'w-16 bg-purple-500' : 'w-4 bg-slate-800'}`} />
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* STEP 1: Metaphysical Profile */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-black tracking-tight">Your Metaphysical Profile</h1>
                <p className="text-slate-400 text-sm mt-2">Help us align your energy for better consultations.</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Date of Birth</label>
                  <div className="relative">
                    <Calendar size={18} className="absolute left-4 top-3.5 text-slate-400" />
                    <input name="dob" type="date" required className="w-full pl-11 pr-4 py-3.5 bg-slate-950 border border-white/10 rounded-2xl text-sm focus:border-purple-500 outline-none text-slate-200" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Gender</label>
                  <div className="relative">
                    <User size={18} className="absolute left-4 top-3.5 text-slate-400" />
                    <select name="gender" required className="w-full pl-11 pr-4 py-3.5 bg-slate-950 border border-white/10 rounded-2xl text-sm focus:border-purple-500 outline-none text-slate-200 appearance-none">
                      <option value="" disabled selected>Select Identity</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-Binary">Non-Binary</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Zodiac Sign</label>
                  <div className="relative">
                    <Moon size={18} className="absolute left-4 top-3.5 text-slate-400" />
                    <select name="zodiac" required className="w-full pl-11 pr-4 py-3.5 bg-slate-950 border border-white/10 rounded-2xl text-sm focus:border-purple-500 outline-none text-slate-200 appearance-none">
                      <option value="" disabled selected>Select Sign</option>
                      <option value="Aries">Aries</option><option value="Taurus">Taurus</option>
                      <option value="Gemini">Gemini</option><option value="Cancer">Cancer</option>
                      <option value="Leo">Leo</option><option value="Virgo">Virgo</option>
                      <option value="Libra">Libra</option><option value="Scorpio">Scorpio</option>
                      <option value="Sagittarius">Sagittarius</option><option value="Capricorn">Capricorn</option>
                      <option value="Aquarius">Aquarius</option><option value="Pisces">Pisces</option>
                    </select>
                  </div>
                </div>

                <button type="button" onClick={handleNext} className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 mt-4">
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Welcome Bonus Reveal */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500 flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-[0_0_60px_-10px_rgba(16,185,129,0.5)] mb-6 animate-pulse">
                <Sparkles size={40} className="text-white" />
              </div>
              
              <h2 className="text-3xl font-black tracking-tight mb-2">Welcome Bonus Unlocked!</h2>
              <p className="text-slate-400 text-sm mb-8">We have deposited a complimentary balance into your wallet to get you started.</p>

              <div className="w-full bg-slate-950 border border-emerald-500/30 rounded-3xl p-6 mb-8 flex flex-col items-center">
                <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2">Ledger Credited</span>
                <div className="text-5xl font-black font-mono flex items-center text-white">
                  <IndianRupee size={40} className="text-emerald-400 mr-1" />500.00
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-purple-600/30 hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-2">
                {loading ? <Loader2 size={18} className="animate-spin" /> : "Enter Project Zeal"} <ArrowRight size={16} />
              </button>
            </div>
          )}

        </form>
      </div>
    </div>
  );
}
