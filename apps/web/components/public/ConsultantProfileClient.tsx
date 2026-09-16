"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { initiateSessionAction } from "@/actions/signaling";
import { useRouter } from "next/navigation";
import { 
  Star, Shield, Phone, MessageSquare, Sparkles, Image as ImageIcon
} from "lucide-react";

type PublicProfile = { id: string; full_name: string; avatar_url: string | null; cover_url: string | null; is_ai: boolean; is_online: boolean; };
type Post = { id: string; image_url: string | null; content: string; created_at: string; };

export function ConsultantProfileClient({ initialProfile, posts }: { initialProfile: PublicProfile; posts: Post[]; }) {
  const [profile, setProfile] = useState<PublicProfile>(initialProfile);
  const [activeTab, setActiveTab] = useState<"grid" | "about">("grid");
  const [callState, setCallState] = useState<'idle' | 'calling' | 'declined'>('idle');
  const router = useRouter();

  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  useEffect(() => {
    const channel = supabase.channel(`public:profile:${profile.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profile.id}` },
        (payload) => { if (payload.new && typeof payload.new.is_online === 'boolean') setProfile(prev => ({ ...prev, is_online: payload.new.is_online })); }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile.id, supabase]);

  const handleInitiateSession = async () => {
    setCallState('calling');
    const res = await initiateSessionAction(profile.id);
    
    if (!res.success) {
      alert(res.error);
      setCallState('idle');
      return;
    }

    if (res.status === 'active') {
      // Auto-accepted by AI
      router.push(`/chat/${res.sessionId}`);
      return;
    }

    // If Ringing, listen for the human consultant's response
    const ringChannel = supabase.channel(`ringing:${res.sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'session_requests', filter: `id=eq.${res.sessionId}` },
        (payload) => {
          if (payload.new.status === 'active') {
            router.push(`/chat/${payload.new.id}`);
          } else if (payload.new.status === 'declined') {
            setCallState('declined');
            setTimeout(() => setCallState('idle'), 3000);
          }
        }
      ).subscribe();
  };

  const fallbackCover = "bg-gradient-to-tr from-slate-900 via-indigo-950 to-purple-900";
  const fallbackAvatar = "bg-gradient-to-br from-indigo-500 to-purple-600 text-white";

  return (
    <div className="min-h-screen-app bg-slate-950 pb-24 md:pb-0 flex flex-col relative">
      <div className="relative w-full h-48 md:h-80 bg-slate-900">
        {profile.cover_url ? <img src={profile.cover_url} alt="Cover" className="w-full h-full object-cover" /> : <div className={`w-full h-full ${fallbackCover} flex items-center justify-center opacity-80`} />}
        <div className="absolute bottom-0 w-full h-24 bg-gradient-to-t from-slate-950 to-transparent" />
      </div>

      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 relative -mt-16 md:-mt-24 z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-3">
            <div className="relative inline-block">
              {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.full_name} className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-slate-950 object-cover bg-slate-900" /> : <div className={`w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-slate-950 flex items-center justify-center text-4xl font-black shadow-2xl ${fallbackAvatar}`}>{profile.full_name.charAt(0)}</div>}
              <div className={`absolute bottom-2 right-2 w-6 h-6 rounded-full border-4 border-slate-950 transition-colors duration-500 ${profile.is_online ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 'bg-slate-500'}`} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white flex items-center gap-2">{profile.full_name}{profile.is_ai && <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 text-purple-400 text-[10px] uppercase font-black tracking-widest rounded flex items-center gap-1"><Sparkles size={10} /> AI Persona</span>}</h1>
              <p className="text-slate-400 text-sm font-medium mt-1">Master Astrologer & Spiritual Guide</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-3 mb-2">
            <button 
              onClick={handleInitiateSession}
              disabled={!profile.is_online || callState !== 'idle'}
              className={`px-8 py-3.5 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-xl ${!profile.is_online ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : callState === 'declined' ? 'bg-rose-600 text-white' : callState === 'calling' ? 'bg-indigo-600 text-white animate-pulse' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
            >
              <Phone size={18} /> {callState === 'calling' ? 'Ringing...' : callState === 'declined' ? 'Busy' : 'Initiate Live Session'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-8 mt-10 border-b border-white/5">
          <button onClick={() => setActiveTab("grid")} className={`pb-4 text-sm font-bold uppercase tracking-wider transition-colors relative ${activeTab === "grid" ? "text-white" : "text-slate-500"}`}>Content Grid {activeTab === "grid" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white rounded-t-full" />}</button>
          <button onClick={() => setActiveTab("about")} className={`pb-4 text-sm font-bold uppercase tracking-wider transition-colors relative ${activeTab === "about" ? "text-white" : "text-slate-500"}`}>About {activeTab === "about" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white rounded-t-full" />}</button>
        </div>

        <div className="py-8">
          {activeTab === "grid" && posts.map((post) => (
             <div key={post.id} className="aspect-square bg-slate-900 border border-white/5 rounded-2xl overflow-hidden relative group">
                <div className="w-full h-full flex items-center justify-center p-4 text-center bg-gradient-to-br from-slate-900 to-slate-950"><p className="text-xs md:text-sm text-slate-300">{post.content}</p></div>
             </div>
          ))}
          {activeTab === "about" && <div className="text-slate-300 leading-relaxed"><p>I am dedicated to providing clarity...</p></div>}
        </div>
      </div>

      {/* Sticky Mobile CTA */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-slate-950/90 backdrop-blur-2xl border-t border-white/10 z-50">
        <button 
          onClick={handleInitiateSession}
          disabled={!profile.is_online || callState !== 'idle'}
          className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${!profile.is_online ? 'bg-slate-800 text-slate-500' : callState === 'calling' ? 'bg-indigo-600 text-white animate-pulse' : 'bg-emerald-600 text-white'}`}
        >
          <Phone size={20} /> {callState === 'calling' ? 'Ringing...' : 'Initiate Live Session'}
        </button>
      </div>
    </div>
  );
}
