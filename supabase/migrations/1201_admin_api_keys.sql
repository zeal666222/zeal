-- =============================================================================
-- 1201_admin_api_keys.sql
-- API key credential system for Super Admin programmatic access
-- =============================================================================
-- Enables CI/CD, external tools, and future integrations to access admin
-- APIs without interactive Supabase login. Keys are SHA-256 hashed; the
-- plaintext is shown exactly once at creation time.
-- =============================================================================

BEGIN;

-- ─── Ensure pgcrypto is available for digest() ───────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."AdminAPIKey" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "adminId"   UUID NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  "keyHash"   TEXT NOT NULL UNIQUE,
  scopes      TEXT[] NOT NULL DEFAULT '{}',
  "expiresAt" TIMESTAMPTZ,
  "lastUsedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_api_keys_admin
  ON public."AdminAPIKey" ("adminId");

CREATE INDEX IF NOT EXISTS idx_admin_api_keys_hash
  ON public."AdminAPIKey" ("keyHash");

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public."AdminAPIKey" ENABLE ROW LEVEL SECURITY;

-- Only SUPER_ADMIN can read their own keys
DROP POLICY IF EXISTS admin_api_keys_select ON public."AdminAPIKey";
CREATE POLICY admin_api_keys_select ON public."AdminAPIKey"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public."User"
      WHERE "User".id = "AdminAPIKey"."adminId"
        AND "User".id = (SELECT auth.uid())
        AND "User".role::text = 'SUPER_ADMIN'
    )
  );

-- Only SUPER_ADMIN can insert keys (must be their own)
DROP POLICY IF EXISTS admin_api_keys_insert ON public."AdminAPIKey";
CREATE POLICY admin_api_keys_insert ON public."AdminAPIKey"
  FOR INSERT
  WITH CHECK (
    "adminId" = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public."User"
      WHERE "User".id = "AdminAPIKey"."adminId"
        AND "User".role::text = 'SUPER_ADMIN'
    )
  );

-- Only SUPER_ADMIN can delete their own keys
DROP POLICY IF EXISTS admin_api_keys_delete ON public."AdminAPIKey";
CREATE POLICY admin_api_keys_delete ON public."AdminAPIKey"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public."User"
      WHERE "User".id = "AdminAPIKey"."adminId"
        AND "User".id = (SELECT auth.uid())
        AND "User".role::text = 'SUPER_ADMIN'
    )
  );

-- ─── Generate API Key function ────────────────────────────────────────────────
-- Returns the plaintext key (only time it's available). The hash is stored.
CREATE OR REPLACE FUNCTION public.generate_admin_api_key(
  p_admin_id UUID,
  p_name TEXT,
  p_scopes TEXT[],
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_raw_key TEXT;
  v_hash TEXT;
  v_key_id UUID;
BEGIN
  -- Verify the admin is SUPER_ADMIN
  IF NOT EXISTS (
    SELECT 1 FROM public."User"
    WHERE id = p_admin_id AND role::text = 'SUPER_ADMIN'
  ) THEN
    RAISE EXCEPTION 'Only SUPER_ADMIN can generate API keys';
  END IF;

  -- Generate a random key: zeal_ak_<48 random hex chars>
  v_raw_key := 'zeal_ak_' || encode(
    digest(gen_random_uuid()::text || random()::text || now()::text, 'sha256'),
    'hex'
  );
  -- Truncate to 64 chars after prefix for manageable length
  v_raw_key := 'zeal_ak_' || substr(encode(
    digest(v_raw_key || random()::text, 'sha256'),
    'hex'
  ), 1, 48);

  -- Hash the key for storage
  v_hash := encode(digest(v_raw_key, 'sha256'), 'hex');

  -- Insert the key record
  INSERT INTO public."AdminAPIKey" ("adminId", name, "keyHash", scopes, "expiresAt")
  VALUES (p_admin_id, p_name, v_hash, p_scopes, p_expires_at)
  RETURNING id INTO v_key_id;

  RETURN v_raw_key;
END;
$$;

-- ─── Validate API Key function ────────────────────────────────────────────────
-- Returns admin_id + scopes if the key is valid and not expired.
-- Also updates lastUsedAt.
CREATE OR REPLACE FUNCTION public.validate_admin_api_key(
  p_raw_key TEXT
)
RETURNS TABLE ("adminId" UUID, scopes TEXT[], key_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  v_hash := encode(digest(p_raw_key, 'sha256'), 'hex');

  RETURN QUERY
  UPDATE public."AdminAPIKey" AS ak
  SET "lastUsedAt" = now()
  WHERE ak."keyHash" = v_hash
    AND (ak."expiresAt" IS NULL OR ak."expiresAt" > now())
  RETURNING ak."adminId", ak.scopes, ak.name;
END;
$$;

-- ─── (pgcrypto extension created at top of migration) ─────────────────────────

COMMIT;
