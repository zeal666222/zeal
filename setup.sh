#!/usr/bin/env bash
# ==============================================================================
# PROJECT ZEAL — PUBLIC GATEWAY & PREMIUM NAVIGATION UPGRADE
# ==============================================================================
set -euo pipefail

INFO="\033[1;34m[INFO]\033[0m"
SUCCESS="\033[1;32m[SUCCESS]\033[0m"

echo -e "${INFO} 1. Upgrading Edge Middleware for Public Discovery (apps/web/proxy.ts)..."
cat << 'EOF' > apps/web/proxy.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  
  // Define Route Categories
  const isAuthRoute = path.startsWith('/login') || path.startsWith('/register') || path.startsWith('/apply');
  
  // Public routes anyone can view
  const isPublicRoute = path === '/' || 
                        path.startsWith('/explore') || 
                        path.startsWith('/services') ||
                        (path.startsWith('/consultant/') && !path.startsWith('/consultant/dashboard'));

  // Static Assets Bypass
  if (path.startsWith('/api') || path.startsWith('/_next') || path.match(/\.(.*)$/)) {
    return response
  }

  // Gateway: If not logged in and trying to access a private route, send to login
  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectedFrom', path)
    return NextResponse.redirect(url)
  }

  // RBAC for Authenticated Users
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const role = profile?.role || 'user'

    if (path.startsWith('/admin') && !['admin', 'superadmin', 'super_admin'].includes(role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/explore'
      return NextResponse.redirect(url)
    }

    if (path.startsWith('/consultant/dashboard') && role !== 'consultant' && !['admin', 'superadmin', 'super_admin'].includes(role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/explore'
      return NextResponse.redirect(url)
    }

    // Keep logged-in users out of auth routes
    if (isAuthRoute) {
      const url = request.nextUrl.clone()
      if (['admin', 'superadmin', 'super_admin'].includes(role)) url.pathname = '/admin/dashboard'
      else if (role === 'consultant') url.pathname = '/consultant/dashboard'
      else url.pathname = '/explore'
      return NextResponse.redirect(url)
    }
  }
  return response
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] }
EOF

echo -e "${INFO} 2. Enhancing Top NavBar Responsiveness & Premium Auth States (apps/web/components/navigation/TopNavBar.tsx)..."
cat << 'EOF' > apps/web/components/navigation/TopNavBar.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sun, Moon, Bell, IndianRupee, Sparkles, UserCircle } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { usePathname } from "next/navigation";

export function TopNavBar({ userId, initialBalance }: { userId: string | null; initialBalance: number }) {
  const [balance, setBalance] = useState(initialBalance);
  const [isDark, setIsDark] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    if (!userId) return;
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const channel = supabase
      .channel('wallet_sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, 
        (payload) => {
          if (payload.new && payload.new.wallet_balance !== undefined) setBalance(payload.new.wallet_balance);
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 sm:h-20 bg-slate-950/80 backdrop-blur-3xl border-b border-white/5 flex items-center justify-between px-3 sm:px-8 shadow-sm transition-all">
      
      {/* LEFT: 3D Theme Toggle */}
      <div className="flex-1 flex items-center">
        <button 
          onClick={() => setIsDark(!isDark)}
          className="btn-3d w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600 flex items-center justify-center text-slate-300 relative overflow-hidden active:scale-90 transition-transform"
          title="Toggle Theme"
        >
          <div className="absolute inset-0 bg-white/5 rounded-full pointer-events-none" />
          {isDark ? <Moon size={18} className="drop-shadow-lg" /> : <Sun size={18} className="drop-shadow-lg text-amber-400" />}
        </button>
      </div>

      {/* CENTER: Premium 3D Logo */}
      <div className="flex-1 flex justify-center">
        <Link href="/" className="relative flex items-center justify-center group no-tap-highlight hover:scale-105 transition-transform duration-300">
          <div className="absolute w-12 h-12 sm:w-16 sm:h-16 bg-purple-500/20 blur-xl rounded-full group-hover:bg-purple-500/40 transition-all duration-500 pointer-events-none" />
          <h1 className="text-3xl sm:text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-purple-200 to-purple-600 text-3d relative z-10">
            Zeal
          </h1>
        </Link>
      </div>

      {/* RIGHT: Real-Time Wallet / Auth Gateway */}
      <div className="flex-1 flex items-center justify-end gap-2 sm:gap-4">
        {userId ? (
          <>
            <Link href="/wallet" className="btn-3d hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-900 border border-emerald-500/50 text-white relative overflow-hidden group active:scale-95 transition-transform">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <IndianRupee size={16} className="drop-shadow-md" />
              <span className="font-black text-sm tracking-wide drop-shadow-md">{Number(balance).toFixed(2)}</span>
            </Link>
            
            <button className="btn-3d w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600 flex items-center justify-center text-slate-300 relative active:scale-90 transition-transform">
              <Bell size={18} className="drop-shadow-lg" />
              <span className="absolute top-2 right-2 sm:top-3 sm:right-3 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-900 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
            </button>
          </>
        ) : (
          <Link href={`/login?redirectedFrom=${pathname}`} className="btn-3d flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-2.5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 border border-purple-500/50 text-white relative overflow-hidden group active:scale-95 transition-transform">
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <UserCircle size={16} className="drop-shadow-md" />
            <span className="font-black text-xs sm:text-sm tracking-wide drop-shadow-md">Sign In</span>
          </Link>
        )}
      </div>
    </header>
  );
}
EOF

echo -e "${INFO} 3. Fixing Bottom NavBar Routing & Layout (apps/web/components/navigation/BottomNavBar.tsx)..."
cat << 'EOF' > apps/web/components/navigation/BottomNavBar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, MessageCircle, User } from "lucide-react";

