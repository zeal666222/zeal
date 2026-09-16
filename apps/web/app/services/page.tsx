import Link from "next/link";
import { Sparkles, Video, MessageCircle, ArrowRight } from "lucide-react";

export default function ServicesPage() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-10 text-center relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none" />
      
      <div className="relative z-10 max-w-2xl w-full flex flex-col items-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center mb-6 shadow-2xl">
          <Sparkles size={36} className="text-purple-400" />
        </div>
        
        <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-purple-100 to-purple-400 mb-4 tracking-tight">
          Metaphysical Services
        </h1>
        <p className="text-slate-400 text-sm sm:text-base mb-10 max-w-lg leading-relaxed">
          Access our elite directory of Vedic Astrologers, Tarot Intuitives, and AI Personas. Connect instantly via secure WebRTC or end-to-end encrypted chat.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <div className="p-6 bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl flex flex-col items-center text-center">
            <Video size={32} className="text-emerald-400 mb-4" />
            <h3 className="font-bold text-white text-lg mb-2">Live Video Sessions</h3>
            <p className="text-xs text-slate-400 mb-6 flex-1">Face-to-face spiritual guidance with WebRTC peer-to-peer encryption.</p>
            <Link href="/explore" className="btn-3d w-full py-3 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-sm font-bold text-white transition-all flex justify-center gap-2">Book Now <ArrowRight size={16}/></Link>
          </div>
          
          <div className="p-6 bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl flex flex-col items-center text-center">
            <MessageCircle size={32} className="text-indigo-400 mb-4" />
            <h3 className="font-bold text-white text-lg mb-2">AI Persona Chat</h3>
            <p className="text-xs text-slate-400 mb-6 flex-1">Instant, hyper-accurate readings from our trained Metaphysical AI.</p>
            <Link href="/explore" className="btn-3d w-full py-3 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-sm font-bold text-white transition-all flex justify-center gap-2">Start Chat <ArrowRight size={16}/></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
