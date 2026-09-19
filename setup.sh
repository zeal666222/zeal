#!/usr/bin/env bash
# CRLF self-heal
if [[ -f "$0" ]] && [[ "$(head -c 2048 "$0" | tr -cd '\r' | wc -c)" -gt 0 ]]; then
  _tmp="$(mktemp)"; tr -d '\r' < "$0" > "$_tmp"; chmod +x "$_tmp"; exec bash "$_tmp" "$@"
fi

# NOTE: deliberately NO `set -u` — partial pastes break it
set -o pipefail
IFS=$'\n\t'

# HOME fix
if [[ "${HOME:-}" == *"Program Files"* ]]; then HOME="/c/Users/${USERNAME:-$USER}"; export HOME; fi

# Colors
G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; C='\033[0;36m'; B='\033[1m'; N='\033[0m'
ok()   { printf "${G}✓${N} %s\n" "$1"; }
warn() { printf "${Y}⚠${N} %s\n" "$1"; }
err()  { printf "${R}✗${N} %s\n" "$1"; }
sec()  { printf "\n${C}${B}▶ %s${N}\n\n" "$1"; }

# Find repo root
d="$PWD"
while [[ "$d" != "/" && "$d" != "." ]]; do
  [[ -f "$d/package.json" && -d "$d/apps" && -d "$d/packages" ]] && break
  p="$(cd "$d/.." 2>/dev/null && pwd || echo "/")"
  [[ "$p" == "$d" ]] && break
  d="$p"
done
[[ -f "$d/package.json" && -d "$d/apps" ]] || { err "Not in zeal repo"; exit 1; }
cd "$d"
echo "Repo: $PWD"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
BK=".zeal-backup/fix-$TS"
mkdir -p "$BK"
echo "Backup: $BK"
echo ""

# Helper: write file from stdin
w() {
  local p="$1"
  mkdir -p "$(dirname "$p")"
  if [[ -f "$p" ]]; then
    cp "$p" "$BK/$(echo "$p" | tr '/' '_')"
  fi
  cat > "$p"
  ok "$p"
}

# ═════════════════════════════════════════════════════════════════
sec "FIX 1 — packages/database exports (add ./auth-handoff)"

if [[ -f "packages/database/package.json" ]]; then
  node -e "
    const fs = require('fs');
    const path = 'packages/database/package.json';
    const p = JSON.parse(fs.readFileSync(path, 'utf8'));
    p.exports = p.exports || { '.': './src/index.ts' };
    p.exports['./auth-handoff'] = './src/auth-handoff.ts';
    p.exports['./client'] = p.exports['./client'] || './src/client.ts';
    p.exports['./server'] = p.exports['./server'] || './src/server.ts';
    p.exports['./rpc']    = p.exports['./rpc']    || './src/rpc/index.ts';
    fs.writeFileSync(path, JSON.stringify(p, null, 2) + '\n');
  "
  ok "packages/database/package.json — ./auth-handoff added"
else
  err "packages/database/package.json missing"
fi

# ═════════════════════════════════════════════════════════════════
sec "FIX 2 — packages/database auth-handoff.ts (create if missing)"

if [[ -f "packages/database/src/auth-handoff.ts" ]]; then
  ok "auth-handoff.ts already exists"
else
  w "packages/database/src/auth-handoff.ts" << 'ZEALEOF_HANDOFF'
import "server-only";
import { createAdminClient } from "./server";

