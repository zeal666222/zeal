-- ═══════════════════════════════════════════════════════════════════════════════
-- ZEAL — DIRECT AUTH FIX  (Paste into Supabase → SQL Editor → Run)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Fully idempotent. Safe to re-run. Self-verifying. No migrations needed.
--
-- Fixes:
--   1. AppRole enum missing → creates it
--   2. User.role text → casts to AppRole enum
--   3. custom_access_token_hook 42501 → grants + RLS carve-out + fail-open
--   4. handle_new_user trigger → routes by account_type
--   5. AdminAuditLog CHECK constraint → drops it
--   6. Missing tables → audit report
--   7. RLS policies → rebuilt with wrapped auth.uid()
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── SECTION 0: Pre-flight diagnostics ────────────────────────────────────────
DO $$
DECLARE
  v_table_count int;
  v_user_count  int;
  v_enum_exists boolean;
BEGIN
  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

  SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AppRole') INTO v_enum_exists;

  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public."User"' INTO v_user_count;
  EXCEPTION WHEN OTHERS THEN
    v_user_count := -1;
  END;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  ZEAL DIRECT AUTH FIX — PRE-FLIGHT';
  RAISE NOTICE '  Public tables     : %', v_table_count;
  RAISE NOTICE '  AppRole enum      : %', v_enum_exists;
  RAISE NOTICE '  User row count    : %', v_user_count;
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;

-- ─── SECTION 1: AppRole enum ──────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AppRole') THEN
    CREATE TYPE public."AppRole" AS ENUM (
      'USER','CLIENT_ADMIN','SUPPORT','ADMIN','SUPER_ADMIN','VIEWER','AI'
    );
    RAISE NOTICE '[1] ✓ Created AppRole enum';
  ELSE
    RAISE NOTICE '[1] ✓ AppRole enum already exists';
  END IF;
END $$;