export function BottomNavBar() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-20 sm:h-24 bg-slate-950/90 backdrop-blur-3xl border-t border-white/5 flex items-center justify-between px-4 sm:px-12 pb-safe">
      
      <NavIcon href="/" icon={Home} label="Home" currentPath={pathname} />
      <NavIcon href="/explore" icon={Compass} label="Explore" currentPath={pathname} />

      {/* CENTER: 9-Second Morphing 'Z' mapped to /services */}
      <Link href="/services" className="relative -top-5 sm:-top-7 no-tap-highlight group">
        <div className="btn-3d w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-700 border border-purple-400/50 flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.3)] morph-container">
          <div className="relative w-8 h-8 flex items-center justify-center">
            <div className="morph-line morph-line-1" />
            <div className="morph-line morph-line-2" />
            <div className="morph-line morph-line-3" />
          </div>
        </div>
      </Link>

      <NavIcon href="/chat" icon={MessageCircle} label="Chat" currentPath={pathname} />
      <NavIcon href="/profile" icon={User} label="Profile" currentPath={pathname} />
      
    </div>
  );
}

function NavIcon({ href, icon: Icon, label, currentPath }: { href: string, icon: any, label: string, currentPath: string }) {
  const isActive = currentPath === href || (href !== '/' && currentPath.startsWith(href));
  return (
    <Link href={href} className="flex flex-col items-center gap-1 group no-tap-highlight min-w-[60px]">
      <div className={`p-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-white/10 text-white scale-110 shadow-inner' : 'text-slate-500 group-hover:text-slate-300 group-active:scale-95'}`}>
        <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className="drop-shadow-lg" />
      </div>
      <span className={`text-[9px] sm:text-[10px] font-bold tracking-wider uppercase transition-colors ${isActive ? 'text-white' : 'text-transparent group-hover:text-slate-500'}`}>
        {label}
      </span>
    </Link>
  );
}
EOF

echo -e "${INFO} 4. Graceful Auth Interception on Consultant Profiles (apps/web/components/public/ConsultantProfileClient.tsx)..."
# We update the handleInitiateSession to catch the "Unauthorized" error and redirect to login securely.
cat << 'EOF' > apps/web/components/public/ConsultantProfileClient.tsx
"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { initiateSessionAction } from "@/actions/signaling";
import { useRouter, usePathname } from "next/navigation";
import { Star, Shield, Phone, MessageSquare, Sparkles, Image as ImageIcon } from "lucide-react";

type PublicProfile = { id: string; full_name: string; avatar_url: string | null; cover_url: string | null; is_ai: boolean; is_online: boolean; };
type Post = { id: string; image_url: string | null; content: string; created_at: string; };

