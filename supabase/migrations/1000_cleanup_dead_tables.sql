-- ============================================================================
-- 1000_cleanup_dead_tables.sql
-- Forward-only cleanup migration: drop tables with ZERO application references.
--
-- Verified against live schema (2026-09-26) and full-repo grep of
-- apps/web, apps/admin, packages/* — no .from(), .rpc(), or SQL references.
--
-- KEPT (still load-bearing):
--   rate_limits / rate_limit_buckets / AIChatRateLimit / RateChangeLog
--     -> reachable only via RPCs (check_rate_limit, check_ai_rate_limit,
--        request_pricing_change); app code never queries them directly.
--   _zeal_migrations -> migration bookkeeping.
--   _mv_refresh_log  -> refresh_consultant_directory RPC may log into it.
--
-- Every drop is guarded: the table is only dropped when NO function body
-- (pg_proc.prosrc) and NO dependent view/rule (pg_depend) references it.
-- Otherwise the drop is skipped with a NOTICE. Safe to re-run (idempotent).
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- Guarded drop helper logic, repeated per table (plain SQL, no helper fn
-- left behind).
-- --------------------------------------------------------------------------

DO $do$
DECLARE
  tbl text := 'wallet_ledger';  -- dead duplicate of Wallet/Transaction ledger
  dep record;
BEGIN
  IF to_regclass('public.' || tbl) IS NULL THEN
    RAISE NOTICE 'skip %: absent', tbl; RETURN;
  END IF;
  SELECT 1 INTO dep FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosrc ILIKE '%' || tbl || '%' LIMIT 1;
  IF dep IS NOT NULL THEN
    RAISE NOTICE 'skip %: referenced by a function body', tbl; RETURN;
  END IF;
  SELECT 1 INTO dep FROM pg_depend d
   WHERE d.refobjid = to_regclass('public.' || tbl)
     AND d.classid IN ('pg_rewrite'::regclass) LIMIT 1;
  IF dep IS NOT NULL THEN
    RAISE NOTICE 'skip %: referenced by a view/rule', tbl; RETURN;
  END IF;
  EXECUTE format('DROP TABLE public.%I', tbl);
  RAISE NOTICE 'dropped %', tbl;
END $do$;

DO $do$
DECLARE
  tbl text := 'audit_logs';  -- dead duplicate of AdminAuditLog
  dep record;
BEGIN
  IF to_regclass('public.' || tbl) IS NULL THEN
    RAISE NOTICE 'skip %: absent', tbl; RETURN;
  END IF;
  SELECT 1 INTO dep FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosrc ILIKE '%' || tbl || '%' LIMIT 1;
  IF dep IS NOT NULL THEN
    RAISE NOTICE 'skip %: referenced by a function body', tbl; RETURN;
  END IF;
  SELECT 1 INTO dep FROM pg_depend d
   WHERE d.refobjid = to_regclass('public.' || tbl)
     AND d.classid IN ('pg_rewrite'::regclass) LIMIT 1;
  IF dep IS NOT NULL THEN
    RAISE NOTICE 'skip %: referenced by a view/rule', tbl; RETURN;
  END IF;
  EXECUTE format('DROP TABLE public.%I', tbl);
  RAISE NOTICE 'dropped %', tbl;
END $do$;

DO $do$
DECLARE
  tbl text := 'ai_services';  -- orphan; app uses AIConsultant
  dep record;
BEGIN
  IF to_regclass('public.' || tbl) IS NULL THEN
    RAISE NOTICE 'skip %: absent', tbl; RETURN;
  END IF;
  SELECT 1 INTO dep FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosrc ILIKE '%' || tbl || '%' LIMIT 1;
  IF dep IS NOT NULL THEN
    RAISE NOTICE 'skip %: referenced by a function body', tbl; RETURN;
  END IF;
  SELECT 1 INTO dep FROM pg_depend d
   WHERE d.refobjid = to_regclass('public.' || tbl)
     AND d.classid IN ('pg_rewrite'::regclass) LIMIT 1;
  IF dep IS NOT NULL THEN
    RAISE NOTICE 'skip %: referenced by a view/rule', tbl; RETURN;
  END IF;
  EXECUTE format('DROP TABLE public.%I', tbl);
  RAISE NOTICE 'dropped %', tbl;
END $do$;

DO $do$
DECLARE
  tbl text := 'ai_profiles';  -- orphan; app uses AIConsultant
  dep record;
BEGIN
  IF to_regclass('public.' || tbl) IS NULL THEN
    RAISE NOTICE 'skip %: absent', tbl; RETURN;
  END IF;
  SELECT 1 INTO dep FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosrc ILIKE '%' || tbl || '%' LIMIT 1;
  IF dep IS NOT NULL THEN
    RAISE NOTICE 'skip %: referenced by a function body', tbl; RETURN;
  END IF;
  SELECT 1 INTO dep FROM pg_depend d
   WHERE d.refobjid = to_regclass('public.' || tbl)
     AND d.classid IN ('pg_rewrite'::regclass) LIMIT 1;
  IF dep IS NOT NULL THEN
    RAISE NOTICE 'skip %: referenced by a view/rule', tbl; RETURN;
  END IF;
  EXECUTE format('DROP TABLE public.%I', tbl);
  RAISE NOTICE 'dropped %', tbl;
END $do$;

DO $do$
DECLARE
  tbl text := 'AdminLoginAttempt';  -- never written by app code
  dep record;
BEGIN
  IF to_regclass('public.' || tbl) IS NULL THEN
    RAISE NOTICE 'skip %: absent', tbl; RETURN;
  END IF;
  SELECT 1 INTO dep FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosrc ILIKE '%' || tbl || '%' LIMIT 1;
  IF dep IS NOT NULL THEN
    RAISE NOTICE 'skip %: referenced by a function body', tbl; RETURN;
  END IF;
  SELECT 1 INTO dep FROM pg_depend d
   WHERE d.refobjid = to_regclass('public.' || tbl)
     AND d.classid IN ('pg_rewrite'::regclass) LIMIT 1;
  IF dep IS NOT NULL THEN
    RAISE NOTICE 'skip %: referenced by a view/rule', tbl; RETURN;
  END IF;
  EXECUTE format('DROP TABLE public.%I', tbl);
  RAISE NOTICE 'dropped %', tbl;
END $do$;

DO $do$
DECLARE
  tbl text := 'DebugLog';  -- error-log route only console.logs; no DB writes
  dep record;
BEGIN
  IF to_regclass('public.' || tbl) IS NULL THEN
    RAISE NOTICE 'skip %: absent', tbl; RETURN;
  END IF;
  SELECT 1 INTO dep FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosrc ILIKE '%' || tbl || '%' LIMIT 1;
  IF dep IS NOT NULL THEN
    RAISE NOTICE 'skip %: referenced by a function body', tbl; RETURN;
  END IF;
  SELECT 1 INTO dep FROM pg_depend d
   WHERE d.refobjid = to_regclass('public.' || tbl)
     AND d.classid IN ('pg_rewrite'::regclass) LIMIT 1;
  IF dep IS NOT NULL THEN
    RAISE NOTICE 'skip %: referenced by a view/rule', tbl; RETURN;
  END IF;
  EXECUTE format('DROP TABLE public.%I', tbl);
  RAISE NOTICE 'dropped %', tbl;
END $do$;

DO $do$
DECLARE
  tbl text := '_zeal_diag';  -- one-off diagnostics table
  dep record;
BEGIN
  IF to_regclass('public.' || tbl) IS NULL THEN
    RAISE NOTICE 'skip %: absent', tbl; RETURN;
  END IF;
  SELECT 1 INTO dep FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosrc ILIKE '%' || tbl || '%' LIMIT 1;
  IF dep IS NOT NULL THEN
    RAISE NOTICE 'skip %: referenced by a function body', tbl; RETURN;
  END IF;
  SELECT 1 INTO dep FROM pg_depend d
   WHERE d.refobjid = to_regclass('public.' || tbl)
     AND d.classid IN ('pg_rewrite'::regclass) LIMIT 1;
  IF dep IS NOT NULL THEN
    RAISE NOTICE 'skip %: referenced by a view/rule', tbl; RETURN;
  END IF;
  EXECUTE format('DROP TABLE public.%I', tbl);
  RAISE NOTICE 'dropped %', tbl;
END $do$;

DO $do$
DECLARE
  tbl text := '_zeal_audit_history';  -- written only by manual 999_audit_auth.sql
  dep record;
BEGIN
  IF to_regclass('public.' || tbl) IS NULL THEN
    RAISE NOTICE 'skip %: absent', tbl; RETURN;
  END IF;
  SELECT 1 INTO dep FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosrc ILIKE '%' || tbl || '%' LIMIT 1;
  IF dep IS NOT NULL THEN
    RAISE NOTICE 'skip %: referenced by a function body', tbl; RETURN;
  END IF;
  SELECT 1 INTO dep FROM pg_depend d
   WHERE d.refobjid = to_regclass('public.' || tbl)
     AND d.classid IN ('pg_rewrite'::regclass) LIMIT 1;
  IF dep IS NOT NULL THEN
    RAISE NOTICE 'skip %: referenced by a view/rule', tbl; RETURN;
  END IF;
  EXECUTE format('DROP TABLE public.%I', tbl);
  RAISE NOTICE 'dropped %', tbl;
END $do$;

-- --------------------------------------------------------------------------
-- Post-state report: list remaining public tables for the operator log.
-- --------------------------------------------------------------------------
DO $do$
DECLARE r record; BEGIN
  RAISE NOTICE '--- remaining public tables ---';
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1 LOOP
    RAISE NOTICE '%', r.tablename;
  END LOOP;
END $do$;

COMMIT;
