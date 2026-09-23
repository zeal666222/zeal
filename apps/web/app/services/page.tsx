// ZEAL_PHASE2_V1
// apps/web/app/services/page.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Services — AI concierge (ZealChat) + realtime category grid
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
    if (error) {
      return {} as Record<string, { count: number; onlineCount: number }>;
    }
    const rows = (data ?? []) as Array<{
      categoryId: string;
      count: number;
      onlineCount: number;
    }>;
    const map: Record<string, { count: number; onlineCount: number }> = {};
    for (const r of rows) {
      map[r.categoryId] = { count: r.count, onlineCount: r.onlineCount };
    }
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
        id,
        name,
        count: counts[id]?.count ?? 0,
        onlineCount: counts[id]?.onlineCount ?? 0,
      }))}
    />
  );
}

export default function ServicesPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
      {/* ─── AI concierge ──────────────────────────────────────────────── */}
      <section>
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-luxury-gold)] font-bold mb-2">
            Powered by Agnes + Groq
          </p>
          <h1
            className="text-3xl md:text-4xl font-black text-white tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Ask Zeal, find your guide
          </h1>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl">
            Describe what you're looking for. Zeal reads the entire directory —
            human and AI — and connects you with the right match.
          </p>
        </div>
        <ZealChat />
      </section>

      {/* ─── Category grid (anchor for ZealChat scroll) ────────────────── */}
      <section id="category-grid" className="pt-4">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={18} className="text-[var(--color-luxury-gold)]" />
          <h2 className="text-2xl md:text-3xl font-black text-white">
            Explore every tradition
          </h2>
        </div>
        <p className="text-sm text-slate-400 mb-6">
          37 traditions · verified guides · realtime counts
        </p>
        <Suspense fallback={<SkeletonGrid count={12} />}>
          <CategoryGrid />
        </Suspense>
      </section>
    </div>
  );
}
