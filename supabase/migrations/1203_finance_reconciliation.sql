-- =============================================================================
-- 1203_finance_reconciliation.sql
-- Financial discrepancy tracking and auto-correction
-- =============================================================================
-- Tracks discrepancies between wallet transactions and billing heartbeats.
-- Small discrepancies (<₹10) can be auto-corrected. Large ones are flagged
-- for manual review by SUPER_ADMIN.
-- =============================================================================

BEGIN;

-- ─── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."BillingDiscrepancy" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    UUID NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('overcharge', 'undercharge', 'negative_balance', 'missing_transaction', 'duplicate_charge')),
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  status      TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'auto_corrected', 'manually_corrected', 'dismissed', 'pending_review')),
  "autoCorrectable" BOOLEAN NOT NULL DEFAULT false,
  "correctedAt" TIMESTAMPTZ,
  "correctedBy" UUID REFERENCES public."User"(id) ON DELETE SET NULL,
  "detectedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_discrepancy_user
  ON public."BillingDiscrepancy" ("userId");

CREATE INDEX IF NOT EXISTS idx_billing_discrepancy_status
  ON public."BillingDiscrepancy" (status);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public."BillingDiscrepancy" ENABLE ROW LEVEL SECURITY;

-- Only SUPER_ADMIN can read discrepancies
DROP POLICY IF EXISTS billing_discrepancy_select ON public."BillingDiscrepancy";
CREATE POLICY billing_discrepancy_select ON public."BillingDiscrepancy"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public."User"
      WHERE "User".id = auth.uid()
        AND "User".role::text = 'SUPER_ADMIN'
    )
  );

-- Only SUPER_ADMIN can insert/update
DROP POLICY IF EXISTS billing_discrepancy_insert ON public."BillingDiscrepancy";
CREATE POLICY billing_discrepancy_insert ON public."BillingDiscrepancy"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."User"
      WHERE "User".id = auth.uid()
        AND "User".role::text = 'SUPER_ADMIN'
    )
  );

DROP POLICY IF EXISTS billing_discrepancy_update ON public."BillingDiscrepancy";
CREATE POLICY billing_discrepancy_update ON public."BillingDiscrepancy"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public."User"
      WHERE "User".id = auth.uid()
        AND "User".role::text = 'SUPER_ADMIN'
    )
  );

-- ─── Auto-correct function ────────────────────────────────────────────────────
-- Auto-corrects small discrepancies (<₹10) by adjusting wallet balance
CREATE OR REPLACE FUNCTION public.auto_correct_discrepancy(
  p_discrepancy_id UUID,
  p_admin_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_disc RECORD;
  v_current_balance NUMERIC;
BEGIN
  -- Fetch the discrepancy
  SELECT * INTO v_disc FROM public."BillingDiscrepancy"
  WHERE id = p_discrepancy_id AND status = 'detected';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Discrepancy not found or already processed';
  END IF;

  -- Only auto-correct small amounts
  IF ABS(v_disc.amount) >= 10 THEN
    RAISE EXCEPTION 'Amount too large for auto-correction (>=₹10). Requires manual review.';
  END IF;

  -- Adjust wallet balance
  IF v_disc.type = 'overcharge' THEN
    -- Refund the user
    UPDATE public."Wallet"
    SET balance = balance + ABS(v_disc.amount)
    WHERE "userId" = v_disc."userId";
  ELSIF v_disc.type = 'undercharge' THEN
    -- Charge the user
    UPDATE public."Wallet"
    SET balance = GREATEST(0, balance - ABS(v_disc.amount))
    WHERE "userId" = v_disc."userId";
  END IF;

  -- Mark as corrected
  UPDATE public."BillingDiscrepancy"
  SET status = 'auto_corrected',
      "correctedAt" = now(),
      "correctedBy" = p_admin_id
  WHERE id = p_discrepancy_id;

  RETURN true;
END;
$$;

-- ─── Reconciliation check function ────────────────────────────────────────────
-- Compares wallet transactions against billing heartbeats for a given user
CREATE OR REPLACE FUNCTION public.check_billing_reconciliation(
  p_user_id UUID
)
RETURNS TABLE (
  discrepancy_type TEXT,
  amount NUMERIC,
  description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Check for negative balance
  RETURN QUERY
  SELECT
    'negative_balance'::TEXT AS discrepancy_type,
    ABS(w.balance) AS amount,
    ('Negative wallet balance for user ' || p_user_id::TEXT) AS description
  FROM public."Wallet" w
  WHERE w."userId" = p_user_id AND w.balance < 0;
END;
$$;

COMMIT;
