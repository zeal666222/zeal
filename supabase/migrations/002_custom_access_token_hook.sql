-- ═══════════════════════════════════════════════════════════════════════════════
-- 002_custom_access_token_hook.sql — NEUTRALISED
-- ═══════════════════════════════════════════════════════════════════════════════
-- This migration is intentionally a no-op.
-- Zeal no longer injects role into JWTs. Role is read from the User table
-- by @zeal/database/session.ts. See scripts/simplify-auth.sh and
-- supabase/zz_simplify_auth.sql.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Keep the function defined as a pass-through in case Supabase Auth still
-- has it registered. A pass-through is always safe.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN event;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb)
  FROM authenticated, anon, public;
