// ═══════════════════════════════════════════════════════════════════════════════
// AI Chat Concurrency — In-memory per-user + global limits
// ═══════════════════════════════════════════════════════════════════════════════
// Tracks concurrent AI chats per user and platform-wide.
// Uses in-memory tracking (per-instance) since Vercel serverless is stateless.
// Limits are generous (50 per user, 2000 global) — these are anti-abuse guards.
// ═══════════════════════════════════════════════════════════════════════════════

import { logger } from "@/lib/logger";
import { ConcurrencyGate, getGate } from "@/lib/ai/engine/concurrency-gate";

// ─── Configuration ────────────────────────────────────────────────────────────

const DEFAULT_PER_USER_MAX = parseInt(process.env.AI_CHAT_PER_USER_MAX ?? "50", 10);
const DEFAULT_GLOBAL_MAX = parseInt(process.env.AI_CHAT_GLOBAL_MAX ?? "2000", 10);

// ─── In-memory tracker ───────────────────────────────────────────────────────

const memoryTracker = new Map<string, Set<string>>(); // userId → Set<sessionId>
let globalActiveCount = 0;

function memoryTrack(userId: string, sessionId: string): { allowed: boolean; current: number } {
  let userSessions = memoryTracker.get(userId);
  if (!userSessions) {
    userSessions = new Set();
    memoryTracker.set(userId, userSessions);
  }
  userSessions.add(sessionId);
  globalActiveCount++;
  return { allowed: true, current: userSessions.size };
}

function memoryUntrack(userId: string, sessionId: string): void {
  const userSessions = memoryTracker.get(userId);
  if (userSessions) {
    userSessions.delete(sessionId);
    if (userSessions.size === 0) memoryTracker.delete(userId);
  }
  globalActiveCount = Math.max(0, globalActiveCount - 1);
}

function memoryCheck(userId: string, maxPerUser: number): { allowed: boolean; current: number } {
  const userSessions = memoryTracker.get(userId);
  const current = userSessions?.size ?? 0;
  return { allowed: current < maxPerUser, current };
}

// ─── Main API ─────────────────────────────────────────────────────────────────

export interface AIChatAcquireResult {
  allowed: boolean;
  currentPerUser?: number;
  currentGlobal?: number;
  maxPerUser: number;
  maxGlobal: number;
  error?: string;
}

/**
 * Try to start an AI chat session for a user.
 * Checks both per-user and global limits using in-memory tracking.
 */
export async function tryAcquireAIChat(
  userId: string,
  options?: { perUserMax?: number; globalMax?: number },
): Promise<AIChatAcquireResult> {
  const perUserMax = options?.perUserMax ?? DEFAULT_PER_USER_MAX;
  const globalMax = options?.globalMax ?? DEFAULT_GLOBAL_MAX;

  const check = memoryCheck(userId, perUserMax);
  if (!check.allowed) {
    return {
      allowed: false,
      currentPerUser: check.current,
      maxPerUser: perUserMax,
      maxGlobal: globalMax,
      error: `Too many concurrent chats. Max ${perUserMax} per user.`,
    };
  }

  if (globalActiveCount >= globalMax) {
    return {
      allowed: false,
      currentGlobal: globalActiveCount,
      maxPerUser: perUserMax,
      maxGlobal: globalMax,
      error: "Platform at capacity. Please try again.",
    };
  }

  const sessionId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const tracked = memoryTrack(userId, sessionId);

  logger.debug("ai", "chat_acquired", `AI chat started for user ${userId}`, {
    userId,
    currentPerUser: tracked.current,
    currentGlobal: globalActiveCount,
  });

  return {
    allowed: true,
    currentPerUser: tracked.current,
    currentGlobal: globalActiveCount,
    maxPerUser: perUserMax,
    maxGlobal: globalMax,
  };
}

/**
 * Release an AI chat session when the conversation ends.
 */
export async function releaseAIChat(userId: string): Promise<void> {
  memoryUntrack(userId, "");
}

/**
 * Get current AI chat stats for monitoring.
 */
export async function getAIChatStats(): Promise<{
  totalActive: number;
  topUsers: Array<{ userId: string; count: number }>;
  providerGates: Record<string, { active: number; queued: number; max: number }>;
}> {
  const topUsers = Array.from(memoryTracker.entries())
    .map(([userId, sessions]) => ({ userId, count: sessions.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const { allGateStats } = await import("@/lib/ai/engine/concurrency-gate");
  const providerGates = allGateStats();

  return {
    totalActive: globalActiveCount,
    topUsers,
    providerGates,
  };
}

// ─── Provider gate singleton ──────────────────────────────────────────────────

export function getAIGate(maxConcurrent?: number): ConcurrencyGate {
  return getGate("groqPro", maxConcurrent ?? DEFAULT_GLOBAL_MAX);
}
