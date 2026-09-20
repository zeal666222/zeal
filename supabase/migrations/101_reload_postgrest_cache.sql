-- ═══════════════════════════════════════════════════════════════════════════════
-- 101_reload_postgrest_cache.sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Flushes any stale PostgREST schema metadata left behind after failed inserts
-- referencing a non-existent `avatar` column on the `User` table.
--
-- Reference:
--   https://supabase.com/docs/guides/troubleshooting/postgrest-not-recognizing-new-columns
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Step 1 — drain the notification queue so PostgREST is guaranteed to
--          observe the reload signal (Supabase docs recommendation).
DO $$
BEGIN
  PERFORM pg_notification_queue_usage();
EXCEPTION WHEN undefined_function THEN
  -- Not available on some Postgres versions — non-fatal
  NULL;
END $$;

-- Step 2 — standard PostgREST reload (also re-reads config + relationships).
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- Step 3 — assert the canonical User columns exist (defense in depth).
DO $$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(col) INTO missing
  FROM (
    VALUES ('avatar_url'), ('username'), ('name'), ('full_name')
  ) AS expected(col)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = expected.col
  );

  IF missing IS NOT NULL THEN
    RAISE WARNING 'User table missing expected columns: %', missing;
  ELSE
    RAISE NOTICE 'User table schema verified: avatar_url, username, name, full_name present';
  END IF;
END $$;

COMMIT;
