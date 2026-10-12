// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/queue — Postgres-backed job queue
// ═══════════════════════════════════════════════════════════════════════════════
// Barrel exports. Import from "@zeal/queue" in application code.
// ═══════════════════════════════════════════════════════════════════════════════

export {
  JobQueueClient,
  JobQueueError,
  type Job,
  type JobStatus,
  type EnqueueOptions,
  type ProcessOptions,
  type JobHandler,
  type QueueStats,
} from "./client";
