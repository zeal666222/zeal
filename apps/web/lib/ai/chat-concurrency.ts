// ═══════════════════════════════════════════════════════════════════════════════
// AI Chat Concurrency — Enhanced gate with per-user + global limits
// ═══════════════════════════════════════════════════════════════════════════════
// Extends the existing ConcurrencyGate (per-provider semaphore) with:
//   - Per-user limit: max 5 concurrent AI chats per user
//   - Global limit: max 100 concurrent AI chats platform-wide
//
// Uses Postgres AIChatSession table (migration 1205) for cross-instance
// tracking. Falls back to in-memory tracking if DB is unreachable.
// ═══════════════════════════════════════════════════════════════════════════════

import { createAdminClient } from "@zeal/database/server";
import { logger } from "@/lib/logger";
import { ConcurrencyGate, getGate } from "@/lib/ai/engine/concurrency-gate";

// ─── Configuration ────────────────────────────────────────────────────────────

const DEFAULT_PER_USER_MAX = parseInt(process.env.AI_CHAT_PER_USER_MAX ?? "50", 10);
const DEFAULT_GLOBAL_MAX = parseInt(process.env.AI_CHAT_GLOBAL_MAX ?? "2000", 10);

// ─── In-memory fallback tracker ───────────────────────────────────────────────
// Used when Postgres is unreachable. Less accurate (per-instance only) but
// prevents total failure.

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
 * Checks both per-user and global limits.
 *
 * @param userId - The user starting the chat
 * @param options - Override defaults for max concurrent chats
 */
export async function tryAcquireAIChat(
  userId: string,
  options?: { perUserMax?: number; globalMax?: number },
): Promise<AIChatAcquireResult> {
  const perUserMax = options?.perUserMax ?? DEFAULT_PER_USER_MAX;
  const globalMax = options?.globalMax ?? DEFAULT_GLOBAL_MAX;

  try {
    const admin = createAdminClient();

    // Check per-user limit
    const { data: userData, error: userErr } = await admin.rpc("try_start_ai_chat", {
      p_user_id: userId,
      p_max_concurrent: perUserMax,
    });

    if (userErr) {
      throw new Error(userErr.message);
    }

    const userResult = userData as { allowed?: boolean; current?: number; max?: number } | null;

    if (userResult?.allowed === false) {
      return {
        allowed: false,
        currentPerUser: userResult.current,
        maxPerUser: perUserMax,
        maxGlobal: globalMax,
        error: `Too many concurrent chats. Max ${perUserMax} per user.`,
      };
    }

    // Check global limit
    const { data: statsData } = await admin.rpc("get_ai_chat_stats");
    const stats = statsData as { totalActive?: number } | null;
    const globalActive = stats?.totalActive ?? 0;

    if (globalActive >= globalMax) {
      // Roll back the per-user increment
      await admin.rpc("end_ai_chat_session", { p_user_id: userId });

      return {
        allowed: false,
        currentGlobal: globalActive,
        maxPerUser: perUserMax,
        maxGlobal: globalMax,
        error: "Platform is at capacity. Please try again in a moment.",
      };
    }

    logger.debug("ai", "chat_acquired", `AI chat started for user ${userId}`, {
      userId,
      currentPerUser: userResult?.current,
      currentGlobal: globalActive,
    });

    return {
      allowed: true,
      currentPerUser: userResult?.current,
      currentGlobal: globalActive,
      maxPerUser: perUserMax,
      maxGlobal: globalMax,
    };
  } catch (err) {
    // DB unreachable — fall back to in-memory tracking
    logger.warn("ai", "chat_acquire_fallback", "DB unreachable, using in-memory tracker", {
      error: err instanceof Error ? err.message : String(err),
    });

    const check = memoryCheck(userId, perUserMax);
    if (!check.allowed) {
      return {
        allowed: false,
        currentPerUser: check.current,
        maxPerUser: perUserMax,
        maxGlobal: globalMax,
        error: `Too many concurrent chats (fallback). Max ${perUserMax} per user.`,
      };
    }

    if (globalActiveCount >= globalMax) {
      return {
        allowed: false,
        currentGlobal: globalActiveCount,
        maxPerUser: perUserMax,
        maxGlobal: globalMax,
        error: "Platform at capacity (fallback). Please try again.",
      };
    }

    const sessionId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    memoryTrack(userId, sessionId);

    return {
      allowed: true,
      currentPerUser: check.current + 1,
      currentGlobal: globalActiveCount,
      maxPerUser: perUserMax,
      maxGlobal: globalMax,
    };
  }
}

/**
 * Release an AI chat session when the conversation ends.
 */
export async function releaseAIChat(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.rpc("end_ai_chat_session", { p_user_id: userId });
  } catch {
    // Fall back to memory
    memoryUntrack(userId, "");
  }
}

/**
 * Get current AI chat stats for monitoring.
 */
export async function getAIChatStats(): Promise<{
  totalActive: number;
  topUsers: Array<{ userId: string; count: number }>;
  providerGates: Record<string, { active: number; queued: number; max: number }>;
}> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.rpc("get_ai_chat_stats");
    const stats = data as { totalActive?: number; topUsers?: Array<{ userId: string; count: number }> } | null;

    // Also include provider gate stats
    const { allGateStats } = await import("@/lib/ai/engine/concurrency-gate");
    const providerGates = allGateStats();

    return {
      totalActive: stats?.totalActive ?? 0,
      topUsers: stats?.topUsers ?? [],
      providerGates,
    };
  } catch {
    return {
      totalActive: globalActiveCount,
      topUsers: [],
      providerGates: {},
    };
  }
}

// ─── Provider gate singleton ──────────────────────────────────────────────────
// The existing ConcurrencyGate handles per-provider limits. This is a
// convenience accessor for the AI-specific gate.

export function getAIGate(maxConcurrent?: number): ConcurrencyGate {
  return getGate("groqPro", maxConcurrent ?? DEFAULT_GLOBAL_MAX);
}
