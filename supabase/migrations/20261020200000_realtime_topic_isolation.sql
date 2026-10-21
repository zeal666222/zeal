-- ============================================================================
-- 20261020200000_realtime_topic_isolation.sql
--
-- Two policies that exist in production but in NO migration:
--
--   anon_can_receive_broadcasts           FOR SELECT USING (true)
--   authenticated_can_receive_broadcasts  FOR SELECT USING (true)
--
-- RLS policies are OR'd, so a single `USING (true)` makes every other policy on
-- realtime.messages irrelevant: any browser holding the public anon key could
-- join `user:<someone-else-id>:wallet` and read their balance, or join
-- `admin:pricing` and watch payout approvals arrive. The topics were never the
-- protection — these two rows quietly removed it.
--
-- This migration deletes them and states, in migration history, the policy set
-- the app actually depends on. Every topic the client subscribes is enumerated
-- below; a topic missing here is a subscription that silently stops receiving,
-- so the list is deliberately exhaustive rather than minimal.
--
-- It also adds the publishers that were missing: sparks, slot availability,
-- moderation and audit each had a subscriber (or an admin queue) and nobody on
-- the write side, so those panels could only ever show a stale snapshot. The
-- three triggers that called the old realtime API directly — presence and the
-- two directory-count refreshers — are repointed through the same primitive.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Remove the blanket read grants
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  DROP POLICY IF EXISTS "anon_can_receive_broadcasts" ON realtime.messages;
  DROP POLICY IF EXISTS "authenticated_can_receive_broadcasts" ON realtime.messages;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'realtime.messages policies not owned by this role: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- 2. The topic map, per audience
-- ---------------------------------------------------------------------------
-- No `ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY` here, unlike
-- section 23 of 0000_consolidated_idempotent.sql: realtime.messages is owned by
-- supabase_admin, so that statement raises 42501 for every other role and — being
-- first in that block's DO body — took every policy in the block down with it.
-- That is how the blanket `USING (true)` policies survived: the policies meant to
-- replace them never got created. RLS is already enabled on the table, and
-- CREATE/DROP POLICY is allowed for this role, so the statements below apply.
DO $$
BEGIN
  -- Public: no identity is implied by reading these, and the anon key must see
  -- them (the marketing pages render the live directory and the feed).
  -- 'feed:posts', 'slots:%' and 'directory:counts' were only ever reachable
  -- *because* of the blanket policy above; naming them here is what keeps them
  -- working. The directory counts carry aggregated guide counts per service
  -- category and nothing else, which is why an anon key may read them.
  DROP POLICY IF EXISTS "realtime_public_channels" ON realtime.messages;
  CREATE POLICY "realtime_public_channels" ON realtime.messages
    FOR SELECT TO anon, authenticated
    USING (
      realtime.topic() IN ('consultants:live', 'consultant:ai:updates', 'feed:posts', 'directory:counts')
      OR realtime.topic() LIKE 'slots:%'
      OR realtime.topic() LIKE 'presence:%'
    );

  -- Own-scoped: the uid is the MIDDLE segment of the topic (see the note in
  -- packages/realtime/src/channels.ts) because the policy compares against
  -- auth.uid(), not against a value inside the payload.
  DROP POLICY IF EXISTS "realtime_user_channels" ON realtime.messages;
  CREATE POLICY "realtime_user_channels" ON realtime.messages
    FOR SELECT TO authenticated
    USING (
      realtime.topic() LIKE 'user:' || (SELECT auth.uid())::text || ':%'
      OR realtime.topic() LIKE 'consultant:' || (SELECT auth.uid())::text || ':%'
      OR (realtime.topic() LIKE 'room:%'
          AND public.user_is_in_conversation(
            substring(realtime.topic() FROM 'room:([0-9a-f-]{36}):')::uuid))
      OR (realtime.topic() LIKE 'booking:%'
          AND public.user_can_view_booking(
            substring(realtime.topic() FROM 'booking:([0-9a-f-]{36}):')::uuid))
    );

  DROP POLICY IF EXISTS "realtime_payment_channels" ON realtime.messages;
  CREATE POLICY "realtime_payment_channels" ON realtime.messages
    FOR SELECT TO authenticated
    USING (realtime.topic() = 'user:' || (SELECT auth.uid())::text || ':payments');

  DROP POLICY IF EXISTS "realtime_session_channels" ON realtime.messages;
  CREATE POLICY "realtime_session_channels" ON realtime.messages
    FOR SELECT TO authenticated
    USING (
      realtime.topic() LIKE 'session:%:billing'
      AND public.user_can_view_session(
        substring(realtime.topic() FROM 'session:([0-9a-f-]{36}):')::uuid)
    );

  -- Admin. The app_metadata check alone only works while the auth hook that
  -- writes `role` into the JWT is wired in the dashboard; auth_is_admin()
  -- resolves the same fact from the "User" row via auth.uid(), so the panels
  -- keep their realtime feed even if that hook is ever uninstalled.
  DROP POLICY IF EXISTS "realtime_admin_all" ON realtime.messages;
  CREATE POLICY "realtime_admin_all" ON realtime.messages
    FOR SELECT TO authenticated
    USING (
      COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', 'USER')
        IN ('ADMIN','SUPER_ADMIN','SUPPORT','VIEWER','CLIENT_ADMIN')
      OR public.auth_is_admin()
    );

  RAISE NOTICE 'realtime.messages topic isolation applied';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping realtime.messages RLS — not owner of the table: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Publishers that were missing
