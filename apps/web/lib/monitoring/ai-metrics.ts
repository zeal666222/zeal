// ═══════════════════════════════════════════════════════════════════════════════
// AI Latency Metrics — TTFT + TPOT histograms per consultant / provider
// ═══════════════════════════════════════════════════════════════════════════════
// Industry targets (see ClickHouse / Mirantis LLM-serving benchmarks):
//   p95 TTFT < 1_000 ms, TPOT 10–50 ms, error rate < 1%.
// Everything is in-memory, ring-buffered (bounded), and safe to sample from
// both the app-server and the edge worker. Exposed via /api/health.
// ═══════════════════════════════════════════════════════════════════════════════

export interface AiSample {
  consultantId: string;
  provider: string;
  ttftMs: number;
  totalMs: number;
  tokens: number;
  retries: number;
  ok: boolean;
  err?: string;
  cached?: boolean;
}

export interface AiMetricsSnapshot {
  samples: number;
  ttft: { p50: number; p95: number; p99: number; max: number };
  tpot: { p50: number; p95: number };
  total: { p50: number; p95: number; p99: number };
  errorRate: number;
  cacheHitRate: number;
  byProvider: Record<string, { samples: number; ttftP95: number; errorRate: number }>;
  byConsultant: Record<string, { samples: number; ttftP95: number }>;
}

const RING = 1024;
const buf: AiSample[] = [];
let head = 0;

export function recordAi(sample: AiSample): void {
  if (buf.length < RING) buf.push(sample);
  else { buf[head] = sample; head = (head + 1) % RING; }
}

function pct(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

function group<K extends string, V>(items: V[], key: (v: V) => K): Map<K, V[]> {
  const out = new Map<K, V[]>();
  for (const it of items) {
    const k = key(it);
    const arr = out.get(k);
    if (arr) arr.push(it);
    else out.set(k, [it]);
  }
  return out;
}

export function snapshotAi(): AiMetricsSnapshot {
  if (!buf.length) {
    return {
      samples: 0,
      ttft: { p50: 0, p95: 0, p99: 0, max: 0 },
      tpot: { p50: 0, p95: 0 },
      total: { p50: 0, p95: 0, p99: 0 },
      errorRate: 0,
      cacheHitRate: 0,
      byProvider: {},
      byConsultant: {},
    };
  }
  const ttfts = buf.map((s) => s.ttftMs);
  const totals = buf.map((s) => s.totalMs);
  const tpots = buf
    .filter((s) => s.tokens > 1)
    .map((s) => Math.max(0, (s.totalMs - s.ttftMs) / (s.tokens - 1)));
  const errs = buf.filter((s) => !s.ok).length;
  const hits = buf.filter((s) => s.cached).length;

  const byProvider = new Map<string, AiSample[]>();
  for (const [k, arr] of group(buf, (s) => s.provider)) byProvider.set(k, arr);
  const byConsultant = new Map<string, AiSample[]>();
  for (const [k, arr] of group(buf, (s) => s.consultantId)) byConsultant.set(k, arr);

  return {
    samples: buf.length,
    ttft: { p50: pct(ttfts, 50), p95: pct(ttfts, 95), p99: pct(ttfts, 99), max: Math.max(...ttfts) },
    tpot: { p50: pct(tpots, 50), p95: pct(tpots, 95) },
    total: { p50: pct(totals, 50), p95: pct(totals, 95), p99: pct(totals, 99) },
    errorRate: errs / buf.length,
    cacheHitRate: hits / buf.length,
    byProvider: Object.fromEntries(
      [...byProvider].map(([p, arr]) => [
        p,
        {
          samples: arr.length,
          ttftP95: pct(arr.map((s) => s.ttftMs), 95),
          errorRate: arr.filter((s) => !s.ok).length / arr.length,
        },
      ]),
    ),
    byConsultant: Object.fromEntries(
      [...byConsultant].map(([c, arr]) => [
        c,
        { samples: arr.length, ttftP95: pct(arr.map((s) => s.ttftMs), 95) },
      ]),
    ),
  };
}

export function resetAi(): void {
  buf.length = 0;
  head = 0;
}