-- ─── SECTION 2: Ensure required tables exist (defensive) ──────────────────────
DO $$
BEGIN
  IF to_regclass('public."User"') IS NULL THEN
    CREATE TABLE public."User" (
      id uuid PRIMARY KEY,
      email text NOT NULL UNIQUE,
      username text UNIQUE,
      name text,
      full_name text,
      avatar_url text,
      role public."AppRole" NOT NULL DEFAULT 'USER',
      sparks integer NOT NULL DEFAULT 100,
      "isVerified" boolean NOT NULL DEFAULT false,
      "is_online" boolean NOT NULL DEFAULT false,
      "sparkScore" bigint NOT NULL DEFAULT 0,
      "lastSeenAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );
    RAISE NOTICE '[2] ✓ Created User table';
  ELSE
    RAISE NOTICE '[2] ✓ User table exists';
  END IF;

  IF to_regclass('public."Consultant"') IS NULL THEN
    CREATE TABLE public."Consultant" (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" uuid NOT NULL UNIQUE REFERENCES public."User"(id) ON DELETE CASCADE,
      category text NOT NULL DEFAULT 'ASTROLOGER',
      specialties text[] NOT NULL DEFAULT '{}',
      languages text[] NOT NULL DEFAULT '{English}',
      bio text,
      "perMinuteRate" double precision NOT NULL DEFAULT 50,
      "isVerified" boolean NOT NULL DEFAULT true,
      "isActive" boolean NOT NULL DEFAULT true,
      status text NOT NULL DEFAULT 'VERIFIED',
      subdomain text UNIQUE,
      "subdomainActive" boolean NOT NULL DEFAULT true,
      "whiteLabelEnabled" boolean NOT NULL DEFAULT true,
      rating double precision NOT NULL DEFAULT 5.0,
      "totalConsultations" integer NOT NULL DEFAULT 0,
      "sparkScore" bigint NOT NULL DEFAULT 0,
      "bufferMinutes" integer NOT NULL DEFAULT 10,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );
    RAISE NOTICE '[2] ✓ Created Consultant table';
  ELSE
    RAISE NOTICE '[2] ✓ Consultant table exists';
  END IF;

  IF to_regclass('public."Wallet"') IS NULL THEN
    CREATE TABLE public."Wallet" (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" uuid NOT NULL UNIQUE REFERENCES public."User"(id) ON DELETE CASCADE,
      balance double precision NOT NULL DEFAULT 0,
      escrow double precision NOT NULL DEFAULT 0,
      "pendingIn" double precision NOT NULL DEFAULT 0,
      "pendingOut" double precision NOT NULL DEFAULT 0,
      blocked double precision NOT NULL DEFAULT 0,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );
    RAISE NOTICE '[2] ✓ Created Wallet table';
  ELSE
    RAISE NOTICE '[2] ✓ Wallet table exists';
  END IF;

  IF to_regclass('public."AdminAuditLog"') IS NULL THEN
    CREATE TABLE public."AdminAuditLog" (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      action text NOT NULL DEFAULT 'UPDATE',
      action_name text,
      "userId" uuid,
      email text,
      "targetType" text,
      "targetId" text,
      metadata jsonb,
      ip text,
      "userAgent" text,
      success boolean DEFAULT true,
      "createdAt" timestamptz DEFAULT now()
    );
    RAISE NOTICE '[2] ✓ Created AdminAuditLog table';
  ELSE
    RAISE NOTICE '[2] ✓ AdminAuditLog table exists';
  END IF;
END $$;

-- ─── SECTION 3: Normalize User.role to AppRole enum ───────────────────────────
DO $$
DECLARE col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='User' AND column_name='role';

  IF col_type IS DISTINCT FROM 'USER-DEFINED' THEN
    UPDATE public."User"
    SET role = UPPER(role::text)::public."AppRole"
    WHERE role IS NOT NULL;

    ALTER TABLE public."User" ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE public."User"
      ALTER COLUMN role TYPE public."AppRole"
      USING role::text::public."AppRole";
    ALTER TABLE public."User"
      ALTER COLUMN role SET DEFAULT 'USER'::public."AppRole";
    RAISE NOTICE '[3] ✓ Converted User.role → AppRole enum';
  ELSE
    RAISE NOTICE '[3] ✓ User.role already AppRole enum';
  END IF;
END $$;

-- ─── SECTION 4: Grants for supabase_auth_admin ────────────────────────────────
DO $$
BEGIN
  GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
  IF to_regclass('public."User"') IS NOT NULL THEN
    GRANT SELECT ON public."User" TO supabase_auth_admin;
  END IF;
  IF to_regclass('public."Consultant"') IS NOT NULL THEN
    GRANT SELECT ON public."Consultant" TO supabase_auth_admin;
  END IF;
  RAISE NOTICE '[4] ✓ Grants applied';
END $$;

-- ─── SECTION 5: RLS carve-out ─────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public."User"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY';
    DROP POLICY IF EXISTS "user_auth_admin_read" ON public."User";
    CREATE POLICY "user_auth_admin_read" ON public."User"
      FOR SELECT TO supabase_auth_admin USING (true);
  END IF;
  IF to_regclass('public."Consultant"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public."Consultant" ENABLE ROW LEVEL SECURITY';
    DROP POLICY IF EXISTS "consultant_auth_admin_read" ON public."Consultant";
    CREATE POLICY "consultant_auth_admin_read" ON public."Consultant"
      FOR SELECT TO supabase_auth_admin USING (true);
  END IF;
  RAISE NOTICE '[5] ✓ RLS carve-out for supabase_auth_admin';
END $$;

-- ─── SECTION 6: Fail-open custom_access_token_hook ────────────────────────────
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
    SELECT COALESCE(u.role::text, 'USER'), COALESCE(c.status, 'none')
    INTO user_role, consultant_status
    FROM (SELECT v_sub::uuid AS uid) x
    LEFT JOIN public."User"       u ON u.id       = x.uid
    LEFT JOIN public."Consultant" c ON c."userId" = x.uid;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'custom_access_token_hook: %', SQLERRM;
  END;

  claims := jsonb_set(claims, '{user_role}',         to_jsonb(user_role));
  claims := jsonb_set(claims, '{consultant_status}', to_jsonb(consultant_status));
  RETURN jsonb_set(event, '{claims}', claims);
END;
$fn$;

ALTER FUNCTION public.custom_access_token_hook(jsonb) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb)
  FROM authenticated, anon, public;

DO $$ BEGIN RAISE NOTICE '[6] ✓ custom_access_token_hook installed'; END $$;

-- ─── SECTION 7: handle_new_user trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_account_type text;
  v_role         text;
  v_base         text;
  v_username     text;
  v_full_name    text;
  v_avatar       text;
  v_slug         text;
  v_subdomain    text;
  v_attempt      int := 0;
BEGIN
  v_account_type := LOWER(COALESCE(new.raw_user_meta_data->>'account_type', 'seeker'));
  v_role := CASE WHEN v_account_type = 'consultant' THEN 'CLIENT_ADMIN' ELSE 'USER' END;

  v_base := LOWER(REGEXP_REPLACE(
    COALESCE(SPLIT_PART(new.email, '@', 1), 'user'),
    '[^a-z0-9_]', '', 'g'
  ));
  IF LENGTH(v_base) < 3 THEN v_base := 'user'; END IF;

  LOOP
    v_username := v_base || '_' ||
      SUBSTRING(REPLACE(new.id::text, '-', ''), GREATEST(1, 7 - v_attempt), 6);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public."User" WHERE username = v_username);
    v_attempt := v_attempt + 1;
    IF v_attempt > 4 THEN
      v_username := v_base || '_' ||
        SUBSTRING(REPLACE(new.id::text, '-', ''), 1, 10);
      EXIT;
    END IF;
  END LOOP;

  v_full_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    SPLIT_PART(new.email, '@', 1)
  );
  v_avatar := new.raw_user_meta_data->>'avatar_url';

  INSERT INTO public."User" (
    id, email, username, name, full_name, avatar_url, role, sparks
  ) VALUES (
    new.id, new.email, v_username, v_full_name, v_full_name, v_avatar,
    v_role::public."AppRole", 100
  )
  ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role, "updatedAt" = now()
    WHERE public."User".role::text <> EXCLUDED.role::text;

  INSERT INTO public."Wallet"
    ("userId", balance, escrow, "pendingIn", "pendingOut", blocked)
  VALUES (new.id, 0, 0, 0, 0, 0)
  ON CONFLICT ("userId") DO NOTHING;

  IF v_role = 'CLIENT_ADMIN' THEN
    v_slug := LOWER(REGEXP_REPLACE(COALESCE(v_full_name, 'guide'),
                                   '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := TRIM(BOTH '-' FROM v_slug);
    IF LENGTH(v_slug) < 3  THEN v_slug := 'guide'; END IF;
    IF LENGTH(v_slug) > 20 THEN v_slug := SUBSTRING(v_slug, 1, 20); END IF;
    v_subdomain := v_slug || '-' ||
      SUBSTRING(REPLACE(new.id::text, '-', ''), 1, 4);

    INSERT INTO public."Consultant" (
      "userId", category, specialties, languages, "perMinuteRate",
      status, "isVerified", "isActive",
      subdomain, "subdomainActive", "whiteLabelEnabled",
      rating, "totalConsultations", "sparkScore", "bufferMinutes"
    ) VALUES (
      new.id, 'ASTROLOGER', '{}', '{English}', 50,
      'VERIFIED', true, true,
      v_subdomain, true, true,
      5.0, 0, 0, 10
    )
    ON CONFLICT ("userId") DO NOTHING;
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', v_role)
  WHERE id = new.id;

  RETURN new;
END;
$fn$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DO $$ BEGIN RAISE NOTICE '[7] ✓ handle_new_user trigger installed'; END $$;

-- ─── SECTION 8: AdminAuditLog CHECK fix ───────────────────────────────────────
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public."AdminAuditLog"'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%action%INSERT%UPDATE%DELETE%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public."AdminAuditLog" DROP CONSTRAINT %I', cname);
  END IF;
  UPDATE public."AdminAuditLog"
  SET action_name = COALESCE(action_name, action) WHERE action_name IS NULL;
  ALTER TABLE public."AdminAuditLog"
    ALTER COLUMN action SET DEFAULT 'UPDATE';
  RAISE NOTICE '[8] ✓ AdminAuditLog CHECK fixed';
END $$;

-- ─── SECTION 9: Missing-table audit ───────────────────────────────────────────
DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'User','Consultant','Wallet','Transaction','Booking','CallSession',
    'Conversation','ConversationParticipant','Message','Notification',
    'Post','Comment','Cheer','AIConsultant','AdminAuditLog'
  ]) LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      v_missing := array_append(v_missing, t);
    END IF;
  END LOOP;
  IF array_length(v_missing, 1) > 0 THEN
    RAISE WARNING '[9] Missing tables: %', array_to_string(v_missing, ', ');
  ELSE
    RAISE NOTICE '[9] ✓ All canonical tables present';
  END IF;
