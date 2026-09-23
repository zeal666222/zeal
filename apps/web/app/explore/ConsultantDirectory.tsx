// ZEAL_PHASE2_V1
"use client";
// ConsultantDirectory — search + filters + realtime + startChatFlow wiring
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";
import { staggerContainer, fadeUp } from "@zeal/ui/motion";
import { ConsultantCard } from "@/components/shared/ConsultantCard";
import { LuxuryConsultantCard } from "@/components/shared/LuxuryConsultantCard";
import { startChatFlow, type LowBalanceInfo } from "@/lib/chat/start-chat-flow";
import { WalletGateDialog } from "@/components/billing/WalletGateDialog";
import type { ConsultantProfile } from "@zeal/types";

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
    <div className="space-y-6">
      <div className="relative max-w-2xl mx-auto">
        <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input type="search" value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          placeholder="Search by name, skill, or tradition…" aria-label="Search consultants"
          className="w-full pl-14 pr-14 py-4 glass-luxury rounded-2xl text-base text-white placeholder:text-slate-500 outline-none focus:border-[var(--color-luxury-gold)] transition-colors" />
        {query && (
          <button type="button" aria-label="Clear search" onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors">
            <X size={15} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-center">
        <Chip active={category === "all"} onClick={() => setCategory("all")}>All</Chip>
        {categories.slice(0, 12).map((c) => (
          <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
            {c.display_name}
          </Chip>
        ))}
        <button type="button" onClick={() => setOnlineOnly((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            onlineOnly
              ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
              : "bg-white/5 border border-white/10 text-slate-400 hover:text-white"
          }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${onlineOnly ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
          Online only
        </button>
        {isFiltered && (
          <button type="button" onClick={clearFilters}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-slate-400 hover:text-rose-400 transition-colors">
            <SlidersHorizontal size={11} /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-luxury-gold)]" />
        </div>
      ) : fetchError ? (
        <div className="text-center py-16 text-rose-400">Failed to load: {fetchError}</div>
      ) : visible.length === 0 ? (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
            <Search size={32} className="mx-auto mb-4 text-slate-600" />
            <p className="text-slate-400">No consultants match your search.</p>
            {isFiltered && (
              <button type="button" onClick={clearFilters}
                className="mt-4 text-xs text-[var(--color-luxury-gold)] font-bold hover:underline">
                Clear filters
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visible.map((c) => (
            <motion.div key={c.id} variants={fadeUp}>
              <LuxuryConsultantCard consultant={toProfile(c)} onChat={handleChat} onBook={(id) => router.push(`/booking?consultantId=${id}`)} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-2xl glass-luxury text-sm font-bold text-white shadow-2xl">
          {toast}
        </div>
      )}
      <WalletGateDialog open={gateOpen} onOpenChange={setGateOpen} info={gateInfo} />
    </div>
  );
}

function Chip({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
        active
          ? "bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-white shadow-lg shadow-[#533AFD]/20"
          : "bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-[var(--color-luxury-gold)]/30"
      }`}>
      {children}
    </button>
  );
}
