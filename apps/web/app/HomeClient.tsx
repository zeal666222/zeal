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
import Image from "next/image";
import { getImageUrl } from "@/lib/storage/r2";
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
  ShieldCheck,
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
import { ScrollReveal } from "@zeal/ui/motion";

import { LuxuryConsultantCard } from "@/components/shared/LuxuryConsultantCard";
import { FreeServicesGrid } from "@/components/shared/FreeServicesGrid";
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
      className="fixed top-0 left-0 right-0 h-[2px] origin-left bg-gradient-to-r from-[var(--color-luxury-gold)] via-[var(--color-primary)] to-[var(--color-luxury-gold)] z-[100]"
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
      className="pointer-events-none fixed top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-[var(--color-luxury-gold)]/[0.06] blur-[100px] z-0 hidden lg:block"
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
          className="group inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-[var(--color-luxury-gold)] transition-colors whitespace-nowrap"
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
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10 bg-gradient-to-l from-background to-transparent" />
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
      className="group relative overflow-hidden rounded-3xl glass-luxury p-6 transition-all duration-500"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-[var(--color-luxury-gold)]/[0.08] via-transparent to-[var(--color-primary)]/[0.10]"
      />

      <span
        aria-hidden
        className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse z-10"
      />

      {consultant.isFeatured && (
        <span className="absolute top-4 left-4 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-luxury-gold)]/15 border border-[var(--color-luxury-gold)]/30 text-[9px] font-black uppercase tracking-widest text-[var(--color-luxury-gold)]">
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
            <div className="relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-[var(--color-luxury-gold)]/30">
              {consultant.avatar ? (
                <Image
                  src={getImageUrl(consultant.avatar, "avatar-sm")}
                  alt={consultant.name}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] flex items-center justify-center text-white font-black text-xl">
                  {initial}
                </div>
              )}
            </div>
            <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white text-[8px] font-black flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" /> AI
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-foreground text-base truncate group-hover:text-[var(--color-luxury-gold)] transition-colors">
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
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white text-xs font-black hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
          >
            <Zap size={12} /> Start Chat
          </button>
          <Link
            href={`/ai-astrologers/${consultant.id}`}
            className="px-4 py-2.5 rounded-xl bg-surface-raised border border-border text-muted-foreground hover:text-foreground text-xs font-bold transition-colors flex items-center justify-center"
          >
            View Profile
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
      className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center rounded-[2.5rem] border border-[var(--color-luxury-glass-border)] bg-gradient-to-br from-[var(--color-surface)] via-[var(--color-surface)] to-[var(--color-surface-sunken)] noise-overlay overflow-hidden relative p-8 md:p-12"
    >
      <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-[var(--color-luxury-gold)]/[0.08] blur-[160px] rounded-full pointer-events-none" />

      <div className="lg:col-span-5 relative">
        <motion.div
          initial={{ scale: 0.9, rotate: -4 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative aspect-square max-w-sm mx-auto"
        >
          <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-[var(--color-luxury-gold)]/30 via-transparent to-[var(--color-primary)]/20 blur-2xl" />
          <div className="relative w-full h-full rounded-[2rem] overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)]">
            {expert.user?.avatar ? (
              <Image
                src={getImageUrl(expert.user.avatar, "avatar-md")}
                alt={name}
                width={384}
                height={384}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white font-black text-8xl">
                {initial}
              </div>
            )}
          </div>
          {expert.user?.is_online && (
            <div className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-emerald-500/30">
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
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white text-sm font-black shadow-xl shadow-[var(--color-primary-hover)]/25 hover:opacity-95 active:scale-[0.98] transition-all"
          >
            <MessageCircle size={15} /> Chat with {name.split(" ")[0]}
          </button>
          <Link
            href={`/consultant/${expert.id}`}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl glass-luxury glass-luxury-hover text-foreground text-sm font-black transition-all"
          >
            View Full Profile <ArrowUpRight size={14} />
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
      <div className="pointer-events-none absolute inset-y-0 right-0 w-32 z-10 bg-gradient-to-l from-background to-transparent" />
      <div className="flex gap-3 overflow-x-auto pb-3 pl-4 md:pl-0 pr-12 custom-scrollbar hide-scrollbar">
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
              className="group flex-shrink-0 w-36 h-36 rounded-3xl glass-luxury glass-luxury-hover flex flex-col items-center justify-center gap-3 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--color-luxury-gold)]/20 to-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-luxury-gold)] group-hover:scale-110 transition-transform">
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
        <div className="w-11 h-11 rounded-full overflow-hidden bg-surface-sunken shrink-0 ring-1 ring-[var(--color-luxury-gold)]/20">
          {post.author?.avatar ? (
            <Image
              src={getImageUrl(post.author.avatar, "avatar-sm")}
              alt=""
              width={44}
              height={44}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm font-black text-foreground">
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
          <Image
            src={getImageUrl(post.mediaUrls![0], "grid")}
            alt={post.content?.slice(0, 80) || "Post image"}
            width={600}
            height={400}
            sizes="(max-width: 768px) 100vw, 600px"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <footer className="flex items-center gap-5 mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
        <Link
          href={`/post/${post.id}`}
          className="flex items-center gap-1 hover:text-rose-400 transition-colors"
          aria-label={`${post.cheerCount ?? 0} cheers — open post`}
        >
          <Heart size={12} /> {post.cheerCount ?? 0}
        </Link>
        <Link
          href={`/post/${post.id}`}
          className="flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors"
          aria-label={`${post.commentCount ?? 0} comments — open post`}
        >
          <MessageCircle size={12} /> {post.commentCount ?? 0}
        </Link>
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
      title: "Get Your Free Reading",
      body: "Instant AI-powered tarot, horoscope, kundali & numerology readings — no signup required. Available 24/7.",
      Icon: Compass,
    },
    {
      n: "02",
      title: "Connect with Experts",
      body: "Chat or call verified astrologers, therapists & healers. Every payment is escrow-protected until your session completes.",
      Icon: MessageCircle,
    },
    {
      n: "03",
      title: "Guidance That Works",
      body: "Receive accurate, personalized guidance based on your birth chart, tarot spread & spiritual tradition. Rate and revisit your favourite consultants.",
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
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--color-luxury-gold)]/20 to-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-luxury-gold)]">
              <Icon size={20} />
            </div>
            <span className="text-4xl font-black font-mono text-[var(--color-luxury-gold)]/25 leading-none select-none">
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
// SECTION — testimonials carousel
// ═══════════════════════════════════════════════════════════════════════════════

const TESTIMONIALS = [
  {
    name: "Priya S.",
    role: "Vedic Astrology Client",
    text: "The accuracy of my reading was uncanny. The AI consultant picked up nuances in my chart that I'd spent years trying to understand. Absolutely transformative experience.",
    rating: 5,
    initial: "P",
  },
  {
    name: "Arjun M.",
    role: "Tarot & Meditation",
    text: "I was skeptical about AI astrology, but Zeal proved me wrong. The reading was deeply insightful and the escrow billing gave me total confidence in the platform.",
    rating: 5,
    initial: "A",
  },
  {
    name: "Sarah K.",
    role: "Life Coaching Client",
    text: "Found my life coach through Zeal and it changed everything. The consultation was professional, the billing transparent, and the follow-up reading was spot-on.",
    rating: 5,
    initial: "S",
  },
  {
    name: "Ravi T.",
    role: "Numerology Seeker",
    text: "The multi-faith approach is what drew me in. I got perspectives from Vedic, Western, and Chinese traditions — all in one session. Mind-blowing platform.",
    rating: 5,
    initial: "R",
  },
];

function TestimonialsCarousel() {
  const [activeIdx, setActiveIdx] = useState(0);
  const safeIdx = Math.min(activeIdx, TESTIMONIALS.length - 1);
  const current = TESTIMONIALS[safeIdx] ?? TESTIMONIALS[0]!;

  useEffect(() => {
    const t = setInterval(() => {
      setActiveIdx((i) => (i + 1) % TESTIMONIALS.length);
    }, 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative">
      <div className="overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIdx}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl glass-luxury p-8 md:p-12 max-w-3xl mx-auto text-center"
          >
            <div className="flex items-center justify-center gap-1 mb-6">
              {Array.from({ length: current.rating }).map((_, i) => (
                <Star key={i} size={16} className="fill-amber-400 text-amber-400" />
              ))}
            </div>
            <blockquote className="text-lg md:text-xl text-foreground leading-relaxed font-medium italic mb-8">
              &ldquo;{current.text}&rdquo;
            </blockquote>
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] flex items-center justify-center text-white font-black text-sm">
                {current.initial}
              </div>
              <div className="text-left">
                <p className="text-sm font-black text-foreground">{current.name}</p>
                <p className="text-xs text-muted-foreground">{current.role}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-2 mt-6">
        {TESTIMONIALS.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveIdx(i)}
            aria-label={`View testimonial ${i + 1}`}
            aria-pressed={i === activeIdx}
            className={`h-1.5 rounded-full transition-all ${
              i === activeIdx
                ? "w-8 bg-[var(--color-luxury-gold)]"
                : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION — trust badges
// ═══════════════════════════════════════════════════════════════════════════════

function TrustBadges() {
  const badges = [
    { icon: Star, label: "4.9/5 rating", sub: "10,000+ reviews" },
    { icon: Users, label: "50,000+ users", sub: "Growing daily" },
    { icon: ShieldCheck, label: "Escrow-protected", sub: "100% secure" },
    { icon: Radio, label: "24/7 available", sub: "AI + human guides" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {badges.map(({ icon: Icon, label, sub }, i) => (
        <ScrollReveal key={label} delay={i * 0.08}>
          <div className="flex items-center gap-3 p-4 rounded-2xl glass-luxury">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-luxury-gold)]/10 flex items-center justify-center text-[var(--color-luxury-gold)] shrink-0">
              <Icon size={18} />
            </div>
            <div>
              <p className="text-sm font-black text-foreground">{label}</p>
              <p className="text-[10px] text-muted-foreground">{sub}</p>
            </div>
          </div>
        </ScrollReveal>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION — premium footer
// ═══════════════════════════════════════════════════════════════════════════════

function PremiumFooter() {
  const columns = [
    {
      title: "Platform",
      links: [
        { label: "Explore Guides", href: "/explore" },
        { label: "AI Consultants", href: "/ai-astrologers" },
        { label: "Services", href: "/services" },
        { label: "Pricing", href: "/services" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", href: "/about" },
        { label: "Blog", href: "/blog" },
        { label: "Careers", href: "/careers" },
        { label: "Contact", href: "/contact" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
        { label: "Refund Policy", href: "/refund" },
        { label: "Cookie Policy", href: "/cookies" },
      ],
    },
  ];

  return (
    <footer className="border-t border-[var(--color-luxury-glass-border)] bg-surface/50">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand column */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] flex items-center justify-center">
                <Sparkles size={14} className="text-white" />
              </div>
              <span className="text-lg font-black text-foreground">Zeal</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-4">
              Free astrology, tarot & spiritual consultations. Verified astrologers, AI readers & therapists — all in one place.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                All systems operational
              </span>
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-luxury-gold)] font-black mb-4">
                {col.title}
              </p>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Zeal. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-emerald-400" />
              SOC 2 Compliant
            </span>
            <span className="flex items-center gap-1.5">
              <Heart size={12} className="text-rose-400" />
              Made with care
            </span>
          </div>
        </div>
      </div>
    </footer>
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
  // Once the user hand-picks a spotlight, stop auto-rotation (preserve their choice).
  const [spotlightPaused, setSpotlightPaused] = useState(false);

  const showToast = useCallback((msg: string) => {
    pushToast({ title: msg });
  }, []);

  // In-flight guard: rapid double-clicks on a Chat CTA must not start two sessions.
  const chatBusyRef = useRef(false);
  const handleChat = useCallback(
    async (consultantId: string) => {
      if (chatBusyRef.current) return;
      chatBusyRef.current = true;
      try {
        await startChatFlow(consultantId, {
          router,
          onLowBalance: (info) => {
            setGateInfo(info);
            setGateOpen(true);
          },
          onOffline: ({ consultantName }) =>
            showToast(`${consultantName} is offline right now.`),
          onError: showToast,
        });
      } finally {
        chatBusyRef.current = false;
      }
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
        // Partial records (e.g. cheer/comment count pings) must merge, not replace.
        setPosts((prev) =>
          prev.map((x) => (x.id === record.id ? { ...x, ...record } : x)),
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
    if (topExperts.length < 2 || spotlightPaused) return;
    const t = setInterval(
      () => setSpotlightIdx((i) => (i + 1) % topExperts.length),
      8000,
    );
    return () => clearInterval(t);
  }, [topExperts.length, spotlightPaused]);

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
        className="relative overflow-hidden noise-overlay border-b border-[var(--color-luxury-glass-border)]"
      >
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[var(--color-luxury-gold)]/[0.08] blur-[180px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-[var(--color-primary)]/[0.12] blur-[180px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 lg:px-16 py-16 md:py-24 lg:py-32">
          <div className="max-w-4xl">
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--color-luxury-gold)]/[0.08] border border-[var(--color-luxury-gold)]/[0.20] text-[var(--color-luxury-gold)] text-[10px] font-black uppercase tracking-[0.25em] animate-fade-in-up"
            >
              <Sparkles size={12} />
              Multi-faith · Realtime · 24/7
            </div>

            <h1
              id="hero-heading"
              className="mt-6 text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-[-0.03em] leading-[0.95] text-foreground animate-fade-in-up-d1"
            >
              Free Astrology,
              <br />
              <span className="text-luxury-gradient">
                Tarot & Spiritual
              </span>
              <br />
              Consultations.
            </h1>

            <div className="mt-6 h-8 overflow-hidden animate-fade-in-up-d2">
              <div className="animate-[spin-text_12s_ease-in-out_infinite]">
                <p className="h-8 flex items-center text-base md:text-lg text-muted-foreground font-medium">
                  Kundali · Numerology · Palmistry · Dream Analysis
                </p>
                <p className="h-8 flex items-center text-base md:text-lg text-muted-foreground font-medium">
                  Therapy · Reiki · Meditation · Life Coaching
                </p>
                <p className="h-8 flex items-center text-base md:text-lg text-muted-foreground font-medium">
                  Vastu · Yoga · Sound Healing · Relationship Advice
                </p>
                <p className="h-8 flex items-center text-base md:text-lg text-muted-foreground font-medium">
                  Kundali · Numerology · Palmistry · Dream Analysis
                </p>
              </div>
            </div>

            <p
              className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed animate-fade-in-up-d3"
            >
              37+ spiritual services in one platform — from Vedic astrology and
              tarot readings to therapy, healing, and wellness consultations.
              Free AI-powered readings available instantly, or connect with
              verified experts for personal guidance.
            </p>

            <form
              onSubmit={handleSearch}
              className="mt-10 max-w-2xl animate-fade-in-up-d3"
            >
              <div className="relative group">
                <Search
                  size={18}
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-[var(--color-luxury-gold)] transition-colors"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setQuery(e.target.value)
                  }
                  aria-label="Search for guides"
                  placeholder="Search tarot, kundali, horoscope, numerology…"
                  className="w-full pl-14 pr-36 py-5 rounded-2xl glass-luxury text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--color-luxury-gold)]/50 transition-colors"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white text-xs font-black hover:opacity-95 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  Find a Guide <ArrowRight size={12} />
                </button>
              </div>
            </form>

            <div
              className="mt-8 flex flex-wrap items-center gap-3 animate-fade-in-up-d4"
            >
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white font-black text-sm shadow-xl shadow-[var(--color-primary-hover)]/25 hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                Browse Guides <ArrowRight size={15} />
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl glass-luxury glass-luxury-hover text-foreground font-bold text-sm"
              >
                <Sparkles size={15} /> Ask Zeal AI
              </Link>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-16 md:mt-24 grid grid-cols-2 md:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-[var(--color-luxury-glass-border)] bg-[var(--color-luxury-glass-border)]"
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
                <div className="text-3xl md:text-4xl font-black font-mono text-foreground tabular-nums">
                  <Counter to={value} suffix={suffix} />
                </div>
              </div>
            ))}
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-8"
          >
            <TrustBadges />
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
          action={{ href: "/ai-astrologers", label: "View All AI Guides" }}
        />
        {aiList.length === 0 ? (
          <EmptyState
            title="No AI consultants available right now"
            description="Check back in a moment — we're launching soon."
          />
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
            <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-luxury-gold)] font-bold mb-2 flex items-center gap-2">
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
                  type="button"
                  onClick={() => { setSpotlightIdx(i); setSpotlightPaused(true); }}
                  aria-label={`View spotlight guide ${i + 1}`}
                  aria-pressed={i === spotlightIdx}
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

      {/* FREE AI SERVICES */}
      <section
        aria-labelledby="free-services-heading"
        className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 pb-20 cv-auto"
      >
        <FreeServicesGrid />
      </section>

      {/* CATEGORY RAIL */}
      <section
        aria-labelledby="categories-heading"
        className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 pb-20 cv-auto"
      >
        <SectionHeader
          eyebrow="Explore by tradition"
          title="Every path, one platform"
          action={{ href: "/services", label: "All Categories" }}
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
          action={{ href: "/explore", label: "Full Directory" }}
        />
        {experts.length === 0 ? (
          <EmptyState
            title="No guides found yet"
            description="Please try again in a little while."
          />
        ) : (
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
          >
            {experts.slice(0, 8).map((ex, i) => (
              <motion.div
                key={ex.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 24,
                  delay: i * 0.04,
                }}
              >
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

      {/* TESTIMONIALS */}
      <section
        aria-labelledby="testimonials-heading"
        className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 pb-20 cv-auto"
      >
        <SectionHeader
          eyebrow="Loved by seekers"
          title="What our community says"
        />
        <TestimonialsCarousel />
      </section>

      {/* FEED */}
      <section
        aria-labelledby="feed-heading"
        className="max-w-4xl mx-auto px-6 md:px-10 lg:px-16 pb-20 cv-auto"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-luxury-gold)] font-bold mb-2 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
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
            className="text-xs font-black uppercase tracking-widest text-[var(--color-luxury-gold)] hover:underline"
          >
            + Post
          </Link>
        </div>

        {posts.length === 0 ? (
          <EmptyState
            title="No posts yet"
            description="Share the first post — the cosmos is waiting for you."
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
        className="relative overflow-hidden mx-6 md:mx-10 lg:mx-auto max-w-7xl mb-24 rounded-[2.5rem] noise-overlay border border-[var(--color-luxury-glass-border)]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-background)] via-[var(--color-surface)] to-[var(--color-background)]" />
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-[var(--color-luxury-gold)]/[0.10] blur-[160px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-[var(--color-primary)]/[0.15] blur-[160px] pointer-events-none" />

        <div className="relative z-10 py-20 md:py-28 px-8 md:px-16 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-luxury-gold)] font-black mb-6">
            Your journey begins
          </p>
          <h2
            id="cta-heading"
            className="text-4xl md:text-6xl lg:text-7xl font-black tracking-[-0.03em] leading-[1] text-foreground max-w-3xl mx-auto"
          >
            Your free{" "}
            <span className="text-luxury-gradient">astrology reading</span>
            {" "}awaits.
          </h2>
          <p className="mt-8 text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Free tarot, horoscope, kundali & numerology — or connect with verified
            astrologers, therapists & healers for personal guidance.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white font-black text-sm shadow-xl shadow-[var(--color-primary-hover)]/25 hover:scale-[1.03] active:scale-[0.98] transition-transform"
            >
              Find Astrologers & Healers <ArrowRight size={15} />
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl glass-luxury glass-luxury-hover text-foreground font-bold text-sm"
            >
              <Sparkles size={15} /> Try Free Services
            </Link>
          </div>
        </div>
      </section>

      <PremiumFooter />

      <WalletGateDialog
        open={gateOpen}
        onOpenChange={setGateOpen}
        info={gateInfo}
      />
    </div>
  );
}
