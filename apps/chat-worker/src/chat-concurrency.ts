import type { Env } from "./env";

// Shared concurrency control via Durable Object. Single actor = correct across
// all worker isolates. Falls back to local in-memory tracking if DO is
// unavailable (dev, migration not yet applied).

const PER_USER_MAX = 50;
const GLOBAL_MAX = 2000;
const LEASE_TTL_MS = 120_000; // 2 min — long enough for any chat, short enough to auto-recover

export interface AcquireResult {
  allowed: boolean;
  leaseId?: string;
  currentPerUser?: number;
  currentGlobal?: number;
  error?: string;
}

let localTracker: Map<string, Set<string>> | null = null;
let localGlobal = 0;

function localAcquire(userId: string): AcquireResult {
  if (!localTracker) localTracker = new Map();
  const sessions = localTracker.get(userId);
  const current = sessions?.size ?? 0;
  if (current >= PER_USER_MAX) return { allowed: false, error: `Too many concurrent chats (max ${PER_USER_MAX}).` };
  if (localGlobal >= GLOBAL_MAX) return { allowed: false, error: "Platform at capacity." };
  const sid = crypto.randomUUID();
  if (!sessions) {
    const s = new Set<string>();
    s.add(sid);
    localTracker.set(userId, s);
  } else {
    sessions.add(sid);
  }
  localGlobal++;
  return { allowed: true, leaseId: sid, currentPerUser: (sessions ?? localTracker.get(userId)!).size, currentGlobal: localGlobal };
}

function localRelease(leaseId: string): void {
  if (!localTracker) return;
  for (const [uid, sessions] of localTracker) {
    if (sessions.has(leaseId)) {
      sessions.delete(leaseId);
      if (sessions.size === 0) localTracker.delete(uid);
      localGlobal = Math.max(0, localGlobal - 1);
      return;
    }
  }
}

export async function tryAcquire(env: Env, userId: string): Promise<AcquireResult> {
  if (!env.CHAT_GATE) return localAcquire(userId);
  try {
    const id = env.CHAT_GATE.idFromName("global");
    const stub = env.CHAT_GATE.get(id);
    const res = await stub.fetch("http://do/acquire", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, maxPerUser: PER_USER_MAX, maxGlobal: GLOBAL_MAX, ttlMs: LEASE_TTL_MS }),
    });
    const j = await res.json() as { allowed: boolean; leaseId?: string; currentPerUser?: number; currentGlobal?: number; error?: string };
    return j;
  } catch {
    return localAcquire(userId);
  }
}

export async function release(env: Env, leaseId: string): Promise<void> {
  if (!env.CHAT_GATE) return localRelease(leaseId);
  try {
    const id = env.CHAT_GATE.idFromName("global");
    const stub = env.CHAT_GATE.get(id);
    await stub.fetch("http://do/release", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leaseId }),
    });
  } catch {
    localRelease(leaseId);
  }
}

export async function stats(env: Env) {
  if (!env.CHAT_GATE) return { totalActive: localGlobal, perUserMax: PER_USER_MAX, globalMax: GLOBAL_MAX, mode: "local" };
  try {
    const id = env.CHAT_GATE.idFromName("global");
    const stub = env.CHAT_GATE.get(id);
    const res = await stub.fetch("http://do/stats");
    const j = await res.json() as { active: number; perUser: Record<string, number>; globalMax: number; perUserMax: number };
    return { totalActive: j.active, perUserMax: j.perUserMax, globalMax: j.globalMax, mode: "durable-object" };
  } catch {
    return { totalActive: localGlobal, perUserMax: PER_USER_MAX, globalMax: GLOBAL_MAX, mode: "local-fallback" };
  }
}
