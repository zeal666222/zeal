"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Homepage
// ─────────────────────────────────────────────────────────────────────────────
// Editorial hero · live ticker · spotlight rotation · category rail ·
// realtime presence · how-it-works · final CTA.
//
// Server component (page.tsx) fetches data. This component renders it.
// Every realtime channel is preserved: consultants:live, consultant:ai:updates,
// feed:posts.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  AnimatePresence,
} from "framer-motion";
import { useInView } from "react-intersection-observer";
import {
  ArrowRight,
  ArrowUpRight,
  Compass,
  Flame,
  Hand,
  Hash,
  Heart,
  Leaf,
  MessageCircle,
  Moon,
  Radio,
  Search,
  Sparkles,
  Star,
  Sun,
  TrendingUp,
  Users,
  Wind,
  Zap,
} from "lucide-react";

import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";
import { EmptyState } from "@zeal/ui";
import { fadeUp, staggerContainer } from "@zeal/ui/motion";

import { LuxuryConsultantCard } from "@/components/shared/LuxuryConsultantCard";
import { startChatFlow, type LowBalanceInfo } from "@/lib/chat/start-chat-flow";
import { toast as pushToast } from "@/components/ui/toaster";
import { WalletGateDialog } from "@/components/billing/WalletGateDialog";
import type { ConsultantProfile } from "@zeal/types";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

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

interface Expert {
  id: string;
  category: string;
  rating: number;
  sparkScore: number;
  perMinuteRate: number;
  specialties: string[] | null;
  languages: string[] | null;
  totalConsultations: number | null;
  user: {
    id: string;
    name: string | null;
    username: string;
    avatar: string | null;
    is_online: boolean | null;
  } | null;
}

interface Post {
  id: string;
  content: string;
  mediaUrls?: string[] | null;
  cheerCount?: number | null;
  commentCount?: number | null;
  createdAt: string;
  author: {
    id?: string;
    name: string | null;
    username: string | null;
    avatar: string | null;
  } | null;
}

