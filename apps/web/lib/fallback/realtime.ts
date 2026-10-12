// ═══════════════════════════════════════════════════════════════════════════════
// Fallback: Realtime — polling when Supabase Realtime disconnects
// ═══════════════════════════════════════════════════════════════════════════════
// When the Supabase Realtime WebSocket disconnects (network issues, server
// restart, etc.), this module provides a polling fallback that checks for
// updates at a configurable interval (default 5s).
//
// Usage:
//   import { withRealtimeFallback } from "@/lib/fallback/realtime";
//
//   const data = await withRealtimeFallback(
//     () => subscribeToChannel("messages", callback),
//     () => fetchLatestMessages(),
//     { pollIntervalMs: 5000 }
//   );
// ═══════════════════════════════════════════════════════════════════════════════

import { logger } from "@/lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RealtimeFallbackOptions {
  /** Poll interval in ms when fallback is active. Default: 5000 */
  pollIntervalMs?: number;
  /** Max consecutive poll failures before stopping. Default: 10 */
  maxPollFailures?: number;
  /** Called when switching to polling mode */
  onFallbackStart?: () => void;
  /** Called when Realtime reconnects */
  onFallbackStop?: () => void;
  /** AbortSignal to stop the fallback */
  signal?: AbortSignal;
}

export interface RealtimeFallbackState {
  mode: "realtime" | "polling" | "stopped";
  pollCount: number;
  lastPollAt: string | null;
  consecutiveFailures: number;
  totalFallbackDuration: number;
}

// ─── State ────────────────────────────────────────────────────────────────────

let currentState: RealtimeFallbackState = {
  mode: "realtime",
  pollCount: 0,
  lastPollAt: null,
  consecutiveFailures: 0,
  totalFallbackDuration: 0,
};

let fallbackStartTime: number | null = null;

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * Wrap a realtime subscription with a polling fallback.
 *
 * @param subscribeFn - The realtime subscription function
 * @param pollFn - The polling function to call when realtime is down
 * @param options - Configuration options
 * @returns A handle to stop the fallback
 */
export function withRealtimeFallback<T>(
  subscribeFn: () => { unsubscribe: () => void } | Promise<{ unsubscribe: () => void }>,
  pollFn: () => Promise<T>,
  options?: RealtimeFallbackOptions,
): { stop: () => void; getState: () => RealtimeFallbackState } {
  const {
    pollIntervalMs = 5000,
    maxPollFailures = 10,
    onFallbackStart,
    onFallbackStop,
    signal,
  } = options ?? {};

  let stopped = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let subscription: { unsubscribe: () => void } | null = null;

  // Reset state
  currentState = {
    mode: "realtime",
    pollCount: 0,
    lastPollAt: null,
    consecutiveFailures: 0,
    totalFallbackDuration: 0,
  };

  const startPolling = () => {
    if (stopped || pollTimer) return;

    currentState.mode = "polling";
    fallbackStartTime = Date.now();
    onFallbackStart?.();

    logger.warn("realtime", "fallback_polling", "Switching to polling mode", {
      pollIntervalMs,
    });

    pollTimer = setInterval(async () => {
      if (stopped) return;

      try {
        await pollFn();
        currentState.pollCount++;
        currentState.lastPollAt = new Date().toISOString();
        currentState.consecutiveFailures = 0;
      } catch (err) {
        currentState.consecutiveFailures++;
        logger.warn("realtime", "poll_failed", `Poll failed (${currentState.consecutiveFailures}/${maxPollFailures})`, {
          error: err instanceof Error ? err.message : String(err),
        });

        if (currentState.consecutiveFailures >= maxPollFailures) {
          logger.error("realtime", "poll_exhausted", `Max poll failures reached, stopping`);
          stop();
        }
      }
    }, pollIntervalMs);
  };

  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (fallbackStartTime) {
      currentState.totalFallbackDuration += Date.now() - fallbackStartTime;
      fallbackStartTime = null;
    }
    currentState.mode = stopped ? "stopped" : "realtime";
    onFallbackStop?.();
  };

  const stop = () => {
    stopped = true;
    stopPolling();
    subscription?.unsubscribe();
    currentState.mode = "stopped";
  };

  // Wire up abort signal
  signal?.addEventListener("abort", () => stop());

  // Start the realtime subscription
  const startResult = subscribeFn();

  if (startResult instanceof Promise) {
    startResult
      .then((sub) => {
        subscription = sub;
      })
      .catch(() => {
        // Subscription failed — switch to polling immediately
        startPolling();
      });
  } else {
    subscription = startResult;
  }

  return {
    stop,
    getState: () => ({ ...currentState }),
  };
}

/**
 * Check if the realtime connection is currently in fallback mode.
 */
export function isRealtimeFallbackActive(): boolean {
  return currentState.mode === "polling";
}

/**
 * Get the current fallback state for monitoring.
 */
export function getRealtimeFallbackState(): RealtimeFallbackState {
  return { ...currentState };
}

/**
 * Manually trigger fallback mode (e.g., when a disconnect event is detected).
 */
export function triggerFallback(
  pollFn: () => Promise<unknown>,
  options?: RealtimeFallbackOptions,
): void {
  const { pollIntervalMs = 5000, onFallbackStart } = options ?? {};

  if (currentState.mode === "polling") return; // Already polling

  currentState.mode = "polling";
  fallbackStartTime = Date.now();
  onFallbackStart?.();

  logger.warn("realtime", "manual_fallback", "Manually triggered polling fallback");

  const timer = setInterval(async () => {
    if (currentState.mode !== "polling") {
      clearInterval(timer);
      return;
    }
    try {
      await pollFn();
      currentState.pollCount++;
      currentState.lastPollAt = new Date().toISOString();
      currentState.consecutiveFailures = 0;
    } catch {
      currentState.consecutiveFailures++;
    }
  }, pollIntervalMs);
}
