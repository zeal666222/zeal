-- ═══════════════════════════════════════════════════════════════════════════════
-- 1207 — Billing upgrade: rate lock, heartbeat tracking, stale session cleanup
-- ═══════════════════════════════════════════════════════════════════════════════
-- Adds:
--   1. `lockedRate` column to CallSession — rate locked at session start
--   2. `lastHeartbeatAt` column to CallSession — tracks last heartbeat time
--   3. cleanup_stale_sessions() — auto-ends sessions with no heartbeat for 5 min
--   4. resume_session() — reconnects to an active session after network drop
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Add lockedRate column ────────────────────────────────────────────────
-- Stores the per-minute rate at session start. Heartbeat and end use this
-- instead of re-resolving from Consultant/AIConsultant tables.
ALTER TABLE "CallSession" ADD COLUMN IF NOT EXISTS "lockedRate" DOUBLE PRECISION;

-- ─── 2. Add lastHeartbeatAt column ───────────────────────────────────────────
-- Updated on every heartbeat. Used by cleanup_stale_sessions() to detect
-- sessions where the client disappeared (tab close, network drop).
ALTER TABLE "CallSession" ADD COLUMN IF NOT EXISTS "lastHeartbeatAt" TIMESTAMPTZ;

-- Set lastHeartbeatAt = startTime for existing active sessions
UPDATE "CallSession"
SET "lastHeartbeatAt" = "startTime"::timestamptz
WHERE "status" = 'CONNECTED' AND "lastHeartbeatAt" IS NULL;

-- ─── 3. Index for stale session cleanup ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS "idx_callsession_active"
ON "CallSession" ("status", "lastHeartbeatAt")
WHERE "status" = 'CONNECTED';

-- ─── 4. cleanup_stale_sessions ───────────────────────────────────────────────
-- Auto-ends sessions that haven't received a heartbeat in p_stale_minutes.
-- Called by cron or manually. Returns count of ended sessions.
-- Bills for elapsed time up to the stale threshold, then ends.
CREATE OR REPLACE FUNCTION cleanup_stale_sessions(
  p_stale_minutes INTEGER DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_ended INTEGER := 0;
  v_session RECORD;
BEGIN
  v_cutoff := now() - (p_stale_minutes || ' minutes')::interval;

  FOR v_session IN
    SELECT "id", "userId", "startTime", "durationSeconds", "lockedRate", "amount"
    FROM "public"."CallSession"
    WHERE "status" = 'CONNECTED'
      AND "lastHeartbeatAt" < v_cutoff
  LOOP
    -- Calculate final duration up to the cutoff (not now — user was gone)
    DECLARE
      v_start_ms BIGINT;
      v_cutoff_ms BIGINT;
      v_duration_secs INTEGER;
      v_duration_mins INTEGER;
      v_rate DOUBLE PRECISION;
      v_total_cost DOUBLE PRECISION;
      v_held DOUBLE PRECISION;
    BEGIN
      v_start_ms := (EXTRACT(EPOCH FROM v_session."startTime"::timestamptz) * 1000)::BIGINT;
      v_cutoff_ms := (EXTRACT(EPOCH FROM v_cutoff) * 1000)::BIGINT;
      v_duration_secs := ((v_cutoff_ms - v_start_ms) / 1000)::INTEGER;
      v_duration_mins := CEIL(v_duration_secs::DOUBLE PRECISION / 60.0);
      v_rate := COALESCE(v_session."lockedRate", 0);
      v_total_cost := v_duration_mins * v_rate;
      v_held := COALESCE(v_session."amount", 0);

      UPDATE "public"."CallSession"
      SET "status" = 'ENDED',
          "endTime" = v_cutoff::text,
          "durationSeconds" = v_duration_secs,
          "amount" = v_total_cost
      WHERE "id" = v_session."id";

      -- Release escrow if held
      IF v_held > 0 THEN
        PERFORM "public"."release_session_escrow"(
          v_session."id",
          v_held,
          v_total_cost
        );
      END IF;

      v_ended := v_ended + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'ended', v_ended);
END;
$$;

-- ─── 5. resume_session ──────────────────────────────────────────────────────
-- Called when a user reconnects to an active session (e.g., tab reopen).
-- Returns the session if it's still active and belongs to the user.
-- Updates lastHeartbeatAt to now so the cleanup doesn't kill it.
CREATE OR REPLACE FUNCTION resume_session(
  p_user_id UUID,
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session RECORD;
BEGIN
  SELECT "id", "userId", "status", "lockedRate", "startTime", "durationSeconds", "consultantId", "aiConsultantId", "isAI", "conversationId"
  INTO v_session
  FROM "public"."CallSession"
  WHERE "id" = p_session_id
    AND "userId" = p_user_id;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found');
  END IF;

  IF v_session."status" = 'ENDED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session already ended', 'ended', true);
  END IF;

  -- Check if session is too old (> 4 hours)
  DECLARE
    v_start_ms BIGINT;
    v_now_ms BIGINT;
    v_elapsed_mins INTEGER;
  BEGIN
    v_start_ms := (EXTRACT(EPOCH FROM v_session."startTime"::timestamptz) * 1000)::BIGINT;
    v_now_ms := (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT;
    v_elapsed_mins := ((v_now_ms - v_start_ms) / 60000)::INTEGER;

    IF v_elapsed_mins > 240 THEN
      -- Auto-end the stale session
      UPDATE "public"."CallSession"
      SET "status" = 'ENDED',
          "endTime" = now()::text,
          "durationSeconds" = v_elapsed_mins * 60
      WHERE "id" = p_session_id;
      RETURN jsonb_build_object('success', false, 'error', 'Session expired', 'ended', true);
    END IF;
  END;

  -- Refresh heartbeat timestamp
  UPDATE "public"."CallSession"
  SET "lastHeartbeatAt" = now()
  WHERE "id" = p_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session', jsonb_build_object(
      'id', v_session."id",
      'consultantId', v_session."consultantId",
      'aiConsultantId', v_session."aiConsultantId",
      'isAI', v_session."isAI",
      'lockedRate', v_session."lockedRate",
      'durationSeconds', v_session."durationSeconds",
      'conversationId', v_session."conversationId"
    )
  );
END;
$$;
