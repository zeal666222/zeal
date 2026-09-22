-- 801_booking_platform_fee.sql
BEGIN;

ALTER TABLE public."Consultant"
  ADD COLUMN IF NOT EXISTS "chatRate"     double precision DEFAULT 50,
  ADD COLUMN IF NOT EXISTS "audioRate"    double precision DEFAULT 75,
  ADD COLUMN IF NOT EXISTS "videoRate"    double precision DEFAULT 100,
  ADD COLUMN IF NOT EXISTS "physicalRate" double precision DEFAULT 150;

ALTER TABLE public."Booking"
  ADD COLUMN IF NOT EXISTS "serviceType" text DEFAULT 'chat'
    CHECK ("serviceType" IN ('chat','audio','video','physical'));

ALTER TABLE public."Booking"
  ADD COLUMN IF NOT EXISTS "platformFeeRate" numeric(5,4) DEFAULT 0.10;

CREATE OR REPLACE FUNCTION public.confirm_booking_payment(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
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

  SELECT * INTO v_booking FROM public."Booking"
  WHERE id = p_booking_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'booking_not_found');
  END IF;

  IF v_booking."userId" <> v_caller AND NOT public.auth_is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF v_booking.status = 'CONFIRMED' THEN
    RETURN jsonb_build_object('success', true, 'alreadyConfirmed', true);
  END IF;

  v_platform_fee       := v_booking.amount * COALESCE(v_booking."platformFeeRate", 0.10);
  v_consultant_earning := v_booking.amount - v_platform_fee;

  UPDATE public."Booking"
  SET status              = 'CONFIRMED',
      "platformFee"       = v_platform_fee,
      "consultantEarning" = v_consultant_earning,
      "updatedAt"         = now()
  WHERE id = p_booking_id;

  SELECT c."userId" INTO v_consultant_user
  FROM public."Consultant" c WHERE c.id = v_booking."consultantId";

  IF v_consultant_user IS NOT NULL AND v_consultant_earning > 0 THEN
    PERFORM public.credit_funds_safe(
      v_consultant_user::text,
      v_consultant_earning,
      'Booking earning: ' || p_booking_id,
      'booking-earn:' || p_booking_id::text
    );

    INSERT INTO public."Notification" ("userId", type, message, "redirectUrl", "actorId")
    VALUES (
      v_consultant_user, 'booking',
      'New paid booking confirmed. You earned ₹' || v_consultant_earning::text,
      '/consultant/bookings', v_caller
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'platformFee', v_platform_fee,
    'consultantEarning', v_consultant_earning,
    'total', v_booking.amount
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.confirm_booking_payment(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
