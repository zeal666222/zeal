// apps/web/app/services/page.tsx
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { AIChatDiscovery } from "@/components/discovery/AIChatDiscovery";
import { SkeletonGrid } from "@zeal/ui";
import { createServerClientFromCookies } from "@zeal/database/server";
import { CATEGORY_ID_TO_NAME } from "@/lib/services/slug";
import { CategoryGridRealtime } from "./CategoryGridRealtime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getCategoryCounts() {
  try {
    const supabase = await createServerClientFromCookies();
    const { data, error } = await supabase.rpc("category_counts");
    if (error) return {} as Record<string, { count: number; onlineCount: number }>;

    const rows = (data ?? []) as Array<{
      categoryId: string;
      count: number;
      onlineCount: number;
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
        id,
        name,
        count:       counts[id]?.count       ?? 0,
        onlineCount: counts[id]?.onlineCount ?? 0,
      }))}
    />
  );
}

export default function ServicesPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <AIChatDiscovery />
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={18} className="text-[var(--color-primary)]" />
          <h2 className="text-2xl md:text-3xl font-black text-[var(--color-foreground)]">
            Explore every faith & healing tradition
          </h2>
        </div>
        <p className="text-sm text-[var(--color-muted-foreground)] mb-6">
          37 traditions · verified guides · realtime counts
        </p>
        <Suspense fallback={<SkeletonGrid count={12} />}>
          <CategoryGrid />
        </Suspense>
      </div>
    </div>
  );
}
