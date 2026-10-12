-- ═══════════════════════════════════════════════════════════════════════════════
-- 1206 — BirthProfile: persistent user birth details for astrology consultations
-- ═══════════════════════════════════════════════════════════════════════════════
-- Adds:
--   1. BirthProfile table — one row per user, stores DOB/TOB/POB/gender
--   2. RLS policies — user owns their profile, service_role has full access
--   3. upsert_birth_profile() — SECURITY DEFINER atomic save
--   4. get_birth_profile() — SECURITY DEFINER fetch by user ID
--   5. Realtime broadcast trigger on profile changes
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. BirthProfile table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BirthProfile" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"          UUID NOT NULL UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
  "fullName"        TEXT NOT NULL DEFAULT '',
  "dateOfBirth"     DATE,
  "timeOfBirth"     TIME,
  "placeOfBirth"    TEXT NOT NULL DEFAULT '',
  "latitude"        DOUBLE PRECISION,
  "longitude"       DOUBLE PRECISION,
  "gender"          TEXT CHECK ("gender" IN ('male', 'female', 'non-binary', 'other', 'prefer-not')),
  "primaryConcern"  TEXT NOT NULL DEFAULT '',
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_birthprofile_user" ON "BirthProfile" ("userId");

ALTER TABLE "BirthProfile" ENABLE ROW LEVEL SECURITY;

-- ─── 2. RLS policies ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_read_own_birth_profile" ON "BirthProfile";
CREATE POLICY "user_read_own_birth_profile" ON "BirthProfile"
  FOR SELECT
  USING (auth.uid() = "userId");

DROP POLICY IF EXISTS "user_update_own_birth_profile" ON "BirthProfile";
CREATE POLICY "user_update_own_birth_profile" ON "BirthProfile"
  FOR ALL
  USING (auth.uid() = "userId")
  WITH CHECK (auth.uid() = "userId");

DROP POLICY IF EXISTS "service_role_full_access_birth_profile" ON "BirthProfile";
CREATE POLICY "service_role_full_access_birth_profile" ON "BirthProfile"
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─── 3. upsert_birth_profile ─────────────────────────────────────────────────
-- Atomic save: inserts or updates the user's birth profile.
-- Called by the intake form and onboarding wizard.
CREATE OR REPLACE FUNCTION upsert_birth_profile(
  p_user_id       UUID,
  p_full_name     TEXT DEFAULT '',
  p_date_of_birth DATE DEFAULT NULL,
  p_time_of_birth TIME DEFAULT NULL,
  p_place_of_birth TEXT DEFAULT '',
  p_latitude      DOUBLE PRECISION DEFAULT NULL,
  p_longitude     DOUBLE PRECISION DEFAULT NULL,
  p_gender        TEXT DEFAULT NULL,
  p_primary_concern TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID required');
  END IF;

  INSERT INTO "public"."BirthProfile" (
    "userId", "fullName", "dateOfBirth", "timeOfBirth",
    "placeOfBirth", "latitude", "longitude", "gender",
    "primaryConcern", "createdAt", "updatedAt"
  ) VALUES (
    p_user_id, p_full_name, p_date_of_birth, p_time_of_birth,
    p_place_of_birth, p_latitude, p_longitude, p_gender,
    p_primary_concern, now(), now()
  )
  ON CONFLICT ("userId") DO UPDATE SET
    "fullName"       = COALESCE(NULLIF(p_full_name, ''), "public"."BirthProfile"."fullName"),
    "dateOfBirth"    = COALESCE(p_date_of_birth, "public"."BirthProfile"."dateOfBirth"),
    "timeOfBirth"    = COALESCE(p_time_of_birth, "public"."BirthProfile"."timeOfBirth"),
    "placeOfBirth"   = COALESCE(NULLIF(p_place_of_birth, ''), "public"."BirthProfile"."placeOfBirth"),
    "latitude"       = COALESCE(p_latitude, "public"."BirthProfile"."latitude"),
    "longitude"      = COALESCE(p_longitude, "public"."BirthProfile"."longitude"),
    "gender"         = COALESCE(p_gender, "public"."BirthProfile"."gender"),
    "primaryConcern" = COALESCE(NULLIF(p_primary_concern, ''), "public"."BirthProfile"."primaryConcern"),
    "updatedAt"      = now();

  SELECT "id", "userId", "fullName", "dateOfBirth", "timeOfBirth",
         "placeOfBirth", "latitude", "longitude", "gender",
         "primaryConcern", "createdAt", "updatedAt"
  INTO v_profile
  FROM "public"."BirthProfile"
  WHERE "userId" = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'userId', v_profile."userId",
      'fullName', v_profile."fullName",
      'dateOfBirth', v_profile."dateOfBirth",
      'timeOfBirth', v_profile."timeOfBirth",
      'placeOfBirth', v_profile."placeOfBirth",
      'latitude', v_profile."latitude",
      'longitude', v_profile."longitude",
      'gender', v_profile."gender",
      'primaryConcern', v_profile."primaryConcern",
      'createdAt', v_profile."createdAt",
      'updatedAt', v_profile."updatedAt"
    )
  );
END;
$$;

-- ─── 4. get_birth_profile ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_birth_profile(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  SELECT "id", "userId", "fullName", "dateOfBirth", "timeOfBirth",
         "placeOfBirth", "latitude", "longitude", "gender",
         "primaryConcern", "createdAt", "updatedAt"
  INTO v_profile
  FROM "public"."BirthProfile"
  WHERE "userId" = p_user_id;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', true, 'profile', NULL);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'userId', v_profile."userId",
      'fullName', v_profile."fullName",
      'dateOfBirth', v_profile."dateOfBirth",
      'timeOfBirth', v_profile."timeOfBirth",
      'placeOfBirth', v_profile."placeOfBirth",
      'latitude', v_profile."latitude",
      'longitude', v_profile."longitude",
      'gender', v_profile."gender",
      'primaryConcern', v_profile."primaryConcern",
      'createdAt', v_profile."createdAt",
      'updatedAt', v_profile."updatedAt"
    )
  );
END;
$$;

-- ─── 5. Realtime broadcast ──────────────────────────────────────────────────
-- Notify the user's private channel when their birth profile changes,
-- so the AI consultant can pick up the new context on the next message.
CREATE OR REPLACE FUNCTION birth_profile_realtime_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM pg_notify(
    'realtime',
    jsonb_build_object(
      'topic', 'user:' || NEW."userId" || ':birth-profile',
      'event', 'UPDATED',
      'payload', jsonb_build_object(
        'fullName', NEW."fullName",
        'dateOfBirth', NEW."dateOfBirth",
        'timeOfBirth', NEW."timeOfBirth",
        'placeOfBirth', NEW."placeOfBirth",
        'primaryConcern', NEW."primaryConcern"
      )
    )::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_birth_profile_realtime" ON "BirthProfile";
CREATE TRIGGER "trg_birth_profile_realtime"
  AFTER INSERT OR UPDATE ON "BirthProfile"
  FOR EACH ROW
  EXECUTE FUNCTION birth_profile_realtime_notify();
