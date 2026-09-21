-- ═══════════════════════════════════════════════════════════════════════════════
-- 002_custom_access_token_hook.sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Injects role, consultant_status, and AAL into every JWT before issuance.
-- Reference: Supabase docs — Custom Access Token Hook
--   - Required claims: iss, aud, exp, iat, sub, role, aal, session_id, phone, is_anonymous
--   - Optional claims: jti, nbf, app_metadata, user_metadata, amr
--   - Hook runs on every token issue + refresh
--   - Must return claims conforming to spec or Auth returns an error
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Drop old hook if it exists (schema evolved) ─────────────────────────────
DROP FUNCTION IF EXISTS public.custom_access_token_hook(jsonb) CASCADE;

-- ─── Recreate with full claims contract ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  original_claims jsonb;
  new_claims jsonb;
  claim text;
  v_user_id uuid;
  v_role text;
  v_consultant_status text;
  v_aal text;
  -- Minimal required + business claims. Ordered for readability.
  -- Required by Supabase Auth: iss, aud, exp, iat, sub, role, aal, session_id
  kept_claims text[] := ARRAY[
    'iss', 'aud', 'exp', 'iat', 'sub', 'role', 'aal', 'session_id',
    'email', 'phone', 'is_anonymous',
    'app_metadata', 'user_metadata',
    'user_role', 'consultant_status'
  ];
BEGIN
  original_claims := event->'claims';
  v_user_id := (original_claims->>'sub')::uuid;
  v_aal := COALESCE(original_claims->>'aal', 'aal1');

  -- Look up canonical role from our User table
  SELECT role::text INTO v_role FROM public."User" WHERE id = v_user_id;
  v_role := COALESCE(v_role, 'USER');

  -- Look up consultant status (null if no consultant row)
  SELECT status::text INTO v_consultant_status
  FROM public."Consultant"
  WHERE "userId" = v_user_id;

  -- Build a lean claim set (JWT size matters for SSR cookie storage)
  new_claims := '{}'::jsonb;
  FOREACH claim IN ARRAY kept_claims LOOP
    IF original_claims ? claim THEN
      new_claims := jsonb_set(new_claims, ARRAY[claim], original_claims->claim);
    END IF;
  END LOOP;

  -- Inject business claims
  new_claims := jsonb_set(new_claims, '{user_role}',          to_jsonb(v_role));
  new_claims := jsonb_set(new_claims, '{consultant_status}',  to_jsonb(COALESCE(v_consultant_status, 'none')));
  new_claims := jsonb_set(new_claims, '{aal}',                to_jsonb(v_aal));

  -- Ensure role claim is uppercase (Supabase uses 'authenticated' for its role;
  -- our app role lives in user_role to avoid confusion)
  new_claims := jsonb_set(new_claims, '{app_role}', to_jsonb(v_role));

  RETURN jsonb_build_object('claims', new_claims);
END;
$$;

-- ─── Grant to auth admin ─────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- ─── Update RLS helpers to read new claim names ──────────────────────────────
CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'role',
    current_setting('request.jwt.claims', true)::json ->> 'user_role',
    current_setting('request.jwt.claims', true)::json ->> 'app_role',
    'USER'
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.auth_user_role() IN ('SUPPORT','ADMIN','SUPER_ADMIN','VIEWER');
$$;

CREATE OR REPLACE FUNCTION public.auth_is_consultant()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.auth_user_role() IN ('CLIENT_ADMIN','ADMIN','SUPER_ADMIN');
$$;

CREATE OR REPLACE FUNCTION public.auth_has_mfa()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json ->> 'aal',
    'aal1'
  ) = 'aal2';
$$;

GRANT EXECUTE ON FUNCTION public.auth_user_role()     TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auth_is_admin()      TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auth_is_consultant() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auth_has_mfa()       TO authenticated, anon;

NOTIFY pgrst, 'reload schema';

DO $$ BEGIN
  RAISE NOTICE '  002 — custom_access_token_hook installed';
  RAISE NOTICE '  Claims injected: user_role, consultant_status, aal, app_role';
END $$;

COMMIT;
