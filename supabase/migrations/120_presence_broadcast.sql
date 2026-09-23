-- ═══════════════════════════════════════════════════════════════════════════════
-- 120_presence_broadcast.sql — ZEAL_PHASE1_LUXURY_v1
-- ═══════════════════════════════════════════════════════════════════════════════
-- Closes the realtime presence gap: when User.is_online flips (via UI toggle,
-- heartbeat, or cron cleanup), broadcast to the public `consultants:live`
-- channel so homepage / explore / profile reflect status changes within ~50ms.
--
-- Payload shape matches the manual publish in /api/consultant/online/route.ts:
--   { consultantId: <user_id>, is_online: <bool> }
--
-- Idempotent. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.broadcast_user_presence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.is_online IS DISTINCT FROM OLD.is_online THEN
    PERFORM realtime.broadcast_changes(
      'consultants:live',
      'UPDATE',
      'UPDATE',
      'User',
      'public',
      jsonb_build_object(
        'consultantId', NEW.id::text,
        'is_online',    NEW.is_online,
        'at',           now()
      ),
      jsonb_build_object(
        'consultantId', OLD.id::text,
        'is_online',    OLD.is_online
      )
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'broadcast_user_presence: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_user_presence ON public."User";
CREATE TRIGGER trg_broadcast_user_presence
  AFTER UPDATE OF is_online ON public."User"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_user_presence();

-- Ensure User is in the realtime publication (no-op if already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'User'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."User";
  END IF;
END $$;

-- Replica identity so DELETE/UPDATE carry the previous row
ALTER TABLE public."User" REPLICA IDENTITY FULL;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '  120_presence_broadcast.sql — APPLIED';
  RAISE NOTICE '  Trigger: trg_broadcast_user_presence';
  RAISE NOTICE '  Channel: consultants:live';
  RAISE NOTICE '════════════════════════════════════════════════════════';
END $$;

COMMIT;
