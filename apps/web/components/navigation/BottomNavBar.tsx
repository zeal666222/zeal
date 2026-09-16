"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, MessageCircle, User } from "lucide-react";

export function BottomNavBar() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-24 bg-slate-950/90 backdrop-blur-3xl border-t border-white/5 flex items-center justify-between px-6 sm:px-12 pb-4 pt-2">
      
      <NavIcon href="/" icon={Home} label="Home" currentPath={pathname} />
      <NavIcon href="/explore" icon={Compass} label="Explore" currentPath={pathname} />

      {/* CENTER: 9-Second Morphing 3D 'Z' Button */}
      <div className="relative -top-6">
        <button className="btn-3d w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-700 border border-purple-400/50 flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.3)] morph-container group">
          <div className="relative w-8 h-8 flex items-center justify-center">
            {/* The 3 Lines controlled by globals.css keyframes */}
            <div className="morph-line morph-line-1" />
            <div className="morph-line morph-line-2" />
            <div className="morph-line morph-line-3" />
          </div>
        </button>
      </div>

      <NavIcon href="/chat" icon={MessageCircle} label="Chat" currentPath={pathname} />
      <NavIcon href="/profile" icon={User} label="Profile" currentPath={pathname} />
      
    </div>
  );
}

function NavIcon({ href, icon: Icon, label, currentPath }: { href: string, icon: any, label: string, currentPath: string }) {
  const isActive = currentPath === href || (href !== '/' && currentPath.startsWith(href));
  return (
    <Link href={href} className="flex flex-col items-center gap-1 group no-tap-highlight">
      <div className={`p-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-white/10 text-white scale-110' : 'text-slate-500 group-hover:text-slate-300 group-active:scale-95'}`}>
        <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className="drop-shadow-lg" />
      </div>
      <span className={`text-[10px] font-bold tracking-wider uppercase transition-colors ${isActive ? 'text-white' : 'text-transparent group-hover:text-slate-500'}`}>
        {label}
      </span>
    </Link>
  );
}
