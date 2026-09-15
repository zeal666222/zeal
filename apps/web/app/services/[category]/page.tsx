"use client";
export const dynamic = "force-dynamic";

import { useParams } from "next/navigation";
import { Bot, User, Phone, Video, MessageSquare, MapPin, CheckCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function CategoryServicePage() {
  const params = useParams();
  const rawCategory = params?.category as string || "service";
  const title = rawCategory.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="max-w-[84rem] mx-auto relative z-10">
        
        <Link href="/services" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-purple-600 mb-8 transition-colors">
          <ArrowRight size={16} className="rotate-180" /> Back to Intelligence Hub
        </Link>
        
        <h1 className="text-4xl sm:text-5xl font-medium tracking-tight mb-2">{title}</h1>
        <p className="text-slate-500 mb-12 text-lg">Consult with our specialized neural AIs or verified human masters.</p>

        {/* Human Masters Grid with Clean Slugs */}
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <User className="text-emerald-500" /> Verified Human Masters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-xl">A</div>
                <div>
                  <h4 className="font-bold text-lg flex items-center gap-1">Acharya Rajesh <CheckCircle size={14} className="text-emerald-500" /></h4>
                  <p className="text-xs text-purple-500 font-semibold mb-1">Master of {title}</p>
                  <p className="text-xs text-slate-400">18+ Years Exp • 4.98 Rating</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mb-6">
                <button onClick={() => window.location.href='/consultant/acharya-rajesh'} className="flex items-center justify-center gap-2 p-2 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer">
                  <MessageSquare size={14} /> Chat (₹20/m)
                </button>
                <button onClick={() => window.location.href='/consultant/acharya-rajesh'} className="flex items-center justify-center gap-2 p-2 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer">
                  <Phone size={14} /> Audio (₹40/m)
                </button>
              </div>
            </div>
            
            <Link href="/consultant/acharya-rajesh" className="w-full py-3 text-center border border-slate-200 dark:border-white/10 rounded-xl font-bold text-sm hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-950 transition-colors">
              View Full Profile
            </Link>
          </div>

        </div>

      </div>
    </div>
  );
}
