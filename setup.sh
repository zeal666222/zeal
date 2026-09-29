#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — PREMIUM PAGES + LENIS SMOOTH SCROLL
# ═══════════════════════════════════════════════════════════════════════════════
# Rewrites:
#   packages/ui/src/motion.tsx                              (add SmoothScroll)
#   apps/web/app/layout.tsx                                 (wrap with SmoothScroll)
#   apps/web/app/profile/page.tsx                           (premium profile)
#   apps/web/app/explore/page.tsx                           (premium explore hero)
#   apps/web/app/explore/ConsultantDirectory.tsx            (bubble filter rail)
#   apps/web/app/services/page.tsx                          (premium services)
#   apps/web/app/services/CategoryGridRealtime.tsx          (bubble category grid)
#   apps/web/components/shared/LuxuryConsultantCard.tsx     (refined tilt card)
#
# Idempotent. Backs up. Type-checks. No new files.
# ═══════════════════════════════════════════════════════════════════════════════
set -Eeuo pipefail
IFS=$' \t\n'

if [[ -t 1 ]]; then
  RED='\033[0;31m'; GRN='\033[0;32m'; YEL='\033[1;33m'
  BLU='\033[0;34m'; BLD='\033[1m'; NC='\033[0m'
else
  RED=''; GRN=''; YEL=''; BLU=''; BLD=''; NC=''
fi
ok()   { printf "${GRN}✓${NC} %s\n" "$1"; }
warn() { printf "${YEL}○${NC} %s\n" "$1"; }
fail() { printf "${RED}✗${NC} %s\n" "$1"; }
info() { printf "${BLU}→${NC} %s\n" "$1"; }
hdr()  { printf "\n${BLD}═══ %s ═══${NC}\n" "$1"; }

detect_root() {
  local dir
  if [[ -n "${ZEAL_REPO_ROOT:-}" && -f "${ZEAL_REPO_ROOT}/package.json" ]]; then
    printf '%s' "${ZEAL_REPO_ROOT}"; return 0
  fi
  if dir="$(git rev-parse --show-toplevel 2>/dev/null)" \
     && [[ -f "$dir/package.json" && -f "$dir/apps/web/package.json" ]]; then
    printf '%s' "$dir"; return 0
  fi
  dir="$(pwd)"
  while [[ "$dir" != "/" && "$dir" != "." ]]; do
    if [[ -f "$dir/package.json" && -f "$dir/apps/web/package.json" ]]; then
      printf '%s' "$dir"; return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}

hdr "PREFLIGHT"
REPO_ROOT="$(detect_root)" || { fail "not a Zeal repo"; exit 1; }
cd "$REPO_ROOT"
ok "Repo root: $REPO_ROOT"

STATE_FILE="$REPO_ROOT/.premium-pages-state"
BACKUP_ROOT="$REPO_ROOT/.premium-pages-backup/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_ROOT"

mark_done() { echo "$1" >> "$STATE_FILE"; }
is_done()   { [[ -f "$STATE_FILE" ]] && grep -qxF "$1" "$STATE_FILE"; }

FILES=(
  "packages/ui/src/motion.tsx"
  "apps/web/app/layout.tsx"
  "apps/web/app/profile/page.tsx"
  "apps/web/app/explore/page.tsx"
  "apps/web/app/explore/ConsultantDirectory.tsx"
  "apps/web/app/services/page.tsx"
  "apps/web/app/services/CategoryGridRealtime.tsx"
  "apps/web/components/shared/LuxuryConsultantCard.tsx"
)
for f in "${FILES[@]}"; do
  [[ -f "$REPO_ROOT/$f" ]] || continue
  mkdir -p "$BACKUP_ROOT/$(dirname "$f")"
  cp "$REPO_ROOT/$f" "$BACKUP_ROOT/$f"
done
ok "Backed up ${#FILES[@]} files → $BACKUP_ROOT"

write_if_changed() {
  local rel="$1" abs="$REPO_ROOT/$1" tmp
  tmp="$(mktemp)"
  cat > "$tmp"
  if [[ -f "$abs" ]] && cmp -s "$tmp" "$abs"; then
    ok "$rel — unchanged"
  else
    mkdir -p "$(dirname "$abs")"
    mv "$tmp" "$abs"
    ok "$rel — written"
  fi
  rm -f "$tmp"
}

# ═══════════════════════════════════════════════════════════════════════════════
# 0. Install Lenis
# ═══════════════════════════════════════════════════════════════════════════════
hdr "0. Install Lenis"

if is_done "install"; then ok "skip"; else
  if grep -q '"lenis"' "$REPO_ROOT/apps/web/package.json" 2>/dev/null; then
    ok "lenis already installed"
  else
    info "Installing lenis into apps/web…"
    if npm install lenis@1.1.20 --save-exact --workspace=web --legacy-peer-deps 2>&1 | tail -3; then
      ok "lenis@1.1.20 installed"
    else
      warn "install failed — install manually: npm i lenis@1.1.20 -w web"
    fi
  fi
  mark_done "install"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 1. Add SmoothScroll to motion.tsx (append, keep all existing exports)
# ═══════════════════════════════════════════════════════════════════════════════
hdr "1. packages/ui/src/motion.tsx — SmoothScroll"

if is_done "motion"; then ok "skip"; else
  MO="$REPO_ROOT/packages/ui/src/motion.tsx"
  if [[ -f "$MO" ]] && ! grep -q "SmoothScroll" "$MO"; then
    cat >> "$MO" <<'TSX'

