-- ═══════════════════════════════════════════════════════════════════════════════
-- 019_realtime_broadcast.sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Migrates from postgres_changes (WAL-based, 50-200ms latency) to Broadcast
-- (server-mediated, <50ms latency).
--
-- Triggers call realtime.broadcast_changes() to push changes to specific
-- channels. Clients subscribe via Supabase Realtime Broadcast, not WAL.
--
-- Idempotent. Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. MESSAGE → room + participant inboxes
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.broadcast_message_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  participant RECORD;
BEGIN
  -- Broadcast to the conversation room
  PERFORM realtime.broadcast_changes(
    'room:' || NEW."conversationId"::text || ':messages',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );

  -- Broadcast to each participant's personal inbox channel
  FOR participant IN
    SELECT "userId" FROM public."ConversationParticipant"
    WHERE "conversationId" = NEW."conversationId"
  LOOP
    PERFORM realtime.broadcast_changes(
      'user:' || participant."userId"::text || ':inbox',
      TG_OP,
      TG_OP,
      TG_TABLE_NAME,
      TG_TABLE_SCHEMA,
      NEW,
      OLD
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_message ON "Message";
CREATE TRIGGER trg_broadcast_message
  AFTER INSERT ON "Message"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_message_changes();

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. WALLET → user:{id}:wallet
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.broadcast_wallet_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'user:' || NEW."userId"::text || ':wallet',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_wallet ON "Wallet";
CREATE TRIGGER trg_broadcast_wallet
  AFTER UPDATE ON "Wallet"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_wallet_changes();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. CONSULTANT → sparks broadcast
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.broadcast_consultant_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW."sparkScore" IS DISTINCT FROM OLD."sparkScore" THEN
    PERFORM realtime.broadcast_changes(
      'consultant:' || NEW."userId"::text || ':sparks',
      TG_OP,
      TG_OP,
      TG_TABLE_NAME,
      TG_TABLE_SCHEMA,
      NEW,
      OLD
    );
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM realtime.broadcast_changes(
      'admin:verification',
      TG_OP,
      TG_OP,
      TG_TABLE_NAME,
      TG_TABLE_SCHEMA,
      NEW,
      OLD
    );
    PERFORM realtime.broadcast_changes(
      'user:' || NEW."userId"::text || ':notifications',
      TG_OP,
      TG_OP,
      TG_TABLE_NAME,
      TG_TABLE_SCHEMA,
      NEW,
      OLD
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_consultant ON "Consultant";
CREATE TRIGGER trg_broadcast_consultant
  AFTER UPDATE ON "Consultant"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_consultant_changes();

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. BOOKING → admin + status channels
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.broadcast_booking_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'admin:bookings',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );

  PERFORM realtime.broadcast_changes(
    'booking:' || NEW.id::text || ':status',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_booking ON "Booking";
CREATE TRIGGER trg_broadcast_booking
  AFTER INSERT OR UPDATE ON "Booking"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_booking_changes();

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. NOTIFICATION → user:{id}:notifications
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.broadcast_notification_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'user:' || NEW."userId"::text || ':notifications',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_notification ON "Notification";
CREATE TRIGGER trg_broadcast_notification
  AFTER INSERT ON "Notification"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_notification_changes();

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. REALTIME.MESSAGES RLS — private channels
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable RLS on the realtime.messages catalog (required for private:true channels)

DROP POLICY IF EXISTS "realtime_user_channels" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_admin_all"     ON realtime.messages;

-- Users can subscribe to their own channels only
CREATE POLICY "realtime_user_channels" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE 'user:' || (SELECT auth.uid())::text || ':%'
    OR realtime.topic() LIKE 'room:%'
    OR realtime.topic() LIKE 'consultant:' || (SELECT auth.uid())::text || ':%'
    OR realtime.topic() LIKE 'booking:%'
  );

-- Admins can subscribe to anything
CREATE POLICY "realtime_admin_all" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', 'USER')
      IN ('ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'VIEWER')
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  trigger_count integer;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger
  WHERE tgname LIKE 'trg_broadcast_%';

  RAISE NOTICE '========================================';
  RAISE NOTICE '  019_realtime_broadcast.sql — VERIFIED';
  RAISE NOTICE '  Broadcast triggers: %', trigger_count;
  RAISE NOTICE '========================================';
END $$;

COMMIT;
