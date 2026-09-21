-- ═══════════════════════════════════════════════════════════════════════════════
-- 111_signup_router.sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Routes signups by raw_user_meta_data.account_type:
--   consultant  → role=CLIENT_ADMIN + Consultant row
--   anything    → role=USER
-- Runs AFTER INSERT on auth.users, syncs raw_app_meta_data.role before the
-- signup response returns so the FIRST JWT carries the correct role.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Safety net
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='AppRole') THEN
    CREATE TYPE public."AppRole" AS ENUM (
      'USER','CLIENT_ADMIN','SUPPORT','ADMIN','SUPER_ADMIN','VIEWER','AI'
    );
  END IF;
END $do$;

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
  v_account_type := LOWER(COALESCE(new.raw_user_meta_data->>'account_type','seeker'));
  v_role := CASE WHEN v_account_type = 'consultant'
                 THEN 'CLIENT_ADMIN' ELSE 'USER' END;

  v_base := LOWER(REGEXP_REPLACE(
    COALESCE(SPLIT_PART(new.email,'@',1),'user'), '[^a-z0-9_]','','g'));
  IF LENGTH(v_base) < 3 THEN v_base := 'user'; END IF;

  LOOP
    v_username := v_base || '_' ||
      SUBSTRING(REPLACE(new.id::text,'-',''), GREATEST(1, 7 - v_attempt), 6);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public."User" WHERE username = v_username);
    v_attempt := v_attempt + 1;
    IF v_attempt > 4 THEN
      v_username := v_base || '_' ||
        SUBSTRING(REPLACE(new.id::text,'-',''),1,10);
      EXIT;
    END IF;
  END LOOP;

  v_full_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    SPLIT_PART(new.email,'@',1)
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
    v_slug := LOWER(REGEXP_REPLACE(
      COALESCE(v_full_name,'guide'), '[^a-zA-Z0-9]+','-','g'));
    v_slug := TRIM(BOTH '-' FROM v_slug);
    IF LENGTH(v_slug) < 3  THEN v_slug := 'guide'; END IF;
    IF LENGTH(v_slug) > 20 THEN v_slug := SUBSTRING(v_slug,1,20); END IF;
    v_subdomain := v_slug || '-' ||
      SUBSTRING(REPLACE(new.id::text,'-',''),1,4);

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
    COALESCE(raw_app_meta_data,'{}'::jsonb) ||
    jsonb_build_object('role', v_role)
  WHERE id = new.id;

  RETURN new;
END;
$fn$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

NOTIFY pgrst, 'reload schema';
COMMIT;