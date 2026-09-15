"use client";

import { useState, useEffect } from "react";
import { processApplicationAction } from "@/actions/admin";
import { CheckCircle2, XCircle, Loader2, Sparkles, Clock } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

type Application = {
  id: string;
  user_id: string;
  full_name: string;
  expertise: string;
  bio: string;
  created_at: string;
};

export function ApplicationReviewBoard({ initialApplications }: { initialApplications: Application[] }) {
  const [applications, setApplications] = useState<Application[]>(initialApplications);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    // Connect to Supabase Realtime WebSockets
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const channel = supabase
      .channel('realtime_applications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'consultant_applications', filter: "status=eq.pending" },
        (payload) => {
          // Instantly inject new application into the UI without refreshing
          setApplications((current) => [payload.new as Application, ...current]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAction = async (appId: string, userId: string, action: 'approve' | 'reject') => {
    setProcessingId(appId);
    const res = await processApplicationAction(appId, userId, action);
    
    if (res.success) {
      // Remove it from the pending UI list instantly
      setApplications(applications.filter(app => app.id !== appId));
    } else {
      alert("Error processing application: " + res.error);
    }
    setProcessingId(null);
  };

  if (applications.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center border-2 border-dashed border-white/5 rounded-3xl bg-slate-950/50 p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
            <Clock size={24} />
          </div>
          <h4 className="text-lg font-bold text-slate-300 mb-2">Queue Empty</h4>
          <p className="text-sm text-slate-500">Listening for new consultant applications in real-time...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
      {applications.map((app) => (
        <div key={app.id} className="p-5 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-lg font-bold text-white flex items-center gap-2">
                {app.full_name} 
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-xs uppercase tracking-wider border border-indigo-500/30">
                  {app.expertise}
                </span>
              </h4>
              <p className="text-xs text-slate-400 mt-1">Applied: {new Date(app.created_at).toLocaleString()}</p>
            </div>
          </div>
          
          <div className="p-4 bg-slate-950/50 rounded-xl border border-white/5 text-sm text-slate-300 leading-relaxed">
            "{app.bio}"
          </div>

          <div className="flex gap-3 mt-2">
            <button 
              onClick={() => handleAction(app.id, app.user_id, 'approve')}
              disabled={processingId === app.id}
              className="flex-1 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
            >
              {processingId === app.id ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Approve & Escalate</>}
            </button>
            <button 
              onClick={() => handleAction(app.id, app.user_id, 'reject')}
              disabled={processingId === app.id}
              className="px-5 py-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-xl text-sm font-bold transition-all flex items-center justify-center"
            >
              <XCircle size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