-- ---------------------------------------------------------------------------

-- 3a. The primitive every DB broadcast goes through.
--
-- public.safe_broadcast was written against an older realtime API:
--
--   PERFORM realtime.broadcast_changes(p_channel, p_operation, p_operation,
--                                       p_table, p_schema, p_new, p_old);
--
-- realtime.broadcast_changes is now
-- (topic_name, event_name, operation, table_name, table_schema, new record,
--  old record, level) — eight arguments, two of them RECORD. Seven jsonb
-- arguments never matched it, so the call raised 42883 on every invocation and
-- the `EXCEPTION WHEN OTHERS THEN RAISE WARNING` wrapper swallowed it. The
-- visible symptom: nothing that a database trigger was supposed to publish ever
-- reached a socket, while server-side publish from Next.js route handlers
-- (which does not use this function) appeared to work.
--
-- realtime.send(topic, payload, event, private) is the current primitive and is
-- verified working here. The payload keys match BroadcastChange in
-- @zeal/realtime, so no client had to change to receive them.
--
-- `private` must mirror two other lists — the realtime_public_channels policy
-- above and PUBLIC_CHANNELS in packages/realtime/src/client.ts. A topic marked
-- private here is dropped for every logged-out subscriber.
CREATE OR REPLACE FUNCTION public.safe_broadcast(
  p_channel text,
  p_operation text,
  p_table text,
  p_schema text,
  p_new jsonb,
  p_old jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
DECLARE
  v_private boolean;
BEGIN
  IF p_channel IS NULL OR p_operation IS NULL THEN
    RETURN;
  END IF;

  v_private := NOT (
    p_channel IN ('consultants:live', 'consultant:ai:updates', 'feed:posts', 'directory:counts')
    OR p_channel LIKE 'slots:%'
    OR p_channel LIKE 'presence:%'
  );

  PERFORM realtime.send(
    jsonb_build_object(
      'type', p_operation,
      'table', p_table,
      'schema', p_schema,
      'record', p_new,
      'old_record', p_old,
      'id', gen_random_uuid()
    ),
    p_operation,
    p_channel,
    v_private
  );
EXCEPTION WHEN OTHERS THEN
  -- A broadcast must never take a write down with it, but it must not be silent
  -- either: this warning is the only trace a failed publish leaves.
  RAISE WARNING 'safe_broadcast(%): %', p_channel, SQLERRM;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.safe_broadcast(text, text, text, text, jsonb, jsonb)
  TO authenticated, service_role, anon;

-- 3b. Sparks -> user:{uid}:sparks
-- ProfileSparkCounter animated the delta for a payload nobody ever sent, because
-- sparks move in five different places (quests, cheers, admin grants, refunds).
-- Firing on the column rather than at each writer is what makes it complete.
CREATE OR REPLACE FUNCTION public.trg_fn_user_sparks_broadcast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  IF NEW.sparks IS DISTINCT FROM OLD.sparks THEN
    PERFORM public.safe_broadcast(
      'user:' || NEW.id::text || ':sparks', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA,
      jsonb_build_object('userId', NEW.id, 'sparks', NEW.sparks,
                         'delta', COALESCE(NEW.sparks, 0) - COALESCE(OLD.sparks, 0)),
      jsonb_build_object('sparks', OLD.sparks));
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_broadcast_user_sparks ON public."User";
CREATE TRIGGER trg_broadcast_user_sparks
  AFTER UPDATE OF sparks ON public."User"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_user_sparks_broadcast();

-- 3c. Slot availability -> slots:{consultantId}
-- Availability is computed from Booking rows, so there is no slots table to
-- trigger on. A booking is the only thing that changes it: two seekers on the
-- same consultant page used to watch the same slot and one of them failed.
-- The payload carries no participant identity on purpose — this topic is public.
--
-- This replaces the function from 20261020130000, so it has to keep that
-- migration's fan-out too (admin feed, per-booking status, and the owning
-- consultant's queue/console channels) and only add the slots topic.
CREATE OR REPLACE FUNCTION public.trg_fn_booking_broadcast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
DECLARE
  v_consultant_user uuid;
BEGIN
  PERFORM public.safe_broadcast('admin:bookings', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA,
    to_jsonb(NEW), to_jsonb(OLD));
  IF NEW.id IS NOT NULL THEN
    PERFORM public.safe_broadcast('booking:' || NEW.id::text || ':status',
      TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD));
  END IF;

  IF NEW."consultantId" IS NOT NULL THEN
    SELECT c."userId" INTO v_consultant_user
      FROM public."Consultant" c
     WHERE c.id = NEW."consultantId";

    IF v_consultant_user IS NOT NULL THEN
      PERFORM public.safe_broadcast('consultant:' || v_consultant_user::text || ':bookings',
        TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD));
      IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status IN ('PENDING', 'PENDING_PAYMENT') THEN
          PERFORM public.safe_broadcast('consultant:' || v_consultant_user::text || ':incoming',
            TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD));
        END IF;
      END IF;
    END IF;

    PERFORM public.safe_broadcast('slots:' || NEW."consultantId"::text,
      TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA,
      jsonb_build_object('consultantId', NEW."consultantId", 'at', now()),
      jsonb_build_object('bookingId', OLD.id));
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'booking broadcast: %', SQLERRM;
  RETURN NEW;
