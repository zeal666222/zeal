"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// SlotPicker — realtime availability
// ─────────────────────────────────────────────────────────────────────────────
// • Subscribe to booking:{consultantId}:slots for live slot changes.
// • Grouped by Morning / Afternoon / Evening.
// • Local timezone rendering with server ISO.
// • Skeleton loaders + empty states.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Clock, Loader2, Sun, Sunrise, Sunset } from "lucide-react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";

interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
}

interface Props {
  consultantId: string;
  durationMinutes: number;
  selectedSlot: string | null;
  onSelect: (iso: string) => void;
}

type Group = "Morning" | "Afternoon" | "Evening";
const GROUP_ICON: Record<Group, typeof Sun> = {
  Morning: Sunrise,
  Afternoon: Sun,
  Evening: Sunset,
};

function groupOf(iso: string): Group {
  const h = new Date(iso).getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

export function SlotPicker({
  consultantId, durationMinutes, selectedSlot, onSelect,
}: Props) {
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateStr = useMemo(() => date.toISOString().slice(0, 10), [date]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/bookings/availability?consultantId=${consultantId}&date=${dateStr}&durationMinutes=${durationMinutes}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { slots?: TimeSlot[] };
      setSlots(data.slots ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load slots");
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [consultantId, dateStr, durationMinutes]);

  useEffect(() => { void load(); }, [load]);

  // Realtime slot updates
  useChannel<BroadcastChange<{ slot?: string; available?: boolean }>>({
    channel: channels.bookingSlots(consultantId),
    event: "*",
    onMessage: (p) => {
      const slot = p?.record?.slot;
      const available = p?.record?.available;
      if (typeof slot !== "string" || typeof available !== "boolean") return;
      setSlots((prev) => prev.map((s) =>
        s.start === slot ? { ...s, available } : s,
      ));
    },
  });

  const changeDate = useCallback((days: number) => {
    setDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + days);
      if (next.getTime() < Date.now() - 86_400_000) return d;
      return next;
    });
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<Group, TimeSlot[]>();
    for (const s of slots) {
      const g = groupOf(s.start);
      const arr = map.get(g) ?? [];
      arr.push(s);
      map.set(g, arr);
    }
    return Array.from(map.entries());
  }, [slots]);

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-surface border border-border">
        <button
          onClick={() => changeDate(-1)}
          className="p-2 rounded-xl hover:bg-surface-raised transition-colors active:scale-90"
          aria-label="Previous day"
        >
          <ChevronLeft className="w-5 h-5 text-[var(--color-primary)]" />
        </button>
        <div className="text-center">
          <p className="text-sm font-black text-foreground">
            {date.toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "short",
            })}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {dateStr}
          </p>
        </div>
        <button
          onClick={() => changeDate(1)}
          className="p-2 rounded-xl hover:bg-surface-raised transition-colors active:scale-90"
          aria-label="Next day"
        >
          <ChevronRight className="w-5 h-5 text-[var(--color-primary)]" />
        </button>
      </div>

      {/* Slots */}
      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="h-11 rounded-xl bg-surface-raised animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-8 text-rose-400 text-sm">
          {error}
          <button onClick={() => void load()} className="ml-2 underline">Retry</button>
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl">
          <Clock size={24} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No slots on this day</p>
          <p className="text-xs text-muted-foreground mt-1">Try another date</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {grouped.map(([group, groupSlots]) => {
              const Icon = GROUP_ICON[group];
              return (
                <motion.div
                  key={group}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <div className="flex items-center gap-1.5">
                    <Icon size={13} className="text-muted-foreground" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {group}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {groupSlots.map((slot) => {
                      const isSelected = selectedSlot === slot.start;
                      return (
                        <motion.button
                          key={slot.start}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => slot.available && onSelect(slot.start)}
                          disabled={!slot.available}
                          className={`py-3 rounded-xl text-sm font-mono font-black transition-all ${
                            isSelected
                              ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white shadow-lg"
                              : slot.available
                                ? "bg-surface border border-border text-foreground hover:border-[var(--color-primary)]/50"
                                : "bg-surface-raised text-muted-foreground/40 cursor-not-allowed line-through"
                          }`}
                        >
                          {new Date(slot.start).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
