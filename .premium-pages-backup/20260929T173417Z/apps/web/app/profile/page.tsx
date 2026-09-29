"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Profile — Instagram-style own profile
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Check, Copy, Edit3, Loader2, LogOut, MapPin, Plus,
  Settings, Shield, Sparkles, User, Wallet,
} from "lucide-react";
import { PostGrid } from "@/components/profile/PostGrid";
import { signOutAction } from "@/actions/auth";
import { toast } from "@/components/ui/toaster";

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

  useEffect(() => {
    (async () => {
      try {
        const [meRes, statsRes] = await Promise.all([
          fetch("/api/users/me/profile", { cache: "no-store" }),
          fetch("/api/users/me/profile", { cache: "no-store" }),
        ]);
        if (meRes.ok) {
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
        }
        void statsRes;
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCopy = async () => {
    if (!profile?.username) return;
    try {
      await navigator.clipboard.writeText(`https://zeal.app/@${profile.username}`);
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
        <div className="text-center">
          <User size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Please sign in to view your profile.</p>
          <Link
            href="/login"
            className="mt-4 inline-block px-5 py-2.5 rounded-xl
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

  return (
    <div className="min-h-screen-app bg-background pb-24">
      {/* Back + actions header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-surface-raised transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={16} className="text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <Link
              href="/wallet"
              className="p-2 rounded-xl hover:bg-surface-raised transition-colors"
              aria-label="Wallet"
            >
              <Wallet size={16} className="text-foreground" />
            </Link>
            <Link
              href="/profile/edit"
              className="p-2 rounded-xl hover:bg-surface-raised transition-colors"
              aria-label="Edit profile"
            >
              <Edit3 size={16} className="text-foreground" />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-6">
        {/* Header card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8"
        >
          <div className="relative shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden
                            bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)]
                            flex items-center justify-center text-white font-black text-3xl
                            ring-4 ring-[var(--color-luxury-gold)]/20">
              {profile.avatar ? (
                <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                initial
              )}
            </div>
            {profile.is_online && (
              <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full
                               bg-emerald-500 border-4 border-background animate-pulse" />
            )}
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left">
            <h1 className="text-2xl font-black text-foreground truncate">
              {displayName}
            </h1>
            {profile.username && (
              <div className="mt-1 flex items-center gap-2 justify-center sm:justify-start">
                <p className="text-sm text-muted-foreground font-mono">@{profile.username}</p>
                <button
                  onClick={handleCopy}
                  className="p-1 rounded-lg hover:bg-surface-raised text-muted-foreground"
                  aria-label="Copy profile link"
                >
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
            )}

            {/* Stats row */}
            {stats && (
              <div className="flex items-center gap-6 mt-4 justify-center sm:justify-start">
                <Stat label="Posts" value={stats.posts} />
                <Stat label="Followers" value={stats.followers} />
                <Stat label="Following" value={stats.following} />
              </div>
            )}

            {/* Bio */}
            {profile.bio && (
              <p className="text-sm text-foreground mt-4 leading-relaxed max-w-lg">
                {profile.bio}
              </p>
            )}

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground justify-center sm:justify-start">
              {profile.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={11} /> {profile.location}
                </span>
              )}
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-primary)] hover:underline truncate max-w-[200px]"
                >
                  {profile.website}
                </a>
              )}
              <span className="flex items-center gap-1">
                <Sparkles size={11} className="text-[var(--color-luxury-gold)]" />
                {profile.sparks.toLocaleString("en-IN")} Sparks
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-5 justify-center sm:justify-start">
              {canPost?.canPost ? (
                <Link
                  href="/create"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                             bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                             text-white text-xs font-black"
                >
                  <Plus size={13} /> New post
                </Link>
              ) : (
                <div className="px-5 py-2.5 rounded-xl bg-surface-raised border border-border
                                text-xs font-bold text-muted-foreground">
                  Post limit reached ({canPost?.limit})
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Limit banner */}
        {canPost && (
          <div className="mb-6 p-3 rounded-2xl bg-surface border border-border
                          text-xs text-muted-foreground flex items-center gap-2">
            <Sparkles size={12} className="text-[var(--color-luxury-gold)]" />
            <span>
              {canPost.current} of {canPost.limit} posts used
              {canPost.remaining > 0 && ` · ${canPost.remaining} remaining`}
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-border">
          <TabButton active={tab === "posts"} onClick={() => setTab("posts")}>
            Posts
          </TabButton>
          <TabButton active={tab === "about"} onClick={() => setTab("about")}>
            About
          </TabButton>
          <TabButton active={tab === "security"} onClick={() => setTab("security")}>
            Security
          </TabButton>
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {tab === "posts" && (
            <motion.div
              key="posts"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <PostGrid userId={profile.id} isSelf />
            </motion.div>
          )}

          {tab === "about" && (
            <motion.div
              key="about"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-3xl border border-border bg-surface p-6 space-y-4"
            >
              <AboutRow label="Name"      value={profile.name ?? "—"} />
              <AboutRow label="Username"  value={profile.username ? `@${profile.username}` : "—"} />
              <AboutRow label="Email"     value={profile.email} />
              <AboutRow label="Location"  value={profile.location ?? "—"} />
              <AboutRow label="Website"   value={profile.website ?? "—"} />
              <AboutRow label="Role"      value={profile.role} />
              <AboutRow
                label="Member since"
                value={new Date(profile.post_count > 0 ? Date.now() : Date.now()).toLocaleDateString("en-IN", {
                  year: "numeric", month: "long",
                })}
              />
              <div className="pt-4 border-t border-border">
                <Link
                  href="/profile/edit"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl
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
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <Link
                href="/profile?tab=security"
                className="flex items-center gap-3 p-5 rounded-3xl border border-border
                           bg-surface hover:border-[var(--color-primary)]/40 transition-colors"
              >
                <Shield size={20} className="text-[var(--color-primary)]" />
                <div className="flex-1">
                  <p className="text-sm font-black text-foreground">Two-factor authentication</p>
                  <p className="text-xs text-muted-foreground">
                    Add an extra layer of security
                  </p>
                </div>
              </Link>

              <div className="p-5 rounded-3xl border border-rose-500/20 bg-rose-500/[0.04]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-foreground">Sign out</p>
                    <p className="text-xs text-muted-foreground">
                      End your session on this device
                    </p>
                  </div>
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="px-4 py-2.5 rounded-xl bg-rose-500/10 text-rose-400
                                 hover:bg-rose-500/20 text-xs font-black transition-colors
                                 flex items-center gap-1.5"
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center sm:text-left">
      <p className="text-lg font-black font-mono text-foreground">
        {value.toLocaleString("en-IN")}
      </p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">
        {label}
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-xs font-black uppercase tracking-widest border-b-2 -mb-px transition-colors ${
        active
          ? "border-[var(--color-primary)] text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
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
