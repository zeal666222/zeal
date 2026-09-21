"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// CategoryHubClient — realtime AI + human sections
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Flame, Sparkles, Star } from "lucide-react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";

interface HumanRow {
  id: string; category: string; specialties: string[] | null; languages: string[] | null;
  bio: string | null; perMinuteRate: number; rating: number; totalConsultations: number;
  sparkScore: number; subdomain: string | null;
  user: { id: string; name: string | null; username: string; avatar: string | null; is_online: boolean | null };
}

interface AiRow {
  id: string; name: string; username: string; avatar: string; category: string;
  bio: string; rating: number; isPaid: boolean; perMinuteRate: number;
  specialties: string[] | null; isFeatured: boolean;
}

interface Props {
  categoryId: string;
  categoryName: string;
  initialHumans: HumanRow[];
  initialAi: AiRow[];
}

export function CategoryHubClient({ categoryId, categoryName, initialHumans, initialAi }: Props) {
  const [humans, setHumans] = useState(initialHumans);
  const [ai, setAi] = useState(initialAi);

  // Realtime: AI consultant updates
  useChannel<BroadcastChange<AiRow>>({
    channel: channels.consultantAiUpdates(),
    event: "*",
    onMessage: useCallback((p) => {
      const { type, record, old_record } = p ?? {};
      if (type === "INSERT" && record) {
        setAi((prev) => prev.some((x) => x.id === record.id) ? prev : [record, ...prev]);
      } else if (type === "UPDATE" && record) {
        setAi((prev) => prev.map((x) => x.id === record.id ? record : x));
      } else if (type === "DELETE" && old_record?.id) {
        setAi((prev) => prev.filter((x) => x.id !== old_record.id));
      }
    }, []),
  });

  // Realtime: consultants:live → invalidate on change (simple refresh pattern)
  useChannel<BroadcastChange<unknown>>({
    channel: channels.consultantsLive(),
    event: "*",
    onMessage: useCallback(() => {
      fetch(`/api/explore/consultants?category=${encodeURIComponent(categoryId)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d?.consultants) setHumans(d.consultants); })
        .catch(() => {});
    }, [categoryId]),
  });

  return (
    <div className="space-y-10">
      {ai.length > 0 && (
        <section>
          <h2 className="text-sm font-black uppercase tracking-widest text-[var(--color-primary)] mb-4 flex items-center gap-2">
            <Sparkles size={14} /> AI Consultants · 24/7
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ai.map((c) => (
              <Link
                key={c.id}
                href={`/ai-astrologers/${c.id}`}
                className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-[var(--color-surface-raised)] shrink-0 ring-2 ring-[var(--color-primary)]/30">
                    {c.avatar && <img src={c.avatar} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[var(--color-foreground)] text-sm truncate">{c.name}</p>
                    <p className="text-xs text-[var(--color-muted-foreground)] capitalize">{c.category.toLowerCase()}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      <span className="text-amber-500">⭐ {c.rating.toFixed(1)}</span>
                      <span className="text-[var(--color-primary)] font-mono">
                        {c.isPaid ? `₹${c.perMinuteRate}/min` : "Free"}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-black uppercase tracking-widest text-[var(--color-muted-foreground)] mb-4">
          Verified Human Guides
        </h2>
        {humans.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-[var(--color-border)] rounded-3xl">
            <p className="text-[var(--color-muted-foreground)]">
              No consultants available yet in {categoryName}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {humans.map((c, idx) => {
              const name = c.user?.name || c.user?.username || "Guide";
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                >
                  <Link
                    href={`/consultant/${c.id}`}
                    className="block p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        <div className="w-14 h-14 rounded-full overflow-hidden bg-[var(--color-surface-raised)]">
                          {c.user?.avatar ? (
                            <img src={c.user.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg font-black text-[var(--color-primary)]">
                              {name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        {c.user?.is_online && (
                          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[var(--color-surface)] rounded-full" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[var(--color-foreground)] text-sm truncate">{name}</p>
                        <p className="text-xs text-[var(--color-muted-foreground)] truncate">
                          {(c.specialties ?? []).slice(0, 2).join(", ") || c.category.toLowerCase()}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 text-xs">
                          <span className="flex items-center gap-0.5 text-amber-500">
                            <Star size={10} className="fill-amber-500" /> {c.rating.toFixed(1)}
                          </span>
                          <span className="flex items-center gap-0.5 text-orange-500">
                            <Flame size={10} /> {c.sparkScore.toLocaleString()}
                          </span>
                          <span className="text-[var(--color-primary)] font-mono ml-auto">
                            ₹{c.perMinuteRate}/min
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
