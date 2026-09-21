-- ═══════════════════════════════════════════════════════════════════════════════
-- 110_fix_auth_hook.sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Idempotent. Creates AppRole enum if missing, grants supabase_auth_admin
-- access to User + Consultant, adds RLS carve-outs, installs fail-open hook.
-- All identifiers are schema-qualified because the hook runs with
-- search_path = ''.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Ensure AppRole enum exists ───────────────────────────────────────────
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AppRole') THEN
    CREATE TYPE public."AppRole" AS ENUM (
      'USER','CLIENT_ADMIN','SUPPORT','ADMIN','SUPER_ADMIN','VIEWER','AI'
    );
    RAISE NOTICE '[110] Created AppRole enum';
  ELSE
    RAISE NOTICE '[110] AppRole enum already exists';
  END IF;
END $do$;

-- ─── 2. Normalize User.role to enum ──────────────────────────────────────────
DO $do$
DECLARE col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='User' AND column_name='role';

  IF col_type IS DISTINCT FROM 'USER-DEFINED' THEN
    -- Normalize text values to uppercase
    EXECUTE $upd$
      UPDATE public."User"
      SET role = UPPER(role::text)
      WHERE role IS NOT NULL AND role::text <> UPPER(role::text)
    $upd$;

    ALTER TABLE public."User" ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE public."User"
      ALTER COLUMN role TYPE public."AppRole"
      USING role::text::public."AppRole";
    ALTER TABLE public."User"
      ALTER COLUMN role SET DEFAULT 'USER'::public."AppRole";
    RAISE NOTICE '[110] User.role converted to AppRole';
  ELSE
    RAISE NOTICE '[110] User.role already uses AppRole';
  END IF;
END $do$;

-- ─── 3. Grants for supabase_auth_admin ───────────────────────────────────────
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT ON public."User"       TO supabase_auth_admin;
GRANT SELECT ON public."Consultant" TO supabase_auth_admin;

-- ─── 4. RLS carve-outs ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_auth_admin_read"       ON public."User";
DROP POLICY IF EXISTS "consultant_auth_admin_read" ON public."Consultant";

CREATE POLICY "user_auth_admin_read" ON public."User"
  FOR SELECT TO supabase_auth_admin USING (true);

CREATE POLICY "consultant_auth_admin_read" ON public."Consultant"
  FOR SELECT TO supabase_auth_admin USING (true);

-- ─── 5. Fail-open hook ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  claims            jsonb;
  user_role         text := 'USER';
  consultant_status text := 'none';
  v_sub             text;
BEGIN
  claims := event->'claims';
  v_sub  := claims->>'sub';

  IF v_sub IS NULL OR v_sub = '' THEN
    RETURN event;
  END IF;

  BEGIN
    SELECT
      COALESCE(u.role::text, 'USER'),
      COALESCE(c.status, 'none')
    INTO user_role, consultant_status
    FROM (SELECT v_sub::uuid AS uid) x
    LEFT JOIN public."User"       u ON u.id       = x.uid
    LEFT JOIN public."Consultant" c ON c."userId" = x.uid;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'custom_access_token_hook: % for %', SQLERRM, v_sub;
  END;

  claims := jsonb_set(claims, '{user_role}',         to_jsonb(user_role));
  claims := jsonb_set(claims, '{consultant_status}', to_jsonb(consultant_status));

  RETURN jsonb_set(event, '{claims}', claims);
END;
$fn$;

ALTER FUNCTION public.custom_access_token_hook(jsonb) OWNER TO postgres;
GRANT  EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb)
  FROM authenticated, anon, public;

-- ─── 6. Health monitor ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hook_health()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
  SELECT jsonb_build_object(
    'auth_admin_can_read_user',
      has_table_privilege('supabase_auth_admin', 'public."User"', 'SELECT'),
    'auth_admin_can_read_consultant',
      has_table_privilege('supabase_auth_admin', 'public."Consultant"', 'SELECT'),
    'auth_admin_can_execute_hook',
      has_function_privilege('supabase_auth_admin',
        'public.custom_access_token_hook(jsonb)', 'EXECUTE'),
    'approle_enum_exists',
      EXISTS (SELECT 1 FROM pg_type WHERE typname='AppRole'),
    'checked_at', now()
  );
$fn$;

GRANT EXECUTE ON FUNCTION public.hook_health() TO authenticated;

-- ─── 7. Verification ─────────────────────────────────────────────────────────
DO $do$
DECLARE
  v_user  boolean := has_table_privilege('supabase_auth_admin','public."User"','SELECT');
  v_cons  boolean := has_table_privilege('supabase_auth_admin','public."Consultant"','SELECT');
  v_fn    boolean := has_function_privilege('supabase_auth_admin',
                       'public.custom_access_token_hook(jsonb)','EXECUTE');
  v_enum  boolean := EXISTS (SELECT 1 FROM pg_type WHERE typname='AppRole');
  v_pu    boolean;
  v_pc    boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='User'
      AND policyname='user_auth_admin_read'
      AND 'supabase_auth_admin' = ANY (roles::text[])
  ) INTO v_pu;

  SELECT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='Consultant'
      AND policyname='consultant_auth_admin_read'
      AND 'supabase_auth_admin' = ANY (roles::text[])
  ) INTO v_pc;

  RAISE NOTICE '[110] enum=% user_select=% consult_select=% fn_exec=% policy_u=% policy_c=%',
    v_enum, v_user, v_cons, v_fn, v_pu, v_pc;

  IF NOT (v_enum AND v_user AND v_cons AND v_fn AND v_pu AND v_pc) THEN
    RAISE EXCEPTION '[110] verification failed';
  END IF;
END $do$;

NOTIFY pgrst, 'reload schema';
COMMIT;