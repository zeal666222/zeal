-- ═══════════════════════════════════════════════════════════════════════════════
-- 1204 — Postgres-backed job queue
-- ═══════════════════════════════════════════════════════════════════════════════
-- Lightweight async job queue using Postgres as the backing store. No Redis
-- dependency. Suitable for emails, notifications, reports, payouts, etc.
--
-- Design:
--   • Jobs are rows in JobQueue with status lifecycle:
--       pending → processing → completed
--                          ↘ failed (retryable → pending, terminal → failed)
--   • dequeue_jobs atomically claims pending jobs via UPDATE...RETURNING
--     with status='pending' AND scheduledAt <= now()
--   • RLS: only service role can access (no user-facing rows)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "JobQueue" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "type"          TEXT NOT NULL,
  "payload"       JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status"        TEXT NOT NULL DEFAULT 'pending'
                    CHECK ("status" IN ('pending', 'processing', 'completed', 'failed')),
  "priority"      INTEGER NOT NULL DEFAULT 0,
  "attempts"      INTEGER NOT NULL DEFAULT 0,
  "maxAttempts"   INTEGER NOT NULL DEFAULT 3,
  "scheduledAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "startedAt"     TIMESTAMPTZ,
  "completedAt"   TIMESTAMPTZ,
  "error"         TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- Primary dequeue path: find pending jobs that are ready to run, ordered by
-- priority (desc) then scheduled time (asc) for FIFO within same priority.
CREATE INDEX IF NOT EXISTS "idx_jobqueue_dequeue"
  ON "JobQueue" ("status", "scheduledAt")
  WHERE "status" = 'pending';

-- Worker management: find all jobs of a given type currently processing.
CREATE INDEX IF NOT EXISTS "idx_jobqueue_type_status"
  ON "JobQueue" ("type", "status");

-- Cleanup / analytics: find completed jobs older than N days.
CREATE INDEX IF NOT EXISTS "idx_jobqueue_completed"
  ON "JobQueue" ("completedAt")
  WHERE "status" = 'completed';

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE "JobQueue" ENABLE ROW LEVEL SECURITY;

-- Service role gets full access. No user-facing policies — this is purely
-- server-side infrastructure.
DROP POLICY IF EXISTS "service_role_full_access" ON "JobQueue";
CREATE POLICY "service_role_full_access" ON "JobQueue"
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─── dequeue_jobs(type, batch_size) ──────────────────────────────────────────
-- Atomically claims up to batch_size pending jobs for the given type.
-- Uses SELECT ... FOR UPDATE SKIP LOCKED to avoid contention between workers.
-- Returns claimed rows with status set to 'processing' and startedAt = now().
CREATE OR REPLACE FUNCTION dequeue_jobs(
  p_type TEXT,
  p_batch_size INTEGER DEFAULT 10
)
RETURNS SETOF "JobQueue"
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE "JobQueue"
  SET "status"    = 'processing',
      "startedAt" = now(),
      "updatedAt" = now()
  WHERE "id" IN (
    SELECT "id"
    FROM "JobQueue"
    WHERE "type" = p_type
      AND "status" = 'pending'
      AND "scheduledAt" <= now()
    ORDER BY "priority" DESC, "scheduledAt" ASC
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- ─── complete_job(job_id) ────────────────────────────────────────────────────
-- Marks a job as completed. Idempotent — no-op if already completed.
CREATE OR REPLACE FUNCTION complete_job(
  p_job_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  UPDATE "JobQueue"
  SET "status"      = 'completed',
      "completedAt" = now(),
      "updatedAt"   = now()
  WHERE "id" = p_job_id
    AND "status" = 'processing';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- ─── fail_job(job_id, error_msg) ─────────────────────────────────────────────
-- Records a failure. If attempts < maxAttempts, resets to 'pending' for retry
-- with exponential backoff on scheduledAt. Otherwise marks as terminal 'failed'.
CREATE OR REPLACE FUNCTION fail_job(
  p_job_id UUID,
  p_error_msg TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_attempts INTEGER;
  v_max_attempts INTEGER;
BEGIN
  UPDATE "JobQueue"
  SET "attempts"  = "attempts" + 1,
      "error"     = p_error_msg,
      "updatedAt" = now()
  WHERE "id" = p_job_id
  RETURNING "attempts", "maxAttempts"
  INTO v_attempts, v_max_attempts;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_attempts >= v_max_attempts THEN
    -- Terminal failure — no more retries
    UPDATE "JobQueue"
    SET "status"    = 'failed',
        "updatedAt" = now()
    WHERE "id" = p_job_id;
  ELSE
    -- Retry: reset to pending with exponential backoff
    -- Backoff: 10s, 40s, 160s, ... (10 * 4^(attempt-1))
    UPDATE "JobQueue"
    SET "status"      = 'pending',
        "startedAt"   = NULL,
        "scheduledAt" = now() + (interval '10 seconds' * power(4, v_attempts - 1)),
        "updatedAt"   = now()
    WHERE "id" = p_job_id;
  END IF;

  RETURN TRUE;
END;
$$;

-- ─── cleanup_completed_jobs(older_than_days) ─────────────────────────────────
-- Housekeeping: delete completed jobs older than N days. Called by cron.
CREATE OR REPLACE FUNCTION cleanup_completed_jobs(
  p_older_than_days INTEGER DEFAULT 7
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM "JobQueue"
    WHERE "status" = 'completed'
      AND "completedAt" < now() - (p_older_than_days || ' days')::interval
    RETURNING "id"
  )
  SELECT count(*) INTO v_deleted FROM deleted;

  RETURN v_deleted;
END;
$$;

-- ─── updated_at trigger ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION jobqueue_updated_at_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_jobqueue_updated_at" ON "JobQueue";
CREATE TRIGGER "trg_jobqueue_updated_at"
  BEFORE UPDATE ON "JobQueue"
  FOR EACH ROW
  EXECUTE FUNCTION jobqueue_updated_at_trigger();
