-- ═══════════════════════════════════════════════════════════════════════════
-- 20261020130000_booking_consultant_realtime.sql
-- The consultant console subscribes to `consultant:<uid>:incoming` (live seeker
-- request queue) and `consultant:<uid>:bookings` (their booking list), but NO
-- trigger ever published to them — the Live Queue could never fill and booking
-- status changes only reached admin + the per-booking channel. This extends the
-- existing booking broadcast trigger to fan out to the owning consultant too.
--
-- Idempotent + additive: replaces trg_fn_booking_broadcast (which already runs
-- on INSERT/UPDATE) and re-attaches it. admin:bookings + booking:<id>:status
-- behavior is preserved. Apply with `supabase db push` (or the SQL editor).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trg_fn_booking_broadcast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
DECLARE
  v_consultant_user text;
BEGIN
  -- Global admin feed + per-booking status (unchanged).
  PERFORM public.safe_broadcast('admin:bookings', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD));
  PERFORM public.safe_broadcast('booking:' || NEW.id::text || ':status', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD));

  -- Resolve the owning consultant's user id so we can target their console.
  IF NEW."consultantId" IS NOT NULL THEN
    SELECT c."userId"::text INTO v_consultant_user
      FROM public."Consultant" c
     WHERE c.id = NEW."consultantId";
  END IF;

  IF v_consultant_user IS NOT NULL THEN
    -- Booking list update for the consultant (any insert/update).
    PERFORM public.safe_broadcast('consultant:' || v_consultant_user || ':bookings', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD));

    -- New inbound request: only when the booking just entered a pending state.
    IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status IN ('PENDING', 'PENDING_PAYMENT') THEN
        PERFORM public.safe_broadcast('consultant:' || v_consultant_user || ':incoming', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD));
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_broadcast_booking ON public."Booking";
CREATE TRIGGER trg_broadcast_booking
  AFTER INSERT OR UPDATE ON public."Booking"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_booking_broadcast();

NOTIFY pgrst, 'reload schema';
