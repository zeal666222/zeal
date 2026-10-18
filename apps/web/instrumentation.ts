// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Next.js Instrumentation Hook
// ─────────────────────────────────────────────────────────────────────────────
// Warms hot caches after boot so first-request users don't eat the cold-path
// latency. Runs on both Node runtime and edge runtime; production only.
// Industry pattern: pre-compute the top-N entries that are guaranteed to be
// requested within seconds of deploy / instance spin-up.
// ═══════════════════════════════════════════════════════════════════════════

export const config = { runtime: "nodejs" };

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;
  // Kick off async warm — never block boot.
  void import("./lib/ai/cache-warm")
    .then((m) => m.warmHotCaches())
    .then((r) => console.log(`[instrumentation] cache warm: ${JSON.stringify(r)}`))
    .catch((e) => console.warn("[instrumentation] cache warm failed:", e));
}
