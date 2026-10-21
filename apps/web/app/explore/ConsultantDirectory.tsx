"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// ConsultantDirectory — search + bubble filter rail + realtime grid
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpDown, Flame, Grid3x3, List, Loader2, MessageCircle, Search, SlidersHorizontal, Sparkles, Star, X } from "lucide-react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";
import { staggerContainer, fadeUp } from "@zeal/ui/motion";
import { LuxuryConsultantCard } from "@/components/shared/LuxuryConsultantCard";
import { startChatFlow } from "@/lib/chat/start-chat-flow";
import { WalletGateDialog } from "@/components/billing/WalletGateDialog";
import type { ConsultantProfile } from "@zeal/types";
import { cn } from "@zeal/ui";
import { getImageUrl } from "@/lib/storage/r2";
import Link from "next/link";

interface MvRow {
  id: string; userId: string; name: string | null; username: string | null;
  avatar_url: string | null; is_online: boolean; category: string | null;
  perMinuteRate: number | null; rating: number | null; sparkScore: number | null;
  specialties: string[] | null; languages: string[] | null; bio: string | null;
  totalConsultations: number | null; service_slugs: string[] | null;
  isAI: boolean | null; isVerified: boolean | null;
}
interface Category { id: string; display_name: string; }
interface Props {
  initialConsultants: MvRow[];
  /** Server-computed total across all pages (not just the loaded slice). */
  initialTotal?: number;
  /** Seed from the `?q` search param so Home → Explore keeps the query. */
  initialQuery?: string;
  /** Surface a server-side load failure as a retryable error, not a dead end. */
  initialError?: string | null;
}

const PAGE_SIZE = 24;

function toProfile(m: MvRow): ConsultantProfile {
  return {
    id: m.id, userId: m.userId,
    name: m.name ?? m.username ?? "Guide",
    username: m.username ?? "", bio: m.bio ?? "",
    avatar: m.avatar_url ?? "", category: (m.category ?? "HEALER") as never,
    isVerified: Boolean(m.isVerified), isOnline: Boolean(m.is_online),
    perMinuteRate: m.perMinuteRate ?? 0, experience: 0,
    rating: m.rating ?? 4.5, totalConsultations: m.totalConsultations ?? 0,
    sparks: m.sparkScore ?? 0, languages: m.languages ?? [],
    specialties: m.specialties ?? [], faith: "OTHER" as never, isAI: Boolean(m.isAI),
  };
}

