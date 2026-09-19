-- ═══════════════════════════════════════════════════════════════════════════════
-- 090_auth_repair.sql — idempotent repair of the auth chain
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Backfill Consultant for every CLIENT_ADMIN user
-- 2. Promote users with Consultant rows to CLIENT_ADMIN
-- 3. Sync app_metadata.role from User.role (JWT carries correct role)
-- 4. Create self_heal_user() RPC — callable from frontend
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Backfill Consultant for CLIENT_ADMIN users without one ─────────────
INSERT INTO public."Consultant" (
  "userId", category, specialties, languages, "perMinuteRate",
  status, "isVerified", "isActive",
  subdomain, "subdomainActive", "whiteLabelEnabled",
  rating, "totalConsultations", "sparkScore", "bufferMinutes"
)
SELECT
  u.id, 'ASTROLOGER', '{}', '{English}', 50,
  'VERIFIED', true, true,
  COALESCE(
    NULLIF(TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(
      COALESCE(u.name, SPLIT_PART(u.email,'@',1), 'guide'),
      '[^a-zA-Z0-9]+','-','g'))), ''),
    'guide'
  ) || '-' || SUBSTRING(REPLACE(u.id::text, '-', ''), 1, 4),
  true, true,
  5.0, 0, 0, 10
FROM public."User" u
LEFT JOIN public."Consultant" c ON c."userId"::text = u.id::text
WHERE c.id IS NULL
  AND u.role::text IN ('CLIENT_ADMIN','ADMIN','SUPER_ADMIN','SUPPORT')
ON CONFLICT DO NOTHING;

-- ─── 2. Promote users with Consultant rows ──────────────────────────────────
UPDATE public."User" u
SET role = 'CLIENT_ADMIN'::"AppRole"
WHERE u.role::text = 'USER'
  AND EXISTS (
    SELECT 1 FROM public."Consultant" c
    WHERE c."userId"::text = u.id::text AND c.status = 'VERIFIED'
  );

-- ─── 3. Sync app_metadata.role from User.role ───────────────────────────────
UPDATE auth.users au
SET raw_app_meta_data =
  COALESCE(au.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', u.role::text)
FROM public."User" u
WHERE au.id::text = u.id::text
  AND COALESCE(au.raw_app_meta_data->>'role', 'USER') <> u.role::text;

-- ─── 4. self_heal_user() RPC — called from client after auth ───────────────
CREATE OR REPLACE FUNCTION public.self_heal_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_has_consultant boolean := false;
  v_created boolean := false;
  v_slug text;
  v_subdomain text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT role::text INTO v_role
  FROM public."User" WHERE id = v_uid;

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_user_row');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public."Consultant" WHERE "userId"::text = v_uid::text
  ) INTO v_has_consultant;

  IF v_role IN ('CLIENT_ADMIN','ADMIN','SUPER_ADMIN','SUPPORT') AND NOT v_has_consultant THEN
    SELECT LOWER(REGEXP_REPLACE(
      COALESCE(name, 'guide'), '[^a-zA-Z0-9]+','-','g'))
    INTO v_slug FROM public."User" WHERE id = v_uid;

    v_slug := TRIM(BOTH '-' FROM COALESCE(v_slug, 'guide'));
    IF LENGTH(v_slug) < 3  THEN v_slug := 'guide'; END IF;
    IF LENGTH(v_slug) > 20 THEN v_slug := SUBSTRING(v_slug, 1, 20); END IF;
    v_subdomain := v_slug || '-' || SUBSTRING(REPLACE(v_uid::text, '-', ''), 1, 4);

    INSERT INTO public."Consultant" (
      "userId", category, specialties, languages, "perMinuteRate",
      status, "isVerified", "isActive",
      subdomain, "subdomainActive", "whiteLabelEnabled",
      rating, "totalConsultations", "sparkScore", "bufferMinutes"
    ) VALUES (
      v_uid, 'ASTROLOGER', '{}', '{English}', 50,
      'VERIFIED', true, true,
      v_subdomain, true, true,
      5.0, 0, 0, 10
    )
    ON CONFLICT DO NOTHING;

    v_created := true;
    v_has_consultant := true;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'role', v_role,
    'has_consultant', v_has_consultant,
    'created', v_created
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.self_heal_user() TO authenticated;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════';
  RAISE NOTICE '  090_auth_repair.sql — APPLIED';
  RAISE NOTICE '  Consultant rows : %', (SELECT COUNT(*) FROM public."Consultant");
  RAISE NOTICE '  CLIENT_ADMINs   : %', (SELECT COUNT(*) FROM public."User" WHERE role::text = 'CLIENT_ADMIN');
  RAISE NOTICE '  Synced metadata : OK';
  RAISE NOTICE '════════════════════════════════════════════════';
END $$;

COMMIT;
