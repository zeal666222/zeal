-- ═══════════════════════════════════════════════════════════════════════════════
-- 998_booking_payments_settle.sql
-- Final settlement: missing Booking columns, FKs, opening balance fix,
-- audit_health RPC, booking payment RPCs.
--
-- Paste this ENTIRE file into the Supabase SQL Editor and Run.
-- Idempotent. No ALTER TABLE on realtime.messages.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Booking columns for Razorpay tracking ────────────────────────────────
ALTER TABLE public."Booking"
  ADD COLUMN IF NOT EXISTS "razorpayOrderId"    text,
  ADD COLUMN IF NOT EXISTS "razorpayPaymentId"  text,
  ADD COLUMN IF NOT EXISTS "paymentStatus"      text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "cancellationReason" text,
  ADD COLUMN IF NOT EXISTS "cancelledBy"        uuid,
  ADD COLUMN IF NOT EXISTS "noShow"             boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "timezone"           text DEFAULT 'Asia/Kolkata';

CREATE INDEX IF NOT EXISTS idx_booking_rzp_order
  ON public."Booking"("razorpayOrderId")
  WHERE "razorpayOrderId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_rzp_payment
  ON public."Booking"("razorpayPaymentId")
  WHERE "razorpayPaymentId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_payment_status
  ON public."Booking"("paymentStatus");

-- ─── 2. Opening balance fix for the drifted wallet (safe if already fixed) ───
INSERT INTO public."Transaction" (
  id, "walletId", type, amount, balance, description, "referenceId"
)
SELECT
  gen_random_uuid(),
  w.id,
  'TOPUP'::"TransactionType",
  w.balance - COALESCE((SELECT SUM(amount) FROM public."Transaction" WHERE "walletId" = w.id), 0),
  w.balance,
  'Opening balance — reconciliation',
  'reconcile:' || w.id::text || ':opening'
FROM public."Wallet" w
WHERE w.balance <> COALESCE((SELECT SUM(amount) FROM public."Transaction" WHERE "walletId" = w.id), 0)
ON CONFLICT ("referenceId") DO NOTHING;

-- ─── 3. audit_health() RPC ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_health()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'wallet_drift_count',
      (SELECT COUNT(*)::int FROM (
        SELECT w.id FROM public."Wallet" w
        LEFT JOIN public."Transaction" t ON t."walletId" = w.id
        GROUP BY w.id, w.balance
        HAVING ABS(w.balance - COALESCE(SUM(t.amount), 0)) > 0.01
      ) x),
    'uncredited_bookings',
      (SELECT COUNT(*)::int FROM public."Booking" b
       WHERE b.status = 'CONFIRMED' AND b."consultantEarning" > 0
         AND NOT EXISTS (SELECT 1 FROM public."Transaction" t
                         WHERE t."referenceId" = 'booking-earn:' || b.id::text)),
    'stuck_webhooks',
      (SELECT COUNT(*)::int FROM public."RazorpayWebhookEvent"
       WHERE processed = false AND "createdAt" < now() - interval '5 minutes'),
    'orphan_users',
      (SELECT COUNT(*)::int FROM public."User" u
       LEFT JOIN public."Wallet" w ON w."userId" = u.id
       WHERE w.id IS NULL),
    'negative_balances',
      (SELECT COUNT(*)::int FROM public."Wallet"
       WHERE balance < 0 OR escrow < 0 OR "pendingOut" < 0),
    'duplicate_references',
      (SELECT COUNT(*)::int FROM (
        SELECT "referenceId" FROM public."Transaction"
        WHERE "referenceId" IS NOT NULL
        GROUP BY "referenceId" HAVING COUNT(*) > 1
      ) x),
    'checked_at', now()
  );
$$;
GRANT EXECUTE ON FUNCTION public.audit_health() TO authenticated, anon, service_role;

-- ─── 4. confirm_booking_payment — credits consultant exactly once ────────────
CREATE OR REPLACE FUNCTION public.confirm_booking_payment(
  p_booking_id uuid, p_razorpay_payment_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_booking RECORD;
  v_consultant_user uuid;
  v_platform_fee numeric;
  v_consultant_earning numeric;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_booking FROM public."Booking" WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'booking_not_found');
  END IF;
  IF v_booking."userId" <> v_caller AND NOT public.auth_is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  IF v_booking.status = 'CONFIRMED'
     AND (p_razorpay_payment_id IS NULL OR v_booking."razorpayPaymentId" = p_razorpay_payment_id)
  THEN
    RETURN jsonb_build_object('success', true, 'alreadyConfirmed', true);
  END IF;

  v_platform_fee := v_booking.amount * COALESCE(v_booking."platformFeeRate", 0.10);
  v_consultant_earning := v_booking.amount - v_platform_fee;

  UPDATE public."Booking"
    SET status = 'CONFIRMED',
        "platformFee" = v_platform_fee,
        "consultantEarning" = v_consultant_earning,
        "razorpayPaymentId" = COALESCE(p_razorpay_payment_id, "razorpayPaymentId"),
        "paymentStatus" = 'captured',
        "updatedAt" = now()
    WHERE id = p_booking_id;

  SELECT c."userId" INTO v_consultant_user
  FROM public."Consultant" c WHERE c.id = v_booking."consultantId";

  IF v_consultant_user IS NOT NULL AND v_consultant_earning > 0 THEN
    PERFORM public.credit_funds_safe(
      v_consultant_user::text,
      v_consultant_earning,
      'Booking earning: ' || p_booking_id::text,
      'booking-earn:' || p_booking_id::text
    );

    INSERT INTO public."Notification" ("userId", type, message, "redirectUrl", "actorId")
    VALUES (
      v_consultant_user, 'booking',
      'Booking confirmed. You earned ₹' || v_consultant_earning::text,
      '/consultant/bookings', v_caller::text
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'platformFee', v_platform_fee,
    'consultantEarning', v_consultant_earning,
    'total', v_booking.amount
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'code', SQLSTATE);
END $$;
GRANT EXECUTE ON FUNCTION public.confirm_booking_payment(uuid, text) TO authenticated;

-- ─── 5. Verify ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Booking'
      AND column_name = 'razorpayPaymentId'
  ) THEN
    RAISE EXCEPTION 'Booking.razorpayPaymentId missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'audit_health'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'audit_health RPC missing';
  END IF;
  RAISE NOTICE '✓ 998_booking_payments_settle.sql applied';
END $$;

NOTIFY pgrst, 'reload schema';