END $$;

-- ─── SECTION 10: RLS policies with wrapped auth.uid() ─────────────────────────
DO $$
BEGIN
  IF to_regclass('public."User"') IS NOT NULL THEN
    DROP POLICY IF EXISTS user_self_select ON public."User";
    DROP POLICY IF EXISTS user_self_insert ON public."User";
    DROP POLICY IF EXISTS user_self_update ON public."User";
    CREATE POLICY user_self_select ON public."User"
      FOR SELECT USING (id = (SELECT auth.uid()));
    CREATE POLICY user_self_insert ON public."User"
      FOR INSERT WITH CHECK (id = (SELECT auth.uid()));
    CREATE POLICY user_self_update ON public."User"
      FOR UPDATE USING (id = (SELECT auth.uid()));
  END IF;
  IF to_regclass('public."Wallet"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public."Wallet" ENABLE ROW LEVEL SECURITY';
    DROP POLICY IF EXISTS wallet_owner_read ON public."Wallet";
    CREATE POLICY wallet_owner_read ON public."Wallet"
      FOR SELECT USING ("userId" = (SELECT auth.uid()));
  END IF;
  IF to_regclass('public."Consultant"') IS NOT NULL THEN
    DROP POLICY IF EXISTS consultant_public_read ON public."Consultant";
    DROP POLICY IF EXISTS consultant_self_manage ON public."Consultant";
    CREATE POLICY consultant_public_read ON public."Consultant"
      FOR SELECT USING (status = 'VERIFIED' AND "isActive" = true);
    CREATE POLICY consultant_self_manage ON public."Consultant"
      FOR UPDATE USING ("userId" = (SELECT auth.uid()));
  END IF;
  RAISE NOTICE '[10] ✓ RLS policies rebuilt';
END $$;

-- ─── SECTION 11: Auth helper functions ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'user_role',
    auth.jwt() -> 'app_metadata' ->> 'role',
    'USER'
  );
