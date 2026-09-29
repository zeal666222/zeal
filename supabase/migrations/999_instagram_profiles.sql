-- ═══════════════════════════════════════════════════════════════════════════════
-- 999_instagram_profiles.sql
-- Instagram-style profiles + post limits + username validation.
-- Paste into Supabase SQL Editor and Run. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Columns on User ──────────────────────────────────────────────────────
ALTER TABLE public."User"
  ADD COLUMN IF NOT EXISTS "website"            text,
  ADD COLUMN IF NOT EXISTS "location"           text,
  ADD COLUMN IF NOT EXISTS "post_count"         integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "profile_completeness" integer NOT NULL DEFAULT 0;

-- ─── 2. Columns on Post ──────────────────────────────────────────────────────
ALTER TABLE public."Post"
  ADD COLUMN IF NOT EXISTS "isArchived"   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mediaType"    text DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS "locationTag"  text,
  ADD COLUMN IF NOT EXISTS "deletedAt"    timestamptz;

CREATE INDEX IF NOT EXISTS idx_post_author_active
  ON public."Post"("authorId") WHERE "isArchived" = false;

CREATE INDEX IF NOT EXISTS idx_post_author_created_active
  ON public."Post"("authorId", "createdAt" DESC) WHERE "isArchived" = false;

-- ─── 3. Username validation trigger ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_username()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.username IS NULL THEN RETURN NEW; END IF;

  NEW.username := LOWER(TRIM(NEW.username));

  IF LENGTH(NEW.username) < 3 OR LENGTH(NEW.username) > 30 THEN
    RAISE EXCEPTION 'Username must be 3–30 characters';
  END IF;

  IF NEW.username !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Username can only contain letters, numbers, and underscores';
  END IF;

  IF NEW.username = ANY(ARRAY[
    'admin','zeal','support','help','api','www','mail','root','system',
    'official','moderator','staff','team','null','undefined'
  ]) THEN
    RAISE EXCEPTION 'Username is reserved';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_username ON public."User";
CREATE TRIGGER trg_validate_username
  BEFORE UPDATE OF username ON public."User"
  FOR EACH ROW EXECUTE FUNCTION public.validate_username();

-- ─── 4. Post count sync trigger ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_post_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NOT NEW."isArchived" THEN
    UPDATE public."User"
      SET "post_count" = "post_count" + 1
      WHERE id = NEW."authorId";
  ELSIF TG_OP = 'UPDATE' AND OLD."isArchived" IS DISTINCT FROM NEW."isArchived" THEN
    UPDATE public."User"
      SET "post_count" = GREATEST(0, "post_count" + CASE WHEN NEW."isArchived" THEN -1 ELSE 1 END)
      WHERE id = NEW."authorId";
  ELSIF TG_OP = 'DELETE' AND NOT OLD."isArchived" THEN
    UPDATE public."User"
      SET "post_count" = GREATEST(0, "post_count" - 1)
      WHERE id = OLD."authorId";
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_sync_post_count ON public."Post";
CREATE TRIGGER trg_sync_post_count
  AFTER INSERT OR UPDATE OF "isArchived" OR DELETE ON public."Post"
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_count();

-- ─── 5. Backfill post_count ──────────────────────────────────────────────────
UPDATE public."User" u
SET "post_count" = (
  SELECT COUNT(*) FROM public."Post" p
  WHERE p."authorId" = u.id AND p."isArchived" = false
);

-- ─── 6. RLS: post insert with limit ──────────────────────────────────────────
DROP POLICY IF EXISTS "post_insert_with_limit" ON public."Post";
DROP POLICY IF EXISTS "posts_author_insert"    ON public."Post";

CREATE POLICY "posts_author_insert" ON public."Post"
  FOR INSERT TO authenticated
  WITH CHECK (
    "authorId" = (SELECT auth.uid())
    AND (
      SELECT CASE
        WHEN u."isVerified" = false THEN false
        WHEN u.role = 'CLIENT_ADMIN'::"AppRole" THEN
          (SELECT COUNT(*) FROM public."Post" p
           WHERE p."authorId" = u.id AND p."isArchived" = false) < 6
        WHEN u.role = 'USER'::"AppRole" THEN
          (SELECT COUNT(*) FROM public."Post" p
           WHERE p."authorId" = u.id AND p."isArchived" = false) < 3
        ELSE false
      END
      FROM public."User" u
      WHERE u.id = (SELECT auth.uid())
    )
  );

-- ─── 7. RLS: profile update with immutable fields ────────────────────────────
DROP POLICY IF EXISTS "user_self_update" ON public."User";

CREATE POLICY "user_self_update" ON public."User"
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid())
    AND role          IS NOT DISTINCT FROM (SELECT role          FROM public."User" WHERE id = (SELECT auth.uid()))
    AND "isVerified"  IS NOT DISTINCT FROM (SELECT "isVerified"  FROM public."User" WHERE id = (SELECT auth.uid()))
    AND "sparks"      IS NOT DISTINCT FROM (SELECT "sparks"      FROM public."User" WHERE id = (SELECT auth.uid()))
    AND "sparkScore"  IS NOT DISTINCT FROM (SELECT "sparkScore"  FROM public."User" WHERE id = (SELECT auth.uid()))
  );

