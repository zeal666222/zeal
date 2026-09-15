"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle, MessageSquare, Phone, Video, MapPin, ArrowRight, Bot, IndianRupee, X } from "lucide-react";
import Link from "next/link";
import { initiateConsultation } from "@/actions/booking";

export default function ConsultantProfileBookingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const isAI = slug?.endsWith("-ai");
  
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showIntake, setShowIntake] = useState(false);
  const [contextData, setContextData] = useState({ name: "", dob: "", time: "", location: "", concern: "" });

  const handleBooking = async (type: string, rate: number) => {
    if (isAI && type === "CHAT") {
      setShowIntake(true);
      return;
    }

    setLoading(type);
    setError(null);
    const res = await initiateConsultation(slug, type, rate);
    
    if (res.success && res.consultationId) {
      router.push(`/chat/${res.consultationId}`);
    } else {
      setError(res.error || "Failed to connect.");
      setLoading(null);
    }
  };

  const startAIChat = (e: React.FormEvent) => {
    e.preventDefault();
    const encodedContext = encodeURIComponent(JSON.stringify(contextData));
    router.push(`/chat/${slug}?ctx=${encodedContext}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-16 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-4xl mx-auto relative z-10">
        <Link href="/services" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-purple-600 mb-8 transition-colors">
          <ArrowRight size={16} className="rotate-180" /> Back to Directory
        </Link>

        {showIntake && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-white/10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2"><Bot className="text-purple-500"/> Seeker Intake</h3>
                <button onClick={() => setShowIntake(false)} className="text-slate-400 hover:text-rose-500"><X size={20}/></button>
              </div>
              <form onSubmit={startAIChat} className="space-y-4">
                <input type="text" required placeholder="Your Name" value={contextData.name} onChange={e => setContextData({...contextData, name: e.target.value})} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="date" required value={contextData.dob} onChange={e => setContextData({...contextData, dob: e.target.value})} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10" />
                  <input type="time" required value={contextData.time} onChange={e => setContextData({...contextData, time: e.target.value})} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10" />
                </div>
                <input type="text" required placeholder="Birth City" value={contextData.location} onChange={e => setContextData({...contextData, location: e.target.value})} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10" />
                <textarea required placeholder="What is your main concern?" value={contextData.concern} onChange={e => setContextData({...contextData, concern: e.target.value})} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 resize-none h-24" />
                <button type="submit" className="w-full py-4 bg-purple-600 text-white rounded-xl font-bold shadow-lg hover:bg-purple-500 transition-colors">
                  Initialize Neural Link
                </button>
              </form>
            </div>
          </div>
        )}

        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row gap-8 items-start mb-12">
            <div className={`w-32 h-32 rounded-3xl flex items-center justify-center font-bold text-4xl shadow-inner shrink-0 text-white ${isAI ? 'bg-gradient-to-tr from-purple-600 to-indigo-600' : 'bg-slate-800'}`}>
              {isAI ? <Bot size={48} /> : slug?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3 ${isAI ? 'bg-purple-500/10 text-purple-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                {isAI ? <><Bot size={14} /> Zeal Core Engine</> : <><CheckCircle size={14} /> Verified Human Master</>}
              </div>
              <h1 className="text-4xl font-bold mb-2 tracking-tight capitalize">{isAI ? slug?.replace("-ai", "") + " AI" : `Acharya ${slug}`}</h1>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
                {isAI 
                  ? "Powered by the Groq LPU, this neural avatar provides instant, highly accurate astrological guidance based on real-time ephemeris data." 
                  : "Consult with one of our highest-rated masters. Specializing in highly accurate transit forecasting, career blockage clearing, and synastry analysis."}
              </p>
            </div>
          </div>

          <h3 className="text-xl font-bold mb-4">Initiate Secure Consultation</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <button onClick={() => handleBooking("CHAT", isAI ? 5.00 : 20.00)} className="p-5 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-2xl flex justify-between group hover:border-purple-500/50 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform"><MessageSquare size={20} /></div>
                <div className="text-left">
                  <h4 className="font-bold text-lg">Neural Chat</h4>
                  <p className="text-xs text-slate-400 flex items-center"><IndianRupee size={10} className="mr-0.5"/>{isAI ? '5.00' : '20.00'} / min</p>
                </div>
              </div>
              <ArrowRight className="text-slate-300 group-hover:text-purple-500 transition-colors mt-3" />
            </button>

            <button disabled={isAI} onClick={() => handleBooking("AUDIO", 40.00)} className={`p-5 rounded-2xl flex justify-between transition-all ${isAI ? 'bg-slate-100 dark:bg-slate-900 opacity-50 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 hover:border-blue-500/50 group'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isAI ? 'bg-slate-200 dark:bg-slate-800 text-slate-400' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 group-hover:scale-105'}`}><Phone size={20} /></div>
                <div className="text-left">
                  <h4 className="font-bold text-lg">Audio Call</h4>
                  <p className="text-xs text-slate-400 flex items-center">{isAI ? 'Human Only' : <><IndianRupee size={10} className="mr-0.5"/>40.00 / min</>}</p>
                </div>
              </div>
            </button>

            <button disabled={isAI} onClick={() => handleBooking("VIDEO", 80.00)} className={`p-5 rounded-2xl flex justify-between transition-all ${isAI ? 'bg-slate-100 dark:bg-slate-900 opacity-50 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 hover:border-emerald-500/50 group'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isAI ? 'bg-slate-200 dark:bg-slate-800 text-slate-400' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 group-hover:scale-105'}`}><Video size={20} /></div>
                <div className="text-left">
                  <h4 className="font-bold text-lg">Video Call</h4>
                  <p className="text-xs text-slate-400 flex items-center">{isAI ? 'Human Only' : <><IndianRupee size={10} className="mr-0.5"/>80.00 / min</>}</p>
                </div>
              </div>
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}
