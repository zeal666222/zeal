import type { Env } from "./env";

const memoryTracker = new Map<string, Set<string>>();
let globalActiveCount = 0;

const PER_USER_MAX = 50;
const GLOBAL_MAX = 2000;

export interface AcquireResult {
  allowed: boolean;
  currentPerUser?: number;
  currentGlobal?: number;
  error?: string;
}

export function tryAcquire(userId: string): AcquireResult {
  const sessions = memoryTracker.get(userId);
  const current = sessions?.size ?? 0;
  if (current >= PER_USER_MAX) {
    return { allowed: false, currentPerUser: current, error: `Too many concurrent chats (max ${PER_USER_MAX}).` };
  }
  if (globalActiveCount >= GLOBAL_MAX) {
    return { allowed: false, currentGlobal: globalActiveCount, error: "Platform at capacity." };
  }

  const sid = crypto.randomUUID();
  if (!sessions) {
    const s = new Set<string>();
    s.add(sid);
    memoryTracker.set(userId, s);
  } else {
    sessions.add(sid);
  }
  globalActiveCount++;
  return { allowed: true, currentPerUser: (sessions ?? memoryTracker.get(userId)!).size, currentGlobal: globalActiveCount };
}

export function release(userId: string): void {
  const sessions = memoryTracker.get(userId);
  if (sessions) {
    const first = sessions.values().next().value;
    if (first !== undefined) sessions.delete(first);
    if (sessions.size === 0) memoryTracker.delete(userId);
  }
  globalActiveCount = Math.max(0, globalActiveCount - 1);
}

export function stats() {
  return { totalActive: globalActiveCount, perUserMax: PER_USER_MAX, globalMax: GLOBAL_MAX };
}