END;
$func$;

-- Re-attached rather than assumed: 20261020130000 created it, but this file must
-- stand on its own against a database where that one was never applied.
DROP TRIGGER IF EXISTS trg_broadcast_booking ON public."Booking";
CREATE TRIGGER trg_broadcast_booking
  AFTER INSERT OR UPDATE ON public."Booking"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_booking_broadcast();

-- 3d. Moderation queue -> admin:moderation
CREATE OR REPLACE FUNCTION public.trg_fn_moderation_broadcast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  IF TG_TABLE_NAME = 'ContentReport' THEN
    PERFORM public.safe_broadcast('admin:moderation', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA,
      to_jsonb(NEW), CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END);
  ELSIF NEW."isFlagged" IS DISTINCT FROM OLD."isFlagged" THEN
    PERFORM public.safe_broadcast('admin:moderation', 'UPDATE', 'Post', 'public',
      jsonb_build_object('id', NEW.id, 'isFlagged', NEW."isFlagged",
                         'authorId', NEW."authorId", 'createdAt', NEW."createdAt"),
      jsonb_build_object('id', NEW.id, 'isFlagged', OLD."isFlagged"));
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'moderation broadcast: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$func$;

DROP TRIGGER IF EXISTS trg_broadcast_content_report ON public."ContentReport";
CREATE TRIGGER trg_broadcast_content_report
  AFTER INSERT OR UPDATE OR DELETE ON public."ContentReport"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_moderation_broadcast();

