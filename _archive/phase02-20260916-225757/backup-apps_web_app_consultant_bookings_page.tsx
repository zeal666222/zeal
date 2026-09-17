"use client";
export const dynamic = "force-dynamic";

import { Calendar, Clock, Home, ShieldCheck } from "lucide-react";

export default function ConsultantBookingsPage() {
  const bookings = [
    { id: "1", client: "Alexander Vance", date: "2026-03-25", time: "10:00 AM", status: "Confirmed" }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => window.location.href = "/consultant/dashboard"} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-purple-400 mb-8">
          <Home size={16} /> Back to Dashboard
        </button>

        <div className="bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl">
          <h1 className="text-3xl font-bold mb-2">Incoming Bookings</h1>
          <p className="text-slate-400 font-light mb-8">Review and join scheduled client sessions.</p>

          <div className="space-y-4">
            {bookings.map((b: any) => (
              <div key={b.id} className="p-6 bg-slate-950/50 rounded-2xl border border-white/5 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-lg">{b.client}</h4>
                  <p className="text-xs text-slate-400 mt-1">{b.date} at {b.time}</p>
                </div>
                <button onClick={() => alert("Launching encrypted room...")} className="px-5 py-2.5 bg-purple-600 text-white rounded-xl font-medium text-sm">
                  Join Room
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
