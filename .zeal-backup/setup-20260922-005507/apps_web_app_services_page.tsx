import { createAdminClient } from "@zeal/database/server";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { AIChatDiscovery } from "@/components/discovery/AIChatDiscovery";
import { SkeletonGrid } from "@zeal/ui";
import { CATEGORY_ID_TO_NAME } from "@/lib/services/slug";

export const dynamic = "force-dynamic";

async function getCategoryStats() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("Consultant")
    .select("category")
    .eq("status", "VERIFIED")
    .eq("isActive", true);

  const counts = new Map<string, number>();
  for (const c of (data ?? []) as Array<{ category: string }>) {
    const key = String(c.category ?? "").toLowerCase().replace(/_/g, "-");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

async function CategoryGrid() {
  const counts = await getCategoryStats();
  const categories = Object.entries(CATEGORY_ID_TO_NAME);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {categories.map(([id, name]) => {
        const count = counts.get(id) ?? 0;
        return (
          <Link
            key={id}
            href={`/services/${id}`}
            className="group p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:-translate-y-1 transition-all relative overflow-hidden"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-primary-hover)]/10 flex items-center justify-center text-xl mb-3">
              ✨
            </div>
            <h3 className="font-bold text-[var(--color-foreground)] text-sm leading-tight mb-1.5 line-clamp-2">
              {name}
            </h3>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {count} guide{count !== 1 ? "s" : ""}
            </p>
            <div className="mt-3 flex items-center text-[var(--color-primary)] text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Explore <ArrowRight size={12} className="ml-1" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default async function ServicesPage() {
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
          From Vedic astrology to Islamic counseling, Buddhist meditation, Christian therapy, and modern wellness — 37 traditions, one platform.
        </p>
        <Suspense fallback={<SkeletonGrid count={8} />}>
          <CategoryGrid />
        </Suspense>
      </div>
    </div>
  );
}
