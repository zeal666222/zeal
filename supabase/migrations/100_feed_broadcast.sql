-- ═══════════════════════════════════════════════════════════════════════════════
-- 100_feed_broadcast.sql — public feed channel
-- ═══════════════════════════════════════════════════════════════════════════════
-- Broadcasts Post INSERT/UPDATE to the `feed:posts` channel so the homepage
-- prepends new posts without polling. Uses the safe_broadcast helper defined
-- in migration 004.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.trg_fn_post_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW."isFlagged" = false THEN
    PERFORM public.safe_broadcast(
      'feed:posts',
      TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA,
      to_jsonb(NEW), to_jsonb(OLD)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_post ON public."Post";
CREATE TRIGGER trg_broadcast_post
  AFTER INSERT OR UPDATE ON public."Post"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_post_broadcast();

-- Ensure Post is in realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'Post'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."Post";
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

DO $$ BEGIN
  RAISE NOTICE '100_feed_broadcast.sql — Post trigger installed on feed:posts';
END $$;

COMMIT;
