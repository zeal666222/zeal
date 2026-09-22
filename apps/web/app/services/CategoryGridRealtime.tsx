"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// CategoryGridRealtime — cards with live category counts
// ═══════════════════════════════════════════════════════════════════════════════
import { useCallback, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useChannel } from "@zeal/realtime";

interface CategoryCard {
  id: string;
  name: string;
  count: number;
  onlineCount: number;
}

export function CategoryGridRealtime({ initial }: { initial: CategoryCard[] }) {
  const [categories, setCategories] = useState(initial);

  const { refetch } = useQuery({
    queryKey: ["category-counts"],
    queryFn: async () => {
      const res = await fetch("/api/services/counts", { cache: "no-store" });
      if (!res.ok) throw new Error("counts fetch failed");
      const data = (await res.json()) as { categories: CategoryCard[] };
      setCategories((prev) =>
        prev.map((c) => {
          const fresh = data.categories.find((x) => x.id === c.id);
          return fresh ? { ...c, count: fresh.count, onlineCount: fresh.onlineCount } : c;
        }),
      );
      return data;
    },
    refetchOnWindowFocus: false,
    refetchInterval: 30_000,
  });

  useChannel<{ at?: string }>({
    channel: "directory:counts",
    event: "*",
    onMessage: useCallback(() => { void refetch(); }, [refetch]),
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/services/${c.id}`}
          className="group p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:-translate-y-1 transition-all relative overflow-hidden"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-primary-hover)]/10 flex items-center justify-center text-xl mb-3">
            ✨
          </div>
          <h3 className="font-bold text-[var(--color-foreground)] text-sm leading-tight mb-1.5 line-clamp-2">
            {c.name}
          </h3>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {c.count} guide{c.count !== 1 ? "s" : ""}
            {c.onlineCount > 0 && (
              <span className="ml-2 text-emerald-400 font-bold">
                · {c.onlineCount} online
              </span>
            )}
          </p>
          <div className="mt-3 flex items-center text-[var(--color-primary)] text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            Explore <ArrowRight size={12} className="ml-1" />
          </div>
        </Link>
      ))}
    </div>
  );
}
