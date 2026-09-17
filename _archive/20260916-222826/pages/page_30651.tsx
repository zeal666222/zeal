"use client";
import { Hand, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
export default function PalmistryPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 py-24 px-4 text-center">
      <div className="max-w-2xl mx-auto bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-12 rounded-[2.5rem] shadow-2xl">
        <Hand className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
        <h1 className="text-4xl font-medium mb-4">Palmistry Vision AI</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8 font-light">Neural line extraction for Heart, Head, and Life lines with instant energetic interpretation.</p>
        <Link href="/explore" className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-full font-bold">
          Explore All Tools <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
