"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Orbit, Sparkles, ArrowRight, Compass, ShieldCheck, Calendar, Clock, MapPin, User } from "lucide-react";
import Link from "next/link";

export default function KundaliPage() {
  const [formData, setFormData] = useState({ name: "", dob: "", tob: "", pob: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/ai/kundali", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.analysis);
      } else {
        setError("Computation failed. Please check inputs.");
      }
    } catch (err) {
      setError("Network error connecting to computational ephemeris.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 py-16 px-4 sm:px-6 lg:px-8 transition-colors duration-500 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-200 dark:bg-purple-600/10 blur-[150px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-[72rem] mx-auto relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-100 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-purple-700 dark:text-purple-300 font-medium text-xs uppercase tracking-widest mb-6">
            <Orbit size={14} /> Vedic Ephemeris Engine
          </div>
          <h1 className="text-4xl sm:text-6xl font-medium tracking-tight mb-4">Janam Kundali Calculator</h1>
          <p className="text-slate-600 dark:text-slate-400 font-light text-lg">Generate your precise Vedic birth chart, planetary degrees, house allocations, and Groq-powered astrological analysis.</p>
        </div>

        {!result ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && <div className="p-4 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl text-sm font-medium border border-rose-200">{error}</div>}
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                  <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Alexander Vance" className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none font-medium text-slate-900 dark:text-white" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Date of Birth</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                    <input type="date" required value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none font-medium text-slate-900 dark:text-white" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Time of Birth</label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                    <input type="time" required value={formData.tob} onChange={e => setFormData({...formData, tob: e.target.value})} className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none font-medium text-slate-900 dark:text-white" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Place of Birth (City, Country)</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                  <input type="text" required value={formData.pob} onChange={e => setFormData({...formData, pob: e.target.value})} placeholder="e.g. New York, USA" className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none font-medium text-slate-900 dark:text-white" />
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-purple-600 dark:hover:bg-purple-400 transition-all shadow-xl">
                {loading ? <Sparkles className="animate-spin" size={20} /> : <>Compute Janam Kundali <ArrowRight size={18} /></>}
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
            <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl">
              <div className="flex justify-between items-center mb-8 border-b border-slate-200 dark:border-white/10 pb-6">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{formData.name}'s Kundali Report</h2>
                  <p className="text-slate-500 text-sm mt-1">{formData.dob} at {formData.tob} | {formData.pob}</p>
                </div>
                <button onClick={() => setResult(null)} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">Recalculate</button>
              </div>

              {/* North Indian Style Kundali SVG Chart Representation */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-12">
                <div className="w-full max-w-md mx-auto aspect-square border-2 border-purple-500/40 rounded-2xl p-4 bg-slate-950/20 relative flex items-center justify-center">
                  <svg viewBox="0 0 400 400" className="w-full h-full text-purple-400">
                    {/* North Indian Diamond Chart Layout */}
                    <polygon points="200,10 390,200 200,390 10,200" fill="none" stroke="currentColor" strokeWidth="2" />
                    <line x1="10" y1="200" x2="390" y2="200" stroke="currentColor" strokeWidth="2" />
                    <line x1="200" y1="10" x2="200" y2="390" stroke="currentColor" strokeWidth="2" />
                    <line x1="10" y1="10" x2="390" y2="390" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
                    <line x1="390" y1="10" x2="10" y2="390" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
                    <text x="200" y="60" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="bold">1</text>
                    <text x="100" y="150" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="bold">12</text>
                    <text x="300" y="150" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="bold">2</text>
                    <text x="60" y="205" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="bold">11</text>
                    <text x="340" y="205" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="bold">3</text>
                    <text x="200" y="215" textAnchor="middle" fill="currentColor" fontSize="12" opacity="0.8">LAGNA</text>
                  </svg>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xl font-bold">Astrological Summary</h3>
                  <div className="p-6 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-white/5 text-slate-300 leading-relaxed text-sm whitespace-pre-line">
                    {result}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
