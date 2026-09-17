"use client";

import { Home, Compass, Calendar, User } from "lucide-react";
import { useEffect, useState } from "react";

export function BottomBar() {
  const [triggerAnim, setTriggerAnim] = useState(false);

  // 9-second periodic animation trigger for the 3D Z triangle morph
  useEffect(() => {
    const interval = setInterval(() => {
      setTriggerAnim(true);
      setTimeout(() => setTriggerAnim(false), 1500); // Animation duration
    }, 9000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 px-4 py-3 flex items-center justify-around shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-colors duration-500">
      
      {/* 1. Home */}
      <button 
        onClick={() => window.location.href = "/"}
        className="flex flex-col items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors w-16 cursor-pointer"
      >
        <Home size={22} />
        <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Home</span>
      </button>

      {/* 2. Explore */}
      <button 
        onClick={() => window.location.href = "/explore"}
        className="flex flex-col items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors w-16 cursor-pointer"
      >
        <Compass size={22} />
        <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Explore</span>
      </button>

      {/* 3. Center 3D Animated 'Z' Premium Button (Triggers every 9s) */}
      <div className="relative -top-6">
        <button 
          onClick={() => window.location.href = "/services"}
          className={`w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-600 text-white flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.7)] hover:scale-110 transition-all duration-700 border-4 border-slate-50 dark:border-slate-950 cursor-pointer ${triggerAnim ? 'rotate-[360deg] scale-110 shadow-[0_0_40px_rgba(236,72,153,0.9)]' : ''}`}
        >
          <div className="font-black text-2xl tracking-tighter flex items-center">
            <span>Z</span>
          </div>
        </button>
      </div>

      {/* 4. Bookings */}
      <button 
        onClick={() => window.location.href = "/bookings"}
        className="flex flex-col items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors w-16 cursor-pointer"
      >
        <Calendar size={22} />
        <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Bookings</span>
      </button>

      {/* 5. Profile */}
      <button 
        onClick={() => window.location.href = "/profile"}
        className="flex flex-col items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors w-16 cursor-pointer"
      >
        <User size={22} />
        <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Profile</span>
      </button>
    </div>
  );
}
