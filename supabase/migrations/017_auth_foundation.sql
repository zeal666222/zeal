-- ═══════════════════════════════════════════════════════════════════════════════
-- 017_auth_foundation.sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 1 of the Zeal enterprise auth overhaul.
--
-- 1. Standardize Role enum (fixes 'user' vs 'USER' case mismatch)
-- 2. Custom Access Token Hook — injects user_role + consultant_status into JWT
-- 3. Auto-profile trigger on auth.users INSERT (replaces ensureUserRow round-trip)
-- 4. Instant consultant activation defaults (no approval flow)
-- 5. Auto-subdomain generation trigger
--
-- Idempotent. Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. ROLE ENUM
-- ═══════════════════════════════════════════════════════════════════════════

-- Create proper enum type (replaces ad-hoc text + CHECK constraint)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AppRole') THEN
    CREATE TYPE "AppRole" AS ENUM (
      'USER', 'CLIENT_ADMIN', 'SUPPORT', 'ADMIN', 'SUPER_ADMIN', 'VIEWER', 'AI'
    );
    RAISE NOTICE 'Created AppRole enum';
  ELSE
    RAISE NOTICE 'AppRole enum already exists — skipping';
  END IF;
END $$;

-- Normalize existing role data to uppercase BEFORE cast
UPDATE "User"
SET role = UPPER(role)
WHERE role IS NOT NULL AND role <> UPPER(role);

-- Drop any CHECK constraint on role (legacy)
DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = '"User"'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE "User" DROP CONSTRAINT %I', cname);
    RAISE NOTICE 'Dropped constraint: %', cname;
  END LOOP;
END $$;

-- Convert role column to AppRole enum (only if currently text)
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'role';

  IF col_type IS DISTINCT FROM 'USER-DEFINED' THEN
    ALTER TABLE "User" ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE "User" ALTER COLUMN role TYPE "AppRole" USING role::"AppRole";
    ALTER TABLE "User" ALTER COLUMN role SET DEFAULT 'USER'::"AppRole";
    RAISE NOTICE 'Converted role column to AppRole enum';
  ELSE
    RAISE NOTICE 'role column already uses enum';
  END IF;
END $$;

-- Ensure default is uppercase
ALTER TABLE "User" ALTER COLUMN role SET DEFAULT 'USER'::"AppRole";

-- Index for RLS and admin queries
CREATE INDEX IF NOT EXISTS idx_user_role ON "User"(role);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. CUSTOM ACCESS TOKEN HOOK
-- ═══════════════════════════════════════════════════════════════════════════
-- Injects user_role + consultant_status directly into the JWT before issuance.
-- This eliminates per-row lookups in RLS policies and gives every request
-- zero-latency access to the caller's role.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_role text;
  consultant_status text;
BEGIN
  claims := event->'claims';

  -- Look up canonical role from User table
  SELECT role::text INTO user_role
  FROM "User"
  WHERE id = (claims->>'sub')::uuid;

  -- Look up consultant status (null when user has no Consultant row)
  SELECT status INTO consultant_status
  FROM "Consultant"
  WHERE "userId" = (claims->>'sub')::uuid;

  -- Inject claims (defaults: USER role, none for consultant_status)
  claims := jsonb_set(claims, '{user_role}',          to_jsonb(COALESCE(user_role, 'USER')));
  claims := jsonb_set(claims, '{consultant_status}',  to_jsonb(COALESCE(consultant_status, 'none')));

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant to auth admin (Supabase requirement — hook must be callable by GoTrue)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revoke from public/anon/authenticated (security-critical)
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. AUTO-PROFILE TRIGGER
-- ═══════════════════════════════════════════════════════════════════════════
-- Fires on every new auth.users INSERT. Creates User + Wallet atomically.
-- Replaces the need for app-side ensureUserRow on the happy path.
-- Server action fallback (ensureUserRow) still exists for OAuth/admin heal.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  base_username text;
  suffix text;
  final_username text;
  user_full_name text;
  user_avatar text;
