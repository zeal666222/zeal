-- Add timezone column to BirthProfile table
-- This stores the IANA timezone (e.g., "Asia/Kolkata") for the birth place,
-- so the worker can render Panchanga in the user's local time.

ALTER TABLE "BirthProfile" ADD COLUMN IF NOT EXISTS "timezone" TEXT;

-- Update upsert_birth_profile to accept and store timezone
CREATE OR REPLACE FUNCTION upsert_birth_profile(
  p_user_id       UUID,
  p_full_name     TEXT DEFAULT '',
  p_date_of_birth DATE DEFAULT NULL,
  p_time_of_birth TIME DEFAULT NULL,
  p_place_of_birth TEXT DEFAULT '',
  p_latitude      DOUBLE PRECISION DEFAULT NULL,
  p_longitude     DOUBLE PRECISION DEFAULT NULL,
  p_timezone      TEXT DEFAULT NULL,
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
    "placeOfBirth", "latitude", "longitude", "timezone", "gender",
    "primaryConcern", "createdAt", "updatedAt"
  ) VALUES (
    p_user_id, p_full_name, p_date_of_birth, p_time_of_birth,
    p_place_of_birth, p_latitude, p_longitude, p_timezone, p_gender,
    p_primary_concern, now(), now()
  )
  ON CONFLICT ("userId") DO UPDATE SET
    "fullName"       = COALESCE(NULLIF(p_full_name, ''), "public"."BirthProfile"."fullName"),
    "dateOfBirth"    = COALESCE(p_date_of_birth, "public"."BirthProfile"."dateOfBirth"),
    "timeOfBirth"    = COALESCE(p_time_of_birth, "public"."BirthProfile"."timeOfBirth"),
    "placeOfBirth"   = COALESCE(NULLIF(p_place_of_birth, ''), "public"."BirthProfile"."placeOfBirth"),
    "latitude"       = COALESCE(p_latitude, "public"."BirthProfile"."latitude"),
    "longitude"      = COALESCE(p_longitude, "public"."BirthProfile"."longitude"),
    "timezone"       = COALESCE(p_timezone, "public"."BirthProfile"."timezone"),
    "gender"         = COALESCE(p_gender, "public"."BirthProfile"."gender"),
    "primaryConcern" = COALESCE(NULLIF(p_primary_concern, ''), "public"."BirthProfile"."primaryConcern"),
    "updatedAt"      = now();

  SELECT "id", "userId", "fullName", "dateOfBirth", "timeOfBirth",
         "placeOfBirth", "latitude", "longitude", "timezone", "gender",
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
      'timezone', v_profile."timezone",
      'gender', v_profile."gender",
      'primaryConcern', v_profile."primaryConcern",
      'createdAt', v_profile."createdAt",
      'updatedAt', v_profile."updatedAt"
    )
  );
END;
$$;

-- Update get_birth_profile to return timezone
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
         "placeOfBirth", "latitude", "longitude", "timezone", "gender",
         "primaryConcern", "createdAt", "updatedAt"
  INTO v_profile
  FROM "public"."BirthProfile"
  WHERE "userId" = p_user_id;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
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
      'timezone', v_profile."timezone",
      'gender', v_profile."gender",
      'primaryConcern', v_profile."primaryConcern",
      'createdAt', v_profile."createdAt",
      'updatedAt', v_profile."updatedAt"
    )
  );
END;
$$;
