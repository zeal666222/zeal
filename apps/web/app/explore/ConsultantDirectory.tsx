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
