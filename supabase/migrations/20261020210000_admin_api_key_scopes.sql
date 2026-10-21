-- ============================================================================
-- 20261020210000_admin_api_key_scopes.sql
--
-- The API-key system was written against a schema that production does not
-- have, and three separate breaks compounded into "every key is useless":
--
--   1. AdminAPIKey has no `scopes` column. /api/admin/api-keys selects it and
--      filters on `adminId` (the column is `createdBy`), so the list page 500s
--      and a key can never be revoked.
--   2. Production's generate_admin_api_key(p_name, p_expires_days) has no
--      p_scopes, and validate_admin_api_key takes p_key, while api-guard calls
--      it with p_raw_key. A missing parameter is a 404 from PostgREST, so
--      key auth never resolved — every Bearer zeal_ak_ request got 401.
--   3. generate returns a bare 64-hex string with no `zeal_ak_` prefix, but
--      the guard only recognises a key when the header starts with that
--      prefix. Even a correctly issued key was therefore invisible to auth.
--   4. The 0000-era gate is `IF NOT public.auth_is_admin() THEN ...`. Under the
--      service-role client auth.uid() is NULL, the lookup returns zero rows, and
--      a three-valued `NOT NULL` is never TRUE — so the guard fell through and
--      minted a key owned by nobody. Since EXECUTE was granted to `authenticated`
--      as well, any logged-in user could call the RPC directly and get an admin
--      API key. The actor is now an explicit parameter, verified against the
--      User table's role, and the function fails closed when it is missing —
--      the same shape 20261020160000 gave verify_consultant for the same reason.
--
-- Scopes are not decoration: wallet:credit, wallet:debit, withdraw:process and
-- impersonate:session are each enforced by a route through hasAPIScope(), and
-- 'read-only' deliberately satisfies none of them. So the capability has to
-- live in the row. This migration adds the column, replaces both functions with
-- the signatures the app calls, and mints prefixed keys.
--
-- The old overloads are dropped rather than replaced: CREATE OR REPLACE keeps
-- the original parameter names, and adding p_scopes would leave two functions
-- of the same name, which PostgREST rejects as ambiguous.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The column the app reads
-- ---------------------------------------------------------------------------
ALTER TABLE public."AdminAPIKey"
  ADD COLUMN IF NOT EXISTS "scopes" text[] NOT NULL DEFAULT '{}';

-- Keys minted before this migration could not authenticate at all, so there is
-- no working automation to preserve. Least privilege: they come back as
-- read-only, and an admin issues a scoped key when a tool needs a capability.
UPDATE public."AdminAPIKey" SET "scopes" = ARRAY['read-only']::text[]
 WHERE "scopes" = '{}';

-- validate looks a key up by its hash on every authenticated request.
CREATE INDEX IF NOT EXISTS admin_api_key_hash_idx
    ON public."AdminAPIKey" ("keyHash");

-- ---------------------------------------------------------------------------
-- 2. Issue a key — zeal_ak_ prefixed, scopes recorded, actor verified
-- ---------------------------------------------------------------------------
-- Both the prod overload and a partially-upgraded (text, text[], integer) are
-- dropped, so re-running this file after an earlier draft leaves one function.
DROP FUNCTION IF EXISTS public.generate_admin_api_key(text, integer);
DROP FUNCTION IF EXISTS public.generate_admin_api_key(text, text[], integer);

CREATE OR REPLACE FUNCTION public.generate_admin_api_key(
  p_name text,
  p_admin_id uuid,
  p_scopes text[] DEFAULT ARRAY['read-only']::text[],
  p_expires_days integer DEFAULT 90
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_key   text;
  v_hash  text;
  v_id    uuid;
  v_role  text;
BEGIN
  IF p_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  -- The caller names the acting admin, but the role is read from the database
  -- rather than trusted: an API key is a standing credential, so minting one is
  -- reserved for the roles the UI already gates with requireAdminAPI.
  SELECT role::text INTO v_role FROM public."User" WHERE id = p_admin_id;
  IF v_role IS NULL OR v_role NOT IN ('ADMIN','SUPER_ADMIN') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'name required');
  END IF;

  -- The guard only recognises keys that start with this prefix, so the prefix
  -- is part of the secret that gets hashed — never strip it before digest().
  -- pgcrypto is installed in the `extensions` schema here and search_path is
  -- pinned empty, so every crypto call is qualified.
  v_key := 'zeal_ak_' || encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_key, 'sha256'), 'hex');

  INSERT INTO public."AdminAPIKey" ("keyHash", name, "expiresAt", "createdBy", "scopes")
  VALUES (
    v_hash,
    btrim(p_name),
    -- An explicit NULL means "never expires"; the UI offers that choice and the
    -- validator already treats a NULL expiresAt as valid forever. Only a caller
    -- that omits the argument gets the 90-day default.
    CASE WHEN p_expires_days IS NULL THEN NULL
         ELSE now() + (p_expires_days || ' days')::interval END,
    p_admin_id,
    coalesce(p_scopes, ARRAY['read-only']::text[])
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'key', v_key);
END;
$func$;

-- ---------------------------------------------------------------------------
-- 3. Verify a key — returns the shape api-guard destructures
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.validate_admin_api_key(text);

CREATE OR REPLACE FUNCTION public.validate_admin_api_key(p_raw_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_hash text;
  v_rec  record;
BEGIN
  IF p_raw_key IS NULL OR length(p_raw_key) < 16 THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  v_hash := encode(extensions.digest(p_raw_key, 'sha256'), 'hex');

  SELECT * INTO v_rec FROM public."AdminAPIKey"
   WHERE "keyHash" = v_hash
     AND "isActive" = true
     AND ("expiresAt" IS NULL OR "expiresAt" > now())
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  UPDATE public."AdminAPIKey" SET "lastUsedAt" = now() WHERE id = v_rec.id;

  RETURN jsonb_build_object(
    'valid', true,
    'adminId', v_rec."createdBy",
    'keyName', v_rec.name,
    'scopes', coalesce(v_rec."scopes", ARRAY[]::text[])
  );
END;
$func$;

-- ---------------------------------------------------------------------------
-- 4. Grants
-- ---------------------------------------------------------------------------
-- Both are service-role only. `authenticated` must not reach generate (it mints
-- a standing admin credential and the actor is a parameter, so the only honest
-- caller is a route that has already checked the session), and 20261020160000
-- made the same call on validate: a yes/no answer about a key hash is an oracle
-- for whoever holds the public anon key.
--
-- PUBLIC is in the revoke list because Postgres grants EXECUTE to PUBLIC on every
-- new function: DROP + CREATE re-opens the hole the grant itself did not mention.
REVOKE ALL ON FUNCTION public.generate_admin_api_key(text, uuid, text[], integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_admin_api_key(text, uuid, text[], integer) TO service_role;

REVOKE ALL ON FUNCTION public.validate_admin_api_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_admin_api_key(text) TO service_role;

NOTIFY pgrst, 'reload schema';