export function ConsultantDirectory({
  initialConsultants, initialTotal, initialQuery, initialError,
}: Props) {
  const router = useRouter();
  const [consultants, setConsultants] = useState<MvRow[]>(initialConsultants);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState(initialQuery ?? "");
  const [category, setCategory] = useState<string>("all");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState<number>(initialTotal ?? initialConsultants.length);
  const [reloadKey, setReloadKey] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(initialError ?? null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateInfo, setGateInfo] = useState<{ balance: number; required: number; consultantName: string; consultantId: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sort, setSort] = useState<"relevance" | "rating" | "price-asc" | "price-desc" | "consultations" | "sparks">("relevance");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Skip the first client fetch only when the SSR data is usable as-is (no
  // seeded query, no server error). Otherwise run the mount fetch so results
  // actually match `?q` and a failed SSR load can be retried.
  const firstRef = useRef(!(initialQuery ?? "") && !initialError);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const chatBusyRef = useRef(false);
  const handleChat = useCallback(async (consultantId: string, consultantName?: string) => {
    if (chatBusyRef.current) return; // prevent double-tap starting two sessions
    chatBusyRef.current = true;
    try {
      const name = consultantName ?? consultants.find((c) => c.id === consultantId)?.name ?? "Consultant";
      await startChatFlow(consultantId, {
        router,
        onLowBalance: (info) => { setGateInfo(info); setGateOpen(true); },
        onOffline: () => showToast(`${name} is offline right now.`),
        onError: showToast,
      });
    } finally {
      chatBusyRef.current = false;
    }
  }, [router, consultants, showToast]);

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

  const fetchPage = useCallback(async (offset: number, append: boolean) => {
    const p = new URLSearchParams();
    if (query.trim()) p.set("q", query.trim());
    if (category !== "all") p.set("category", category);
    if (onlineOnly) p.set("online", "true");
    p.set("limit", String(PAGE_SIZE));
    p.set("offset", String(offset));

    const res = await fetch(`/api/explore/consultants?${p}`, { cache: "no-store" });
    const body = (await res.json().catch(() => ({}))) as {
      consultants?: MvRow[]; total?: number; error?: string;
    };
    if (!res.ok || body.error) {
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    const rows = body.consultants ?? [];
    setTotal(body.total ?? rows.length);
    setConsultants((prev) => (append ? [...prev, ...rows] : rows));
  }, [query, category, onlineOnly]);

  useEffect(() => {
    if (firstRef.current) { firstRef.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const run = async () => {
      setLoading(true); setFetchError(null);
      try {
        await fetchPage(0, false);
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : "Failed to load");
      } finally { setLoading(false); }
    };
    debounceRef.current = setTimeout(run, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, category, onlineOnly, reloadKey, fetchPage]);

  const loadMoreRef = useRef(false);
  const loadMore = useCallback(async () => {
    if (loadMoreRef.current) return;
    loadMoreRef.current = true;
    setLoadingMore(true); setMoreError(null);
    try {
      await fetchPage(consultants.length, true);
    } catch (e) {
      // Keep the loaded grid; surface the failure inline with a retry path.
      setMoreError(e instanceof Error ? e.message : "Something went wrong while loading more");
    } finally { setLoadingMore(false); loadMoreRef.current = false; }
  }, [fetchPage, consultants.length]);

  useChannel<BroadcastChange<{ consultantId?: string; is_online?: boolean; userId?: string }>>({
    channel: channels.consultantsLive(),
    event: "*",
    onMessage: useCallback((p) => {
      const pl = p as unknown as {
        consultantId?: string; is_online?: boolean;
        record?: { consultantId?: string; userId?: string; is_online?: boolean };
      };
      // DB trigger publishes wrap the body in `record`; route handlers publish
      // it flat. Both shapes have to land on the same card.
      const id = pl.consultantId ?? pl.record?.consultantId ?? pl.record?.userId;
      const st = pl.is_online ?? pl.record?.is_online;
      if (typeof id === "string" && typeof st === "boolean") {
        setConsultants((prev) => prev.map((c) =>
          c.userId === id ? { ...c, is_online: st } : c));
      }
    }, []),
  });

  const isFiltered = query.trim() !== "" || category !== "all" || onlineOnly;

  const sortedConsultants = [...consultants].sort((a, b) => {
    switch (sort) {
      case "rating": return (b.rating ?? 0) - (a.rating ?? 0);
      case "price-asc": return (a.perMinuteRate ?? 0) - (b.perMinuteRate ?? 0);
      case "price-desc": return (b.perMinuteRate ?? 0) - (a.perMinuteRate ?? 0);
      case "consultations": return (b.totalConsultations ?? 0) - (a.totalConsultations ?? 0);
      case "sparks": return (b.sparkScore ?? 0) - (a.sparkScore ?? 0);
      default: return (b.sparkScore ?? 0) - (a.sparkScore ?? 0);
    }
  });

  const clearFilters = useCallback(() => {
    setQuery(""); setCategory("all"); setOnlineOnly(false);
  }, []);
  // The server already applies the online filter and returns a correct total,
  // so rely on it directly rather than re-filtering / disabling pagination.
  const hasMore = consultants.length < total;

  return (
    <div className="space-y-8">
      {/* ─── Search ──────────────────────────────────────────────────────── */}
      <div className="relative max-w-2xl mx-auto">
        <Search
          size={18}
          className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          type="search"
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          placeholder="Search by name, skill, or tradition…"
          aria-label="Search guides"
          className="w-full pl-14 pr-14 py-4 glass-luxury rounded-2xl text-base text-foreground placeholder:text-muted-foreground outline-none focus:border-[var(--color-luxury-gold)]/50 transition-colors"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-overlay transition-colors"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* ─── Filter rail (bubble pills) ──────────────────────────────────── */}
      <div className="relative -mx-4 md:mx-0">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10 bg-gradient-to-l from-background to-transparent" />
        <div className="flex items-center gap-2 overflow-x-auto pb-2 pl-4 md:pl-0 pr-12 custom-scrollbar hide-scrollbar">
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
            aria-pressed={onlineOnly}
            aria-label="Show only online guides"
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
            Online Only
          </button>
          {isFiltered && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-full text-xs font-bold text-muted-foreground hover:text-rose-400 whitespace-nowrap transition-colors"
            >
              <SlidersHorizontal size={11} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ─── Sort & view controls ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ArrowUpDown size={13} className="text-muted-foreground shrink-0" />
          <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar">
            {([
              ["relevance", "Relevance"],
              ["rating", "Top rated"],
              ["price-asc", "Price ↑"],
              ["price-desc", "Price ↓"],
              ["consultations", "Popular"],
              ["sparks", "Trending"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                aria-pressed={sort === key}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all",
                  sort === key
                    ? "bg-[var(--color-luxury-gold)]/[0.12] text-[var(--color-luxury-gold)] border border-[var(--color-luxury-gold)]/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-raised",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-raised p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
            aria-pressed={viewMode === "grid"}
            className={cn(
              "p-1.5 rounded-lg transition-all",
              viewMode === "grid"
                ? "bg-surface-overlay text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Grid3x3 size={14} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-label="List view"
            aria-pressed={viewMode === "list"}
            className={cn(
              "p-1.5 rounded-lg transition-all",
              viewMode === "list"
                ? "bg-surface-overlay text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* ─── Results ─────────────────────────────────────────────────────── */}
      {loading ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-72 rounded-3xl shimmer" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl shimmer" />
            ))}
          </div>
        )
      ) : fetchError ? (
        <div className="text-center py-20 rounded-3xl border border-rose-500/20 bg-rose-500/[0.04]" role="alert">
          <p className="text-rose-400 text-sm mb-3">Unable to load the guides: {fetchError}</p>
          <button
            type="button"
            onClick={() => { setFetchError(null); setReloadKey((k) => k + 1); }}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white text-xs font-black transition-all hover:opacity-95 active:scale-[0.98]"
          >
            Try Again
          </button>
        </div>
      ) : consultants.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-24 rounded-3xl border-2 border-dashed border-border"
        >
          <Search size={36} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-foreground font-bold mb-1">No guides matched</p>
          <p className="text-sm text-muted-foreground mb-5">
            Try another name, skill, or tradition — or clear the filters.
          </p>
          {isFiltered && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white text-xs font-black transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles size={12} /> Clear Filters
            </button>
          )}
        </motion.div>
      ) : (
        <>
          {viewMode === "grid" ? (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
            >
              {sortedConsultants.map((c) => (
                <motion.div key={c.id} variants={fadeUp}>
                  <LuxuryConsultantCard
                    consultant={toProfile(c)}
                    onChat={handleChat}
                    onBook={(id) => router.push(`/booking?consultantId=${id}`)}
                  />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="space-y-3"
            >
              {sortedConsultants.map((c) => (
                <motion.div key={c.id} variants={fadeUp}>
                  <ListCard
                    consultant={toProfile(c)}
                    onChat={handleChat}
                    onBook={(id) => router.push(`/booking?consultantId=${id}`)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}

          {hasMore && (
            <div className="flex flex-col items-center gap-2 pt-4">
              <motion.button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                whileHover={{ scale: loadingMore ? 1 : 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-surface-raised border border-border text-sm font-bold text-foreground hover:border-[var(--color-luxury-gold)]/40 transition-colors disabled:opacity-60 disabled:cursor-wait"
              >
                {loadingMore ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {loadingMore ? "Loading…" : "Load More"}
                <span className="text-muted-foreground font-mono text-xs">
                  {consultants.length}/{total}
                </span>
              </motion.button>
              {moreError && (
                <p className="text-xs text-rose-400 text-center" role="alert">
                  {moreError} —{" "}
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    className="font-bold underline underline-offset-2 hover:text-rose-300"
                  >
                    Try Again
                  </button>
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── Toast ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-[calc(env(safe-area-inset-bottom)+96px)] left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-2xl glass-luxury text-sm font-bold text-foreground shadow-2xl"
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
      aria-pressed={active}
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

/* ─── List view card ───────────────────────────────────────────────────────── */

function ListCard({
  consultant, onChat, onBook,
}: {
  consultant: ConsultantProfile;
  onChat: (id: string) => void;
  onBook: (id: string) => void;
}) {
  const displayName = consultant.name || consultant.username || "Guide";
  const initial = displayName.charAt(0).toUpperCase();
  const chatEnabled = Boolean(consultant.isAI || consultant.isOnline);
  const rateLabel = consultant.perMinuteRate > 0 ? `₹${consultant.perMinuteRate}/min` : "Free";
  const href = consultant.isAI
    ? `/ai-astrologers/${consultant.id}`
    : `/consultant/${consultant.id}`;

  return (
    <div
      className="group flex items-center gap-4 p-4 rounded-2xl glass-luxury glass-luxury-hover card-lift"
    >
      {/* Avatar */}
      <Link href={href} className="shrink-0">
        {consultant.avatar ? (
          <img
            src={getImageUrl(consultant.avatar, "avatar-sm")}
            alt=""
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] font-black text-white text-lg"
          >
            {initial}
          </span>
        )}
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <Link href={href} className="block">
          <h3 className="font-bold text-foreground truncate group-hover:text-[var(--color-luxury-gold)] transition-colors">
            {displayName}
          </h3>
          {consultant.username && (
            <p className="text-[11px] text-muted-foreground font-mono truncate">
              @{consultant.username}
            </p>
          )}
        </Link>
        <div className="flex items-center gap-3 mt-1 text-xs">
          <span className="inline-flex items-center gap-1 text-amber-400">
            <Star size={11} className="fill-amber-400" />
            {(consultant.rating || 0).toFixed(1)}
          </span>
          {consultant.specialties?.slice(0, 2).map((s) => (
            <span key={s} className="text-muted-foreground truncate">{s}</span>
          ))}
          {consultant.sparks > 0 && (
            <span className="inline-flex items-center gap-1 text-orange-400">
              <Flame size={11} />
              {consultant.sparks.toLocaleString("en-IN")}
            </span>
          )}
        </div>
      </div>

      {/* Rate + actions */}
      <div className="shrink-0 flex items-center gap-3">
        <span className="font-mono font-bold text-sm text-[var(--color-luxury-gold)] hidden sm:block">
          {rateLabel}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
            consultant.isOnline || consultant.isAI
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : "bg-surface-raised text-muted-foreground border border-border",
          )}
        >
          <span className={cn(
            "h-1.5 w-1.5 rounded-full",
            consultant.isOnline ? "bg-emerald-400 animate-pulse" : "bg-slate-500",
          )} />
          {consultant.isAI ? "AI" : consultant.isOnline ? "Online" : "Offline"}
        </span>
        <button
          type="button"
          onClick={() => onChat(consultant.id)}
          disabled={!chatEnabled}
          aria-label={chatEnabled ? `Chat with ${displayName}` : `${displayName} is offline right now`}
          title={chatEnabled ? "Start Chat" : "Guide is offline right now"}
          className={cn(
            "px-3 py-2 rounded-xl text-xs font-black transition-all",
            chatEnabled
              ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white hover:opacity-95 active:scale-[0.98]"
              : "cursor-not-allowed bg-surface-raised text-muted-foreground",
          )}
        >
          <MessageCircle size={13} />
        </button>
        {!consultant.isAI && (
          <button
            type="button"
            onClick={() => onBook(consultant.id)}
            aria-label={`Book a session with ${displayName}`}
            className="px-3 py-2 rounded-xl border border-border bg-surface-raised text-xs font-black text-foreground transition-all hover:border-[var(--color-luxury-gold)]/40 hover:bg-surface-overlay active:scale-[0.98]"
          >
            Book Now
          </button>
        )}
      </div>
    </div>
  );
}
