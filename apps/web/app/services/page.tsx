// ═══════════════════════════════════════════════════════════════════════════════
// Services — AI concierge + bubble category grid
// ═══════════════════════════════════════════════════════════════════════════════

import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { SkeletonGrid } from "@zeal/ui";
import { createServerClientFromCookies } from "@zeal/database/server";
import { CATEGORY_ID_TO_NAME } from "@/lib/services/slug";
import { ZealChat } from "@/components/zeal/ZealChat";
import { CategoryGridRealtime } from "./CategoryGridRealtime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getCategoryCounts() {
  try {
    const supabase = await createServerClientFromCookies();
    const { data, error } = await supabase.rpc("category_counts");
    if (error) return {} as Record<string, { count: number; onlineCount: number }>;
    const rows = (data ?? []) as Array<{
      categoryId: string; count: number; onlineCount: number;
    }>;
    const map: Record<string, { count: number; onlineCount: number }> = {};
    for (const r of rows) map[r.categoryId] = { count: r.count, onlineCount: r.onlineCount };
    return map;
  } catch {
    return {} as Record<string, { count: number; onlineCount: number }>;
  }
}

async function CategoryGrid() {
  const counts = await getCategoryCounts();
  const categories = Object.entries(CATEGORY_ID_TO_NAME);
  return (
    <CategoryGridRealtime
      initial={categories.map(([id, name]) => ({
        id, name,
        count: counts[id]?.count ?? 0,
        onlineCount: counts[id]?.onlineCount ?? 0,
      }))}
    />
  );
}

export default function ServicesPage() {
  return (
    <div className="min-h-screen-app bg-background pb-24">
      {/* ─── Editorial hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden noise-overlay
                          border-b border-[var(--color-luxury-glass-border)]">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px]
                        bg-[var(--color-luxury-gold)]/[0.10] blur-[180px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px]
                        bg-[var(--color-primary)]/[0.14] blur-[180px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 lg:px-16 py-14 md:py-20">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full
                          bg-[var(--color-luxury-gold)]/[0.08]
                          border border-[var(--color-luxury-gold)]/[0.20]
                          text-[var(--color-luxury-gold)]
                          text-[10px] font-black uppercase tracking-[0.25em] mb-6">
            <Sparkles size={12} /> Powered by Agnes + Groq
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black
                         tracking-[-0.03em] leading-[0.95] text-foreground max-w-3xl">
            Ask Zeal,{" "}
            <span className="text-luxury-gradient">find your guide.</span>
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground
                        max-w-2xl leading-relaxed">
            Describe what you're looking for. Zeal reads the entire directory —
            human and AI — and connects you with the right match.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-16 py-10 space-y-16">
        {/* ─── AI Concierge ─────────────────────────────────────────────── */}
        <section>
          <ZealChat />
        </section>

        {/* ─── Category bubble grid ────────────────────────────────────── */}
        <section id="category-grid">
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-[0.25em]
                          text-[var(--color-luxury-gold)] font-bold mb-2">
              Every tradition
            </p>
            <h2 className="text-2xl md:text-4xl font-black tracking-tight text-foreground">
              Explore by path
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              37 traditions · verified guides · realtime counts
            </p>
          </div>
          <Suspense fallback={<SkeletonGrid count={12} />}>
            <CategoryGrid />
          </Suspense>
        </section>
      </div>
    </div>
  );
}