interface HomeProps {
  aiConsultants: AIConsultant[];
  experts: Expert[];
  posts: Post[];
  stats: {
    traditions: number;
    consultants: number;
    aiConsultants: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const FEATURED_CATEGORIES = [
  { id: "astrology",      label: "Astrology",  Icon: Sparkles },
  { id: "tarot",          label: "Tarot",      Icon: Moon     },
  { id: "numerology",     label: "Numerology", Icon: Hash     },
  { id: "therapy",        label: "Therapy",    Icon: Heart    },
  { id: "energy-healing", label: "Reiki",      Icon: Wind     },
  { id: "meditation",     label: "Meditation", Icon: Sun      },
  { id: "life-coaching",  label: "Coaching",   Icon: Compass  },
  { id: "wellness",       label: "Wellness",   Icon: Leaf     },
  { id: "palmistry",      label: "Palmistry",  Icon: Hand     },
] as const;

const TICKER_EVENTS = [
  "guide came online",
  "session started",
  "AI consultant answered",
  "session completed",
  "new booking confirmed",
  "spark awarded",
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function toProfile(ex: Expert): ConsultantProfile {
  return {
    id: ex.id,
    userId: ex.user?.id ?? "",
    name: ex.user?.name ?? ex.user?.username ?? "Guide",
    username: ex.user?.username ?? "",
    bio: "",
    avatar: ex.user?.avatar ?? "",
    category: ex.category as never,
    isVerified: true,
    isOnline: Boolean(ex.user?.is_online),
    perMinuteRate: ex.perMinuteRate,
    experience: 0,
    rating: ex.rating,
    totalConsultations: ex.totalConsultations ?? 0,
    sparks: ex.sparkScore,
    languages: ex.languages ?? [],
    specialties: ex.specialties ?? [],
    faith: "OTHER" as never,
    isAI: false,
  };
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMITIVE — count-up
// ═══════════════════════════════════════════════════════════════════════════════

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "-40px" });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!inView) return;
    const duration = 1200;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(eased * to));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [inView, to]);

  return (
    <span ref={ref}>
      {n.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMITIVE — scroll progress
// ═══════════════════════════════════════════════════════════════════════════════

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed top-0 left-0 right-0 h-[2px] origin-left
                 bg-gradient-to-r from-[var(--color-luxury-gold)]
                 via-[var(--color-primary)]
                 to-[var(--color-luxury-gold)] z-[100]"
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMITIVE — cursor glow
// ═══════════════════════════════════════════════════════════════════════════════

function CursorGlow() {
  const x = useMotionValue(-2000);
  const y = useMotionValue(-2000);
  const sx = useSpring(x, { stiffness: 120, damping: 22 });
  const sy = useSpring(y, { stiffness: 120, damping: 22 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const onMove = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [x, y]);

  return (
    <motion.div
      aria-hidden
      style={{ x: sx, y: sy }}
      className="pointer-events-none fixed top-0 left-0
                 -translate-x-1/2 -translate-y-1/2
                 w-[420px] h-[420px] rounded-full
                 bg-[var(--color-luxury-gold)]/[0.06]
                 blur-[100px] z-0 hidden lg:block"
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMITIVE — section header
// ═══════════════════════════════════════════════════════════════════════════════

function SectionHeader({
  eyebrow,
  title,
  icon,
  action,
}: {
  eyebrow: string;
  title: string;
  icon?: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
      <div>
        <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-luxury-gold)] font-bold mb-2 flex items-center gap-2">
          {icon}
          {eyebrow}
        </p>
        <h2 className="text-2xl md:text-4xl font-black tracking-tight text-foreground leading-[1.1]">
          {title}
        </h2>
      </div>
      {action && (
        <Link
          href={action.href}
          className="group inline-flex items-center gap-1.5 text-sm font-bold
                     text-muted-foreground hover:text-[var(--color-luxury-gold)]
                     transition-colors whitespace-nowrap"
        >
          {action.label}
          <ArrowRight
            size={14}
            className="transition-transform group-hover:translate-x-1"
          />
        </Link>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION — live ticker
// ═══════════════════════════════════════════════════════════════════════════════

function LiveTicker({ items }: { items: string[] }) {
  const doubled = useMemo(() => [...items, ...items], [items]);
  return (
    <div className="relative overflow-hidden border-y border-border/60 bg-surface/50">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10
                      bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10
                      bg-gradient-to-l from-background to-transparent" />
      <motion.div
        className="flex gap-10 py-3 whitespace-nowrap will-change-transform"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
      >
        {doubled.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {item}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION — AI card
// ═══════════════════════════════════════════════════════════════════════════════

function AICard({
  consultant,
  onChat,
  index,
}: {
  consultant: AIConsultant;
  onChat: (id: string) => void;
  index: number;
}) {
  const initial = consultant.name.charAt(0).toUpperCase();
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.06, 0.3) }}
      whileHover={{ y: -4 }}
      className="group relative overflow-hidden rounded-3xl glass-luxury
                 p-6 transition-all duration-500"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0
                   group-hover:opacity-100 transition-opacity duration-500
                   bg-gradient-to-br from-[var(--color-luxury-gold)]/[0.08]
                   via-transparent to-[var(--color-primary)]/[0.10]"
      />

      <span
        aria-hidden
        className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-emerald-500
                   ring-2 ring-background animate-pulse z-10"
      />

      {consultant.isFeatured && (
        <span className="absolute top-4 left-4 z-10 inline-flex items-center gap-1
                         px-2 py-0.5 rounded-full
                         bg-[var(--color-luxury-gold)]/15
                         border border-[var(--color-luxury-gold)]/30
                         text-[9px] font-black uppercase tracking-widest
                         text-[var(--color-luxury-gold)]">
          Featured
        </span>
      )}

      <div className="relative z-10">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <div
              aria-hidden
              className="absolute inset-0 rounded-full bg-[var(--color-luxury-gold)]/25 blur-md"
            />
            <div className="relative w-16 h-16 rounded-full overflow-hidden
                            ring-2 ring-[var(--color-luxury-gold)]/30">
              {consultant.avatar ? (
                <img
                  src={consultant.avatar}
                  alt={consultant.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] flex items-center justify-center text-white font-black text-xl">
                  {initial}
                </div>
              )}
            </div>
            <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full
                             bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                             text-white text-[8px] font-black flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" /> AI
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-foreground text-base truncate
                           group-hover:text-[var(--color-luxury-gold)] transition-colors">
              {consultant.name}
            </h3>
            <p className="text-xs text-muted-foreground capitalize truncate mt-0.5">
              {consultant.category.toLowerCase().replace(/_/g, " ")}
            </p>
            <div className="flex items-center gap-2.5 mt-2 text-xs">
              <span className="flex items-center gap-1 text-amber-400">
                <Star size={11} className="fill-amber-400" />
                {consultant.rating.toFixed(1)}
              </span>
              <span className="font-mono font-black text-[var(--color-luxury-gold)]">
                {consultant.isPaid ? `₹${consultant.perMinuteRate}/min` : "Free"}
              </span>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-4 line-clamp-2 leading-relaxed min-h-[32px]">
          {consultant.bio}
        </p>

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={() => onChat(consultant.id)}
            className="flex-1 py-2.5 rounded-xl
                       bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                       text-white text-xs font-black
                       hover:opacity-95 active:scale-[0.98] transition-all
                       flex items-center justify-center gap-1.5"
          >
            <Zap size={12} /> Start chat
          </button>
          <Link
            href={`/ai-astrologers/${consultant.id}`}
            className="px-4 py-2.5 rounded-xl bg-surface-raised border border-border
                       text-muted-foreground hover:text-foreground
                       text-xs font-bold transition-colors
                       flex items-center justify-center"
          >
            Profile
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION — spotlight
// ═══════════════════════════════════════════════════════════════════════════════

function Spotlight({
  expert,
  index,
  onChat,
}: {
  expert: Expert;
  index: number;
  onChat: (id: string) => void;
}) {
  const name = expert.user?.name ?? expert.user?.username ?? "Guide";
  const initial = name.charAt(0).toUpperCase();

  return (
    <motion.article
      key={expert.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center
                 rounded-[2.5rem] border border-[var(--color-luxury-glass-border)]
                 bg-gradient-to-br from-[var(--color-surface)]
                 via-[var(--color-surface)] to-[var(--color-surface-sunken)]
                 noise-overlay overflow-hidden relative p-8 md:p-12"
    >
      <div className="absolute -top-40 -right-40 w-[500px] h-[500px]
                      bg-[var(--color-luxury-gold)]/[0.08] blur-[160px]
                      rounded-full pointer-events-none" />

      <div className="lg:col-span-5 relative">
        <motion.div
          initial={{ scale: 0.9, rotate: -4 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative aspect-square max-w-sm mx-auto"
        >
          <div className="absolute inset-0 rounded-[2rem]
                          bg-gradient-to-br from-[var(--color-luxury-gold)]/30
                          via-transparent to-[var(--color-primary)]/20
                          blur-2xl" />
          <div className="relative w-full h-full rounded-[2rem] overflow-hidden
                          bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)]">
            {expert.user?.avatar ? (
              <img
                src={expert.user.avatar}
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center
                              text-white font-black text-8xl">
                {initial}
              </div>
            )}
          </div>
          {expert.user?.is_online && (
            <div className="absolute bottom-4 right-4 flex items-center gap-2
                            px-3 py-1.5 rounded-full
                            bg-black/60 backdrop-blur-md
                            border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                Live
              </span>
            </div>
          )}
        </motion.div>
      </div>

      <div className="lg:col-span-7 space-y-6">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-[var(--color-luxury-gold)]">
          <Star size={10} className="fill-[var(--color-luxury-gold)]" />
          Spotlight · {String(index + 1).padStart(2, "0")}
        </div>

        <h3 className="text-3xl md:text-5xl font-black tracking-tight text-foreground leading-[1.05]">
          {name}
        </h3>

        <p className="text-sm md:text-base text-muted-foreground capitalize">
          {expert.category.toLowerCase().replace(/_/g, " ")} ·{" "}
          {(expert.languages ?? []).slice(0, 2).join(", ") || "English"}
        </p>

        <p className="text-muted-foreground leading-relaxed max-w-xl line-clamp-3">
          {(expert.specialties ?? []).length > 0
            ? `Specialises in ${(expert.specialties ?? []).slice(0, 3).join(", ")}. Every session is held in confidence.`
            : "A verified guide on Zeal. Every session is held in confidence."}
        </p>

        <div className="grid grid-cols-3 gap-4 pt-6 border-t border-border max-w-md">
          <SpotStat
            label="Rating"
            value={expert.rating.toFixed(1)}
            icon={<Star size={11} className="fill-amber-400 text-amber-400" />}
          />
          <SpotStat
            label="Sessions"
            value={(expert.totalConsultations ?? 0).toLocaleString("en-IN")}
            icon={<Users size={11} className="text-[var(--color-luxury-gold)]" />}
          />
          <SpotStat
            label="Sparks"
            value={expert.sparkScore.toLocaleString("en-IN")}
            icon={<Flame size={11} className="text-orange-400" />}
          />
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => onChat(expert.id)}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl
                       bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                       text-white text-sm font-black
                       shadow-xl shadow-[var(--color-primary-hover)]/25
                       hover:opacity-95 active:scale-[0.98] transition-all"
          >
            <MessageCircle size={15} /> Chat with {name.split(" ")[0]}
          </button>
          <Link
            href={`/consultant/${expert.id}`}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl
                       glass-luxury glass-luxury-hover
                       text-foreground text-sm font-black transition-all"
          >
            Full profile <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

function SpotStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-black mb-1 flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className="text-xl md:text-2xl font-black font-mono text-foreground">
        {value}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION — category rail
// ═══════════════════════════════════════════════════════════════════════════════

function CategoryRail() {
  return (
    <div className="relative -mx-4 md:mx-0">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-32 z-10
                      bg-gradient-to-l from-background to-transparent" />
      <div className="flex gap-3 overflow-x-auto pb-3 pl-4 md:pl-0 pr-12
                      custom-scrollbar hide-scrollbar">
        {FEATURED_CATEGORIES.map(({ id, label, Icon }, i) => (
          <motion.div
            key={id}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.03 }}
          >
            <Link
              href={`/services/${id}`}
              className="group flex-shrink-0 w-36 h-36 rounded-3xl
                         glass-luxury glass-luxury-hover
                         flex flex-col items-center justify-center gap-3
                         transition-all"
            >
              <div className="w-12 h-12 rounded-2xl
                              bg-gradient-to-br from-[var(--color-luxury-gold)]/20
                              to-[var(--color-primary)]/10
                              flex items-center justify-center
                              text-[var(--color-luxury-gold)]
                              group-hover:scale-110 transition-transform">
                <Icon size={20} />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-foreground">
                {label}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION — post card
// ═══════════════════════════════════════════════════════════════════════════════

function PostCard({ post }: { post: Post }) {
  const name = post.author?.name || post.author?.username || "Anonymous";
  const initial = name.charAt(0).toUpperCase();
  const hasImage =
    Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5 }}
      className="glass-luxury glass-luxury-hover rounded-2xl p-5"
    >
      <header className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-full overflow-hidden
                        bg-surface-sunken shrink-0
                        ring-1 ring-[var(--color-luxury-gold)]/20">
          {post.author?.avatar ? (
            <img
              src={post.author.avatar}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center
                            text-sm font-black text-foreground">
              {initial}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground truncate">{name}</p>
          <p className="text-[10px] text-muted-foreground font-mono">
            {relTime(post.createdAt)}
          </p>
        </div>
      </header>

      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
        {post.content}
      </p>

      {hasImage && (
        <div className="mt-3 rounded-xl overflow-hidden border border-border max-h-96">
          <img
            src={post.mediaUrls![0]}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <footer className="flex items-center gap-5 mt-4 pt-3 border-t border-border
                         text-xs text-muted-foreground">
        <span className="flex items-center gap-1 hover:text-rose-400 transition-colors cursor-pointer">
          <Heart size={12} /> {post.cheerCount ?? 0}
        </span>
        <span className="flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors cursor-pointer">
          <MessageCircle size={12} /> {post.commentCount ?? 0}
        </span>
      </footer>
    </motion.article>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION — how it works
// ═══════════════════════════════════════════════════════════════════════════════

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Discover",
      body: "Browse 12+ traditions and 24/7 AI consultants. Filter by category, price, or presence.",
      Icon: Compass,
    },
    {
      n: "02",
      title: "Connect",
      body: "Chat, book, or call. Every rupee is escrow-held until the session completes.",
      Icon: MessageCircle,
    },
    {
      n: "03",
      title: "Transform",
      body: "Receive guidance that meets you where you are. Rate and revisit your favourite guides.",
      Icon: Sparkles,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {steps.map(({ n, title, body, Icon }, i) => (
        <motion.div
          key={n}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: i * 0.1 }}
          className="relative rounded-3xl glass-luxury p-7"
        >
          <div className="flex items-start justify-between mb-5">
            <div className="w-12 h-12 rounded-2xl
                            bg-gradient-to-br from-[var(--color-luxury-gold)]/20
                            to-[var(--color-primary)]/10
                            flex items-center justify-center
                            text-[var(--color-luxury-gold)]">
              <Icon size={20} />
            </div>
            <span className="text-4xl font-black font-mono
                             text-[var(--color-luxury-gold)]/25
                             leading-none select-none">
              {n}
            </span>
          </div>
          <h3 className="text-lg font-black text-foreground mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
        </motion.div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export function HomeClient({
  aiConsultants,
  experts: initialExperts,
  posts: initialPosts,
  stats,
}: HomeProps) {
  const router = useRouter();

  const [experts, setExperts] = useState<Expert[]>(initialExperts);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [aiList, setAiList] = useState<AIConsultant[]>(aiConsultants);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateInfo, setGateInfo] = useState<LowBalanceInfo | null>(null);
  const [query, setQuery] = useState("");
  const [spotlightIdx, setSpotlightIdx] = useState(0);

  const showToast = useCallback((msg: string) => {
    pushToast({ title: msg });
  }, []);

  const handleChat = useCallback(
    async (consultantId: string) => {
      await startChatFlow(consultantId, {
        router,
        onLowBalance: (info) => {
          setGateInfo(info);
          setGateOpen(true);
        },
        onOffline: ({ consultantName }) =>
          showToast(`${consultantName} is currently offline.`),
        onError: showToast,
      });
    },
    [router, showToast],
  );

  useChannel<
    BroadcastChange<{
      consultantId?: string;
      is_online?: boolean;
      userId?: string;
    }>
  >({
    channel: channels.consultantsLive(),
    event: "*",
    onMessage: useCallback((p) => {
      const pl = p as unknown as {
        consultantId?: string;
        is_online?: boolean;
        record?: { userId?: string; is_online?: boolean };
      };
      const id = pl.consultantId ?? pl.record?.userId;
      const st = pl.is_online ?? pl.record?.is_online;
      if (typeof id === "string" && typeof st === "boolean") {
        setExperts((prev) =>
          prev.map((e) =>
            e.user?.id === id ? { ...e, user: { ...e.user!, is_online: st } } : e,
          ),
        );
      }
    }, []),
  });

  useChannel<BroadcastChange<AIConsultant>>({
    channel: channels.consultantAiUpdates(),
    event: "*",
    onMessage: useCallback((p) => {
      const { type, record, old_record } = p ?? {};
      if (type === "INSERT" && record) {
        setAiList((prev) =>
          prev.some((x) => x.id === record.id)
            ? prev
            : [record, ...prev].slice(0, 6),
        );
      } else if (type === "UPDATE" && record) {
        setAiList((prev) =>
          prev.map((x) => (x.id === record.id ? record : x)),
        );
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
        setPosts((prev) =>
          prev.some((x) => x.id === record.id)
            ? prev
            : [record, ...prev].slice(0, 50),
        );
      } else if (type === "UPDATE" && record) {
        setPosts((prev) =>
          prev.map((x) => (x.id === record.id ? record : x)),
        );
      } else if (type === "DELETE" && old_record?.id) {
        setPosts((prev) => prev.filter((x) => x.id !== old_record.id));
      }
    }, []),
  });

  const onlineCount = useMemo(
    () => experts.filter((e) => e.user?.is_online).length,
    [experts],
  );

  const topExperts = useMemo(
    () =>
      [...experts]
        .sort((a, b) => (b.sparkScore ?? 0) - (a.sparkScore ?? 0))
        .slice(0, 3),
    [experts],
  );

  useEffect(() => {
    if (topExperts.length < 2) return;
    const t = setInterval(
      () => setSpotlightIdx((i) => (i + 1) % topExperts.length),
      8000,
    );
    return () => clearInterval(t);
  }, [topExperts.length]);

  const spotlight = topExperts[spotlightIdx] ?? topExperts[0];

  const tickerItems = useMemo(() => {
    const base = [
      `${onlineCount} guides online now`,
      `${stats.consultants.toLocaleString("en-IN")} verified experts`,
      `${stats.aiConsultants} AI consultants · 24/7`,
      `${stats.traditions} traditions`,
      `Every payment escrow-protected`,
    ];
    const events = TICKER_EVENTS.slice(0, 3).map(
      (e) => `${e} · just now`,
    );
    return [...base, ...events];
  }, [onlineCount, stats]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/explore?q=${encodeURIComponent(q)}` : "/explore");
  };

  return (
    <div className="relative">
      <ScrollProgress />
      <CursorGlow />

      {/* HERO */}
      <section
        aria-labelledby="hero-heading"
        className="relative overflow-hidden noise-overlay
                   border-b border-[var(--color-luxury-glass-border)]"
      >
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px]
                        rounded-full bg-[var(--color-luxury-gold)]/[0.08]
                        blur-[180px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px]
                        rounded-full bg-[var(--color-primary)]/[0.12]
                        blur-[180px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 lg:px-16
                        py-16 md:py-24 lg:py-32">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="max-w-4xl"
          >
            <motion.div
              variants={fadeUp}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full
                         bg-[var(--color-luxury-gold)]/[0.08]
                         border border-[var(--color-luxury-gold)]/[0.20]
                         text-[var(--color-luxury-gold)]
                         text-[10px] font-black uppercase tracking-[0.25em]"
            >
              <Sparkles size={12} />
              Multi-faith · Realtime · 24/7
            </motion.div>

            <motion.h1
              id="hero-heading"
              variants={fadeUp}
              className="mt-6 text-5xl sm:text-6xl md:text-7xl lg:text-8xl
                         font-black tracking-[-0.03em] leading-[0.95]
                         text-foreground"
            >
              Every tradition.
              <br />
              <span className="text-luxury-gradient">
                One sanctuary.
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-8 text-base md:text-lg text-muted-foreground
                         max-w-2xl leading-relaxed"
            >
              Vedic astrology, Islamic counseling, Buddhist meditation,
              Christian therapy, Tarot, energy healing, and modern wellness —
              on one calm, escrow-protected platform.
            </motion.p>

            <motion.form
              variants={fadeUp}
              onSubmit={handleSearch}
              className="mt-10 max-w-2xl"
            >
              <div className="relative group">
                <Search
                  size={18}
                  className="absolute left-5 top-1/2 -translate-y-1/2
                             text-muted-foreground
                             group-focus-within:text-[var(--color-luxury-gold)]
                             transition-colors"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setQuery(e.target.value)
                  }
                  placeholder="Ask Zeal — describe what you're looking for…"
                  className="w-full pl-14 pr-36 py-5 rounded-2xl
                             glass-luxury
                             text-base text-foreground
                             placeholder:text-muted-foreground
                             focus:outline-none
                             focus:border-[var(--color-luxury-gold)]/50
                             transition-colors"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2
                             px-5 py-3 rounded-xl
                             bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                             text-white text-xs font-black
                             hover:opacity-95 active:scale-95 transition-all
                             flex items-center gap-1.5"
                >
                  Find a guide <ArrowRight size={12} />
                </button>
              </div>
            </motion.form>

            <motion.div
              variants={fadeUp}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl
                           bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                           text-white font-black text-sm
                           shadow-xl shadow-[var(--color-primary-hover)]/25
                           hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                Browse guides <ArrowRight size={15} />
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl
                           glass-luxury glass-luxury-hover
                           text-foreground font-bold text-sm"
              >
                <Sparkles size={15} /> Ask Zeal AI
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-16 md:mt-24 grid grid-cols-2 md:grid-cols-4 gap-px
                       rounded-2xl overflow-hidden
                       border border-[var(--color-luxury-glass-border)]
                       bg-[var(--color-luxury-glass-border)]"
          >
            {[
              {
                label: "Verified guides",
                value: stats.consultants,
                suffix: "",
                Icon: Users,
              },
              {
                label: "AI consultants",
                value: stats.aiConsultants,
                suffix: "",
                Icon: Sparkles,
              },
              {
                label: "Traditions",
                value: stats.traditions,
                suffix: "",
                Icon: Compass,
              },
              {
                label: "Online now",
                value: onlineCount,
                suffix: "",
                Icon: Radio,
              },
            ].map(({ label, value, suffix, Icon }) => (
              <div
                key={label}
                className="bg-surface/60 backdrop-blur-xl px-5 py-6 md:py-8"
              >
                <div className="flex items-center gap-2 mb-2 text-[var(--color-luxury-gold)]">
                  <Icon size={13} />
                  <span className="text-[9px] font-black uppercase tracking-[0.22em]">
                    {label}
                  </span>
                </div>
                <div className="text-3xl md:text-4xl font-black font-mono
                                text-foreground tabular-nums">
                  <Counter to={value} suffix={suffix} />
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <LiveTicker items={tickerItems} />

      {/* AI CONSULTANTS */}
      <section
        aria-labelledby="ai-heading"
        className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 py-20 cv-auto"
      >
        <SectionHeader
          eyebrow="Instant answers · Always on"
          title="AI Consultants"
          icon={<Sparkles size={12} />}
          action={{ href: "/ai-astrologers", label: "View all" }}
        />
        {aiList.length === 0 ? (
          <EmptyState title="No AI consultants yet" description="Check back soon." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {aiList.slice(0, 6).map((ai, i) => (
              <AICard key={ai.id} consultant={ai} onChat={handleChat} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* SPOTLIGHT */}
      {spotlight && (
        <section
          aria-labelledby="spotlight-heading"
          className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 pb-20 cv-auto"
        >
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-[0.25em]
                          text-[var(--color-luxury-gold)] font-bold mb-2
                          flex items-center gap-2">
              <TrendingUp size={12} />
              Top of the week
            </p>
            <h2
              id="spotlight-heading"
              className="text-2xl md:text-4xl font-black tracking-tight text-foreground"
            >
              Meet this week&apos;s spotlight guide
            </h2>
          </div>

          <AnimatePresence mode="wait">
            <Spotlight
              key={spotlight.id}
              expert={spotlight}
              index={spotlightIdx}
              onChat={handleChat}
            />
          </AnimatePresence>

          {topExperts.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              {topExperts.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSpotlightIdx(i)}
                  aria-label={`Show spotlight ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === spotlightIdx
                      ? "w-8 bg-[var(--color-luxury-gold)]"
                      : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground"
                  }`}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* CATEGORY RAIL */}
      <section
        aria-labelledby="categories-heading"
        className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 pb-20 cv-auto"
      >
        <SectionHeader
          eyebrow="Explore by tradition"
          title="Every path, one platform"
          action={{ href: "/services", label: "All categories" }}
        />
        <CategoryRail />
      </section>

      {/* EXPERTS */}
      <section
        aria-labelledby="experts-heading"
        className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 pb-20 cv-auto"
      >
        <SectionHeader
          eyebrow="Real humans · Verified · Realtime presence"
          title="Verified Experts"
          icon={<Radio size={12} className="text-emerald-400" />}
          action={{ href: "/explore", label: "Directory" }}
        />
        {experts.length === 0 ? (
          <EmptyState
            title="No experts yet"
            description="Please try again shortly."
          />
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
          >
            {experts.slice(0, 8).map((ex) => (
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

      {/* HOW IT WORKS */}
      <section
        aria-labelledby="how-heading"
        className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 pb-20 cv-auto"
      >
        <SectionHeader
          eyebrow="Three steps"
          title="How Zeal works"
        />
        <HowItWorks />
      </section>

      {/* FEED */}
      <section
        aria-labelledby="feed-heading"
        className="max-w-4xl mx-auto px-6 md:px-10 lg:px-16 pb-20 cv-auto"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em]
                          text-[var(--color-luxury-gold)] font-bold mb-2
                          flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full
                                 rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2
                                 bg-emerald-500" />
              </span>
              Live · Realtime
            </p>
            <h2
              id="feed-heading"
              className="text-2xl md:text-4xl font-black tracking-tight text-foreground"
            >
              Cosmos Feed
            </h2>
          </div>
          <Link
            href="/create"
            className="text-xs font-black uppercase tracking-widest
                       text-[var(--color-luxury-gold)] hover:underline"
          >
            + Post
          </Link>
        </div>

        {posts.length === 0 ? (
          <EmptyState
            title="No posts yet"
            description="Be the first to share."
          />
        ) : (
          <div className="space-y-4">
            {posts.slice(0, 12).map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}
      </section>

      {/* FINAL CTA */}
      <section
        aria-labelledby="cta-heading"
        className="relative overflow-hidden mx-6 md:mx-10 lg:mx-auto
                   max-w-7xl mb-24 rounded-[2.5rem]
                   noise-overlay border border-[var(--color-luxury-glass-border)]"
      >
        <div className="absolute inset-0 bg-gradient-to-br
                        from-[var(--color-background)]
                        via-[var(--color-surface)]
                        to-[var(--color-background)]" />
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px]
                        rounded-full bg-[var(--color-luxury-gold)]/[0.10]
                        blur-[160px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px]
                        rounded-full bg-[var(--color-primary)]/[0.15]
                        blur-[160px] pointer-events-none" />

        <div className="relative z-10 py-20 md:py-28 px-8 md:px-16 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em]
                        text-[var(--color-luxury-gold)] font-black mb-6">
            Your journey begins
          </p>
          <h2
            id="cta-heading"
            className="text-4xl md:text-6xl lg:text-7xl font-black
                       tracking-[-0.03em] leading-[1] text-foreground
                       max-w-3xl mx-auto"
          >
            Find your{" "}
            <span className="text-luxury-gradient">guide today.</span>
          </h2>
          <p className="mt-8 text-base md:text-lg text-muted-foreground
                        max-w-xl mx-auto leading-relaxed">
            Twelve traditions. Hundreds of guides. Every session,
            escrow-protected.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl
                         bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                         text-white font-black text-sm
                         shadow-xl shadow-[var(--color-primary-hover)]/25
                         hover:scale-[1.03] active:scale-[0.98] transition-transform"
            >
              Explore guides <ArrowRight size={15} />
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl
                         glass-luxury glass-luxury-hover
                         text-foreground font-bold text-sm"
            >
              <Sparkles size={15} /> Ask Zeal AI
            </Link>
          </div>
        </div>
      </section>

      <WalletGateDialog
        open={gateOpen}
        onOpenChange={setGateOpen}
        info={gateInfo}
      />
    </div>
  );
}
