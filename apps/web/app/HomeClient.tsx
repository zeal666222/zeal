"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Homepage — realtime AI grid + expert grid + live feed
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Flame, Plus, Radio, Sparkles, Star } from "lucide-react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";
import { EmptyState } from "@zeal/ui";

interface AIConsultant {
  id: string; name: string; username: string; avatar: string; category: string;
  bio: string; rating: number; isPaid: boolean; perMinuteRate: number;
  specialties: string[] | null; isFeatured: boolean;
}

interface Expert {
  id: string; category: string; rating: number; sparkScore: number;
  perMinuteRate: number; specialties: string[] | null;
  user: { id: string; name: string | null; username: string; avatar: string | null; is_online: boolean | null } | null;
}

interface Post {
  id: string; content: string; mediaUrls?: string[] | null;
  cheerCount?: number | null; commentCount?: number | null; createdAt: string;
  author: { id?: string; name: string | null; username: string | null; avatar: string | null } | null;
}

interface Props {
  aiConsultants: AIConsultant[];
  experts: Expert[];
  posts: Post[];
}

export function HomeClient({ aiConsultants, experts, posts: initialPosts }: Props) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);

  // Realtime feed — prepend new posts, drop flagged
  useChannel<BroadcastChange<Post>>({
    channel: "feed:posts",
    event: "*",
    onMessage: useCallback((payload) => {
      const { type, record, old_record } = payload ?? {};
      if (type === "INSERT" && record) {
        setPosts((prev) => prev.some((p) => p.id === record.id) ? prev : [record, ...prev].slice(0, 50));
      } else if (type === "UPDATE" && record) {
        setPosts((prev) => prev.map((p) => (p.id === record.id ? record : p)));
      } else if (type === "DELETE" && old_record?.id) {
        setPosts((prev) => prev.filter((p) => p.id !== old_record.id));
      }
    }, []),
  });

  return (
    <div className="space-y-12 pb-12">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl mx-4 md:mx-6 lg:mx-auto lg:max-w-7xl mt-6 border border-[var(--color-border)]">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/15 via-transparent to-[var(--color-primary)]/5 pointer-events-none" />
        <div className="relative p-8 md:p-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-primary-muted)] border border-[var(--color-primary)]/20 text-[var(--color-primary)] text-xs font-bold uppercase tracking-widest mb-5">
            <Sparkles size={12} /> Multi-faith · 37 traditions · 24/7 AI + verified humans
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-[var(--color-foreground)] leading-[1.05] max-w-3xl">
            Every tradition.
              <br />
              <span className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] bg-clip-text text-transparent">
                One platform.
              </span>
          </h1>
          <p className="text-[var(--color-muted-foreground)] mt-5 max-w-xl text-base">
            Multi-faith wellness & healing — Vedic astrology, Islamic counseling,
            Buddhist meditation, Christian therapy, Tarot, energy healing, and modern wellness coaching.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link
              href="/services"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-[var(--color-primary-foreground)] font-black text-sm shadow-lg shadow-[var(--color-primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              Explore services <ArrowRight size={15} />
            </Link>
            <Link
              href="/ai-astrologers"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-foreground)] font-bold text-sm hover:border-[var(--color-primary)]/40 transition-colors"
            >
              Try AI consultant
            </Link>
          </div>
        </div>
      </section>

      {/* AI CONSULTANTS */}
      <section className="mx-4 md:mx-6 lg:mx-auto lg:max-w-7xl">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-[var(--color-foreground)] flex items-center gap-2">
              <Sparkles size={20} className="text-[var(--color-primary)]" />
              AI Consultants
            </h2>
            <p className="text-sm text-[var(--color-muted-foreground)] mt-1">
              Instant answers, 24/7 · Powered by Agnes + Groq
            </p>
          </div>
          <Link href="/ai-astrologers" className="text-sm font-bold text-[var(--color-primary)] hover:underline whitespace-nowrap">
            View all →
          </Link>
        </div>

        {aiConsultants.length === 0 ? (
          <EmptyState title="No AI consultants yet" description="Check back soon." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {aiConsultants.map((ai, idx) => (
              <motion.div
                key={ai.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.05, 0.3) }}
              >
                <Link
                  href={`/ai-astrologers/${ai.id}`}
                  className="block p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:shadow-lg transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] overflow-hidden ring-2 ring-[var(--color-primary)]/30">
                        {ai.avatar ? <img src={ai.avatar} alt="" className="w-full h-full object-cover" /> : null}
                      </div>
                      <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-[var(--color-primary-foreground)] text-[8px] font-black rounded-full">
                        AI
                      </span>
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[var(--color-surface)] rounded-full animate-pulse" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-[var(--color-foreground)] text-sm truncate">{ai.name}</h3>
                      <p className="text-xs text-[var(--color-muted-foreground)] capitalize truncate">{ai.category.toLowerCase()}</p>
                      <div className="flex items-center gap-2 mt-1.5 text-xs">
                        <span className="flex items-center gap-1 text-amber-500">
                          <Star size={11} className="fill-amber-500" /> {ai.rating.toFixed(1)}
                        </span>
                        <span className="text-[var(--color-primary)] font-mono">
                          {ai.isPaid ? `₹${ai.perMinuteRate}/min` : "Free"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-muted-foreground)] mt-3 line-clamp-2">{ai.bio}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* VERIFIED EXPERTS */}
      <section className="mx-4 md:mx-6 lg:mx-auto lg:max-w-7xl">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-[var(--color-foreground)] flex items-center gap-2">
              <Radio size={20} className="text-emerald-500" />
              Verified Experts
            </h2>
            <p className="text-sm text-[var(--color-muted-foreground)] mt-1">
              Real humans · Real-time presence
            </p>
          </div>
          <Link href="/explore" className="text-sm font-bold text-[var(--color-primary)] hover:underline whitespace-nowrap">
            Directory →
          </Link>
        </div>

        {experts.length === 0 ? (
          <EmptyState title="No experts online" description="Try again shortly." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {experts.map((ex, idx) => {
              const name = ex.user?.name || ex.user?.username || "Guide";
              const online = Boolean(ex.user?.is_online);
              return (
                <motion.div
                  key={ex.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                >
                  <Link
                    href={`/consultant/${ex.id}`}
                    className="block p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:shadow-lg transition-all text-center group"
                  >
                    <div className="relative w-16 h-16 mx-auto mb-3 rounded-full overflow-hidden bg-[var(--color-surface-raised)]">
                      {ex.user?.avatar ? (
                        <img src={ex.user.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl font-black text-[var(--color-primary)]">
                          {name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {online && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[var(--color-surface)] rounded-full" />
                      )}
                    </div>
                    <h3 className="font-bold text-[var(--color-foreground)] text-sm truncate">{name}</h3>
                    <p className="text-[10px] text-[var(--color-muted-foreground)] uppercase tracking-wider mt-0.5 truncate">
                      {ex.category.toLowerCase().replace(/_/g, " ")}
                    </p>
                    <div className="flex items-center justify-center gap-3 mt-3 text-xs">
                      <span className="flex items-center gap-1 text-amber-500">
                        <Star size={11} className="fill-amber-500" /> {ex.rating.toFixed(1)}
                      </span>
                      <span className="flex items-center gap-1 text-orange-500">
                        <Flame size={11} /> {ex.sparkScore.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-primary)] font-mono mt-2 font-bold">₹{ex.perMinuteRate}/min</p>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* LIVE FEED */}
      <section className="mx-4 md:mx-6 lg:mx-auto lg:max-w-3xl">
        <div className="flex items-center justify-between gap-4 mb-5">
          <h2 className="text-xl md:text-2xl font-black text-[var(--color-foreground)] flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            Live Cosmos Feed
          </h2>
          <Link
            href="/create"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary)] hover:underline"
          >
            <Plus size={13} /> Post
          </Link>
        </div>

        {posts.length === 0 ? (
          <EmptyState title="No posts yet" description="Be the first to share." />
        ) : (
          <div className="space-y-4">
            {posts.map((p) => (
              <motion.article
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)]"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-surface-raised)] overflow-hidden shrink-0">
                    {p.author?.avatar ? (
                      <img src={p.author.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm font-bold text-[var(--color-primary)]">
                        {(p.author?.name || p.author?.username || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[var(--color-foreground)] truncate">
                      {p.author?.name || p.author?.username || "Anonymous"}
                    </p>
                    <p className="text-[10px] text-[var(--color-muted-foreground)]">
                      {new Date(p.createdAt).toLocaleString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-[var(--color-foreground)] leading-relaxed whitespace-pre-wrap break-words">
                  {p.content}
                </p>
                {Array.isArray(p.mediaUrls) && p.mediaUrls.length > 0 && (
                  <div className="mt-3 rounded-xl overflow-hidden border border-[var(--color-border)] max-h-96">
                    <img src={p.mediaUrls[0]} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex items-center gap-5 mt-4 pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-muted-foreground)]">
                  <span>❤️ {p.cheerCount ?? 0}</span>
                  <span>💬 {p.commentCount ?? 0}</span>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
