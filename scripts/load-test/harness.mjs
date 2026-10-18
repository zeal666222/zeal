#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — 1000-VU Load Harness (no external deps)
// ─────────────────────────────────────────────────────────────────────────────
// Fires N concurrent requests at safe, idempotent, read-only endpoints and
// reports p50 / p95 / p99, throughput, error rate and per-target breakdown.
//
// Usage:   node scripts/load-test/harness.mjs
// Vars:    TARGETS (comma-separated URLs) · VUS (default 1000)
//          DURATION_MS (default 15_000) · WARMUP_MS (default 1_000)
//
// Endpoints chosen to be safe under load: health, catalog, counts, categories,
// worker /api/health, worker /api/consultants/diagnostic. No writes, no auth,
// no upstream AI calls.
// ═══════════════════════════════════════════════════════════════════════════════

const VUS = Number(process.env.VUS ?? 1000);
const DURATION_MS = Number(process.env.DURATION_MS ?? 15_000);
const WARMUP_MS = Number(process.env.WARMUP_MS ?? 1_000);
const MAX_INFLIGHT_MS = Number(process.env.MAX_INFLIGHT_MS ?? 15_000);
const HOST = process.env.WEB_HOST ?? "http://localhost:3000";
const WORKER = process.env.WORKER_URL ?? "https://zeal-chat.zeal666-app.workers.dev";

const DEFAULT_TARGETS = [
  `${HOST}/api/health`,
  `${HOST}/api/zeal/categories`,
  `${HOST}/api/consultants/catalog`,
  `${HOST}/api/services/counts`,
  `${WORKER}/api/health`,
  `${WORKER}/api/consultants/diagnostic`,
];

const TARGETS = (process.env.TARGETS ? process.env.TARGETS.split(",") : DEFAULT_TARGETS)
  .map((s) => s.trim()).filter(Boolean);

function newBucket() {
  return { total: 0, ok: 0, errors: 0, latencies: [], errCodes: new Map() };
}

function pct(values, p) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

async function fireOnce(url, global, perTarget) {
  const t0 = performance.now();
  const bucket = perTarget.get(url);
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(MAX_INFLIGHT_MS) });
    const ms = performance.now() - t0;
    await res.text().catch(() => "");
    global.total++; bucket.total++;
    if (res.ok) {
      global.ok++; bucket.ok++;
      global.latencies.push(ms); bucket.latencies.push(ms);
    } else {
      global.errors++; bucket.errors++;
      const k = String(res.status);
      global.errCodes.set(k, (global.errCodes.get(k) ?? 0) + 1);
      bucket.errCodes.set(k, (bucket.errCodes.get(k) ?? 0) + 1);
    }
  } catch (e) {
    global.total++; bucket.total++;
    global.errors++; bucket.errors++;
    const reason = e?.name === "TimeoutError" ? "timeout" : (e?.cause?.code ?? e?.message ?? "err").slice(0, 40);
    global.errCodes.set(reason, (global.errCodes.get(reason) ?? 0) + 1);
    bucket.errCodes.set(reason, (bucket.errCodes.get(reason) ?? 0) + 1);
  }
}

async function run() {
  const global = newBucket();
  const perTarget = new Map(TARGETS.map((t) => [t, newBucket()]));

  // Warm-up: 1 request per target, discarded.
  await Promise.all(TARGETS.map(async (t) => {
    const throwaway = newBucket();
    const throwawayMap = new Map([[t, throwaway]]);
    await fireOnce(t, throwaway, throwawayMap);
  }));
  await new Promise((r) => setTimeout(r, WARMUP_MS));

  const start = Date.now();
  const deadline = start + DURATION_MS;

  const workers = Array.from({ length: VUS }, (_, i) => (async () => {
    let idx = i;
    while (Date.now() < deadline) {
      const url = TARGETS[idx % TARGETS.length];
      idx++;
      await fireOnce(url, global, perTarget);
    }
  })());

  await Promise.allSettled(workers);
  const elapsed = (Date.now() - start) / 1000;
  const rps = global.total / Math.max(0.001, elapsed);

  console.log("─".repeat(68));
  console.log("ZEAL 1000-VU Load Summary");
  console.log(`VUs: ${VUS}   Duration: ${DURATION_MS}ms   Targets: ${TARGETS.length}`);
  console.log(`Total: ${global.total}  Ok: ${global.ok}  Errors: ${global.errors}`);
  console.log(`Throughput:  ${rps.toFixed(1)} req/s`);
  console.log(`Latency      p50=${pct(global.latencies, 50).toFixed(1)}ms  p95=${pct(global.latencies, 95).toFixed(1)}ms  p99=${pct(global.latencies, 99).toFixed(1)}ms  max=${Math.max(0, ...global.latencies).toFixed(0)}ms`);
  console.log(`Error rate:  ${((global.errors / Math.max(1, global.total)) * 100).toFixed(2)}%`);
  if (global.errCodes.size) console.log(`Errors: ${JSON.stringify(Object.fromEntries(global.errCodes))}`);
  console.log("─".repeat(68));
  for (const [url, s] of perTarget) {
    const line = `${url}  ok=${s.ok} err=${s.errors} p50=${pct(s.latencies, 50).toFixed(0)}ms p95=${pct(s.latencies, 95).toFixed(0)}ms p99=${pct(s.latencies, 99).toFixed(0)}ms`;
    console.log(line);
    if (s.errCodes.size) console.log(`    ↳ ${JSON.stringify(Object.fromEntries(s.errCodes))}`);
  }
  process.exit(0);
}

run().catch((e) => { console.error("load harness failed:", e); process.exit(1); });
