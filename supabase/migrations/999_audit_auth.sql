-- ═══════════════════════════════════════════════════════════════════════════════
-- 999_audit_auth.sql
-- Read-only audit of the auth subsystem. Safe to run any time.
-- ═══════════════════════════════════════════════════════════════════════════════

\echo ''
\echo '════════════════════════════════════════════════════════════'
\echo '  ZEAL — AUTH SUBSYSTEM AUDIT'
\echo '════════════════════════════════════════════════════════════'

\echo ''
\echo '── 1. AppRole enum ─────────────────────────────────────────'
SELECT
  CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname='AppRole')
       THEN '✓  AppRole enum exists'
       ELSE '✗  AppRole enum MISSING' END AS status;

\echo ''
\echo '── 2. Role distribution ────────────────────────────────────'
SELECT role::text AS role, COUNT(*) AS users
FROM public."User"
GROUP BY role
ORDER BY 2 DESC;

\echo ''
\echo '── 3. supabase_auth_admin privileges ───────────────────────'
SELECT
  'User SELECT'       AS privilege,
  has_table_privilege('supabase_auth_admin','public."User"','SELECT')       AS granted
UNION ALL SELECT
  'Consultant SELECT',
  has_table_privilege('supabase_auth_admin','public."Consultant"','SELECT')
UNION ALL SELECT
  'Schema USAGE',
  has_schema_privilege('supabase_auth_admin','public','USAGE')
UNION ALL SELECT
  'Hook EXECUTE',
  has_function_privilege('supabase_auth_admin',
    'public.custom_access_token_hook(jsonb)','EXECUTE');

\echo ''
\echo '── 4. Hook health() ────────────────────────────────────────'
SELECT public.hook_health();

\echo ''
\echo '── 5. Hook function definition ─────────────────────────────'
SELECT
  p.proname                                              AS name,
  pg_get_function_identity_arguments(p.oid)              AS args,
  CASE p.prosecdef WHEN true THEN 'DEFINER' ELSE 'INVOKER' END AS security,
  pg_get_userbyid(p.proowner)                            AS owner,
  p.provolatile                                          AS volatility
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public' AND p.proname='custom_access_token_hook';

\echo ''
\echo '── 6. Role-scoped RLS policies ─────────────────────────────'
SELECT schemaname, tablename, policyname, roles::text AS applies_to, cmd
FROM pg_policies
WHERE schemaname='public'
  AND (
    'supabase_auth_admin' = ANY (roles::text[])
    OR policyname ILIKE '%auth_admin%'
  );

\echo ''
\echo '── 7. auth.users trigger ───────────────────────────────────'
SELECT
  tgname          AS trigger_name,
  tgrelid::regclass AS table_name,
  pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgname='on_auth_user_created';

\echo ''
\echo '── 8. Recent signups (last 10) ─────────────────────────────'
SELECT
  u.id,
  u.email,
  u.role::text AS role,
  (SELECT COUNT(*) FROM public."Consultant" c WHERE c."userId" = u.id) AS has_consultant_row,
  au.raw_app_meta_data->>'role' AS jwt_role,
  u."createdAt"
FROM public."User" u
JOIN auth.users au ON au.id = u.id
ORDER BY u."createdAt" DESC
LIMIT 10;

\echo ''
\echo '── 9. Orphaned rows ────────────────────────────────────────'
SELECT
  'User without Wallet' AS issue,
  COUNT(*)              AS count
FROM public."User" u
LEFT JOIN public."Wallet" w ON w."userId" = u.id
WHERE w.id IS NULL
UNION ALL
SELECT
  'CLIENT_ADMIN without Consultant',
  COUNT(*)
FROM public."User" u
LEFT JOIN public."Consultant" c ON c."userId" = u.id
WHERE u.role::text = 'CLIENT_ADMIN' AND c.id IS NULL
UNION ALL
SELECT
  'auth.users missing public.User row',
  COUNT(*)
FROM auth.users au
LEFT JOIN public."User" u ON u.id = au.id
WHERE u.id IS NULL;

\echo ''
\echo '── 10. Audit CHECK constraint ──────────────────────────────'
SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public."AdminAuditLog"'::regclass
      AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%action%INSERT%UPDATE%DELETE%'
  )
  THEN '✗  Legacy CHECK still present'
  ELSE '✓  Legacy CHECK removed' END AS status;

\echo ''
\echo '════════════════════════════════════════════════════════════'
\echo '  AUDIT COMPLETE'
\echo '════════════════════════════════════════════════════════════'