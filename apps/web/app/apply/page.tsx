"use client";

import { useEffect, useState } from "react";
import { submitConsultantApplication, checkApplicationStatus } from "@/actions/consultant";
import { Sparkles, Send, Loader2, BookOpen, Clock, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function ApplyPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [appStatus, setAppStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  useEffect(() => {
    async function loadStatus() {
      const { status } = await checkApplicationStatus();
      setAppStatus(status);
      setLoading(false);
    }
    loadStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const res = await submitConsultantApplication(formData);

    if (res.success) {
      setAppStatus("pending");
      setMessage({ type: 'success', text: "Application submitted successfully!" });
    } else {
      setMessage({ type: 'error', text: res.error || "Failed to submit application." });
    }
    setSubmitting(false);
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-purple-500" size={32}/></div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient Lighting */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none" />
      
      <div className="max-w-2xl w-full relative z-10 pt-10">
        
        {appStatus === "pending" ? (
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/30 rounded-[2.5rem] p-10 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock size={32} className="text-indigo-400" />
            </div>
            <h1 className="text-3xl font-black mb-4">Application Under Review</h1>
            <p className="text-slate-400">Your expertise profile has been submitted to the God-View administration. You will be notified once a decision is made.</p>
            <Link href="/explore" className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl mt-8 font-bold transition-all">
              Return to Dashboard
            </Link>
          </div>
        ) : appStatus === "approved" ? (
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-emerald-500/30 rounded-[2.5rem] p-10 text-center shadow-2xl">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldCheck size={32} className="text-emerald-400" />
            </div>
            <h1 className="text-3xl font-black mb-4">You are a Consultant</h1>
            <p className="text-slate-400">Your application was approved. Access your studio via the main navigation.</p>
            <Link href="/consultant/dashboard" className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl mt-8 font-bold transition-all">
              Enter Consultant Studio
            </Link>
          </div>
        ) : (
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold mb-4">
                <Sparkles size={14} /> Consultant Onboarding
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Join the Network</h1>
              <p className="text-slate-400 mt-2 text-sm">Provide your metaphysical expertise to apply for a consultant role on Project Zeal.</p>
            </div>

            {message && (
              <div className={`mb-6 p-4 rounded-2xl text-sm font-bold text-center border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Primary Domain of Expertise</label>
                <div className="relative">
                  <BookOpen size={18} className="absolute left-4 top-3.5 text-slate-400" />
                  <select name="expertise" required className="w-full pl-11 pr-4 py-3.5 bg-slate-950 border border-white/10 rounded-2xl text-sm focus:border-indigo-500 outline-none text-slate-200 appearance-none">
                    <option value="" disabled selected>Select Discipline</option>
                    <option value="Vedic Astrology">Vedic Astrology</option>
                    <option value="Tarot Reading">Tarot Reading</option>
                    <option value="Numerology">Numerology</option>
                    <option value="Palmistry">Palmistry</option>
                    <option value="Vastu Shastra">Vastu Shastra</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Professional Bio & Experience</label>
                <textarea 
                  name="bio" 
                  required
                  rows={4}
                  placeholder="Detail your experience, lineage, or certification..." 
                  className="w-full p-4 bg-slate-950 border border-white/10 rounded-2xl text-sm focus:border-indigo-500 outline-none text-slate-200 resize-none"
                />
              </div>

              <button 
                type="submit" 
                disabled={submitting}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-600/30 hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : "Submit Application for Review"} <Send size={16} />
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
