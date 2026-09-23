// ZEAL_PHASE2_V1
"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Homepage — luxury hero + realtime AI + realtime experts + feed
// Phase 2: every Chat CTA routes through startChatFlow with WalletGateDialog.
// ═══════════════════════════════════════════════════════════════════════════════
import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Radio, Sparkles } from "lucide-react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";
import { EmptyState } from "@zeal/ui";
import { cardHoverVariants, staggerContainer, fadeUp } from "@zeal/ui/motion";
import { ConsultantCard } from "@/components/shared/ConsultantCard";
import { LuxuryConsultantCard } from "@/components/shared/LuxuryConsultantCard";
import { startChatFlow, type LowBalanceInfo } from "@/lib/chat/start-chat-flow";
import { WalletGateDialog } from "@/components/billing/WalletGateDialog";
import type { ConsultantProfile } from "@zeal/types";

interface AIConsultant {
  id: string; name: string; username: string; avatar: string;
  category: string; bio: string; rating: number; isPaid: boolean;
  perMinuteRate: number; specialties: string[] | null; isFeatured: boolean;
}
interface Expert {
  id: string; category: string; rating: number; sparkScore: number;
  perMinuteRate: number; specialties: string[] | null; languages: string[] | null;
  totalConsultations: number | null;
  user: { id: string; name: string | null; username: string;
          avatar: string | null; is_online: boolean | null } | null;
}
interface Post {
  id: string; content: string; mediaUrls?: string[] | null;
  cheerCount?: number | null; commentCount?: number | null; createdAt: string;
  author: { id?: string; name: string | null; username: string | null;
            avatar: string | null } | null;
}
interface HomeProps {
  aiConsultants: AIConsultant[];
  experts: Expert[];
  posts: Post[];
  stats: { traditions: number; consultants: number; aiConsultants: number };
}

function toProfile(ex: Expert): ConsultantProfile {
  return {
    id: ex.id, userId: ex.user?.id ?? "",
    name: ex.user?.name ?? ex.user?.username ?? "Guide",
    username: ex.user?.username ?? "", bio: "",
    avatar: ex.user?.avatar ?? "", category: ex.category as never,
    isVerified: true, isOnline: Boolean(ex.user?.is_online),
    perMinuteRate: ex.perMinuteRate, experience: 0, rating: ex.rating,
    totalConsultations: ex.totalConsultations ?? 0, sparks: ex.sparkScore,
    languages: ex.languages ?? [], specialties: ex.specialties ?? [],
    faith: "OTHER" as never, isAI: false,
  };
}

