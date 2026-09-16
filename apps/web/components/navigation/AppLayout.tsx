"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { 
  Sparkles, Compass, MessageCircle, Shield, Briefcase, 
  User, IndianRupee 
} from "lucide-react";
import React from "react";

export type Profile = {
  id: string;
  role: string;
  wallet_balance: number;
  full_name: string;
  avatar_url: string | null;
} | null;

export function AppLayout({ children, user, profile }: { children: React.ReactNode, user: any, profile: Profile }) {
  const pathname = usePathname();
  
  // Smart Routing: Detect full-screen views where navigation should get out of the way
  const isChatRoom = pathname.startsWith('/chat/') && pathname !== '/chat';
  const isPublicProfile = pathname.startsWith('/consultant/') && pathname !== '/consultant/dashboard';
  const isAuth = pathname === '/login' || pathname === '/register';
  const isApply = pathname === '/apply';

  const hideTopBar = isChatRoom || isAuth || isApply;
  const hideBottomDock = isChatRoom || isAuth || isApply || isPublicProfile;

  const role = profile?.role || 'user';
  const balance = profile?.wallet_balance || 0;

  return (
    <div className="flex flex-col h-screen-app overflow-hidden bg-slate-950 w-full relative">
      
      {/* 1. PERSISTENT TOP BAR */}
      {!hideTopBar && (
        <header className="absolute top-0 left-0 right-0 z-40 h-16 bg-slate-950/80 backdrop-blur-2xl border-b border-white/10 flex items-center justify-between px-4 sm:px-6">
          <Link href="/explore" className="flex items-center gap-2 active:scale-95 transition-transform">
            <Sparkles className="text-purple-500" size={20} />
            <span className="font-black text-xl tracking-tight text-white">Zeal</span>
          </Link>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-bold shadow-inner">
                   <IndianRupee size={14} />
                   <span>{Number(balance).toFixed(2)}</span>
                </div>
                <Link href="/profile" className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-xs uppercase overflow-hidden active:scale-90 transition-transform">
                   {profile?.avatar_url ? (
                     <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                   ) : (
                     profile?.full_name?.charAt(0) || 'U'
                   )}
                </Link>
              </div>
            ) : (
              <Link href="/login" className="text-sm font-bold text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full transition-colors active:scale-95">
                Log In
              </Link>
            )}
          </div>
        </header>
      )}
      
      {/* 2. SCROLLABLE MAIN CONTENT */}
      {/* If top bar is hidden, we assume the child component handles its own layout styling */}
      <main className={`flex-1 relative w-full ${!hideTopBar ? 'pt-16 pb-28 overflow-y-auto custom-scrollbar' : 'flex flex-col overflow-hidden'}`}>
        {children}
      </main>

      {/* 3. FLOATING BOTTOM DOCK (App-Like Navigation) */}
      {!hideBottomDock && (
        <div className="absolute bottom-4 sm:bottom-6 left-0 right-0 z-40 flex justify-center pointer-events-none px-4">
          <nav className="pointer-events-auto bg-slate-900/90 backdrop-blur-3xl border border-white/10 rounded-full px-6 py-3.5 flex items-center gap-6 sm:gap-10 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)]">
            <DockItem href="/explore" icon={Compass} currentPath={pathname} />
            <DockItem href="/chat" icon={MessageCircle} currentPath={pathname} />
            
            {/* Contextual Dashboard Link based on Role */}
            {(role === 'admin' || role === 'superadmin' || role === 'super_admin') ? (
              <DockItem href="/admin/dashboard" icon={Shield} currentPath={pathname} />
            ) : role === 'consultant' ? (
              <DockItem href="/consultant/dashboard" icon={Briefcase} currentPath={pathname} />
            ) : null}

            <DockItem href="/profile" icon={User} currentPath={pathname} />
          </nav>
        </div>
      )}
    </div>
  );
}

function DockItem({ href, icon: Icon, currentPath }: { href: string, icon: any, currentPath: string }) {
  const isActive = currentPath === href || (href !== '/' && currentPath.startsWith(href));

  return (
    <Link href={href} className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${isActive ? 'text-purple-400' : 'text-slate-500 hover:text-slate-300'}`}>
      <div className={`relative p-1.5 rounded-full ${isActive ? 'bg-purple-500/20' : ''}`}>
        <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
        {isActive && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-purple-400" />}
      </div>
    </Link>
  );
}