-- ─── 8. RPC: get_profile_stats ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_profile_stats(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'user', jsonb_build_object(
      'id',            u.id,
      'name',          u.name,
      'username',      u.username,
      'avatar',        u.avatar,
      'bio',           u.bio,
      'website',       u."website",
      'location',      u."location",
      'role',          u.role::text,
      'isVerified',    u."isVerified",
      'is_online',     u.is_online,
      'sparks',        u.sparks,
      'postCount',     u."post_count",
      'createdAt',     u."createdAt"
    ),
    'stats', jsonb_build_object(
      'posts',     (SELECT COUNT(*) FROM public."Post" WHERE "authorId" = u.id AND "isArchived" = false),
      'cheers',    (SELECT COALESCE(SUM("cheerCount"), 0) FROM public."Post" WHERE "authorId" = u.id AND "isArchived" = false),
      'comments',  (SELECT COALESCE(SUM("commentCount"), 0) FROM public."Post" WHERE "authorId" = u.id AND "isArchived" = false),
      'followers', (SELECT COUNT(*) FROM public."UserActivity" WHERE "consultantId" = u.id::text AND type = 'follow'),
      'following', (SELECT COUNT(*) FROM public."UserActivity" WHERE "userId" = u.id AND type = 'follow')
    ),
    'isConsultant', (u.role = 'CLIENT_ADMIN'::"AppRole"),
    'isSelf',       (u.id = (SELECT auth.uid()))
  )
  FROM public."User" u
  WHERE u.id = p_user_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_profile_stats(uuid) TO authenticated, anon;

-- ─── 9. RPC: can_create_post ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_create_post()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_role text;
  v_current int;
  v_limit int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('canPost', false, 'limit', 0, 'current', 0);
  END IF;

  SELECT role::text INTO v_role FROM public."User" WHERE id = v_uid;
  v_limit := CASE WHEN v_role = 'CLIENT_ADMIN' THEN 6 ELSE 3 END;

  SELECT COUNT(*) INTO v_current FROM public."Post"
  WHERE "authorId" = v_uid AND "isArchived" = false;

  RETURN jsonb_build_object(
    'canPost', v_current < v_limit,
    'limit',   v_limit,
    'current', v_current,
    'remaining', GREATEST(0, v_limit - v_current)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.can_create_post() TO authenticated;

-- ─── 10. RPC: check_username_available ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_username_available(p_username text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'available', NOT EXISTS (
      SELECT 1 FROM public."User"
      WHERE username = LOWER(TRIM(p_username))
        AND id <> COALESCE((SELECT auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid)
    ),
    'reserved', LOWER(TRIM(p_username)) = ANY(ARRAY[
      'admin','zeal','support','help','api','www','mail','root','system',
      'official','moderator','staff','team','null','undefined'
    ])
  );
$$;
GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO authenticated, anon;

-- ─── 11. RPC: update_profile ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_profile(
  p_name     text DEFAULT NULL,
  p_username text DEFAULT NULL,
  p_bio      text DEFAULT NULL,
  p_website  text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_avatar   text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_existing RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT * INTO v_existing FROM public."User" WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;

  -- Validate name
  IF p_name IS NOT NULL AND (LENGTH(TRIM(p_name)) < 1 OR LENGTH(p_name) > 80) THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_NAME');
  END IF;

  -- Validate bio
  IF p_bio IS NOT NULL AND LENGTH(p_bio) > 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'BIO_TOO_LONG');
  END IF;

  -- Validate website
  IF p_website IS NOT NULL AND p_website <> '' THEN
    IF p_website !~* '^https?://' THEN
      RETURN jsonb_build_object('success', false, 'error', 'WEBSITE_INVALID');
    END IF;
  END IF;

  -- Validate location
  IF p_location IS NOT NULL AND LENGTH(p_location) > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'LOCATION_TOO_LONG');
  END IF;

  -- Username uniqueness
  IF p_username IS NOT NULL AND LOWER(TRIM(p_username)) <> COALESCE(v_existing.username, '') THEN
    IF EXISTS (
      SELECT 1 FROM public."User"
      WHERE username = LOWER(TRIM(p_username)) AND id <> v_uid
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'USERNAME_TAKEN');
    END IF;
  END IF;

  UPDATE public."User"
  SET name      = COALESCE(p_name,     name),
      username  = COALESCE(LOWER(TRIM(p_username)), username),
      bio       = COALESCE(p_bio,      bio),
      website   = COALESCE(p_website,  website),
      location  = COALESCE(p_location, location),
      avatar    = COALESCE(p_avatar,   avatar),
      "updatedAt" = now()
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'user', (
      SELECT jsonb_build_object(
        'id',       u.id,
        'name',     u.name,
        'username', u.username,
        'bio',      u.bio,
        'website',  u."website",
        'location', u."location",
        'avatar',   u.avatar
      )
      FROM public."User" u WHERE u.id = v_uid
    )
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'USERNAME_TAKEN');
  WHEN raise_exception THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION', 'message', SQLERRM);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'INTERNAL', 'message', SQLERRM);
END $$;
GRANT EXECUTE ON FUNCTION public.update_profile(text,text,text,text,text,text) TO authenticated;

-- ─── 12. RPC: delete_post (soft) ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_post(p_post_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_author uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT "authorId" INTO v_author FROM public."Post" WHERE id = p_post_id;
  IF v_author IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'POST_NOT_FOUND');
  END IF;
  IF v_author <> v_uid AND NOT public.auth_is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  UPDATE public."Post"
  SET "isArchived" = true, "deletedAt" = now()
  WHERE id = p_post_id;

  RETURN jsonb_build_object('success', true);
END $$;
GRANT EXECUTE ON FUNCTION public.delete_post(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

DO $$ BEGIN
  RAISE NOTICE '999_instagram_profiles.sql applied';
END $$;

COMMIT;
