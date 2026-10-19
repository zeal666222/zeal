-- ============================================================================
-- 20261018120000_avatar_realtime_topic_fix.sql
-- ----------------------------------------------------------------------------
-- The 1200_avatar_realtime migration broadcast avatar updates on topic
-- `user:profile:<uid>`, but the RLS policy on realtime.messages permits only
-- topics shaped `user:<auth.uid()>:%` — the uid at the tail never matched, so
-- every subscription was silently rejected and clients saw stale avatars.
--
-- Align the trigger to `user:<uid>:profile` (matches the client helper in
-- packages/realtime/src/channels.ts) and also broadcast the whole profile
-- payload so the store can update name/username/bio/sparks without refetching.
--
-- Idempotent.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.trg_fn_user_avatar_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  -- Only fire when a client-visible profile field actually changed.
  IF OLD.avatar     IS DISTINCT FROM NEW.avatar
     OR OLD.name      IS DISTINCT FROM NEW.name
     OR OLD.username  IS DISTINCT FROM NEW.username
     OR OLD.bio       IS DISTINCT FROM NEW.bio
     OR OLD.sparks    IS DISTINCT FROM NEW.sparks
     OR OLD."isVerified" IS DISTINCT FROM NEW."isVerified"
  THEN
    v_payload := jsonb_build_object(
      'userId',     NEW.id,
      'avatar',     NEW.avatar,
      'name',       NEW.name,
      'username',   NEW.username,
      'bio',        NEW.bio,
      'sparks',     NEW.sparks,
      'isVerified', NEW."isVerified"
    );
    PERFORM public.safe_broadcast(
      'user:' || NEW.id::text || ':profile',
      TG_OP,
      TG_TABLE_NAME,
      TG_TABLE_SCHEMA,
      v_payload,
      row_to_json(OLD)::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists and points at the updated function.
DROP TRIGGER IF EXISTS trg_broadcast_user_avatar ON public."User";
CREATE TRIGGER trg_broadcast_user_avatar
  AFTER UPDATE ON public."User"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_user_avatar_broadcast();

-- Widen the RLS policy to accept the corrected topic. Idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='realtime' AND tablename='messages' AND policyname='realtime_user_channels') THEN
    DROP POLICY "realtime_user_channels" ON realtime.messages;
  END IF;
  CREATE POLICY "realtime_user_channels" ON realtime.messages
    FOR SELECT TO authenticated
    USING (
      realtime.topic() LIKE 'user:' || (SELECT auth.uid())::text || ':%'
      OR realtime.topic() LIKE 'consultant:' || (SELECT auth.uid())::text || ':%'
      OR (realtime.topic() LIKE 'room:%' AND public.user_is_in_conversation(
        SUBSTRING(realtime.topic() FROM 'room:([0-9a-f-]{36}):')::uuid))
      OR (realtime.topic() LIKE 'booking:%' AND public.user_can_view_booking(
        SUBSTRING(realtime.topic() FROM 'booking:([0-9a-f-]{36}):')::uuid))
      OR realtime.topic() LIKE 'presence:%'
    );
  RAISE NOTICE 'realtime.messages RLS re-applied';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping realtime.messages RLS — not owner (safe to ignore): %', SQLERRM;
END $$;

COMMIT;
