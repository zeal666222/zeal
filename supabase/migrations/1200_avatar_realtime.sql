-- =============================================================================
-- 1200_avatar_realtime.sql
-- Broadcast User.avatar changes on the user:profile:{uid} channel
-- =============================================================================
-- Clients listening on `user:profile:{uid}` receive:
--   { record: { userId: "<uid>", avatar: "<url>" }, ... }
-- so they can update their local cache without a full refetch.
-- =============================================================================

BEGIN;

-- ─── Trigger function ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_fn_user_avatar_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only fire when the avatar column actually changed
  IF OLD.avatar IS DISTINCT FROM NEW.avatar THEN
    PERFORM public.safe_broadcast(
      'user:profile:' || NEW.id::text,
      TG_OP,
      TG_TABLE_NAME,
      TG_TABLE_SCHEMA,
      jsonb_build_object('userId', NEW.id, 'avatar', NEW.avatar),
      jsonb_build_object('userId', OLD.id, 'avatar', OLD.avatar)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ─── Trigger ─────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_broadcast_user_avatar ON public."User";
CREATE TRIGGER trg_broadcast_user_avatar
  AFTER UPDATE ON public."User"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_user_avatar_broadcast();

COMMIT;
