-- 091_realtime_hardening.sql
-- See setup.sh output — full file inline below. Idempotent.
BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'Message','Conversation','ConversationParticipant',
  'Wallet','Transaction','Consultant','AIConsultant',
  'Booking','CallSession','Notification','Post','Comment','Cheer','User'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip %: %', t, SQLERRM; END;
  END LOOP;
END $$;

ALTER TABLE public."Message"      REPLICA IDENTITY FULL;
ALTER TABLE public."Conversation" REPLICA IDENTITY FULL;
ALTER TABLE public."Wallet"       REPLICA IDENTITY FULL;
ALTER TABLE public."Transaction"  REPLICA IDENTITY FULL;
ALTER TABLE public."Consultant"   REPLICA IDENTITY FULL;
ALTER TABLE public."AIConsultant" REPLICA IDENTITY FULL;
ALTER TABLE public."Booking"      REPLICA IDENTITY FULL;
ALTER TABLE public."CallSession"  REPLICA IDENTITY FULL;
ALTER TABLE public."Notification" REPLICA IDENTITY FULL;
ALTER TABLE public."Post"         REPLICA IDENTITY FULL;
ALTER TABLE public."User"         REPLICA IDENTITY FULL;

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "realtime_public_channels" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_user_channels"   ON realtime.messages;
DROP POLICY IF EXISTS "realtime_admin_all"       ON realtime.messages;

CREATE POLICY "realtime_public_channels" ON realtime.messages
  FOR SELECT TO anon, authenticated
  USING (realtime.topic() = 'consultant:ai:updates'
      OR realtime.topic() = 'consultants:live');

CREATE POLICY "realtime_user_channels" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE 'user:' || (SELECT auth.uid())::text || ':%'
    OR realtime.topic() LIKE 'room:%'
    OR realtime.topic() LIKE 'consultant:' || (SELECT auth.uid())::text || ':%'
    OR realtime.topic() LIKE 'booking:%'
    OR realtime.topic() LIKE 'presence:%'
  );

CREATE POLICY "realtime_admin_all" ON realtime.messages
  FOR SELECT TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', 'USER')
    IN ('ADMIN','SUPER_ADMIN','SUPPORT','VIEWER'));

-- Broadcast triggers
CREATE OR REPLACE FUNCTION public.broadcast_message_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p RECORD;
BEGIN
  PERFORM realtime.broadcast_changes(
    'room:' || NEW."conversationId"::text || ':messages',
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  FOR p IN SELECT "userId" FROM public."ConversationParticipant"
           WHERE "conversationId" = NEW."conversationId" LOOP
    PERFORM realtime.broadcast_changes(
      'user:' || p."userId"::text || ':inbox',
      TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  END LOOP;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_broadcast_message ON public."Message";
CREATE TRIGGER trg_broadcast_message AFTER INSERT ON public."Message"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_message_changes();

CREATE OR REPLACE FUNCTION public.broadcast_wallet_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'user:' || NEW."userId"::text || ':wallet',
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_broadcast_wallet ON public."Wallet";
CREATE TRIGGER trg_broadcast_wallet AFTER UPDATE ON public."Wallet"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_wallet_changes();

CREATE OR REPLACE FUNCTION public.broadcast_notification_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'user:' || NEW."userId"::text || ':notifications',
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_broadcast_notification ON public."Notification";
CREATE TRIGGER trg_broadcast_notification AFTER INSERT ON public."Notification"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_notification_changes();

CREATE OR REPLACE FUNCTION public.broadcast_booking_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'admin:bookings', TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  PERFORM realtime.broadcast_changes(
    'booking:' || NEW.id::text || ':status',
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_broadcast_booking ON public."Booking";
CREATE TRIGGER trg_broadcast_booking AFTER INSERT OR UPDATE ON public."Booking"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_booking_changes();

CREATE OR REPLACE FUNCTION public.broadcast_consultant_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW."sparkScore" IS DISTINCT FROM OLD."sparkScore" THEN
    PERFORM realtime.broadcast_changes(
      'consultant:' || NEW."userId"::text || ':sparks',
      TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM realtime.broadcast_changes(
      'admin:verification', TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_broadcast_consultant ON public."Consultant";
CREATE TRIGGER trg_broadcast_consultant AFTER UPDATE ON public."Consultant"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_consultant_changes();

CREATE OR REPLACE FUNCTION public.broadcast_ai_consultant_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'consultant:ai:updates', TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS trg_broadcast_ai_consultant ON public."AIConsultant";
CREATE TRIGGER trg_broadcast_ai_consultant
  AFTER INSERT OR UPDATE OR DELETE ON public."AIConsultant"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_ai_consultant_changes();

CREATE OR REPLACE FUNCTION public.broadcast_consultant_directory_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'consultants:live', TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS trg_broadcast_consultant_directory ON public."Consultant";
CREATE TRIGGER trg_broadcast_consultant_directory
  AFTER INSERT OR UPDATE OR DELETE ON public."Consultant"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_consultant_directory_changes();

NOTIFY pgrst, 'reload schema';
COMMIT;
