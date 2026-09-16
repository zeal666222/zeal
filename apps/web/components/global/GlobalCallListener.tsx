"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { PhoneCall, X, Check, Phone } from "lucide-react";
import { respondToSessionAction } from "@/actions/signaling";
import { useRouter } from "next/navigation";

export function GlobalCallListener({ userId }: { userId: string }) {
  const [incomingCall, setIncomingCall] = useState<{ id: string, seeker_id: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!userId) return;

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const channel = supabase
      .channel('global_ringing')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'session_requests', filter: `consultant_id=eq.${userId}` },
        (payload) => {
          if (payload.new.status === 'ringing') {
            setIncomingCall({ id: payload.new.id, seeker_id: payload.new.seeker_id });
            // In a real app, play HTML5 Audio chime here
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const handleResponse = async (status: 'active' | 'declined') => {
    if (!incomingCall) return;
    const sessionId = incomingCall.id;
    setIncomingCall(null); // Instantly close modal

    await respondToSessionAction(sessionId, status);
    
    if (status === 'active') {
      router.push(`/session/${sessionId}`);
    }
  };

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300 px-4">
      <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-500">
        
        <div className="w-24 h-24 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center mb-6 relative">
          <div className="absolute inset-0 rounded-full border border-emerald-500 animate-ping opacity-75" />
          <PhoneCall size={40} className="text-emerald-400 animate-pulse" />
        </div>
        
        <h2 className="text-2xl font-black text-white mb-2">Incoming Session</h2>
        <p className="text-slate-400 text-sm mb-8">A seeker is requesting your guidance.</p>

        <div className="flex items-center gap-6 w-full justify-center">
          <button 
            onClick={() => handleResponse('declined')}
            className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/30 transition-transform active:scale-90"
          >
            <X size={28} />
          </button>
          <button 
            onClick={() => handleResponse('active')}
            className="w-20 h-20 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white shadow-xl shadow-emerald-500/40 transition-transform active:scale-90 animate-bounce"
          >
            <Check size={36} />
          </button>
        </div>
      </div>
    </div>
  );
}