BEGIN
  -- Derive a safe username from email
  base_username := LOWER(SPLIT_PART(new.email, '@', 1));
  base_username := REGEXP_REPLACE(base_username, '[^a-z0-9_]', '', 'g');
  IF LENGTH(base_username) < 3 THEN
    base_username := 'user';
  END IF;
  suffix := SUBSTRING(REPLACE(new.id::text, '-', ''), 1, 6);
  final_username := base_username || '_' || suffix;

  -- Extract profile hints from raw_user_meta_data
  user_full_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    SPLIT_PART(new.email, '@', 1)
  );
  user_avatar := new.raw_user_meta_data->>'avatar_url';

  -- Insert canonical User row (ON CONFLICT — safe under races)
  INSERT INTO public."User" (
    id, email, username, name, full_name, avatar_url, role, sparks
  )
  VALUES (
    new.id,
    new.email,
    final_username,
    user_full_name,
    user_full_name,
    user_avatar,
    'USER'::"AppRole",
    100
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert Wallet row (ON CONFLICT — safe under races)
  INSERT INTO public."Wallet" ("userId", balance, escrow, "pendingIn", "pendingOut", blocked)
  VALUES (new.id, 0, 0, 0, 0, 0)
  ON CONFLICT ("userId") DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. INSTANT CONSULTANT ACTIVATION
-- ═══════════════════════════════════════════════════════════════════════════
-- No approval flow. Consultants are VERIFIED on signup.

ALTER TABLE "Consultant" ALTER COLUMN status            SET DEFAULT 'VERIFIED';
ALTER TABLE "Consultant" ALTER COLUMN "isVerified"      SET DEFAULT true;
ALTER TABLE "Consultant" ALTER COLUMN "isActive"        SET DEFAULT true;
ALTER TABLE "Consultant" ALTER COLUMN "subdomainActive" SET DEFAULT true;
ALTER TABLE "Consultant" ALTER COLUMN "whiteLabelEnabled" SET DEFAULT true;
ALTER TABLE "Consultant" ALTER COLUMN rating            SET DEFAULT 5.0;
ALTER TABLE "Consultant" ALTER COLUMN "perMinuteRate"   SET DEFAULT 50;

-- Promote any existing PENDING consultants
UPDATE "Consultant"
SET status = 'VERIFIED',
    "isVerified" = true,
    "isActive" = true,
    "subdomainActive" = true
WHERE status = 'PENDING';

-- Promote their users to CLIENT_ADMIN
UPDATE "User" u
SET role = 'CLIENT_ADMIN'::"AppRole"
WHERE u.id IN (SELECT "userId" FROM "Consultant" WHERE status = 'VERIFIED')
  AND u.role = 'USER'::"AppRole";

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. AUTO-SUBDOMAIN TRIGGER
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.generate_consultant_subdomain()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  slug text;
  suffix text;
BEGIN
  IF NEW.subdomain IS NULL OR NEW.subdomain = '' THEN
    -- Build slug from User.name
    SELECT LOWER(REGEXP_REPLACE(
             COALESCE(name, 'consultant'),
             '[^a-zA-Z0-9]+', '-', 'g'
           ))
    INTO slug
    FROM "User"
    WHERE id = NEW."userId";

    -- Trim leading/trailing dashes
    slug := TRIM(BOTH '-' FROM slug);

    -- Truncate to 24 chars
    IF LENGTH(slug) > 24 THEN
      slug := SUBSTRING(slug, 1, 24);
    END IF;

    -- Fallback
    IF slug IS NULL OR LENGTH(slug) < 3 THEN
      slug := 'guide';
    END IF;

    suffix := SUBSTRING(REPLACE(NEW."userId"::text, '-', ''), 1, 4);
    NEW.subdomain := slug || '-' || suffix;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consultant_autosubdomain ON "Consultant";
CREATE TRIGGER trg_consultant_autosubdomain
  BEFORE INSERT ON "Consultant"
  FOR EACH ROW EXECUTE FUNCTION public.generate_consultant_subdomain();

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  hook_exists boolean;
  trigger_exists boolean;
  role_col_type text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'custom_access_token_hook'
  ) INTO hook_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) INTO trigger_exists;

  SELECT data_type INTO role_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'role';

  IF NOT hook_exists THEN
    RAISE EXCEPTION 'custom_access_token_hook was not created';
  END IF;

  IF NOT trigger_exists THEN
    RAISE EXCEPTION 'on_auth_user_created trigger was not created';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE '  017_auth_foundation.sql — VERIFIED';
  RAISE NOTICE '  custom_access_token_hook: %', hook_exists;
  RAISE NOTICE '  on_auth_user_created:     %', trigger_exists;
  RAISE NOTICE '  role column type:         %', role_col_type;
  RAISE NOTICE '========================================';
END $$;

COMMIT;
