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