export function HomeClient({
  aiConsultants, experts: initialExperts,
  posts: initialPosts, stats,
}: HomeProps) {
  const router = useRouter();
  const [experts, setExperts] = useState<Expert[]>(initialExperts);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [aiList, setAiList] = useState<AIConsultant[]>(aiConsultants);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateInfo, setGateInfo] = useState<LowBalanceInfo | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
        setExperts((prev) => prev.map((e) =>
          e.user?.id === id ? { ...e, user: { ...e.user!, is_online: st } } : e));
      }
    }, []),
  });

  useChannel<BroadcastChange<AIConsultant>>({
    channel: channels.consultantAiUpdates(),
    event: "*",
    onMessage: useCallback((p) => {
      const { type, record, old_record } = p ?? {};
      if (type === "INSERT" && record) {
        setAiList((prev) => prev.some((x) => x.id === record.id)
          ? prev : [record, ...prev].slice(0, 6));
      } else if (type === "UPDATE" && record) {
        setAiList((prev) => prev.map((x) => x.id === record.id ? record : x));
      } else if (type === "DELETE" && old_record?.id) {
        setAiList((prev) => prev.filter((x) => x.id !== old_record.id));
      }
    }, []),
  });

  useChannel<BroadcastChange<Post>>({
    channel: "feed:posts",
    event: "*",
    onMessage: useCallback((p) => {
      const { type, record, old_record } = p ?? {};
      if (type === "INSERT" && record) {
        setPosts((prev) => prev.some((x) => x.id === record.id)
          ? prev : [record, ...prev].slice(0, 50));
      } else if (type === "UPDATE" && record) {
        setPosts((prev) => prev.map((x) => x.id === record.id ? record : x));
      } else if (type === "DELETE" && old_record?.id) {
        setPosts((prev) => prev.filter((x) => x.id !== old_record.id));
      }
    }, []),
  });

  return (
    <div className="space-y-16 pb-16">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl mx-4 md:mx-6 lg:mx-auto lg:max-w-7xl mt-6 noise-overlay border border-[var(--color-luxury-glass-border)]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0B0A14] via-[#1A1430] to-[#0B0A14]" />
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-[var(--color-luxury-gold)]/8 blur-[160px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-[#9D7DC5]/10 blur-[160px] pointer-events-none" />
        <motion.div variants={staggerContainer} initial="hidden" animate="show"
          className="relative z-10 p-8 md:p-16">
          <motion.div variants={fadeUp}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-luxury-gold)]/10 border border-[var(--color-luxury-gold)]/20 text-[var(--color-luxury-gold)] text-xs font-bold uppercase tracking-widest mb-6">
            <Sparkles size={12} />
            Multi-faith · {stats.traditions} traditions · 24/7 AI + verified humans
          </motion.div>
          <motion.h1 variants={fadeUp}
            className="text-editorial-xl text-white max-w-3xl"
            style={{ fontFamily: "var(--font-display)" }}>
            Every tradition.<br />
            <span className="text-luxury-gradient">One sanctuary.</span>
          </motion.h1>
          <motion.p variants={fadeUp}
            className="text-slate-300 mt-6 max-w-xl text-base md:text-lg leading-relaxed">
            Vedic astrology, Islamic counseling, Buddhist meditation, Christian
            therapy, Tarot, energy healing, and modern wellness — on one
            platform, in one calm room.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-wrap gap-3 mt-10">
            <Link href="/explore"
              className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-white font-black text-sm shadow-xl shadow-[#533AFD]/25 hover:scale-[1.02] active:scale-[0.98] transition-transform">
              Find your guide <ArrowRight size={15} />
            </Link>
            <Link href="/services"
              className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl glass-luxury glass-luxury-hover text-white font-bold text-sm">
              Ask Zeal AI
            </Link>
          </motion.div>
          <motion.div variants={fadeUp}
            className="flex flex-wrap items-center gap-6 mt-10 pt-8 border-t border-white/5">
            <Stat value={stats.consultants} label="Verified guides" />
            <div className="luxury-divider w-px h-8 hidden sm:block" />
            <Stat value={stats.aiConsultants} label="AI consultants" />
            <div className="luxury-divider w-px h-8 hidden sm:block" />
            <Stat value={stats.traditions} label="Traditions" />
          </motion.div>
        </motion.div>
      </section>

      {/* AI CONSULTANTS */}
      <section className="mx-4 md:mx-6 lg:mx-auto lg:max-w-7xl">
        <SectionHeader eyebrow="Instant answers · 24/7" title="AI Consultants"
          icon={<Sparkles size={20} className="text-[var(--color-luxury-gold)]" />}
          href="/ai-astrologers" hrefLabel="View all" />
        {aiList.length === 0 ? (
          <EmptyState title="No AI consultants yet" description="Check back soon." />
        ) : (
          <motion.div variants={staggerContainer} initial="hidden" whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {aiList.map((ai) => (
              <motion.div key={ai.id} variants={fadeUp}>
                <AICard consultant={ai} onChat={handleChat} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      {/* VERIFIED EXPERTS */}
      <section className="mx-4 md:mx-6 lg:mx-auto lg:max-w-7xl">
        <SectionHeader eyebrow="Real humans · Realtime presence" title="Verified Experts"
          icon={<Radio size={20} className="text-emerald-400" />}
          href="/explore" hrefLabel="Directory" />
        {experts.length === 0 ? (
          <EmptyState title="No experts yet" description="Try again shortly." />
        ) : (
          <motion.div variants={staggerContainer} initial="hidden" whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {experts.map((ex) => (
              <motion.div key={ex.id} variants={fadeUp}>
                <LuxuryConsultantCard
                  consultant={toProfile(ex)}
                  onChat={handleChat}
                  onBook={(id) => router.push(`/booking?consultantId=${id}`)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      {/* LIVE FEED */}
      <section className="mx-4 md:mx-6 lg:mx-auto lg:max-w-3xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            Live Cosmos Feed
          </h2>
          <Link href="/create" className="text-xs font-bold text-[var(--color-luxury-gold)] hover:underline">
            + Post
          </Link>
        </div>
        {posts.length === 0 ? (
          <EmptyState title="No posts yet" description="Be the first to share." />
        ) : (
          <div className="space-y-4">
            {posts.map((p) => (
              <motion.article key={p.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="glass-luxury glass-luxury-hover rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden shrink-0 ring-1 ring-[var(--color-luxury-gold)]/20">
                    {p.author?.avatar ? (
                      <img src={p.author.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white">
                        {(p.author?.name || p.author?.username || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">
                      {p.author?.name || p.author?.username || "Anonymous"}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {new Date(p.createdAt).toLocaleString([], {
                        hour: "2-digit", minute: "2-digit",
                        month: "short", day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                  {p.content}
                </p>
                {Array.isArray(p.mediaUrls) && p.mediaUrls.length > 0 && (
                  <div className="mt-3 rounded-xl overflow-hidden border border-white/5 max-h-96">
                    <img src={p.mediaUrls[0]} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex items-center gap-5 mt-4 pt-3 border-t border-white/5 text-xs text-slate-500">
                  <span>❤️ {p.cheerCount ?? 0}</span>
                  <span>💬 {p.commentCount ?? 0}</span>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </section>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-2xl glass-luxury text-sm font-bold text-white shadow-2xl">
          {toast}
        </div>
      )}
      <WalletGateDialog open={gateOpen} onOpenChange={setGateOpen} info={gateInfo} />
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-2xl font-black text-white font-mono tracking-tight">
        {value.toLocaleString()}
      </p>
      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-0.5">
        {label}
      </p>
    </div>
  );
}

function SectionHeader({
  eyebrow, title, icon, href, hrefLabel,
}: {
  eyebrow: string; title: string; icon: React.ReactNode;
  href: string; hrefLabel: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-luxury-gold)] font-bold mb-1">
          {eyebrow}
        </p>
        <h2 className="text-2xl md:text-3xl font-black text-white flex items-center gap-2.5">
          {icon}
          {title}
        </h2>
      </div>
      <Link href={href}
        className="text-sm font-bold text-slate-300 hover:text-[var(--color-luxury-gold)] transition-colors whitespace-nowrap">
        {hrefLabel} →
      </Link>
    </div>
  );
}

function AICard({
  consultant, onChat,
}: {
  consultant: AIConsultant;
  onChat: (id: string) => void;
}) {
  return (
    <motion.div variants={cardHoverVariants} initial="rest" whileHover="hover"
      className="glass-luxury glass-luxury-hover group relative overflow-hidden rounded-2xl p-5">
      <div aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-[var(--color-luxury-gold)]/10 via-transparent to-[#9D7DC5]/20" />
      <span className="absolute top-3 right-3 z-10 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse ring-2 ring-slate-950/80" />
      {consultant.isFeatured && (
        <span className="absolute top-3 left-3 z-10 px-1.5 py-0.5 rounded-full bg-[var(--color-luxury-gold)]/20 border border-[var(--color-luxury-gold)]/40 text-[var(--color-luxury-gold)] text-[8px] font-black uppercase tracking-widest">
          Featured
        </span>
      )}
      <div className="relative z-10">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <div aria-hidden className="absolute inset-0 rounded-full bg-[var(--color-luxury-gold)]/25 blur-md" />
            <div className="relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-[var(--color-luxury-gold)]/30">
              {consultant.avatar ? (
                <img src={consultant.avatar} alt={consultant.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#9D7DC5] to-[#533AFD] flex items-center justify-center text-white font-black">
                  {consultant.name.charAt(0)}
                </div>
              )}
            </div>
            <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-white text-[8px] font-black flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" /> AI
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-white text-sm truncate group-hover:text-[var(--color-luxury-gold)] transition-colors">
              {consultant.name}
            </h3>
            <p className="text-xs text-slate-400 capitalize truncate">
              {consultant.category.toLowerCase()}
            </p>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="text-amber-400">⭐ {consultant.rating.toFixed(1)}</span>
              <span className="text-[var(--color-luxury-gold)] font-mono font-bold">
                {consultant.isPaid ? `₹${consultant.perMinuteRate}/min` : "Free"}
              </span>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3 line-clamp-2 leading-relaxed">
          {consultant.bio}
        </p>
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={() => onChat(consultant.id)}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-white text-xs font-black hover:opacity-95 active:scale-[0.98] transition-all">
            Start chat →
          </button>
          <Link href={`/ai-astrologers/${consultant.id}`}
            className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-bold hover:text-white transition-colors">
            Profile
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
