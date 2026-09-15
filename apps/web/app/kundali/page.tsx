"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { generateKundaliData } from "@/actions/astrology";
import { MapPin, Calendar, Clock, User, Sparkles, AlertTriangle, ArrowRight, Compass, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function KundaliMakerPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    dob: "",
    time: "",
    location: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const response = await generateKundaliData(formData);
    
    if (response.success) {
      setResult(response.data);
    } else {
      setError(response.error || "System Error");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Ambient Cosmic Background */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-200 dark:bg-purple-600/10 blur-[150px] rounded-full pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-200 dark:bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-[84rem] mx-auto relative z-10">
        <Link href="/explore" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-purple-600 mb-8 transition-colors">
          <ArrowRight size={16} className="rotate-180" /> Back to Free Tools
        </Link>
        
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400">
          Precision Janam Kundali
        </h1>
        <p className="text-slate-600 dark:text-slate-400 font-light mb-12 text-lg max-w-2xl">
          Generate an enterprise-grade Vedic birth chart utilizing high-accuracy ephemeris data to map planetary degrees, Dasha cycles, and karmic doshas.
        </p>

        {!result ? (
          <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-8 max-w-3xl shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Sparkles className="text-purple-500" /> Enter Birth Coordinates</h2>
            
            {error && (
              <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative">
                  <User className="absolute left-4 top-4 text-slate-400" size={20} />
                  <input type="text" placeholder="Full Name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-2xl outline-none focus:border-purple-500 transition-colors" />
                </div>
                <div className="relative">
                  <Calendar className="absolute left-4 top-4 text-slate-400" size={20} />
                  <input type="date" required value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-2xl outline-none focus:border-purple-500 transition-colors" />
                </div>
                <div className="relative">
                  <Clock className="absolute left-4 top-4 text-slate-400" size={20} />
                  <input type="time" required value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-2xl outline-none focus:border-purple-500 transition-colors" />
                </div>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 text-slate-400" size={20} />
                  <input type="text" placeholder="City of Birth (e.g., Delhi, India)" required value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-2xl outline-none focus:border-purple-500 transition-colors" />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-2xl font-bold hover:bg-purple-600 transition-all disabled:opacity-50 shadow-xl flex justify-center items-center gap-2">
                {loading ? "Calculating Ephemeris Data..." : "Generate Neural Chart"}
                {!loading && <Compass size={18} />}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-10 duration-700">
            {/* Top Insight Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-xl">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Ascendant (Lagna)</p>
                <h3 className="text-2xl font-bold">{result.basic_details.ascendant}</h3>
              </div>
              <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-xl">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Moon Sign & Nakshatra</p>
                <h3 className="text-2xl font-bold">{result.basic_details.moon_sign}</h3>
                <p className="text-sm text-purple-500 font-semibold">{result.basic_details.nakshatra} (Lord: {result.basic_details.nakshatra_lord})</p>
              </div>
              <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-purple-200 dark:border-purple-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Compass size={64} /></div>
                <p className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-1">Active Dasha Period</p>
                <h3 className="text-2xl font-bold">{result.current_dasha.mahadasha} - {result.current_dasha.antardasha}</h3>
                <p className="text-sm text-slate-500">Ends: {result.current_dasha.ends_on}</p>
              </div>
            </div>

            {/* Dosha Diagnostics */}
            {result.dosha_diagnostics.manglik && (
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 rounded-3xl p-6 shadow-sm flex items-start gap-4">
                <div className="p-3 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl"><AlertTriangle size={24} /></div>
                <div>
                  <h4 className="text-lg font-bold text-rose-700 dark:text-rose-300">Manglik Dosha Detected</h4>
                  <p className="text-sm text-rose-600 dark:text-rose-400 mb-4 mt-1">Mars is positioned unfavorably in your chart, which may cause delays or friction in partnerships. Consultation with a master is advised for remedies.</p>
                  <Link href="/services/vedic-astrology" className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-rose-500 transition-colors">
                    Consult Expert <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            )}

            {/* Planetary Degrees Table */}
            <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-8 shadow-xl">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><ShieldCheck className="text-emerald-500" /> Precise Planetary Postions</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-950/50 rounded-t-xl">
                    <tr>
                      <th className="px-6 py-4 rounded-tl-xl font-bold">Planet</th>
                      <th className="px-6 py-4 font-bold">Sign</th>
                      <th className="px-6 py-4 font-bold">Degree</th>
                      <th className="px-6 py-4 font-bold">House</th>
                      <th className="px-6 py-4 rounded-tr-xl font-bold">Motion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.planetary_positions.map((planet: any, i: number) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="px-6 py-4 font-bold">{planet.name}</td>
                        <td className="px-6 py-4">{planet.sign}</td>
                        <td className="px-6 py-4 font-mono">{planet.degree}</td>
                        <td className="px-6 py-4">House {planet.house}</td>
                        <td className="px-6 py-4">
                          {planet.is_retrograde ? (
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 text-xs rounded-md font-bold uppercase tracking-wider">Retrograde</span>
                          ) : (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-xs rounded-md font-bold uppercase tracking-wider">Direct</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