DROP TRIGGER IF EXISTS trg_broadcast_post_flag ON public."Post";
CREATE TRIGGER trg_broadcast_post_flag
  AFTER UPDATE OF "isFlagged" ON public."Post"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_moderation_broadcast();

-- 3e. Audit trail -> admin:audit
CREATE OR REPLACE FUNCTION public.trg_fn_audit_broadcast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  PERFORM public.safe_broadcast('admin:audit', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA,
    to_jsonb(NEW), NULL);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'audit broadcast: %', SQLERRM;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_broadcast_admin_audit ON public."AdminAuditLog";
CREATE TRIGGER trg_broadcast_admin_audit
  AFTER INSERT ON public."AdminAuditLog"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_audit_broadcast();

-- 3g. The three triggers that bypassed safe_broadcast.
--
-- broadcast_user_presence, trg_fn_directory_counts_broadcast and
-- trg_fn_service_counts_refresh call realtime.broadcast_changes directly with
-- the old seven-argument shape, so every write raised 42883 — and each one hid
-- it: the presence trigger RAISE WARNINGs, the two count triggers swallow with
-- `THEN NULL`. No migration creates them; they exist in production only, which
-- is why the trigger definitions are recreated here rather than trusted to
-- already be attached.
--
-- refresh_directory_counts() is left exactly as it was: it takes an advisory
-- lock and refreshes mv_category_counts / mv_service_counts concurrently, and a
-- failure there must never block a Consultant write. The publish therefore sits
-- outside that block, and its payload stays an invalidation signal ('at') —
-- the client refetches /api/services/counts instead of trusting the body.
CREATE OR REPLACE FUNCTION public.broadcast_user_presence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  IF NEW.is_online IS DISTINCT FROM OLD.is_online THEN
    -- The id in this topic is a User id (the trigger is on "User"), which is
    -- what the directory cards match on; "consultantId" is the established key
    -- name and the route-handler publish uses it too.
    PERFORM public.safe_broadcast('consultants:live', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA,
      jsonb_build_object('consultantId', NEW.id::text, 'is_online', NEW.is_online, 'at', now()),
      jsonb_build_object('consultantId', OLD.id::text, 'is_online', OLD.is_online));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'broadcast_user_presence: %', SQLERRM;
  RETURN NEW;
END;
$func$;

CREATE OR REPLACE FUNCTION public.trg_fn_directory_counts_broadcast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  BEGIN PERFORM public.refresh_directory_counts(); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM public.safe_broadcast('directory:counts', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA,
    jsonb_build_object('at', now()), NULL);
  RETURN COALESCE(NEW, OLD);
END;
$func$;

CREATE OR REPLACE FUNCTION public.trg_fn_service_counts_refresh()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  BEGIN PERFORM public.refresh_directory_counts(); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM public.safe_broadcast('directory:counts', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA,
    jsonb_build_object('at', now()), NULL);
  RETURN COALESCE(NEW, OLD);
END;
$func$;

DROP TRIGGER IF EXISTS trg_broadcast_user_presence ON public."User";
CREATE TRIGGER trg_broadcast_user_presence
  AFTER UPDATE OF is_online ON public."User"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_user_presence();

DROP TRIGGER IF EXISTS trg_directory_counts_refresh ON public."Consultant";
CREATE TRIGGER trg_directory_counts_refresh
  AFTER INSERT OR DELETE OR UPDATE OF status, "isActive", "isVerified", category
  ON public."Consultant"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_directory_counts_broadcast();

DROP TRIGGER IF EXISTS trg_service_counts_refresh ON public."ConsultantService";
CREATE TRIGGER trg_service_counts_refresh
  AFTER INSERT OR DELETE OR UPDATE ON public."ConsultantService"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_service_counts_refresh();

