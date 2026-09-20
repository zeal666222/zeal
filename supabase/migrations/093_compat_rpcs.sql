-- ═══════════════════════════════════════════════════════════════════════════════
-- 093_compat_rpcs.sql — Compatibility RPCs for legacy call sites
-- ═══════════════════════════════════════════════════════════════════════════════
-- Adds RPCs referenced by code but missing from earlier migrations:
--   • check_rate_limit     — Postgres-backed rate limiter
--   • delete_user_cascade  — GDPR-compliant user deletion
--   • increment_spark      — legacy spark increment (superseded by trigger)
--   • pulse_deduct_inr     — legacy per-minute billing (superseded by RPC)
--
-- Idempotent. Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Rate limit table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key          text PRIMARY KEY,
  count        integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON public.rate_limits(expires_at);

-- ─── check_rate_limit ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key        text,
  p_limit      integer,
  p_window_sec integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now      timestamptz := now();
  v_count    integer;
  v_expires  timestamptz;
  v_reset_ms bigint;
BEGIN
  -- Cleanup expired rows occasionally (cheap; PK-indexed)
  DELETE FROM public.rate_limits WHERE expires_at < v_now;

  INSERT INTO public.rate_limits (key, count, window_start, expires_at)
  VALUES (p_key, 1, v_now, v_now + (p_window_sec || ' seconds')::interval)
  ON CONFLICT (key) DO UPDATE
    SET count = CASE
                  WHEN rate_limits.expires_at < v_now THEN 1
                  ELSE rate_limits.count + 1
                END,
        window_start = CASE
                         WHEN rate_limits.expires_at < v_now THEN v_now
                         ELSE rate_limits.window_start
                       END,
        expires_at   = CASE
                         WHEN rate_limits.expires_at < v_now THEN v_now + (p_window_sec || ' seconds')::interval
                         ELSE rate_limits.expires_at
                       END
  RETURNING count, expires_at INTO v_count, v_expires;

  v_reset_ms := (EXTRACT(EPOCH FROM v_expires) * 1000)::bigint;

  RETURN jsonb_build_object(
    'success',   v_count <= p_limit,
    'limit',     p_limit,
    'remaining', GREATEST(0, p_limit - v_count),
    'reset',     v_reset_ms,
    'count',     v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO authenticated, anon;

-- ─── delete_user_cascade ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_user_cascade(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_id_required');
  END IF;

  -- Delete order matters (FK dependencies)
  DELETE FROM public."Transaction"           WHERE "walletId" IN (SELECT id FROM public."Wallet" WHERE "userId" = p_user_id);
  DELETE FROM public."Wallet"                WHERE "userId" = p_user_id;
  DELETE FROM public."ConversationParticipant" WHERE "userId" = p_user_id;
  DELETE FROM public."Message"               WHERE "senderId" = p_user_id;
  DELETE FROM public."Notification"          WHERE "userId" = p_user_id OR "actorId" = p_user_id;
  DELETE FROM public."Cheer"                 WHERE "userId" = p_user_id;
  DELETE FROM public."Comment"               WHERE "authorId" = p_user_id;
  DELETE FROM public."Post"                  WHERE "authorId" = p_user_id;
  DELETE FROM public."Booking"               WHERE "userId" = p_user_id;
  DELETE FROM public."UserActivity"          WHERE "userId" = p_user_id;
  DELETE FROM public."UserPreferences"       WHERE "userId" = p_user_id;
  DELETE FROM public."Consultant"            WHERE "userId" = p_user_id;
  DELETE FROM public."User"                  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'code', SQLSTATE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_cascade(uuid) TO authenticated;

-- ─── increment_spark (legacy compat) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_spark(p_consultant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public."User" SET sparks = sparks + 1, "updatedAt" = now() WHERE id = p_consultant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_spark(uuid) TO authenticated;

-- ─── pulse_deduct_inr (legacy compat) ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pulse_deduct_inr(
  p_consultation_id uuid,
  p_client_id       uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet RECORD;
  v_rate numeric := 10;
BEGIN
  SELECT * INTO v_wallet FROM public."Wallet" WHERE "userId" = p_client_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'wallet_not_found');
  END IF;
  IF v_wallet.balance < v_rate THEN
    RETURN jsonb_build_object('success', false, 'terminate', true, 'error', 'insufficient_funds');
  END IF;

  UPDATE public."Wallet"
  SET balance = balance - v_rate, "updatedAt" = now()
  WHERE id = v_wallet.id;

  INSERT INTO public."Transaction" (id, "walletId", type, amount, balance, description, "referenceId")
  VALUES (
    gen_random_uuid()::text,
    v_wallet.id,
    'PAYMENT',
    -v_rate,
    v_wallet.balance - v_rate,
    'Per-minute pulse',
    p_consultation_id::text || ':pulse:' || to_char(now(), 'YYYYMMDDHH24MI')
  );

  RETURN jsonb_build_object(
    'success', true,
    'deducted_inr', v_rate,
    'remaining_inr', v_wallet.balance - v_rate,
    'terminate_next', (v_wallet.balance - v_rate) < v_rate
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pulse_deduct_inr(uuid, uuid) TO authenticated;

-- ─── admin_treasury (used by /dashboard wallet card) ─────────────────────────
CREATE OR REPLACE FUNCTION public.admin_treasury()
RETURNS jsonb
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'totalBalance',    COALESCE(SUM(balance), 0),
    'totalEscrow',     COALESCE(SUM(escrow), 0),
    'totalPendingOut', COALESCE(SUM("pendingOut"), 0),
    'totalBlocked',    COALESCE(SUM(blocked), 0),
    'walletCount',     COUNT(*)
  ) FROM public."Wallet";
$$;

GRANT EXECUTE ON FUNCTION public.admin_treasury() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
