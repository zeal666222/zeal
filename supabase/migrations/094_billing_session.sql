-- ═══════════════════════════════════════════════════════════════════════════════
-- 094_billing_session.sql — Enterprise per-minute billing
-- ═══════════════════════════════════════════════════════════════════════════════
-- Adds:
--   • billing_active_session(p_session_id)   — heartbeat lock + elapsed minutes
--   • billing_settle_session(p_session_id)   — final settlement
--
-- Idempotent. Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── billing_active_session ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.billing_active_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session   "CallSession"%ROWTYPE;
  v_elapsed   int;
  v_rate      numeric := 0;
BEGIN
  SELECT * INTO v_session
  FROM "CallSession"
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;

  IF v_session.status = 'ENDED' THEN
    RETURN jsonb_build_object('success', true, 'ended', true, 'elapsed_seconds', v_session."durationSeconds");
  END IF;

  -- Resolve rate
  IF v_session."isAI" AND v_session."aiConsultantId" IS NOT NULL THEN
    SELECT "perMinuteRate" INTO v_rate FROM "AIConsultant" WHERE id = v_session."aiConsultantId";
  ELSIF v_session."consultantId" IS NOT NULL THEN
    SELECT "perMinuteRate" INTO v_rate FROM "Consultant" WHERE id = v_session."consultantId";
  END IF;
  v_rate := COALESCE(v_rate, 0);

  v_elapsed := EXTRACT(EPOCH FROM (now() - v_session."startTime"))::int;

  RETURN jsonb_build_object(
    'success', true,
    'ended', false,
    'elapsed_seconds', v_elapsed,
    'minutes_billed', v_session."durationSeconds" / 60,
    'rate', v_rate,
    'status', v_session.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.billing_active_session(uuid) TO authenticated;

-- ─── billing_settle_session ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.billing_settle_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session   "CallSession"%ROWTYPE;
  v_elapsed   int;
  v_minutes   int;
  v_rate      numeric := 0;
  v_cost      numeric := 0;
  v_fee       numeric := 0;
  v_earning   numeric := 0;
  v_consultant_user text;
BEGIN
  SELECT * INTO v_session
  FROM "CallSession"
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;

  IF v_session.status = 'ENDED' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_ended', true,
      'duration_seconds', v_session."durationSeconds",
      'amount', v_session.amount
    );
  END IF;

  v_elapsed := EXTRACT(EPOCH FROM (now() - v_session."startTime"))::int;
  v_minutes := CEIL(v_elapsed / 60.0)::int;

  -- Rate lookup
  IF v_session."isAI" AND v_session."aiConsultantId" IS NOT NULL THEN
    SELECT "perMinuteRate" INTO v_rate FROM "AIConsultant" WHERE id = v_session."aiConsultantId";
  ELSIF v_session."consultantId" IS NOT NULL THEN
    SELECT "perMinuteRate" INTO v_rate FROM "Consultant" WHERE id = v_session."consultantId";
  END IF;
  v_rate := COALESCE(v_rate, 0);
  v_cost := v_minutes * v_rate;
  v_fee := v_cost * 0.10;
  v_earning := v_cost - v_fee;

  UPDATE "CallSession"
  SET status = 'ENDED',
      "endTime" = now(),
      "durationSeconds" = v_elapsed,
      amount = v_cost,
      "updatedAt" = now()
  WHERE id = p_session_id;

  -- Credit consultant (human only)
  IF NOT v_session."isAI" AND v_earning > 0 AND v_session."consultantId" IS NOT NULL THEN
    SELECT c."userId" INTO v_consultant_user
    FROM "Consultant" c WHERE c.id = v_session."consultantId";

    IF v_consultant_user IS NOT NULL THEN
      PERFORM public.credit_funds_safe(
        v_consultant_user,
        v_earning,
        'Session earning',
        'session-earn:' || p_session_id::text
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'duration_seconds', v_elapsed,
    'minutes', v_minutes,
    'rate', v_rate,
    'cost', v_cost,
    'platform_fee', v_fee,
    'consultant_earning', v_earning
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.billing_settle_session(uuid) TO authenticated;

-- ─── Broadcast CallSession changes ───────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'CallSession'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."CallSession";
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'CallSession publication skip: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