export async function generateAdminHandoff(email: string): Promise<string | null> {
  const adminUrl = (process.env.NEXT_PUBLIC_ADMIN_URL ?? "").replace(/\/$/, "");
  if (!adminUrl) return null;

  const admin = createAdminClient();
  if (!admin) return null;

  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${adminUrl}/auth/handoff` },
    });
    if (error || !data?.properties?.hashed_token) return null;

    const url = new URL(`${adminUrl}/auth/handoff`);
    url.searchParams.set("token_hash", data.properties.hashed_token);
    url.searchParams.set("type", "magiclink");
    return url.toString();
  } catch {
    return null;
  }
}
ZEALEOF_HANDOFF
fi

# ═════════════════════════════════════════════════════════════════
sec "FIX 3 — apps/admin/lib/rate-limit/index.ts (create)"

w "apps/admin/lib/rate-limit/index.ts" << 'ZEALEOF_RATELIMIT'
// apps/admin/lib/rate-limit/index.ts
// Postgres-backed rate limiter via check_rate_limit RPC.
// Fails open in dev, fails closed in prod (unless bypass env is set).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
function getClient(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _client;
}

export interface RateLimitResult {
  success: boolean; limit: number; remaining: number; reset: number; count: number;
}
export interface RateLimitCheck {
  ok: boolean; headers?: Record<string, string>; retryAfter?: number;
}
interface LimiterConfig { tokens: number; windowSeconds: number; prefix: string; }

async function checkLimit(c: LimiterConfig, id: string): Promise<RateLimitResult> {
  const sb = getClient();
  const allowBypass = process.env.ALLOW_RATE_LIMIT_BYPASS === "true";
  const failOpen = process.env.NODE_ENV !== "production" || allowBypass;

  const failed: RateLimitResult = failOpen
    ? { success: true,  limit: c.tokens, remaining: c.tokens, reset: Date.now() + c.windowSeconds * 1000, count: 0 }
    : { success: false, limit: c.tokens, remaining: 0,       reset: Date.now() + c.windowSeconds * 1000, count: c.tokens };

  if (!sb) return failed;
  try {
    const { data, error } = await (sb as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    }).rpc("check_rate_limit", {
      p_key: `zeal:rl:${c.prefix}:${id}`,
      p_limit: c.tokens,
      p_window_sec: c.windowSeconds,
    });
    if (error || !data) return failed;
    return data as RateLimitResult;
  } catch {
    return failed;
  }
}

function createLimiter(tokens: number, windowSeconds: number, prefix: string) {
  const c: LimiterConfig = { tokens, windowSeconds, prefix };
  return { limit: (id: string) => checkLimit(c, id) };
}

export const generalLimiter  = createLimiter(60, 60, "general");
export const authLimiter     = createLimiter(5,  60, "auth");
export const aiRateLimiter   = createLimiter(10, 60, "ai");
export const aiStrictLimiter = createLimiter(3,  60, "ai-strict");

export async function checkRateLimit(
  limiter: { limit: (id: string) => Promise<RateLimitResult> },
  id: string,
): Promise<RateLimitCheck> {
  const r = await limiter.limit(id);
  const headers: Record<string, string> = {
    "X-RateLimit-Limit":     String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset":     String(r.reset),
  };
  if (!r.success) {
    const ra = Math.max(1, Math.ceil((r.reset - Date.now()) / 1000));
    return { ok: false, headers: { ...headers, "Retry-After": String(ra) }, retryAfter: ra };
  }
  return { ok: true, headers };
}
ZEALEOF_RATELIMIT

# Mirror to web if missing
if [[ ! -f "apps/web/lib/rate-limit/index.ts" ]]; then
  w "apps/web/lib/rate-limit/index.ts" << 'ZEALEOF_RATELIMIT_WEB'
export {
  checkRateLimit, generalLimiter, authLimiter, aiRateLimiter, aiStrictLimiter,
} from "../../../../packages/database/src/rate-limit";
ZEALEOF_RATELIMIT_WEB
  warn "apps/web/lib/rate-limit/index.ts may need adjustment"
fi

# ═════════════════════════════════════════════════════════════════
sec "FIX 4 — Homepage → Server Component (real data)"

# 4a. page.tsx — Server Component
w "apps/web/app/page.tsx" << 'ZEALEOF_PAGE'
import { createAdminClient } from "@zeal/database/server";
import { HomeClient } from "./HomeClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ConsultantRow {
  id: string;
  category: string;
  rating: number | null;
  sparkScore: number | null;
  perMinuteRate: number | null;
  specialties: string[] | null;
  user: { id: string; name: string | null; username: string; avatar: string | null; is_online: boolean | null } | null;
}

interface AIConsultantRow {
  id: string;
  name: string;
  username: string;
  avatar: string;
  category: string;
  bio: string;
  rating: number;
  isPaid: boolean;
  perMinuteRate: number;
  specialties: string[] | null;
  isFeatured: boolean;
}

interface PostRow {
  id: string;
  content: string;
  created_at: string;
  author: { name: string | null; avatar: string | null } | null;
}

async function fetchHomeData() {
  const admin = createAdminClient();

  const [consultantsRes, aiRes, postsRes] = await Promise.all([
    admin
      .from("Consultant")
      .select(`
        id, category, rating, "sparkScore", "perMinuteRate", specialties,
        user:User!Consultant_userId_fkey(id, name, username, avatar, is_online)
      `)
      .eq("status", "VERIFIED")
      .eq("isActive", true)
      .order("sparkScore", { ascending: false })
      .limit(4),
    admin
      .from("AIConsultant")
      .select("*")
      .eq("isActive", true)
      .order("isFeatured", { ascending: false })
      .order("rating", { ascending: false })
      .limit(6),
    admin
      .from("Post")
      .select(`
        id, content, created_at,
        author:User!Post_authorId_fkey(name, avatar)
      `)
      .eq("isFlagged", false)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  return {
    consultants: (consultantsRes.data ?? []) as unknown as ConsultantRow[],
    aiConsultants: (aiRes.data ?? []) as AIConsultantRow[],
    posts: (postsRes.data ?? []) as unknown as PostRow[],
  };
}

export default async function HomePage() {
  const data = await fetchHomeData();
  return <HomeClient {...data} />;
}
ZEALEOF_PAGE

# 4b. HomeClient.tsx — interactive client
w "apps/web/app/HomeClient.tsx" << 'ZEALEOF_HOMECLIENT'
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight, Sparkles, Orbit, Brain, Compass, Heart, Layers,
  MessageSquare, Clock, Zap, Star, Hash, Hand, Bot,
} from "lucide-react";

interface Consultant {
  id: string;
  category: string;
  rating: number | null;
  sparkScore: number | null;
  perMinuteRate: number | null;
  specialties: string[] | null;
  user: { id: string; name: string | null; username: string; avatar: string | null; is_online: boolean | null } | null;
}

interface AIConsultant {
  id: string;
  name: string;
  username: string;
  avatar: string;
  category: string;
  bio: string;
  rating: number;
  isPaid: boolean;
  perMinuteRate: number;
  specialties: string[] | null;
  isFeatured: boolean;
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  author: { name: string | null; avatar: string | null } | null;
}

interface Props {
  consultants: Consultant[];
  aiConsultants: AIConsultant[];
  posts: Post[];
}

const SLIDES = [
  {
    video: "https://assets.mixkit.co/videos/preview/mixkit-spinning-earth-in-space-from-a-satellite-39525-large.mp4",
    title: "Welcome to Zeal",
    subtitle: "Ancient metaphysics meets Groq-accelerated AI.",
    cta: "Explore Free Tools",
    href: "#services",
  },
  {
    video: "https://assets.mixkit.co/videos/preview/mixkit-hud-interface-with-neon-lines-and-geometric-shapes-31293-large.mp4",
    title: "Neural Astrologers",
    subtitle: "Sub-second planetary ephemeris mapped to digital sentience.",
    cta: "Consult the Engine",
    href: "/ai-astrologers",
  },
  {
    video: "https://assets.mixkit.co/videos/preview/mixkit-ink-swirling-in-water-438-large.mp4",
    title: "Human Masters",
    subtitle: "Connect instantly with verified practitioners worldwide.",
    cta: "View Directory",
    href: "/explore",
  },
];

const SERVICES = [
  { title: "Daily Horoscope",    desc: "Planetary alignments mapped to your sign.",     icon: Star,      href: "/services/horoscope",   color: "text-blue-400" },
  { title: "Janam Kundali",      desc: "Precise birth charts & house allocations.",     icon: Orbit,     href: "/services/kundali",     color: "text-purple-400" },
  { title: "Synastry Matching",  desc: "Guna Milan compatibility analysis.",            icon: Heart,     href: "/services/matchmaking", color: "text-rose-400" },
  { title: "Arcane Tarot",       desc: "Neural-mapped 3-card temporal spreads.",        icon: Layers,    href: "/services/tarot",       color: "text-indigo-400" },
  { title: "Destiny Numerology", desc: "Life path & soul frequency calculation.",       icon: Hash,      href: "/services/numerology",  color: "text-amber-400" },
  { title: "Palmistry Vision",   desc: "AI line extraction & life-energy readings.",    icon: Hand,      href: "/services/palmistry",   color: "text-emerald-400" },
];

export function HomeClient({ consultants, aiConsultants, posts }: Props) {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 8000);
    return () => clearInterval(t);
  }, []);

  const active = SLIDES[slide] ?? SLIDES[0]!;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 overflow-hidden">
      {/* HERO */}
      <section className="relative w-full h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-slate-950 to-slate-950 z-0" />

        <AnimatePresence mode="wait">
          <motion.div
            key={slide}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0 z-0"
          >
            <video src={active.video} autoPlay loop muted playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-screen" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
          </motion.div>
        </AnimatePresence>

        <div className="relative z-10 text-center px-4 max-w-5xl mt-16">
          <AnimatePresence mode="wait">
            <motion.div key={slide}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium uppercase tracking-[0.15em] backdrop-blur-md mb-8">
                <Sparkles size={14} /> 6 Free AI Cosmic Suites
              </div>
              <h1 className="text-5xl sm:text-7xl md:text-[5.5rem] font-medium tracking-tight mb-6 leading-[1.1] text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">
                {active.title}
              </h1>
              <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10">
                {active.subtitle}
              </p>
              <Link href={active.href}
                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-slate-950 rounded-full font-medium hover:bg-purple-500 hover:text-white transition-all shadow-lg">
                {active.cta} <ArrowRight size={18} />
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="py-32 px-4 sm:px-6 lg:px-8 max-w-[84rem] mx-auto">
        <div className="mb-20 text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-purple-400">Public Free Tier</span>
          <h2 className="text-4xl sm:text-5xl font-medium tracking-tight text-white mt-2 mb-4">
            6 Free AI Cosmic Services
          </h2>
          <p className="text-slate-400 text-lg font-light">
            Zero login required. High-speed models mapped to ancient traditions.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {SERVICES.map((s, idx) => {
            const Icon = s.icon;
            return (
              <motion.div key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
              >
                <Link href={s.href}
                  className="block bg-slate-900/40 backdrop-blur-xl border border-white/5 p-10 rounded-[2.5rem] hover:bg-slate-800/40 hover:border-purple-500/30 transition-all group h-full">
                  <div className={`w-16 h-16 rounded-2xl bg-white/5 ${s.color} flex items-center justify-center mb-8 group-hover:scale-110 transition-transform`}>
                    <Icon size={28} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-2xl font-medium mb-3 text-white">{s.title}</h3>
                  <p className="text-slate-400 font-light leading-relaxed mb-8">{s.desc}</p>
                  <div className="inline-flex items-center gap-2 text-sm font-medium text-purple-400 group-hover:gap-3 transition-all">
                    Launch Analysis <ArrowRight size={16} />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* AI CONSULTANTS */}
      {aiConsultants.length > 0 && (
        <section className="py-32 px-4 sm:px-6 lg:px-8 max-w-[84rem] mx-auto border-t border-white/5">
          <div className="mb-16 flex items-end justify-between gap-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">24/7 Digital Sentience</span>
              <h2 className="text-4xl sm:text-5xl font-medium tracking-tight text-white mt-2">AI Astrologers</h2>
              <p className="text-slate-400 font-light mt-2 text-lg">Instant guidance from neural personas trained on ancient systems.</p>
            </div>
            <Link href="/ai-astrologers"
              className="text-sm font-medium bg-slate-800 text-white px-6 py-3 rounded-full hover:bg-indigo-600 transition-colors">
              View All
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {aiConsultants.map((ai, idx) => (
              <motion.div key={ai.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
              >
                <Link href={`/ai-astrologers/${ai.id}`}
                  className="block bg-slate-900/60 border border-white/5 p-6 rounded-3xl hover:border-indigo-500/40 hover:bg-slate-800/40 transition-all group">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 overflow-hidden shrink-0">
                      {ai.avatar
                        ? <img src={ai.avatar} alt={ai.name} className="w-full h-full object-cover" />
                        : <Bot className="w-7 h-7 m-auto text-white" />}
                      <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-[8px] font-bold rounded-full">
                        AI
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-white text-base truncate">{ai.name}</h3>
                      <p className="text-xs text-indigo-300 capitalize">{ai.category.toLowerCase()}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 mb-3">{ai.bio}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-amber-400">
                      <Star size={11} className="fill-amber-400" /> {ai.rating.toFixed(1)}
                    </span>
                    <span className="text-indigo-300 font-mono">
                      {ai.isPaid ? `₹${ai.perMinuteRate}/min` : "Free"}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* HUMAN CONSULTANTS */}
      {consultants.length > 0 && (
        <section className="py-32 px-4 sm:px-6 lg:px-8 max-w-[84rem] mx-auto border-t border-white/5">
          <div className="mb-16 flex items-end justify-between gap-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-purple-400">Engagement & Clout</span>
              <h2 className="text-4xl sm:text-5xl font-medium tracking-tight text-white mt-2">Verified Master Roster</h2>
              <p className="text-slate-400 font-light mt-2 text-lg">Ranked by real-time community Sparks and impressions.</p>
            </div>
            <Link href="/explore"
              className="text-sm font-medium bg-slate-800 text-white px-6 py-3 rounded-full hover:bg-purple-600 transition-colors">
              View Directory
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {consultants.map((c, idx) => {
              const name = c.user?.name || c.user?.username || "Guide";
              return (
                <motion.div key={c.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <Link href={`/consultant/${c.id}`}
                    className="block bg-gradient-to-b from-slate-900/80 to-slate-900/20 border border-white/5 p-8 rounded-[2.5rem] hover:border-purple-500/40 transition-all text-center group">
                    <div className="relative w-24 h-24 mx-auto rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-3xl font-light text-slate-300 mb-6 group-hover:border-purple-400 transition-colors overflow-hidden">
                      {c.user?.avatar
                        ? <img src={c.user.avatar} alt={name} className="w-full h-full object-cover" />
                        : name.charAt(0)}
                      {c.user?.is_online && (
                        <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-950 rounded-full" />
                      )}
                    </div>
                    <h4 className="font-medium text-lg text-white mb-1 truncate">{name}</h4>
                    <p className="text-purple-400/80 text-xs font-medium uppercase tracking-widest mb-4">
                      {c.category.replace(/_/g, " ").toLowerCase()}
                    </p>
                    <div className="mb-6 inline-flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full text-xs font-bold text-purple-300">
                      <Sparkles size={13} /> {(c.sparkScore ?? 0).toLocaleString()} Sparks
                    </div>
                    <div className="block w-full py-3 bg-slate-800 hover:bg-purple-600 text-slate-300 hover:text-white rounded-xl text-sm font-medium transition-all">
                      Consult Now
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* LIVE FEED */}
      {posts.length > 0 && (
        <section className="py-32 px-4 sm:px-6 lg:px-8 max-w-[84rem] mx-auto border-t border-white/5 mb-20">
          <div className="mb-16 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500" />
                </span>
                <h2 className="text-3xl font-medium tracking-tight text-white">Live Cosmos Feed</h2>
              </div>
              <p className="text-slate-400 font-light">Real-time planetary updates from the verified network.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts.map((p, i) => (
              <motion.div key={p.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-slate-900/60 backdrop-blur-md border border-white/5 p-8 rounded-3xl hover:bg-slate-800/60 transition-all"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300 font-medium text-lg overflow-hidden">
                      {p.author?.avatar
                        ? <img src={p.author.avatar} alt="" className="w-full h-full object-cover" />
                        : (p.author?.name?.charAt(0) || "C")}
                    </div>
                    <div>
                      <h5 className="font-medium text-sm text-white">{p.author?.name || "Verified Consultant"}</h5>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                        <Clock size={12} /> {new Date(p.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <MessageSquare size={18} className="text-slate-600" />
                </div>
                <p className="text-slate-300 text-sm leading-relaxed font-light">{p.content}</p>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
ZEALEOF_HOMECLIENT

# ═════════════════════════════════════════════════════════════════
sec "DONE"
echo ""
echo "  Backup: $BK"
echo ""
echo "  Next:"
echo "    rm -rf node_modules/.cache .next apps/*/.next"
echo "    npm install"
echo "    npm run build"
echo ""
echo "  If build still fails, paste the exact error and I will target it."
echo ""