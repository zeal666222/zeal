-- 802_share_meeting_link.sql
BEGIN;

CREATE OR REPLACE FUNCTION public.share_meeting_link(
  p_booking_id uuid,
  p_meeting_link text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_caller uuid := auth.uid();
  v_booking RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_booking FROM public."Booking" WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'booking_not_found');
  END IF;

  IF NOT public.auth_is_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public."Consultant"
       WHERE id = v_booking."consultantId" AND "userId" = v_caller
     ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  UPDATE public."Booking"
  SET "meetingLink" = p_meeting_link, "updatedAt" = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('success', true, 'meetingLink', p_meeting_link);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.share_meeting_link(uuid, text) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
