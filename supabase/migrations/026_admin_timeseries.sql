-- ═══════════════════════════════════════════════════════════════════════════════
-- 026_admin_timeseries.sql
-- Phase 4: single-RPC admin metrics.
-- ═══════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ─── 1. admin_timeseries(p_days) ─────────────────────────────────────────────
-- Returns day-by-day revenue + bookings for the last p_days (1–90).
CREATE OR REPLACE FUNCTION public.admin_timeseries(p_days int DEFAULT 30)
RETURNS TABLE(day date, revenue numeric, bookings bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH days AS (
    SELECT generate_series(
      (CURRENT_DATE - (LEAST(GREATEST(p_days, 1), 90) - 1)),
      CURRENT_DATE,
      '1 day'::interval
    )::date AS day
  ),
  rev AS (
    SELECT
      "createdAt"::date AS day,
      SUM(amount)::numeric AS revenue
    FROM "Transaction"
    WHERE type = 'PAYMENT'
      AND "createdAt" >= CURRENT_DATE - (LEAST(GREATEST(p_days, 1), 90) - 1)
    GROUP BY 1
  ),
  bkg AS (
    SELECT
      "createdAt"::date AS day,
      COUNT(*)::bigint AS bookings
    FROM "Booking"
    WHERE "createdAt" >= CURRENT_DATE - (LEAST(GREATEST(p_days, 1), 90) - 1)
    GROUP BY 1
  )
  SELECT
    d.day,
    COALESCE(rev.revenue, 0),
    COALESCE(bkg.bookings, 0)
  FROM days d
  LEFT JOIN rev ON rev.day = d.day
  LEFT JOIN bkg ON bkg.day = d.day
  ORDER BY d.day;
$$;

GRANT EXECUTE ON FUNCTION public.admin_timeseries(int) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '  026_admin_timeseries.sql — OK';
  RAISE NOTICE '  RPC: admin_timeseries(p_days int)';
  RAISE NOTICE '========================================';
END $$;

COMMIT;