$$;
CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.auth_user_role() IN ('ADMIN','SUPER_ADMIN','SUPPORT','VIEWER');
$$;
CREATE OR REPLACE FUNCTION public.auth_is_consultant()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.auth_user_role() IN ('CLIENT_ADMIN','ADMIN','SUPER_ADMIN');
$$;
GRANT EXECUTE ON FUNCTION public.auth_user_role()     TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auth_is_admin()      TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auth_is_consultant() TO authenticated, anon;

-- ─── SECTION 12: hook_health() ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hook_health()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
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
      EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AppRole'),
    'hook_function_exists',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'custom_access_token_hook'),
    'handle_new_user_exists',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user'),
    'checked_at', now()
  );
$fn$;
GRANT EXECUTE ON FUNCTION public.hook_health() TO authenticated;

-- ─── SECTION 13: self_heal_user RPC ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.self_heal_user()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_has_consultant boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT role::text INTO v_role FROM public."User" WHERE id = v_uid;
  IF v_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_user_row');
  END IF;
  SELECT EXISTS(
    SELECT 1 FROM public."Consultant" WHERE "userId" = v_uid
  ) INTO v_has_consultant;
  RETURN jsonb_build_object(
    'success', true, 'role', v_role, 'has_consultant', v_has_consultant
  );
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.self_heal_user() TO authenticated;

-- ─── SECTION 14: PostgREST cache reload ───────────────────────────────────────
DO $$ BEGIN PERFORM pg_notification_queue_usage(); EXCEPTION WHEN undefined_function THEN NULL; END $$;
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- ─── SECTION 15: Final verification ───────────────────────────────────────────
DO $$
DECLARE
  v_user_select boolean;
  v_consult_sel boolean;
  v_fn_exec     boolean;
  v_enum_ok     boolean;
  v_policy_u    boolean;
  v_policy_c    boolean;
  v_trigger_ok  boolean;
  v_user_count  int;
BEGIN
  v_user_select := has_table_privilege('supabase_auth_admin', 'public."User"', 'SELECT');
  v_consult_sel := has_table_privilege('supabase_auth_admin', 'public."Consultant"', 'SELECT');
  v_fn_exec     := has_function_privilege('supabase_auth_admin',
                       'public.custom_access_token_hook(jsonb)', 'EXECUTE');
  v_enum_ok     := EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AppRole');
  SELECT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='User'
      AND policyname='user_auth_admin_read'
      AND 'supabase_auth_admin' = ANY (roles::text[])) INTO v_policy_u;
  SELECT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='Consultant'
      AND policyname='consultant_auth_admin_read'
      AND 'supabase_auth_admin' = ANY (roles::text[])) INTO v_policy_c;
  SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') INTO v_trigger_ok;
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public."User"' INTO v_user_count;
  EXCEPTION WHEN OTHERS THEN v_user_count := -1; END;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  FINAL VERIFICATION';
  RAISE NOTICE '  AppRole enum           : %', v_enum_ok;
  RAISE NOTICE '  User SELECT grant      : %', v_user_select;
  RAISE NOTICE '  Consultant SELECT grant: %', v_consult_sel;
  RAISE NOTICE '  Hook EXECUTE grant     : %', v_fn_exec;
  RAISE NOTICE '  RLS policy (User)      : %', v_policy_u;
  RAISE NOTICE '  RLS policy (Consultant): %', v_policy_c;
  RAISE NOTICE '  handle_new_user trigger: %', v_trigger_ok;
  RAISE NOTICE '  User row count         : %', v_user_count;
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';

  IF NOT (v_enum_ok AND v_user_select AND v_consult_sel AND v_fn_exec
          AND v_policy_u AND v_policy_c AND v_trigger_ok) THEN
    RAISE EXCEPTION 'DIRECT AUTH FIX FAILED';
  END IF;
  RAISE NOTICE '  ✓ ALL CHECKS PASSED';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;
