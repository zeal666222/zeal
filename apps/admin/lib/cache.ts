// ZEAL — Cache (in-memory, zero external dependencies)
// ─────────────────────────────────────────────────────────────────────────────
// Vercel serverless keeps instances warm for minutes/hours, so in-memory
// caching works for hot paths (AI responses, category lists). Cache misses
// simply fall through to the producer — no user-visible impact.
//
// If you later need cross-instance caching, swap this file for a Postgres-
// backed implementation using a `cache_entries` table + RPCs.
// ─────────────────────────────────────────────────────────────────────────────

interface Entry { value: unknown; expiresAt: number | null }
const store = new Map<string, Entry>();
const hashes = new Map<string, Map<string, unknown>>();

function isExpired(e: Entry): boolean {
  return e.expiresAt !== null && e.expiresAt < Date.now();
}
function liveEntry(k: string): Entry | null {
  const e = store.get(k);
  if (!e) return null;
  if (isExpired(e)) { store.delete(k); return null; }
  return e;
}

export interface CacheClient {
  get<T = string>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<"OK" | null>;
  setex(key: string, ttl: number, value: unknown): Promise<"OK" | null>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  exists(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  mget<T = string>(...keys: string[]): Promise<(T | null)[]>;
  hget<T = string>(key: string, field: string): Promise<T | null>;
  hset(key: string, field: string, value: unknown): Promise<number>;
  hgetall<T = Record<string, string>>(key: string): Promise<T | null>;
  publish(channel: string, message: string): Promise<number>;
}

export const redis: CacheClient = {
  async get<T = string>(k: string): Promise<T | null> {
    const e = liveEntry(k);
    if (!e) return null;
    if (typeof e.value === "string") {
      try { return JSON.parse(e.value) as T; } catch { return e.value as unknown as T; }
    }
    return e.value as T;
  },
  async set(k, v, o) {
    store.set(k, { value: v, expiresAt: o?.ex ? Date.now() + o.ex * 1000 : null });
    return "OK";
  },
  async setex(k, ttl, v) {
    store.set(k, { value: v, expiresAt: Date.now() + ttl * 1000 });
    return "OK";
  },
  async del(...keys) {
    let n = 0;
    for (const k of keys) { if (store.delete(k)) n++; hashes.delete(k); }
    return n;
  },
  async incr(k) {
    const e = liveEntry(k);
    const next = (typeof e?.value === "number" ? e.value : 0) + 1;
    store.set(k, { value: next, expiresAt: e?.expiresAt ?? null });
    return next;
  },
  async decr(k) {
    const e = liveEntry(k);
    const next = (typeof e?.value === "number" ? e.value : 0) - 1;
    store.set(k, { value: next, expiresAt: e?.expiresAt ?? null });
    return next;
  },
  async expire(k, s) {
    const e = store.get(k);
    if (!e) return 0;
    e.expiresAt = Date.now() + s * 1000;
    return 1;
  },
  async ttl(k) {
    const e = liveEntry(k);
    if (!e || e.expiresAt === null) return -1;
    return Math.max(0, Math.floor((e.expiresAt - Date.now()) / 1000));
  },
  async exists(...keys) {
    let n = 0;
    for (const k of keys) if (liveEntry(k)) n++;
    return n;
  },
  async keys(pattern) {
    const re = new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
    return Array.from(store.keys()).filter((k) => re.test(k) && liveEntry(k));
  },
  async mget<T = string>(...keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map((k) => this.get<T>(k)));
  },
  async hget<T = string>(k: string, field: string): Promise<T | null> {
    const h = hashes.get(k);
    return (h?.get(field) ?? null) as T | null;
  },
  async hset(k: string, field: string, value: unknown): Promise<number> {
    let h = hashes.get(k);
    if (!h) { h = new Map(); hashes.set(k, h); }
    h.set(field, value);
    return 1;
  },
  async hgetall<T = Record<string, string>>(k: string): Promise<T | null> {
    const h = hashes.get(k);
    if (!h) return null;
    return Object.fromEntries(h) as T;
  },
  async publish(_channel: string, _message: string): Promise<number> {
    return 0;
  },
};

export const isRedisConfigured = false;
