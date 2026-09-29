"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// CategoryGridRealtime — bubble cards with realtime counts
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useChannel } from "@zeal/realtime";
import { fadeUp, staggerContainer } from "@zeal/ui/motion";

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
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-50px" }}
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
    >
      {categories.map((c) => (
        <motion.div key={c.id} variants={fadeUp}>
          <BubbleCard category={c} />
        </motion.div>
      ))}
    </motion.div>
  );
}

function BubbleCard({ category }: { category: CategoryCard }) {
  return (
    <Link
      href={`/services/${category.id}`}
      className="group relative block aspect-square overflow-hidden rounded-[2rem]
                 glass-luxury transition-all duration-500"
    >
      {/* Ambient hover glow */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-0
                   group-hover:opacity-100 transition-opacity duration-500
                   bg-gradient-to-br from-[var(--color-luxury-gold)]/[0.15]
                   via-transparent to-[var(--color-primary)]/[0.20]"
      />

      {/* Morphing bubble blob */}
      <motion.span
        aria-hidden
        className="absolute -top-20 -right-20 w-48 h-48 rounded-full
                   bg-[var(--color-primary)]/[0.18] blur-[60px] pointer-events-none"
        animate={{ scale: [1, 1.25, 1], x: [0, -8, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 flex h-full flex-col items-center justify-center text-center px-5">
        <motion.div
          whileHover={{ scale: 1.12, rotate: -3 }}
          transition={{ type: "spring", stiffness: 400, damping: 16 }}
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4
                     bg-gradient-to-br from-[var(--color-luxury-gold)]/25
                     to-[var(--color-primary)]/[0.15]
                     text-[var(--color-luxury-gold)]"
        >
          <Sparkles size={20} />
        </motion.div>

        <h3 className="text-sm md:text-base font-black text-foreground leading-tight
                       line-clamp-2 group-hover:text-[var(--color-luxury-gold)]
                       transition-colors">
          {category.name}
        </h3>

        <div className="mt-3 flex items-center gap-2 text-[11px] font-mono">
          <span className="text-muted-foreground">
            {category.count} guide{category.count !== 1 ? "s" : ""}
          </span>
          {category.onlineCount > 0 && (
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {category.onlineCount}
            </span>
          )}
        </div>

        <ArrowUpRight
          size={14}
          className="absolute top-4 right-4 text-muted-foreground
                     group-hover:text-[var(--color-luxury-gold)]
                     group-hover:-translate-y-0.5 group-hover:translate-x-0.5
                     transition-all"
        />
      </div>
    </Link>
  );
}