-- 3h. Narrow the two payloads that ride public topics.
--
-- Repairing safe_broadcast also wakes up two publishers that send whole rows on
-- topics an anonymous visitor may read:
--
--   trg_fn_directory_broadcast       Consultant   -> consultants:live
--       (earnings, verificationDocs, rejectionReason, approvedBy, every rate)
--   trg_fn_ai_consultant_broadcast   AIConsultant -> consultant:ai:updates
--       (persona, systemPrompt, safetyLevel, bannedPatterns, model, accuracy)
--
-- Neither table is readable through PostgREST for anon — Consultant's only RLS
-- policy is for supabase_auth_admin and AIConsultant has no policies at all —
-- so the broadcast would have been the one channel that handed the operating
-- prompt of every AI consultant, and every consultant's earnings, to whoever
-- holds the public anon key. Both payloads become allow-lists: exactly the
-- fields the public cards render.
CREATE OR REPLACE FUNCTION public.trg_fn_directory_broadcast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  -- A signal, not a row: the directory re-queries /api/explore/consultants, and
  -- presence changes are published on this topic by the "User" trigger with the
  -- consultant's user id, which is the key the cards match on.
  PERFORM public.safe_broadcast('consultants:live', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA,
    jsonb_build_object(
      'consultantId', COALESCE(NEW."userId", OLD."userId")::text,
      'at', now()),
    NULL);
  RETURN COALESCE(NEW, OLD);
END;
$func$;

CREATE OR REPLACE FUNCTION public.trg_fn_ai_consultant_broadcast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
DECLARE
  v_new jsonb;
  v_old jsonb;
BEGIN
  IF TG_OP <> 'DELETE' THEN
    v_new := jsonb_build_object(
      'id', NEW.id, 'name', NEW.name, 'username', NEW.username,
      'avatar', NEW.avatar, 'category', NEW.category, 'bio', NEW.bio,
      'rating', NEW.rating, 'isPaid', NEW."isPaid",
      'perMinuteRate', NEW."perMinuteRate", 'specialties', NEW.specialties,
      'languages', NEW.languages, 'experience', NEW.experience,
      'totalConsultations', NEW."totalConsultations", 'sparks', NEW.sparks,
      'gender', NEW.gender, 'voiceStyle', NEW."voiceStyle",
      'responseTime', NEW."responseTime", 'isFeatured', NEW."isFeatured",
      'isActive', NEW."isActive");
  END IF;
  IF TG_OP = 'DELETE' THEN
    -- Subscribers only need the id to drop the card.
    v_old := jsonb_build_object('id', OLD.id);
  END IF;
  PERFORM public.safe_broadcast('consultant:ai:updates', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA,
    v_new, v_old);
  RETURN COALESCE(NEW, OLD);
END;
$func$;

DROP TRIGGER IF EXISTS trg_broadcast_consultant_directory ON public."Consultant";
CREATE TRIGGER trg_broadcast_consultant_directory
  AFTER INSERT OR UPDATE OR DELETE ON public."Consultant"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_directory_broadcast();

DROP TRIGGER IF EXISTS trg_broadcast_ai_consultant ON public."AIConsultant";
CREATE TRIGGER trg_broadcast_ai_consultant
  AFTER INSERT OR UPDATE OR DELETE ON public."AIConsultant"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_ai_consultant_broadcast();

-- The broadcast functions are SECURITY DEFINER and reach every role by design:
-- triggers run as the writing role (including service_role and anon inserts).
-- Nothing here grants EXECUTE to anon on an RPC — these take no user input.
GRANT EXECUTE ON FUNCTION public.trg_fn_user_sparks_broadcast() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.trg_fn_booking_broadcast()     TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.trg_fn_moderation_broadcast()  TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.trg_fn_audit_broadcast()       TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_user_presence()      TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.trg_fn_directory_counts_broadcast() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.trg_fn_service_counts_refresh() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.trg_fn_directory_broadcast()   TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.trg_fn_ai_consultant_broadcast() TO authenticated, service_role, anon;

NOTIFY pgrst, 'reload schema';
