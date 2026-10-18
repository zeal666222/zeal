// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Cache Warmer
// ─────────────────────────────────────────────────────────────────────────────
// Primes hot, deterministic caches on boot so first requests served by a fresh
// Vercel instance do not eat the producer latency. Never blocks; never makes
// paid upstream calls. Warming rules:
//   • /api/zeal/categories          → static list, already in-memory constant
//   • /api/consultants/catalog      → Supabase read, ~50 rows, cheap once
//   • /api/services/counts          → Supabase RPC `category_counts`, one call
//   • /api/consultants/stats        → aggregate RPC
// AI endpoints (horoscope, kundali) are intentionally NOT warmed here because
// each unique parameter combo is a fresh upstream call — the single-flight in
// withCache already handles the thundering-herd for those.
// ═══════════════════════════════════════════════════════════════════════════════

import { redis } from "@/lib/cache";

interface WarmResult {
  warmed: string[];
  skipped: Array<{ key: string; reason: string }>;
  totalMs: number;
}

export async function warmHotCaches(): Promise<WarmResult> {
  const t0 = Date.now();
  const warmed: string[] = [];
  const skipped: Array<{ key: string; reason: string }> = [];

  const base = process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (!base) {
    return { warmed, skipped: [{ key: "*", reason: "no NEXT_PUBLIC_SITE_URL" }], totalMs: Date.now() - t0 };
  }

  const targets = [
    { key: "zeal:categories", path: "/api/zeal/categories" },
    { key: "consultants:catalog", path: "/api/consultants/catalog" },
    { key: "services:counts", path: "/api/services/counts" },
    { key: "consultants:stats", path: "/api/consultants/stats" },
  ];

  await Promise.allSettled(
    targets.map(async (t) => {
      try {
        const url = `${base}${t.path}`;
        const res = await fetch(url, { headers: { "x-warm": "1" }, cache: "no-store" });
        if (!res.ok) {
          skipped.push({ key: t.key, reason: `HTTP ${res.status}` });
          return;
        }
        // Routes that self-cache (e.g. /zeal/categories setex) already populate
        // the redis store; the fetch alone is the warm.
        await res.text().catch(() => "");
        warmed.push(t.key);
      } catch (e) {
        skipped.push({ key: t.key, reason: e instanceof Error ? e.message : String(e) });
      }
    }),
  );

  // Also mark the warm timestamp for observability.
  await redis.setex("zeal:cache:warm:at", 24 * 3600, String(Date.now())).catch(() => null);

  return { warmed, skipped, totalMs: Date.now() - t0 };
}
