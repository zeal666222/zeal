-- ═══════════════════════════════════════════════════════════════════════════════
-- 004_broadcast_hardening.sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Consolidates and hardens every broadcast trigger:
--   • Idempotent re-run (DROP + CREATE per trigger)
--   • Exception-safe (WARNING on failure, never blocks the transaction)
--   • Uses `set search_path = ''` (Supabase best practice for SECURITY DEFINER)
--   • Fully qualified table references (public."X")
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Helper: safe broadcast wrapper ─────────────────────────────────────────
-- Wraps realtime.broadcast_changes in a block that never raises.
CREATE OR REPLACE FUNCTION public.safe_broadcast(
  p_topic text,
  p_operation text,
  p_table text,
  p_schema text,
  p_record jsonb,
  p_old_record jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    p_topic, p_operation, p_operation, p_table, p_schema, p_record, p_old_record
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'safe_broadcast failed for %: %', p_topic, SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.safe_broadcast(text, text, text, text, jsonb, jsonb)
  TO postgres, service_role;

-- ─── 1. Message → room + participant inboxes ────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_fn_message_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  p record;
BEGIN
  -- Room channel
  PERFORM public.safe_broadcast(
    'room:' || NEW."conversationId"::text || ':messages',
    TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD)
  );

  -- Each participant's inbox
  FOR p IN
    SELECT "userId" FROM public."ConversationParticipant"
    WHERE "conversationId" = NEW."conversationId"
  LOOP
    PERFORM public.safe_broadcast(
      'user:' || p."userId"::text || ':inbox',
      TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_message ON public."Message";
CREATE TRIGGER trg_broadcast_message
  AFTER INSERT ON public."Message"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_message_broadcast();

-- ─── 2. Wallet → user:{uid}:wallet ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_fn_wallet_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.safe_broadcast(
    'user:' || NEW."userId"::text || ':wallet',
    TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_wallet ON public."Wallet";
CREATE TRIGGER trg_broadcast_wallet
  AFTER UPDATE ON public."Wallet"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_wallet_broadcast();

-- ─── 3. Transaction → user:{uid}:wallet:ledger ──────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_fn_ledger_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  owner_id text;
BEGIN
  SELECT "userId"::text INTO owner_id FROM public."Wallet" WHERE id = NEW."walletId";
  IF owner_id IS NULL THEN RETURN NEW; END IF;

  PERFORM public.safe_broadcast(
    'user:' || owner_id || ':wallet:ledger',
    TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_ledger_entry ON public."Transaction";
CREATE TRIGGER trg_broadcast_ledger_entry
  AFTER INSERT ON public."Transaction"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_ledger_broadcast();

-- ─── 4. Notification → user:{uid}:notifications ─────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_fn_notification_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.safe_broadcast(
    'user:' || NEW."userId"::text || ':notifications',
    TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_notification ON public."Notification";
CREATE TRIGGER trg_broadcast_notification
  AFTER INSERT ON public."Notification"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_notification_broadcast();

-- ─── 5. Booking → admin + booking status ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_fn_booking_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.safe_broadcast(
    'admin:bookings',
    TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD)
  );
  PERFORM public.safe_broadcast(
    'booking:' || NEW.id::text || ':status',
    TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_booking ON public."Booking";
CREATE TRIGGER trg_broadcast_booking
  AFTER INSERT OR UPDATE ON public."Booking"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_booking_broadcast();

-- ─── 6. Consultant → sparks + verification ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_fn_consultant_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW."sparkScore" IS DISTINCT FROM OLD."sparkScore" THEN
    PERFORM public.safe_broadcast(
      'consultant:' || NEW."userId"::text || ':sparks',
      TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD)
    );
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.safe_broadcast(
      'admin:verification',
      TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_consultant ON public."Consultant";
CREATE TRIGGER trg_broadcast_consultant
  AFTER UPDATE ON public."Consultant"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_consultant_broadcast();

-- ─── 7. AIConsultant → public updates ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_fn_ai_consultant_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.safe_broadcast(
    'consultant:ai:updates',
    TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA,
    CASE WHEN NEW IS NULL THEN NULL ELSE to_jsonb(NEW) END,
    CASE WHEN OLD IS NULL THEN NULL ELSE to_jsonb(OLD) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_ai_consultant ON public."AIConsultant";
CREATE TRIGGER trg_broadcast_ai_consultant
  AFTER INSERT OR UPDATE OR DELETE ON public."AIConsultant"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_ai_consultant_broadcast();

-- ─── 8. Directory → consultants:live (public) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_fn_directory_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.safe_broadcast(
    'consultants:live',
    TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA,
    CASE WHEN NEW IS NULL THEN NULL ELSE to_jsonb(NEW) END,
    CASE WHEN OLD IS NULL THEN NULL ELSE to_jsonb(OLD) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_consultant_directory ON public."Consultant";
CREATE TRIGGER trg_broadcast_consultant_directory
  AFTER INSERT OR UPDATE OR DELETE ON public."Consultant"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_directory_broadcast();

-- ─── Ensure REPLICA IDENTITY FULL on all realtime tables ────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Message','Conversation','Wallet','Transaction','Consultant','AIConsultant',
    'Booking','CallSession','Notification','Post','User','Comment','Cheer'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

DO $$ BEGIN
  RAISE NOTICE '  004 — Broadcast triggers hardened (8 triggers, exception-safe)';
END $$;

COMMIT;
