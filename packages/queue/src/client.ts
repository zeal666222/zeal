// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/queue — Postgres-backed job queue client
// ═══════════════════════════════════════════════════════════════════════════════
// Lightweight async job queue using Postgres as the backing store.
// No Redis dependency. Jobs are rows in the JobQueue table, claimed atomically
// via dequeue_jobs RPC (UPDATE ... RETURNING with FOR UPDATE SKIP LOCKED).
//
// Usage:
//   import { JobQueueClient } from "@zeal/queue";
//   const queue = new JobQueueClient();
//   await queue.enqueue("send-email", { to: "user@example.com", subject: "Hi" });
//   queue.process("send-email", async (job) => { await sendEmail(job.payload); });
// ═══════════════════════════════════════════════════════════════════════════════

import { createAdminClient } from "@zeal/database/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface Job<T = Record<string, unknown>> {
  id: string;
  type: string;
  payload: T;
  status: JobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnqueueOptions {
  /** Higher = more urgent. Default 0. */
  priority?: number;
  /** When to run the job. Default now(). */
  scheduledAt?: Date;
  /** Max retry attempts. Default 3. */
  maxAttempts?: number;
}

export interface ProcessOptions {
  /** Poll interval in ms. Default 5000. */
  pollInterval?: number;
  /** Max jobs to claim per poll. Default 10. */
  batchSize?: number;
  /** Signal to stop processing. */
  signal?: AbortSignal;
}

export type JobHandler<T = Record<string, unknown>> = (
  job: Job<T>,
) => Promise<void>;

interface WorkerHandle {
  stop: () => void;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class JobQueueClient {
  private admin: ReturnType<typeof createAdminClient>;

  constructor() {
    this.admin = createAdminClient();
  }

  /**
   * Enqueue a new job.
   */
  async enqueue<T extends Record<string, unknown>>(
    type: string,
    payload: T,
    options?: EnqueueOptions,
  ): Promise<string> {
    const { priority = 0, scheduledAt, maxAttempts = 3 } = options ?? {};

    const { data, error } = await this.admin
      .from("JobQueue")
      .insert({
        type,
        payload: payload as Record<string, unknown>,
        priority,
        maxAttempts,
        scheduledAt: scheduledAt?.toISOString() ?? new Date().toISOString(),
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      throw new JobQueueError(`Failed to enqueue job: ${error.message}`, type);
    }

    return (data as { id: string }).id;
  }

  /**
   * Atomically claim pending jobs for processing.
   */
  async dequeue<T = Record<string, unknown>>(
    type: string,
    batchSize = 10,
  ): Promise<Job<T>[]> {
    const { data, error } = await this.admin.rpc("dequeue_jobs", {
      p_type: type,
      p_batch_size: batchSize,
    });

    if (error) {
      throw new JobQueueError(`Failed to dequeue jobs: ${error.message}`, type);
    }

    return (data as Job<T>[]) ?? [];
  }

  /**
   * Mark a job as completed.
   */
  async complete(jobId: string): Promise<boolean> {
    const { data, error } = await this.admin.rpc("complete_job", {
      p_job_id: jobId,
    });

    if (error) {
      throw new JobQueueError(`Failed to complete job: ${error.message}`);
    }

    return Boolean(data);
  }

  /**
   * Mark a job as failed. If attempts < maxAttempts, it will be retried.
   */
  async fail(jobId: string, errorMsg: string): Promise<boolean> {
    const { data, error } = await this.admin.rpc("fail_job", {
      p_job_id: jobId,
      p_error_msg: errorMsg,
    });

    if (error) {
      throw new JobQueueError(`Failed to fail job: ${error.message}`);
    }

    return Boolean(data);
  }

  /**
   * Start a worker that polls for jobs of the given type and processes them.
   * Returns a handle with a stop() method.
   */
  process<T = Record<string, unknown>>(
    type: string,
    handler: JobHandler<T>,
    options?: ProcessOptions,
  ): WorkerHandle {
    const {
      pollInterval = 5000,
      batchSize = 10,
      signal,
    } = options ?? {};

    let stopped = false;
    const abortController = new AbortController();

    // If external signal is provided, wire it up
    if (signal) {
      signal.addEventListener("abort", () => {
        stopped = true;
        abortController.abort();
      });
    }

    const loop = async (): Promise<void> => {
      while (!stopped && !abortController.signal.aborted) {
        try {
          const jobs = await this.dequeue<T>(type, batchSize);

          if (jobs.length === 0) {
            // No jobs — wait before polling again
            await sleep(pollInterval, abortController.signal);
            continue;
          }

          // Process jobs concurrently (up to batchSize)
          const promises = jobs.map(async (job) => {
            try {
              await handler(job);
              await this.complete(job.id);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(`[queue] Job ${job.id} failed:`, msg);
              await this.fail(job.id, msg);
            }
          });

          await Promise.allSettled(promises);

          // Brief pause between batches to avoid hammering the DB
          if (!stopped) {
            await sleep(Math.min(pollInterval, 1000), abortController.signal);
          }
        } catch (err) {
          if (abortController.signal.aborted) break;
          console.error(`[queue] Worker loop error for type "${type}":`, err);
          // Back off on error
          await sleep(pollInterval * 2, abortController.signal);
        }
      }
    };

    // Start the loop (fire-and-forget)
    void loop();

    return {
      stop: () => {
        stopped = true;
        abortController.abort();
      },
    };
  }

  /**
   * Get queue stats for a given type.
   */
  async stats(type?: string): Promise<QueueStats> {
    let query = this.admin.from("JobQueue").select("status", { count: "exact", head: true });

    if (type) {
      query = query.eq("type", type);
    }

    const { count, error } = await query;
    if (error) {
      throw new JobQueueError(`Failed to get queue stats: ${error.message}`);
    }

    // Get breakdown by status
    const statusCounts: Record<JobStatus, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    for (const status of Object.keys(statusCounts) as JobStatus[]) {
      let sq = this.admin
        .from("JobQueue")
        .select("id", { count: "exact", head: true })
        .eq("status", status);

      if (type) {
        sq = sq.eq("type", type);
      }

      const { count: sc } = await sq;
      statusCounts[status] = sc ?? 0;
    }

    return { total: count ?? 0, ...statusCounts };
  }

  /**
   * Clean up old completed jobs.
   */
  async cleanupCompleted(olderThanDays = 7): Promise<number> {
    const { data, error } = await this.admin.rpc("cleanup_completed_jobs", {
      p_older_than_days: olderThanDays,
    });

    if (error) {
      throw new JobQueueError(`Failed to cleanup: ${error.message}`);
    }

    return Number(data ?? 0);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export class JobQueueError extends Error {
  constructor(
    message: string,
    public readonly jobType?: string,
  ) {
    super(message);
    this.name = "JobQueueError";
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