/* ═══════════════════════════════════════════════════════════════════════════════
   Lenis smooth scroll — momentum scroll for the whole app
   ─────────────────────────────────────────────────────────────────────────────
   Wraps children in a Lenis instance. RAF loop drives lenis.raf(). Respects
   prefers-reduced-motion. Cleans up on unmount.
   ═══════════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef } from "react";
import Lenis from "lenis";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<Lenis | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
      wheelMultiplier: 1,
      lerp: 0.1,
    });
    ref.current = lenis;

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      ref.current = null;
    };
  }, []);

  return <>{children}</>;
}
TSX
    ok "motion.tsx — SmoothScroll appended"
  else
    ok "motion.tsx — already has SmoothScroll"
  fi
  mark_done "motion"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 2. Patch apps/web/app/layout.tsx to wrap with SmoothScroll
# ═══════════════════════════════════════════════════════════════════════════════
hdr "2. layout.tsx — wire SmoothScroll"

if is_done "layout"; then ok "skip"; else
  LY="$REPO_ROOT/apps/web/app/layout.tsx"
  if [[ -f "$LY" ]] && ! grep -q "SmoothScroll" "$LY"; then
    # Add import
    if ! grep -q 'MotionProvider' "$LY"; then
      warn "MotionProvider not imported — check layout manually"
    else
      # Add SmoothScroll to import
      perl -i -pe 's/import \{ MotionProvider \} from "\@zeal\/ui\/motion";/import { MotionProvider, SmoothScroll } from "\@zeal\/ui\/motion";/' "$LY"

      # Wrap the AppLayout with SmoothScroll
      perl -0pi -e 's/(<MotionProvider>)([\s\S]*?)(<\/MotionProvider>)/$1\n                  <SmoothScroll>\n                    $2\n                  <\/SmoothScroll>\n                $3/' "$LY"
    fi

    if grep -q "SmoothScroll" "$LY"; then
      ok "layout.tsx — wrapped with SmoothScroll"
    else
      warn "layout.tsx — manual wire needed (SmoothScroll not found after patch)"
    fi
  else
    ok "layout.tsx — already wired"
  fi
  mark_done "layout"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 3. Premium Profile page
# ═══════════════════════════════════════════════════════════════════════════════
hdr "3. profile/page.tsx"

if is_done "page.profile"; then ok "skip"; else
write_if_changed "apps/web/app/profile/page.tsx" <<'TSX'
"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Profile — premium Instagram-inspired layout
// Parallax cover · halo avatar · sliding tabs · mason-style grid
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import {
  ArrowLeft, Check, Copy, Edit3, Link as LinkIcon, Loader2, LogOut,
  MapPin, Plus, Shield, Sparkles, User, Wallet,
} from "lucide-react";
import { PostGrid } from "@/components/profile/PostGrid";
import { signOutAction } from "@/actions/auth";
import { cn } from "@zeal/ui";

interface SelfProfile {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  website: string | null;
  location: string | null;
  role: string;
  sparks: number;
  post_count: number;
  is_online: boolean;
  isVerified: boolean;
}

interface Stats {
  posts: number;
  cheers: number;
  comments: number;
  followers: number;
  following: number;
}

type Tab = "posts" | "about" | "security";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<SelfProfile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [canPost, setCanPost] = useState<{ canPost: boolean; limit: number; current: number; remaining: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("posts");
  const [copied, setCopied] = useState(false);

  const { scrollY } = useScroll();
  const coverY = useTransform(scrollY, [0, 300], [0, 80]);
  const coverScale = useTransform(scrollY, [0, 300], [1, 1.08]);
  const headerOpacity = useTransform(scrollY, [80, 160], [0, 1]);

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/users/me/profile", { cache: "no-store" });
        if (!meRes.ok) return;
        const data = (await meRes.json()) as {
          user: SelfProfile;
          canPost: { canPost: boolean; limit: number; current: number; remaining: number };
        };
        setProfile(data.user);
        setCanPost(data.canPost);

        if (data.user?.id) {
          const sRes = await fetch(`/api/users/${data.user.id}/profile`, { cache: "no-store" });
          if (sRes.ok) {
            const sd = (await sRes.json()) as { stats?: Stats };
            if (sd.stats) setStats(sd.stats);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCopy = async () => {
    if (!profile?.username) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/@${profile.username}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="min-h-screen-app bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen-app bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <User size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-5">Please sign in to view your profile.</p>
          <Link
            href="/login"
            className="inline-block px-5 py-2.5 rounded-xl
                       bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                       text-white text-sm font-black"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const displayName = profile.name || profile.username || "Seeker";
  const initial = displayName.charAt(0).toUpperCase();
  const isConsultant = profile.role === "CLIENT_ADMIN";

  return (
    <div className="min-h-screen-app bg-background pb-24">
      {/* ─── Sticky header (fades in on scroll) ───────────────────────────── */}
      <motion.div
        style={{ opacity: headerOpacity }}
        className="fixed top-0 left-0 right-0 z-30 bg-background/80 backdrop-blur-xl
                   border-b border-border"
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-surface-raised transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={16} className="text-foreground" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-black text-foreground truncate">@{profile.username ?? "profile"}</p>
          </div>
          <Link
            href="/profile/edit"
            className="p-2 rounded-xl hover:bg-surface-raised transition-colors"
            aria-label="Edit profile"
          >
            <Edit3 size={16} className="text-foreground" />
          </Link>
        </div>
      </motion.div>

      {/* ─── Cover banner (parallax) ──────────────────────────────────────── */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        <motion.div
          style={{ y: coverY, scale: coverScale }}
          className="absolute inset-0 will-change-transform"
        >
          <div className="absolute inset-0 bg-gradient-to-br
                          from-[var(--color-primary)]/[0.18]
                          via-[var(--color-surface)]
                          to-[var(--color-luxury-gold)]/[0.15]" />
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px]
                          bg-[var(--color-primary)]/[0.25] blur-[160px] rounded-full" />
          <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px]
                          bg-[var(--color-luxury-gold)]/[0.18] blur-[160px] rounded-full" />
          <div className="absolute inset-0 noise-overlay opacity-60" />
        </motion.div>

        {/* Back button (fades out) */}
        <motion.div
          style={{ opacity: useTransform(scrollY, [0, 80], [1, 0]) }}
          className="absolute top-4 left-4 z-10 flex items-center gap-2"
        >
          <button
            onClick={() => router.back()}
            className="p-2.5 rounded-xl bg-black/40 backdrop-blur-md
                       text-white hover:bg-black/60 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>
        </motion.div>

        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <Link
            href="/wallet"
            className="p-2.5 rounded-xl bg-black/40 backdrop-blur-md
                       text-white hover:bg-black/60 transition-colors"
            aria-label="Wallet"
          >
            <Wallet size={16} />
          </Link>
          <Link
            href="/profile/edit"
            className="p-2.5 rounded-xl bg-black/40 backdrop-blur-md
                       text-white hover:bg-black/60 transition-colors"
            aria-label="Edit profile"
          >
            <Edit3 size={16} />
          </Link>
        </div>
      </div>

      {/* ─── Avatar + identity ───────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 relative -mt-16 md:-mt-20 z-10">
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 mb-8">
          {/* Avatar */}
          <div className="relative">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
              className="relative"
            >
              <div
                aria-hidden
                className="absolute -inset-1 rounded-full
                           bg-gradient-to-br from-[var(--color-luxury-gold)]/40
                           via-[var(--color-primary)]/30
                           to-transparent blur-md"
              />
              <div className="relative w-28 h-28 md:w-36 md:h-36 rounded-full
                              ring-4 ring-background overflow-hidden
                              bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)]
                              flex items-center justify-center text-white font-black text-4xl">
                {profile.avatar ? (
                  <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  initial
                )}
              </div>
              {profile.is_online && (
                <span className="absolute bottom-2 right-2 w-5 h-5 rounded-full
                                 bg-emerald-500 border-4 border-background
                                 animate-pulse" />
              )}
            </motion.div>
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0 text-center sm:text-left pb-2">
            <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
              <h1 className="text-2xl md:text-3xl font-black text-foreground truncate">
                {displayName}
              </h1>
              {profile.isVerified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                                 bg-[var(--color-primary)]/15
                                 border border-[var(--color-primary)]/30
                                 text-[var(--color-primary)] text-[10px] font-black
                                 uppercase tracking-widest">
                  <Check size={10} /> Verified
                </span>
              )}
              {isConsultant && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                                 bg-[var(--color-luxury-gold)]/15
                                 border border-[var(--color-luxury-gold)]/30
                                 text-[var(--color-luxury-gold)] text-[10px] font-black
                                 uppercase tracking-widest">
                  <Sparkles size={10} /> Consultant
                </span>
              )}
            </div>

            {profile.username && (
              <div className="mt-1 flex items-center gap-2 justify-center sm:justify-start">
                <p className="text-sm text-muted-foreground font-mono">@{profile.username}</p>
                <button
                  onClick={handleCopy}
                  className="p-1 rounded-lg hover:bg-surface-raised text-muted-foreground
                             transition-colors"
                  aria-label="Copy profile link"
                >
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ─── Stats row ───────────────────────────────────────────────────── */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-3 gap-3 md:gap-4 mb-6"
          >
            <StatCard label="Posts"     value={stats.posts} />
            <StatCard label="Followers" value={stats.followers} />
            <StatCard label="Following" value={stats.following} />
          </motion.div>
        )}

        {/* ─── Bio + meta ─────────────────────────────────────────────────── */}
        {(profile.bio || profile.location || profile.website || profile.sparks > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-3xl border border-border bg-surface
                       p-5 md:p-6 mb-6 max-w-2xl"
          >
            {profile.bio && (
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                {profile.bio}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground">
              {profile.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={12} /> {profile.location}
                </span>
              )}
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[var(--color-primary)] hover:underline
                             truncate max-w-[240px]"
                >
                  <LinkIcon size={12} /> {profile.website}
                </a>
              )}
              <span className="flex items-center gap-1.5">
                <Sparkles size={12} className="text-[var(--color-luxury-gold)]" />
                {profile.sparks.toLocaleString("en-IN")} Sparks
              </span>
            </div>
          </motion.div>
        )}

        {/* ─── Post action ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3 mb-6 flex-wrap"
        >
          {canPost?.canPost ? (
            <Link
              href="/create"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl
                         bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                         text-white text-xs font-black
                         shadow-lg shadow-[var(--color-primary-hover)]/20
                         hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              <Plus size={14} /> New post
            </Link>
          ) : (
            <div className="px-5 py-3 rounded-2xl bg-surface-raised border border-border
                            text-xs font-bold text-muted-foreground">
              Post limit reached · {canPost?.current}/{canPost?.limit}
            </div>
          )}
          {canPost && canPost.canPost && (
            <span className="text-xs text-muted-foreground font-mono">
              {canPost.remaining} of {canPost.limit} remaining
            </span>
          )}
        </motion.div>

        {/* ─── Tabs (sliding indicator) ────────────────────────────────────── */}
        <div className="sticky top-[64px] z-20 -mx-4 px-4 bg-background/80 backdrop-blur-xl mb-6">
          <div className="flex items-center gap-1 border-b border-border relative">
            {(["posts", "about", "security"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "relative px-4 py-3.5 text-xs font-black uppercase tracking-widest transition-colors",
                  tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
                {tab === t && (
                  <motion.span
                    layoutId="profile-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5
                               bg-gradient-to-r from-[var(--color-luxury-gold)] to-[var(--color-primary)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Tab content ─────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {tab === "posts" && (
            <motion.div
              key="posts"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <PostGrid userId={profile.id} isSelf />
            </motion.div>
          )}

          {tab === "about" && (
            <motion.div
              key="about"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="max-w-2xl rounded-3xl border border-border bg-surface p-6 space-y-4"
            >
              <AboutRow label="Name"      value={profile.name ?? "—"} />
              <AboutRow label="Username"  value={profile.username ? `@${profile.username}` : "—"} />
              <AboutRow label="Email"     value={profile.email} />
              <AboutRow label="Location"  value={profile.location ?? "—"} />
              <AboutRow label="Website"   value={profile.website ?? "—"} />
              <AboutRow label="Role"      value={profile.role} />
              <div className="pt-4 border-t border-border">
                <Link
                  href="/profile/edit"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl
                             bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                             text-white text-sm font-black"
                >
                  <Edit3 size={14} /> Edit profile
                </Link>
              </div>
            </motion.div>
          )}

          {tab === "security" && (
            <motion.div
              key="security"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="max-w-2xl space-y-4"
            >
              <div className="flex items-center gap-3 p-5 rounded-3xl border border-border
                              bg-surface hover:border-[var(--color-primary)]/40 transition-colors">
                <Shield size={20} className="text-[var(--color-primary)]" />
                <div className="flex-1">
                  <p className="text-sm font-black text-foreground">Two-factor authentication</p>
                  <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
                </div>
              </div>

              <div className="p-5 rounded-3xl border border-rose-500/20 bg-rose-500/[0.04]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-foreground">Sign out</p>
                    <p className="text-xs text-muted-foreground">End your session on this device</p>
                  </div>
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="px-4 py-2.5 rounded-xl bg-rose-500/10 text-rose-400
                                 hover:bg-rose-500/20 text-xs font-black
                                 flex items-center gap-1.5 transition-colors"
                    >
                      <LogOut size={13} /> Sign out
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="rounded-2xl border border-border bg-surface p-4
                 hover:border-[var(--color-luxury-gold)]/30 transition-colors"
    >
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">
        {label}
      </p>
      <p className="text-2xl font-black font-mono text-foreground mt-1 tabular-nums">
        {value.toLocaleString("en-IN")}
      </p>
    </motion.div>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground font-bold text-xs uppercase tracking-widest">
        {label}
      </span>
      <span className="text-foreground font-medium truncate max-w-[60%]">{value}</span>
    </div>
  );
}
TSX
mark_done "page.profile"; fi

# ═══════════════════════════════════════════════════════════════════════════════
# 4. Premium Explore page (server)
# ═══════════════════════════════════════════════════════════════════════════════
hdr "4. explore/page.tsx"

if is_done "page.explore"; then ok "skip"; else
write_if_changed "apps/web/app/explore/page.tsx" <<'TSX'
// ═══════════════════════════════════════════════════════════════════════════════
// /explore — editorial discovery
// ═══════════════════════════════════════════════════════════════════════════════

import { createServerClientFromCookies } from "@zeal/database/server";
import { Compass, ShieldCheck, Sparkles } from "lucide-react";
import { ConsultantDirectory } from "./ConsultantDirectory";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface MvRow {
  id: string; userId: string; name: string | null; username: string | null;
  avatar_url: string | null; is_online: boolean; lastSeenAt: string | null;
  category: string | null; perMinuteRate: number | null; rating: number | null;
  sparkScore: number | null; isVerified: boolean | null; isActive: boolean | null;
  status: string | null; subdomain: string | null; subdomainActive: boolean | null;
  specialties: string[] | null; languages: string[] | null; bio: string | null;
  totalConsultations: number | null; service_slugs: string[] | null; category_ids: string[] | null;
}

async function loadDirectory(): Promise<MvRow[]> {
  try {
    const supabase = await createServerClientFromCookies();
    const { data, error } = await supabase.rpc("search_consultants", {
      p_filters: { limit: 60, sort: "relevance" },
    });
    if (error) return [];
    return ((data ?? {}) as { consultants?: MvRow[] }).consultants ?? [];
  } catch {
    return [];
  }
}

export default async function ExplorePage() {
  const consultants = await loadDirectory();
  const onlineCount = consultants.filter((c) => c.is_online).length;

  return (
    <div className="min-h-screen-app bg-background text-foreground pb-24">
      {/* ─── Editorial hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden noise-overlay
                          border-b border-[var(--color-luxury-glass-border)]">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px]
                        bg-[var(--color-primary)]/[0.14] blur-[180px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px]
                        bg-[var(--color-luxury-gold)]/[0.10] blur-[180px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 lg:px-16
                        py-14 md:py-20">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full
                          bg-[var(--color-luxury-gold)]/[0.08]
                          border border-[var(--color-luxury-gold)]/[0.20]
                          text-[var(--color-luxury-gold)]
                          text-[10px] font-black uppercase tracking-[0.25em] mb-6">
            <Compass size={12} /> Discovery
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black
                         tracking-[-0.03em] leading-[0.95] text-foreground
                         max-w-3xl">
            Find your{" "}
            <span className="text-luxury-gradient">sanctuary.</span>
          </h1>

          <p className="mt-6 text-base md:text-lg text-muted-foreground
                        max-w-2xl leading-relaxed">
            {consultants.length.toLocaleString("en-IN")} verified guides across every
            tradition.{" "}
            {onlineCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {onlineCount} online now
              </span>
            )}
          </p>

          {/* trust footer */}
          <div className="mt-8 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-emerald-400" />
              Identity-verified
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles size={12} className="text-[var(--color-luxury-gold)]" />
              Escrow-protected
            </span>
          </div>
        </div>
      </section>

      {/* ─── Client directory ────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-16 py-10">
        <ConsultantDirectory initialConsultants={consultants} />
      </div>
    </div>
  );
}
TSX
mark_done "page.explore"; fi

# ═══════════════════════════════════════════════════════════════════════════════
# 5. ConsultantDirectory — bubble filter rail + refined grid
# ═══════════════════════════════════════════════════════════════════════════════
hdr "5. ConsultantDirectory.tsx"

if is_done "comp.directory"; then ok "skip"; else
write_if_changed "apps/web/app/explore/ConsultantDirectory.tsx" <<'TSX'
"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// ConsultantDirectory — search + bubble filter rail + realtime grid
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";
import { staggerContainer, fadeUp } from "@zeal/ui/motion";
import { LuxuryConsultantCard } from "@/components/shared/LuxuryConsultantCard";
import { startChatFlow, type LowBalanceInfo } from "@/lib/chat/start-chat-flow";
import { WalletGateDialog } from "@/components/billing/WalletGateDialog";
import type { ConsultantProfile } from "@zeal/types";
import { cn } from "@zeal/ui";

interface MvRow {
  id: string; userId: string; name: string | null; username: string | null;
  avatar_url: string | null; is_online: boolean; category: string | null;
  perMinuteRate: number | null; rating: number | null; sparkScore: number | null;
  specialties: string[] | null; languages: string[] | null; bio: string | null;
  totalConsultations: number | null; service_slugs: string[] | null;
}
interface Category { id: string; display_name: string; }
interface Props { initialConsultants: MvRow[]; }

function toProfile(m: MvRow): ConsultantProfile {
  return {
    id: m.id, userId: m.userId,
    name: m.name ?? m.username ?? "Guide",
    username: m.username ?? "", bio: m.bio ?? "",
    avatar: m.avatar_url ?? "", category: (m.category ?? "HEALER") as never,
    isVerified: true, isOnline: Boolean(m.is_online),
    perMinuteRate: m.perMinuteRate ?? 50, experience: 0,
    rating: m.rating ?? 4.5, totalConsultations: m.totalConsultations ?? 0,
    sparks: m.sparkScore ?? 0, languages: m.languages ?? [],
    specialties: m.specialties ?? [], faith: "OTHER" as never, isAI: false,
  };
}

export function ConsultantDirectory({ initialConsultants }: Props) {
  const router = useRouter();
  const [consultants, setConsultants] = useState<MvRow[]>(initialConsultants);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateInfo, setGateInfo] = useState<LowBalanceInfo | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRef = useRef(true);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const handleChat = useCallback(async (consultantId: string) => {
    await startChatFlow(consultantId, {
      router,
      onLowBalance: (info) => { setGateInfo(info); setGateOpen(true); },
      onOffline: ({ consultantName }) => showToast(`${consultantName} is currently offline.`),
      onError: showToast,
    });
  }, [router, showToast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/consultants/catalog", { cache: "no-store" });
        if (!res.ok) return;
        const d = (await res.json()) as { categories?: Category[] };
        if (!cancelled) setCategories(d.categories ?? []);
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (firstRef.current) { firstRef.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const run = async () => {
      setLoading(true); setFetchError(null);
      try {
        const p = new URLSearchParams();
        if (query.trim()) p.set("q", query.trim());
        if (category !== "all") p.set("category", category);
        if (onlineOnly) p.set("online", "true");
        p.set("limit", "60");
        const res = await fetch(`/api/explore/consultants?${p}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = (await res.json()) as { consultants?: MvRow[] };
        setConsultants(d.consultants ?? []);
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : "Failed to load");
      } finally { setLoading(false); }
    };
    debounceRef.current = setTimeout(run, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, category, onlineOnly]);

  useChannel<BroadcastChange<{ consultantId?: string; is_online?: boolean; userId?: string }>>({
    channel: channels.consultantsLive(),
    event: "*",
    onMessage: useCallback((p) => {
      const pl = p as unknown as {
        consultantId?: string; is_online?: boolean;
        record?: { userId?: string; is_online?: boolean };
      };
      const id = pl.consultantId ?? pl.record?.userId;
      const st = pl.is_online ?? pl.record?.is_online;
      if (typeof id === "string" && typeof st === "boolean") {
        setConsultants((prev) => prev.map((c) =>
          c.userId === id ? { ...c, is_online: st } : c));
      }
    }, []),
  });

  const isFiltered = query.trim() !== "" || category !== "all" || onlineOnly;
  const clearFilters = useCallback(() => {
    setQuery(""); setCategory("all"); setOnlineOnly(false);
  }, []);
  const visible = useMemo(
    () => (onlineOnly ? consultants.filter((c) => c.is_online) : consultants),
    [consultants, onlineOnly],
  );

  return (
    <div className="space-y-8">
      {/* ─── Search ──────────────────────────────────────────────────────── */}
      <div className="relative max-w-2xl mx-auto">
        <Search
          size={18}
          className="absolute left-5 top-1/2 -translate-y-1/2
                     text-muted-foreground pointer-events-none"
        />
        <input
          type="search"
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          placeholder="Search by name, skill, or tradition…"
          aria-label="Search consultants"
          className="w-full pl-14 pr-14 py-4 glass-luxury rounded-2xl
                     text-base text-foreground placeholder:text-muted-foreground
                     outline-none focus:border-[var(--color-luxury-gold)]/50
                     transition-colors"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg
                       text-muted-foreground hover:text-foreground
                       hover:bg-surface-overlay transition-colors"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* ─── Filter rail (bubble pills) ──────────────────────────────────── */}
      <div className="relative -mx-4 md:mx-0">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10
                        bg-gradient-to-l from-background to-transparent" />
        <div className="flex items-center gap-2 overflow-x-auto pb-2 pl-4 md:pl-0 pr-12
                        custom-scrollbar hide-scrollbar">
          <Chip active={category === "all"} onClick={() => setCategory("all")}>
            All
          </Chip>
          {categories.slice(0, 14).map((c) => (
            <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
              {c.display_name}
            </Chip>
          ))}
          <button
            type="button"
            onClick={() => setOnlineOnly((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap",
              "transition-all",
              onlineOnly
                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                : "bg-surface-raised border border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <span className={cn(
              "w-1.5 h-1.5 rounded-full",
              onlineOnly ? "bg-emerald-400 animate-pulse" : "bg-slate-500",
            )} />
            Online only
          </button>
          {isFiltered && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-full text-xs font-bold
                         text-muted-foreground hover:text-rose-400 whitespace-nowrap transition-colors"
            >
              <SlidersHorizontal size={11} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ─── Results ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-72 rounded-2xl glass-luxury animate-pulse"
            />
          ))}
        </div>
      ) : fetchError ? (
        <div className="text-center py-20 rounded-3xl border border-rose-500/20 bg-rose-500/[0.04]">
          <p className="text-rose-400 text-sm mb-3">Failed to load: {fetchError}</p>
          <button
            onClick={() => setQuery(query)}
            className="text-[var(--color-primary)] hover:underline text-xs font-bold"
          >
            Retry
          </button>
        </div>
      ) : visible.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-24 rounded-3xl border-2 border-dashed border-border"
        >
          <Search size={36} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-foreground font-bold mb-1">No consultants match</p>
          <p className="text-sm text-muted-foreground mb-5">
            Try a different search term or clear your filters.
          </p>
          {isFiltered && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl
                         bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                         text-white text-xs font-black transition-all hover:scale-[1.02]"
            >
              <Sparkles size={12} /> Clear filters
            </button>
          )}
        </motion.div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          {visible.map((c) => (
            <motion.div key={c.id} variants={fadeUp}>
              <LuxuryConsultantCard
                consultant={toProfile(c)}
                onChat={handleChat}
                onBook={(id) => router.push(`/booking?consultantId=${id}`)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ─── Toast ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200]
                       px-5 py-3 rounded-2xl glass-luxury
                       text-sm font-bold text-foreground shadow-2xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <WalletGateDialog
        open={gateOpen}
        onOpenChange={setGateOpen}
        info={gateInfo}
      />
    </div>
  );
}

function Chip({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all",
        active
          ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white shadow-lg shadow-[var(--color-primary-hover)]/20"
          : "bg-surface-raised border border-border text-muted-foreground hover:text-foreground hover:border-[var(--color-luxury-gold)]/30",
      )}
    >
      {children}
    </motion.button>
  );
}
TSX
mark_done "comp.directory"; fi

# ═══════════════════════════════════════════════════════════════════════════════
# 6. Services page (server)
# ═══════════════════════════════════════════════════════════════════════════════
hdr "6. services/page.tsx"

if is_done "page.services"; then ok "skip"; else
write_if_changed "apps/web/app/services/page.tsx" <<'TSX'
// ═══════════════════════════════════════════════════════════════════════════════
// Services — AI concierge + bubble category grid
// ═══════════════════════════════════════════════════════════════════════════════

import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { SkeletonGrid } from "@zeal/ui";
import { createServerClientFromCookies } from "@zeal/database/server";
import { CATEGORY_ID_TO_NAME } from "@/lib/services/slug";
import { ZealChat } from "@/components/zeal/ZealChat";
import { CategoryGridRealtime } from "./CategoryGridRealtime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getCategoryCounts() {
  try {
    const supabase = await createServerClientFromCookies();
    const { data, error } = await supabase.rpc("category_counts");
    if (error) return {} as Record<string, { count: number; onlineCount: number }>;
    const rows = (data ?? []) as Array<{
      categoryId: string; count: number; onlineCount: number;
    }>;
    const map: Record<string, { count: number; onlineCount: number }> = {};
    for (const r of rows) map[r.categoryId] = { count: r.count, onlineCount: r.onlineCount };
    return map;
  } catch {
    return {} as Record<string, { count: number; onlineCount: number }>;
  }
}

async function CategoryGrid() {
  const counts = await getCategoryCounts();
  const categories = Object.entries(CATEGORY_ID_TO_NAME);
  return (
    <CategoryGridRealtime
      initial={categories.map(([id, name]) => ({
        id, name,
        count: counts[id]?.count ?? 0,
        onlineCount: counts[id]?.onlineCount ?? 0,
      }))}
    />
  );
}

export default function ServicesPage() {
  return (
    <div className="min-h-screen-app bg-background pb-24">
      {/* ─── Editorial hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden noise-overlay
                          border-b border-[var(--color-luxury-glass-border)]">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px]
                        bg-[var(--color-luxury-gold)]/[0.10] blur-[180px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px]
                        bg-[var(--color-primary)]/[0.14] blur-[180px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 lg:px-16 py-14 md:py-20">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full
                          bg-[var(--color-luxury-gold)]/[0.08]
                          border border-[var(--color-luxury-gold)]/[0.20]
                          text-[var(--color-luxury-gold)]
                          text-[10px] font-black uppercase tracking-[0.25em] mb-6">
            <Sparkles size={12} /> Powered by Agnes + Groq
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black
                         tracking-[-0.03em] leading-[0.95] text-foreground max-w-3xl">
            Ask Zeal,{" "}
            <span className="text-luxury-gradient">find your guide.</span>
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground
                        max-w-2xl leading-relaxed">
            Describe what you're looking for. Zeal reads the entire directory —
            human and AI — and connects you with the right match.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-16 py-10 space-y-16">
        {/* ─── AI Concierge ─────────────────────────────────────────────── */}
        <section>
          <ZealChat />
        </section>

        {/* ─── Category bubble grid ────────────────────────────────────── */}
        <section id="category-grid">
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-[0.25em]
                          text-[var(--color-luxury-gold)] font-bold mb-2">
              Every tradition
            </p>
            <h2 className="text-2xl md:text-4xl font-black tracking-tight text-foreground">
              Explore by path
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              37 traditions · verified guides · realtime counts
            </p>
          </div>
          <Suspense fallback={<SkeletonGrid count={12} />}>
            <CategoryGrid />
          </Suspense>
        </section>
      </div>
    </div>
  );
}
TSX
mark_done "page.services"; fi

# ═══════════════════════════════════════════════════════════════════════════════
# 7. CategoryGridRealtime — bubble cards
# ═══════════════════════════════════════════════════════════════════════════════
hdr "7. CategoryGridRealtime.tsx"

if is_done "comp.categoryGrid"; then ok "skip"; else
write_if_changed "apps/web/app/services/CategoryGridRealtime.tsx" <<'TSX'
"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// CategoryGridRealtime — bubble cards with realtime counts
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useChannel } from "@zeal/realtime";
import { fadeUp, staggerContainer } from "@zeal/ui/motion";

interface CategoryCard {
  id: string;
  name: string;
  count: number;
  onlineCount: number;
}

export function CategoryGridRealtime({ initial }: { initial: CategoryCard[] }) {
  const [categories, setCategories] = useState(initial);

  const { refetch } = useQuery({
    queryKey: ["category-counts"],
    queryFn: async () => {
      const res = await fetch("/api/services/counts", { cache: "no-store" });
      if (!res.ok) throw new Error("counts fetch failed");
      const data = (await res.json()) as { categories: CategoryCard[] };
      setCategories((prev) =>
        prev.map((c) => {
          const fresh = data.categories.find((x) => x.id === c.id);
          return fresh ? { ...c, count: fresh.count, onlineCount: fresh.onlineCount } : c;
        }),
      );
      return data;
    },
    refetchOnWindowFocus: false,
    refetchInterval: 30_000,
  });

  useChannel<{ at?: string }>({
    channel: "directory:counts",
    event: "*",
    onMessage: useCallback(() => { void refetch(); }, [refetch]),
  });

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-50px" }}
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
    >
      {categories.map((c) => (
        <motion.div key={c.id} variants={fadeUp}>
          <BubbleCard category={c} />
        </motion.div>
      ))}
    </motion.div>
  );
}

function BubbleCard({ category }: { category: CategoryCard }) {
  return (
    <Link
      href={`/services/${category.id}`}
      className="group relative block aspect-square overflow-hidden rounded-[2rem]
                 glass-luxury transition-all duration-500"
    >
      {/* Ambient hover glow */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-0
                   group-hover:opacity-100 transition-opacity duration-500
                   bg-gradient-to-br from-[var(--color-luxury-gold)]/[0.15]
                   via-transparent to-[var(--color-primary)]/[0.20]"
      />

      {/* Morphing bubble blob */}
      <motion.span
        aria-hidden
        className="absolute -top-20 -right-20 w-48 h-48 rounded-full
                   bg-[var(--color-primary)]/[0.18] blur-[60px] pointer-events-none"
        animate={{ scale: [1, 1.25, 1], x: [0, -8, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 flex h-full flex-col items-center justify-center text-center px-5">
        <motion.div
          whileHover={{ scale: 1.12, rotate: -3 }}
          transition={{ type: "spring", stiffness: 400, damping: 16 }}
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4
                     bg-gradient-to-br from-[var(--color-luxury-gold)]/25
                     to-[var(--color-primary)]/[0.15]
                     text-[var(--color-luxury-gold)]"
        >
          <Sparkles size={20} />
        </motion.div>

        <h3 className="text-sm md:text-base font-black text-foreground leading-tight
                       line-clamp-2 group-hover:text-[var(--color-luxury-gold)]
                       transition-colors">
          {category.name}
        </h3>

        <div className="mt-3 flex items-center gap-2 text-[11px] font-mono">
          <span className="text-muted-foreground">
            {category.count} guide{category.count !== 1 ? "s" : ""}
          </span>
          {category.onlineCount > 0 && (
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {category.onlineCount}
            </span>
          )}
        </div>

        <ArrowUpRight
          size={14}
          className="absolute top-4 right-4 text-muted-foreground
                     group-hover:text-[var(--color-luxury-gold)]
                     group-hover:-translate-y-0.5 group-hover:translate-x-0.5
                     transition-all"
        />
      </div>
    </Link>
  );
}
TSX
mark_done "comp.categoryGrid"; fi

# ═══════════════════════════════════════════════════════════════════════════════
# 8. LuxuryConsultantCard — refined
# ═══════════════════════════════════════════════════════════════════════════════
hdr "8. LuxuryConsultantCard.tsx"

if is_done "comp.luxuryCard"; then ok "skip"; else
write_if_changed "apps/web/components/shared/LuxuryConsultantCard.tsx" <<'TSX'
"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// LuxuryConsultantCard — premium bubble card with 3D tilt
// ═══════════════════════════════════════════════════════════════════════════════

import Link from "next/link";
import { useCallback, useId, useMemo } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Flame, MessageCircle, Radio, Sparkles, Star, Zap } from "lucide-react";
import type { ConsultantProfile } from "@zeal/types";
import { cn } from "@zeal/ui";

export interface LuxuryConsultantInput extends ConsultantProfile {
  lastSeenAt?: string | null;
  isPaid?: boolean;
}

interface Props {
  consultant: LuxuryConsultantInput;
  onChat?: (consultantId: string) => void;
  onBook?: (consultantId: string) => void;
  variant?: "default" | "compact";
  priority?: boolean;
}

type PresenceTone = "online" | "away" | "offline";
interface Presence { tone: PresenceTone; label: string }

const PRESENCE_WINDOW_AWAY_MS = 10 * 60 * 1000;

function derivePresence(c: LuxuryConsultantInput): Presence {
  if (c.isAI) return { tone: "online", label: "AI" };
  if (c.isOnline) return { tone: "online", label: "Online" };
  if (c.lastSeenAt) {
    const last = new Date(c.lastSeenAt).getTime();
    if (Number.isFinite(last) && Date.now() - last < PRESENCE_WINDOW_AWAY_MS) {
      return { tone: "away", label: "Away" };
    }
  }
  return { tone: "offline", label: "Offline" };
}

const PRESENCE_STYLE: Record<PresenceTone, { pill: string; dot: string }> = {
  online: {
    pill: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    dot: "bg-emerald-400 animate-pulse",
  },
  away: {
    pill: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    dot: "bg-amber-400",
  },
  offline: {
    pill: "bg-surface-raised text-muted-foreground border border-border",
    dot: "bg-slate-500",
  },
};

export function LuxuryConsultantCard({
  consultant, onChat, onBook, variant = "default", priority = false,
}: Props) {
  const isCompact = variant === "compact";
  const headingId = useId();

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rotateX = useSpring(useTransform(rawX, [-0.5, 0.5], [3, -3]), {
    stiffness: 260, damping: 20,
  });
  const rotateY = useSpring(useTransform(rawY, [-0.5, 0.5], [-3, 3]), {
    stiffness: 260, damping: 20,
  });

  const presence = useMemo(() => derivePresence(consultant), [consultant]);
  const style = PRESENCE_STYLE[presence.tone];

  const chatEnabled = Boolean(consultant.isAI || consultant.isOnline);
  const href = consultant.isAI
    ? `/ai-astrologers/${consultant.id}`
    : `/consultant/${consultant.id}`;

  const displayName = consultant.name || consultant.username || "Guide";
  const initial = displayName.charAt(0).toUpperCase();

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      rawY.set((e.clientX - rect.left) / rect.width - 0.5);
      rawX.set((e.clientY - rect.top) / rect.height - 0.5);
    },
    [rawX, rawY],
  );

  const handleLeave = useCallback(() => { rawX.set(0); rawY.set(0); }, [rawX, rawY]);

  const handleChat = useCallback(() => {
    if (!chatEnabled) return;
    onChat?.(consultant.id);
  }, [chatEnabled, consultant.id, onChat]);

  const handleBook = useCallback(() => { onBook?.(consultant.id); }, [consultant.id, onBook]);

  const rateLabel = consultant.perMinuteRate > 0 ? `₹${consultant.perMinuteRate}/min` : "Free";

  return (
    <motion.article
      aria-labelledby={headingId}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={cn(
        "group relative overflow-hidden rounded-3xl",
        "glass-luxury glass-luxury-hover",
        isCompact ? "p-4" : "p-5",
      )}
    >
      {/* Ambient hover gradient */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0
                   transition-opacity duration-500 group-hover:opacity-100
                   bg-gradient-to-br from-[var(--color-luxury-gold)]/[0.10]
                   via-transparent to-[var(--color-primary)]/[0.14]"
      />

      {/* Bubble blob */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-16 w-40 h-40 rounded-full
                   bg-[var(--color-primary)]/[0.12] blur-[50px]"
        animate={{ scale: [1, 1.2, 1], x: [0, 6, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Presence pill */}
      <span
        aria-label={`Presence: ${presence.label}`}
        className={cn(
          "absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5",
          "text-[9px] font-black uppercase tracking-widest",
          style.pill,
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
        {presence.label}
      </span>

      {consultant.isAI && (
        <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 rounded-full
                         bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                         px-2 py-0.5 text-[9px] font-black tracking-wider text-white">
          <Zap size={10} aria-hidden /> AI
        </span>
      )}

      <div className="relative z-[1] flex flex-col items-center text-center">
        {/* Avatar with gradient ring */}
        <Link href={href} className="relative inline-block" aria-label={`View ${displayName}'s profile`}>
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-[var(--color-luxury-gold)]/25
                       blur-xl transition-all group-hover:bg-[var(--color-luxury-gold)]/40"
          />
          <span className="relative block rounded-full p-[2px]
                           bg-gradient-to-br from-[var(--color-luxury-gold)]
                           via-transparent to-[var(--color-primary)]">
            <span className="block rounded-full bg-[var(--color-surface)] p-[2px]">
              {consultant.avatar ? (
                <img
                  src={consultant.avatar}
                  alt=""
                  loading={priority ? "eager" : "lazy"}
                  decoding="async"
                  className={cn(
                    "rounded-full object-cover",
                    isCompact ? "h-14 w-14" : "h-20 w-20",
                  )}
                />
              ) : (
                <span className={cn(
                  "flex items-center justify-center rounded-full",
                  "bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)]",
                  "font-black text-white",
                  isCompact ? "h-14 w-14 text-xl" : "h-20 w-20 text-2xl",
                )}>
                  {initial}
                </span>
              )}
            </span>
          </span>
        </Link>

        <Link href={href} className="mt-3 max-w-full">
          <h3
            id={headingId}
            className="truncate text-base font-bold text-foreground
                       transition-colors group-hover:text-[var(--color-luxury-gold)]"
          >
            {displayName}
          </h3>
          {consultant.username && (
            <p className="truncate text-[11px] text-muted-foreground font-mono">
              @{consultant.username}
            </p>
          )}
        </Link>

        {/* Metrics */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 text-amber-400">
            <Star size={11} className="fill-amber-400" aria-hidden />
            {(consultant.rating || 0).toFixed(1)}
          </span>
          {typeof consultant.sparks === "number" && consultant.sparks > 0 && (
            <span className="inline-flex items-center gap-1 text-orange-400">
              <Flame size={11} aria-hidden />
              {consultant.sparks.toLocaleString("en-IN")}
            </span>
          )}
          <span className="font-mono font-bold text-[var(--color-luxury-gold)]">
            {rateLabel}
          </span>
        </div>

        {/* Specialty chips */}
        {!isCompact && consultant.specialties && consultant.specialties.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1">
            {consultant.specialties.slice(0, 2).map((s) => (
              <span
                key={s}
                className="rounded-full border border-border bg-surface-raised
                           px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex w-full gap-2">
          <button
            type="button"
            onClick={handleChat}
            disabled={!chatEnabled}
            aria-label={
              consultant.isAI ? `Chat with ${displayName}`
                : consultant.isOnline ? `Start chat with ${displayName}`
                : `${displayName} is offline`
            }
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black",
              "transition-all",
              chatEnabled
                ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white hover:opacity-95 active:scale-[0.98]"
                : "cursor-not-allowed bg-surface-raised text-muted-foreground",
            )}
          >
            {consultant.isAI ? (
              <><Zap size={12} aria-hidden /> Chat</>
            ) : consultant.isOnline ? (
              <><MessageCircle size={12} aria-hidden /> Chat now</>
            ) : (
              <><Radio size={12} aria-hidden /> Offline</>
            )}
          </button>
          {!consultant.isAI && (
            <button
              type="button"
              onClick={handleBook}
              aria-label={`Book a session with ${displayName}`}
              className="rounded-xl border border-border bg-surface-raised
                         px-3 py-2.5 text-xs font-black text-foreground
                         transition-all hover:border-[var(--color-luxury-gold)]/40
                         hover:bg-surface-overlay"
            >
              Book
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
TSX
mark_done "comp.luxuryCard"; fi

# ═══════════════════════════════════════════════════════════════════════════════
# 9. Type check
# ═══════════════════════════════════════════════════════════════════════════════
hdr "9. Type check"

if is_done "typecheck"; then ok "skip"; else
FAIL=0
for ws in web admin; do
  [[ -f "apps/$ws/package.json" ]] || continue
  grep -q '"type-check"' "apps/$ws/package.json" || continue
  info "type-check apps/$ws…"
  if ( cd "apps/$ws" && npm run type-check --silent 2>&1 | tail -25 ); then
    ok "apps/$ws clean"
  else
    fail "apps/$ws has type errors"
    FAIL=$((FAIL + 1))
  fi
done
if (( FAIL > 0 )); then
  fail "Backups: $BACKUP_ROOT"
  exit 1
fi
mark_done "typecheck"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════
hdr "DONE"

echo ""
echo "  Backups : $BACKUP_ROOT"
echo ""
warn "Next:"
echo "  npm run dev"
echo ""
echo "  Visit:"
echo "    → /profile   (parallax cover, halo avatar, sliding tabs)"
echo "    → /explore   (editorial hero, bubble filter rail, tilted cards)"
echo "    → /services  (ZealChat + bubble category grid)"
echo ""
echo "  Lenis smooth scroll is now active app-wide (respects prefers-reduced-motion)."
echo ""

ok "Premium pages complete."