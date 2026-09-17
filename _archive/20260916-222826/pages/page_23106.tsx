"use client";
export const dynamic = "force-dynamic";

import { Home } from "lucide-react";

export default function ConsultantWhiteLabelPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => window.location.href = "/consultant/dashboard"} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-purple-400 mb-8">
          <Home size={16} /> Back to Dashboard
        </button>

        <div className="bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl">
          <h1 className="text-3xl font-bold mb-2">White-Label Branding</h1>
          <p className="text-slate-400 font-light mb-8">Configure your custom domain and branding portal.</p>
          <div className="p-8 bg-slate-950/50 rounded-2xl border border-white/5 text-center">
            <p className="text-slate-400">Custom white-label domain mapping is active for elite partners.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