export function ConsultantProfileClient({ initialProfile, posts }: { initialProfile: PublicProfile; posts: Post[]; }) {
  const [profile, setProfile] = useState<PublicProfile>(initialProfile);
  const [activeTab, setActiveTab] = useState<"grid" | "about">("grid");
  const [callState, setCallState] = useState<'idle' | 'calling' | 'declined'>('idle');
  const router = useRouter();
  const pathname = usePathname();

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
    
    // Auth Interceptor Logic
    if (!res.success) {
      if (res.error === "Unauthorized") {
        router.push(`/login?redirectedFrom=${pathname}`);
        return;
      }
      alert(res.error);
      setCallState('idle');
      return;
    }

    if (res.status === 'active') {
      router.push(`/chat/${res.sessionId}`);
      return;
    }

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
    <div className="flex flex-col relative w-full">
      <div className="relative w-full h-48 md:h-80 bg-slate-900">
        {profile.cover_url ? <img src={profile.cover_url} alt="Cover" className="w-full h-full object-cover" /> : <div className={`w-full h-full ${fallbackCover} flex items-center justify-center opacity-80`} />}
        <div className="absolute bottom-0 w-full h-24 bg-gradient-to-t from-slate-950 to-transparent" />
      </div>

      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 relative -mt-16 md:-mt-24 z-10 pb-10">
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
              className={`btn-3d px-8 py-3.5 rounded-full font-bold flex items-center gap-2 transition-all shadow-xl ${!profile.is_online ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : callState === 'declined' ? 'bg-rose-600 text-white' : callState === 'calling' ? 'bg-indigo-600 text-white animate-pulse' : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white'}`}
            >
              <Phone size={18} className="drop-shadow-md"/> <span className="drop-shadow-md">{callState === 'calling' ? 'Ringing...' : callState === 'declined' ? 'Busy' : 'Initiate Live Session'}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-8 mt-10 border-b border-white/5">
          <button onClick={() => setActiveTab("grid")} className={`pb-4 text-sm font-bold uppercase tracking-wider transition-colors relative ${activeTab === "grid" ? "text-white" : "text-slate-500"}`}>Content Grid {activeTab === "grid" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white rounded-t-full shadow-[0_0_10px_white]" />}</button>
          <button onClick={() => setActiveTab("about")} className={`pb-4 text-sm font-bold uppercase tracking-wider transition-colors relative ${activeTab === "about" ? "text-white" : "text-slate-500"}`}>About {activeTab === "about" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white rounded-t-full shadow-[0_0_10px_white]" />}</button>
        </div>

        <div className="py-8">
          {activeTab === "grid" && (
            posts.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl"><ImageIcon size={40} className="mx-auto text-slate-600 mb-4" /><h3 className="text-lg font-bold text-slate-300">No content yet</h3></div>
            ) : (
              <div className="grid grid-cols-3 gap-1 md:gap-4">
                {posts.map((post) => (
                  <div key={post.id} className="aspect-square bg-slate-900 border border-white/5 rounded-lg md:rounded-2xl overflow-hidden relative group cursor-pointer hover:border-white/20 transition-all">
                    {post.image_url ? <img src={post.image_url} alt="Post" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center p-4 text-center bg-gradient-to-br from-slate-900 to-slate-950"><p className="text-xs md:text-sm text-slate-300 line-clamp-4">{post.content}</p></div>}
                  </div>
                ))}
              </div>
            )
          )}
          {activeTab === "about" && <div className="text-slate-300 leading-relaxed"><p>I am dedicated to providing clarity...</p></div>}
        </div>
      </div>

      {/* Sticky Mobile CTA wrapped in btn-3d styling */}
      <div className="md:hidden fixed bottom-24 left-4 right-4 z-40 flex justify-center">
        <button 
          onClick={handleInitiateSession}
          disabled={!profile.is_online || callState !== 'idle'}
          className={`btn-3d w-full py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-2xl ${!profile.is_online ? 'bg-slate-800 text-slate-500 border border-slate-700 opacity-90' : callState === 'calling' ? 'bg-indigo-600 text-white animate-pulse' : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white'}`}
        >
          <Phone size={20} className="drop-shadow-md"/> <span className="drop-shadow-md">{callState === 'calling' ? 'Ringing...' : 'Initiate Live Session'}</span>
        </button>
      </div>
    </div>
  );
}
EOF

echo -e "${INFO} 5. Creating Premium Services Hub Route (apps/web/app/services/page.tsx)..."
mkdir -p apps/web/app/services
cat << 'EOF' > apps/web/app/services/page.tsx
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
EOF

echo -e "${INFO} 6. Running Strict TypeScript Sweep..."
if npx tsc --noEmit --project apps/web/tsconfig.json; then
    echo -e "${SUCCESS} Build Verified."
else
    echo -e "${ERR_MSG} TS Error."
    exit 1
fi

echo -e "${INFO} 7. Running Production Build & Syncing to GitHub..."
if npm run build; then
    echo -e "${SUCCESS} Build Complete!"
    git add -A
    git commit -m "feat(zeal): unlock public gateway for discovery and refine premium 3D responsive navigation" || true
    git push -u origin main
    echo -e "${SUCCESS} ====================================================================="
    echo -e "${SUCCESS} ENTERPRISE PUBLIC GATEWAY & NAVIGATION FIXES DEPLOYED!"
    echo -e "${SUCCESS} ====================================================================="
else
    echo -e "${ERR_MSG} Build failed."
    exit 1
fi