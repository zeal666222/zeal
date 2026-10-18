// ═══════════════════════════════════════════════════════════════════════════════
// Worker AI Metrics — TTFT + TPOT ring buffer, exposed via /api/health
// ═══════════════════════════════════════════════════════════════════════════════

export interface AiSample {
  consultant: string;
  provider: string;
  ttftMs: number;
  totalMs: number;
  tokens: number;
  ok: boolean;
}

const RING = 512;
const buf: AiSample[] = [];
let head = 0;

export function record(sample: AiSample): void {
  if (buf.length < RING) buf.push(sample);
  else { buf[head] = sample; head = (head + 1) % RING; }
}

function pct(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0;
}

export function snapshot() {
  if (!buf.length) {
    return {
      samples: 0,
      ttft: { p50: 0, p95: 0, p99: 0 },
      total: { p50: 0, p95: 0, p99: 0 },
      errorRate: 0,
      byProvider: {} as Record<string, { samples: number; ttftP95: number }>,
    };
  }
  const ttfts = buf.map((s) => s.ttftMs);
  const totals = buf.map((s) => s.totalMs);
  const errs = buf.filter((s) => !s.ok).length;

  const prov: Record<string, AiSample[]> = {};
  for (const s of buf) (prov[s.provider] ??= []).push(s);

  return {
    samples: buf.length,
    ttft: { p50: pct(ttfts, 50), p95: pct(ttfts, 95), p99: pct(ttfts, 99) },
    total: { p50: pct(totals, 50), p95: pct(totals, 95), p99: pct(totals, 99) },
    errorRate: errs / buf.length,
    byProvider: Object.fromEntries(
      Object.entries(prov).map(([k, arr]) => [k, {
        samples: arr.length,
        ttftP95: pct(arr.map((s) => s.ttftMs), 95),
      }]),
    ),
  };
}
