// ═══════════════════════════════════════════════════════════════════════════════
// Wallet Concurrency — Optimistic Locking + Advisory Locks
// ═══════════════════════════════════════════════════════════════════════════════
// Money-critical concurrency controls for billing operations.
//
// 1. Optimistic Locking (version column):
//    Wallet table gets a `version` column. Every UPDATE increments version.
//    UPDATE ... WHERE id = $1 AND version = $2. If 0 rows updated, another
//    transaction modified the wallet — retry.
//
// 2. Advisory Locks (pg_advisory_lock):
//    For session heartbeats, acquire a per-session advisory lock before
//    processing. Prevents concurrent heartbeats for the same session from
//    double-billing.
//
// Both are Postgres-native — no Redis dependency.
// ═══════════════════════════════════════════════════════════════════════════════

import { createAdminClient } from "@zeal/database/server";
import { logger } from "@/lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WalletBalance {
  balance: number;
  escrow: number;
  pendingIn: number;
  pendingOut: number;
  blocked: number;
  version: number;
}

export interface DebitResult {
  success: boolean;
  newBalance?: number;
  error?: string;
  retries?: number;
}

export interface LockResult<T> {
  success: boolean;
  result?: T;
  error?: string;
  /** Whether the lock was acquired (false = another process held it) */
  acquired: boolean;
}

// ─── Optimistic Locking — Wallet Debit ────────────────────────────────────────

const MAX_OPTIMISTIC_RETRIES = 5;

/**
 * Atomically debit a wallet with optimistic locking.
 *
 * Uses the `version` column to detect concurrent modifications.
 * If another transaction modified the wallet between our read and write,
 * the WHERE clause matches 0 rows and we retry.
 *
 * @param userId - The user whose wallet to debit
 * @param amount - Amount to debit (positive number)
 * @param description - Ledger description
 * @param referenceId - Unique reference for idempotency
 */
export async function debitWalletOptimistic(
  userId: string,
  amount: number,
  description: string,
  referenceId: string,
): Promise<DebitResult> {
  const admin = createAdminClient();

  for (let attempt = 0; attempt < MAX_OPTIMISTIC_RETRIES; attempt++) {
    // 1. Read current state
    const { data: wallet, error: readErr } = await admin
      .from("Wallet")
      .select('balance, version')
      .eq("userId", userId)
      .maybeSingle();

    if (readErr || !wallet) {
      return {
        success: false,
        error: readErr?.message ?? "Wallet not found",
        retries: attempt,
      };
    }

    const w = wallet as { balance: number; version: number };

    if (Number(w.balance) < amount) {
      return {
        success: false,
        error: "Insufficient balance",
        retries: attempt,
      };
    }

    // 2. Attempt update with version check
    const { data: updated, error: updateErr } = await admin.rpc(
      "debit_wallet_versioned",
      {
        p_user_id: userId,
        p_amount: amount,
        p_version: w.version,
        p_description: description,
        p_reference_id: referenceId,
      },
    );

    if (updateErr) {
      return {
        success: false,
        error: updateErr.message,
        retries: attempt,
      };
    }

    const result = updated as { success?: boolean; new_balance?: number; conflict?: boolean } | null;

    if (result?.success === false && result.conflict) {
      // Version conflict — another transaction modified the wallet. Retry.
      logger.debug("wallet", "optimistic_lock_conflict", `Retry ${attempt + 1}/${MAX_OPTIMISTIC_RETRIES}`, {
        userId,
        amount,
        attempt: attempt + 1,
      });
      // Brief backoff before retry
      await new Promise((r) => setTimeout(r, 10 * Math.pow(2, attempt)));
      continue;
    }

    if (result?.success === false) {
      return {
        success: false,
        error: result.new_balance !== undefined ? "Insufficient balance" : "Debit failed",
        retries: attempt,
      };
    }

    return {
      success: true,
      newBalance: Number(result?.new_balance ?? 0),
      retries: attempt,
    };
  }

  return {
    success: false,
    error: `Optimistic lock retries exhausted (${MAX_OPTIMISTIC_RETRIES})`,
    retries: MAX_OPTIMISTIC_RETRIES,
  };
}

