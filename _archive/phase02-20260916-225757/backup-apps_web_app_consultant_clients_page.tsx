"use client";
export const dynamic = "force-dynamic";

import { User, Home } from "lucide-react";

export default function ConsultantClientsPage() {
  const clients = [
    { id: "1", name: "Sarah Jenkins", sessions: 4, lastConsult: "2026-03-10" }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => window.location.href = "/consultant/dashboard"} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-purple-400 mb-8">
          <Home size={16} /> Back to Dashboard
        </button>

        <div className="bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl">
          <h1 className="text-3xl font-bold mb-2">Client Roster</h1>
          <p className="text-slate-400 font-light mb-8">View client history and relationship notes.</p>

          <div className="space-y-4">
            {clients.map((c: any) => (
              <div key={c.id} className="p-6 bg-slate-950/50 rounded-2xl border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold">{c.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Total Sessions: {c.sessions} | Last: {c.lastConsult}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