/**
 * Atomically credit a wallet with optimistic locking.
 */
export async function creditWalletOptimistic(
  userId: string,
  amount: number,
  description: string,
  referenceId: string,
): Promise<DebitResult> {
  const admin = createAdminClient();

  for (let attempt = 0; attempt < MAX_OPTIMISTIC_RETRIES; attempt++) {
    const { data: wallet } = await admin
      .from("Wallet")
      .select("version")
      .eq("userId", userId)
      .maybeSingle();

    if (!wallet) {
      return { success: false, error: "Wallet not found", retries: attempt };
    }

    const w = wallet as { version: number };

    const { data: result, error } = await admin.rpc("credit_wallet_versioned", {
      p_user_id: userId,
      p_amount: amount,
      p_version: w.version,
      p_description: description,
      p_reference_id: referenceId,
    });

    if (error) {
      return { success: false, error: error.message, retries: attempt };
    }

    const r = result as { success?: boolean; new_balance?: number; conflict?: boolean } | null;

    if (r?.success === false && r.conflict) {
      await new Promise((res) => setTimeout(res, 10 * Math.pow(2, attempt)));
      continue;
    }

    if (r?.success === false) {
      return { success: false, error: "Credit failed", retries: attempt };
    }

    return {
      success: true,
      newBalance: Number(r?.new_balance ?? 0),
      retries: attempt,
    };
  }

  return {
    success: false,
    error: `Optimistic lock retries exhausted (${MAX_OPTIMISTIC_RETRIES})`,
    retries: MAX_OPTIMISTIC_RETRIES,
  };
}

// ─── Advisory Locks — Session Heartbeat ───────────────────────────────────────

/**
 * Execute an operation with a Postgres advisory lock.
 *
 * Advisory locks are application-level locks managed by Postgres. They're
 * perfect for preventing concurrent heartbeats for the same session — two
 * heartbeat requests for the same session will serialize, not double-bill.
 *
 * Uses pg_try_advisory_lock (non-blocking) to avoid holding DB connections
 * while waiting. If the lock is held, returns immediately with acquired=false.
 *
 * @param lockKey - A string key (hashed to int by Postgres)
 * @param operation - The async operation to execute while holding the lock
 * @param timeoutMs - Max time to wait for lock (default: 5000ms)
 */
export async function withAdvisoryLock<T>(
  lockKey: string,
  operation: () => Promise<T>,
  timeoutMs = 5000,
): Promise<LockResult<T>> {
  const admin = createAdminClient();

  // Try to acquire the lock (non-blocking)
  const { data: lockData, error: lockErr } = await admin.rpc(
    "try_advisory_lock",
    { p_key: lockKey },
  );

  if (lockErr) {
    return {
      success: false,
      acquired: false,
      error: `Lock acquisition failed: ${lockErr.message}`,
    };
  }

  const locked = (lockData as { locked?: boolean } | null)?.locked ?? false;

  if (!locked) {
    // Lock is held by another process. Wait and retry once.
    await new Promise((r) => setTimeout(r, Math.min(timeoutMs, 1000)));

    const { data: retryData } = await admin.rpc("try_advisory_lock", {
      p_key: lockKey,
    });
    const retryLocked = (retryData as { locked?: boolean } | null)?.locked ?? false;

    if (!retryLocked) {
      return {
        success: false,
        acquired: false,
        error: `Lock held by another process: ${lockKey}`,
      };
    }
  }

  try {
    const result = await operation();
    return { success: true, acquired: true, result };
  } catch (err) {
    return {
      success: false,
      acquired: true,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    // Always release the lock
    await admin.rpc("advisory_unlock", { p_key: lockKey });
  }
}

/**
 * Wrap a heartbeat call with an advisory lock to prevent concurrent processing.
 */
export async function withSessionLock<T>(
  sessionId: string,
  operation: () => Promise<T>,
): Promise<LockResult<T>> {
  const lockKey = `session:heartbeat:${sessionId}`;
  return withAdvisoryLock(lockKey, operation);
}
