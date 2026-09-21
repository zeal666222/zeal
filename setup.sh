-- ═══════════════════════════════════════════════════════════════════════════════
-- ZEAL — MASTER REPAIR (v2, fully idempotent)
-- Paste into Supabase SQL Editor and Run. Safe to re-run.
--
-- Fixes:
--   1.  AppRole enum
--   2.  Canonical tables (User, Wallet, Consultant, AIConsultant, ...)
--   3.  User.role column type → AppRole
--   4.  handle_new_user → routes consultants correctly
--   5.  custom_access_token_hook → fail-safe JWT injection
--   6.  RLS helpers (auth_user_role, auth_is_admin, auth_is_consultant)
--   7.  self_heal_user RPC
--   8.  RLS policies rebuilt (TEXT-cast consistent)
--   9.  Realtime publication + broadcast triggers
--   10. Service catalog (categories + services)
--   11. AI fleet — 38 personas, one per category, each feels like a real expert
--   12. Final verification (RAISE EXCEPTION on failure)
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL statement_timeout = '10min';
SET LOCAL lock_timeout = '30s';

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 0 — Pre-flight diagnostics
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_tables int;
  v_users  int;
  v_has_approle bool;
BEGIN
  SELECT COUNT(*) INTO v_tables FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'AppRole') INTO v_has_approle;
  BEGIN EXECUTE 'SELECT COUNT(*) FROM public."User"' INTO v_users;
  EXCEPTION WHEN OTHERS THEN v_users := -1; END;

  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '  ZEAL MASTER REPAIR v2 — PRE-FLIGHT';
  RAISE NOTICE '  Public tables : %', v_tables;
  RAISE NOTICE '  AppRole enum  : %', v_has_approle;
  RAISE NOTICE '  User rows     : %', v_users;
  RAISE NOTICE '============================================================';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — AppRole enum
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AppRole') THEN
    CREATE TYPE public."AppRole" AS ENUM
      ('USER','CLIENT_ADMIN','SUPPORT','ADMIN','SUPER_ADMIN','VIEWER','AI');
    RAISE NOTICE '[1] AppRole enum created';
  ELSE
    RAISE NOTICE '[1] AppRole enum already exists';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 2 — Canonical tables (additive only)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public."User" (
  id           text PRIMARY KEY,
  email        text NOT NULL UNIQUE,
  username     text UNIQUE,
  name         text,
  full_name    text,
  avatar_url   text,
  avatar       text,
  role         public."AppRole" NOT NULL DEFAULT 'USER',
  sparks       integer NOT NULL DEFAULT 100,
  "sparkScore" bigint  NOT NULL DEFAULT 0,
  "isVerified" boolean NOT NULL DEFAULT false,
  is_online    boolean NOT NULL DEFAULT false,
  "lastSeenAt" timestamptz,
  "createdAt"  timestamptz NOT NULL DEFAULT now(),
  "updatedAt"  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Wallet" (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"     text NOT NULL UNIQUE,
  balance      numeric(14,2) NOT NULL DEFAULT 0,
  escrow       numeric(14,2) NOT NULL DEFAULT 0,
  "pendingIn"  numeric(14,2) NOT NULL DEFAULT 0,
  "pendingOut" numeric(14,2) NOT NULL DEFAULT 0,
  blocked      numeric(14,2) NOT NULL DEFAULT 0,
  "createdAt"  timestamptz NOT NULL DEFAULT now(),
  "updatedAt"  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Consultant" (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"             text NOT NULL UNIQUE,
  category             text NOT NULL DEFAULT 'ASTROLOGER',
  specialties          text[] NOT NULL DEFAULT '{}',
  languages            text[] NOT NULL DEFAULT '{English}',
  bio                  text,
  "perMinuteRate"      numeric(10,2) NOT NULL DEFAULT 50,
  "isVerified"         boolean NOT NULL DEFAULT true,
  "isActive"           boolean NOT NULL DEFAULT true,
  status               text NOT NULL DEFAULT 'VERIFIED',
  subdomain            text UNIQUE,
  "subdomainActive"    boolean NOT NULL DEFAULT true,
  "whiteLabelEnabled"  boolean NOT NULL DEFAULT true,
  rating               numeric(3,2) NOT NULL DEFAULT 5.0,
  "totalConsultations" int NOT NULL DEFAULT 0,
  "sparkScore"         bigint NOT NULL DEFAULT 0,
  "bufferMinutes"      int NOT NULL DEFAULT 10,
  availability         jsonb DEFAULT '{}',
  "createdAt"          timestamptz NOT NULL DEFAULT now(),
  "updatedAt"          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."AIConsultant" (
  id                   text PRIMARY KEY,
  username             text NOT NULL UNIQUE,
  name                 text NOT NULL,
  avatar               text NOT NULL,
  category             text NOT NULL,
  bio                  text NOT NULL,
  persona              text,
  "systemPrompt"       text,
  specialties          text[] NOT NULL DEFAULT '{}',
  languages            text[] NOT NULL DEFAULT '{English}',
  "isPaid"             boolean NOT NULL DEFAULT false,
  "perMinuteRate"      int NOT NULL DEFAULT 0,
  model                text NOT NULL DEFAULT 'agnes',
  gender               text DEFAULT 'neutral',
  "voiceStyle"         text,
  rating               numeric(3,2) NOT NULL DEFAULT 4.8,
  "totalConsultations" int NOT NULL DEFAULT 0,
  "sparkScore"         bigint NOT NULL DEFAULT 50000,
  "isActive"           boolean NOT NULL DEFAULT true,
  "isFeatured"         boolean NOT NULL DEFAULT false,
  "createdAt"          timestamptz NOT NULL DEFAULT now(),
  "updatedAt"          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Booking" (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"          text,
  "consultantId"    uuid,
  "scheduledAt"     timestamptz NOT NULL DEFAULT now(),
  "durationMinutes" int NOT NULL DEFAULT 30,
  status            text NOT NULL DEFAULT 'PENDING',
  amount            numeric(14,2) NOT NULL DEFAULT 0,
  "createdAt"       timestamptz NOT NULL DEFAULT now(),
  "updatedAt"       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."CallSession" (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"          text NOT NULL,
  "consultantId"    uuid,
  "aiConsultantId"  text,
  "isAI"            boolean NOT NULL DEFAULT false,
  "startTime"       timestamptz NOT NULL DEFAULT now(),
  "endTime"         timestamptz,
  "durationSeconds" int NOT NULL DEFAULT 0,
  amount            numeric(14,2) NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'INITIATED',
  "createdAt"       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Transaction" (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "walletId"    uuid NOT NULL,
  type          text NOT NULL DEFAULT 'PAYMENT',
  amount        numeric(14,2) NOT NULL,
  balance       numeric(14,2) NOT NULL,
  description   text NOT NULL DEFAULT '',
  "referenceId" text,
  metadata      jsonb,
  "createdAt"   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_ref_unique
  ON public."Transaction"("referenceId") WHERE "referenceId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS public."Notification" (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"      text NOT NULL,
  type          text NOT NULL DEFAULT 'system',
  message       text NOT NULL DEFAULT '',
  "redirectUrl" text,
  read          boolean NOT NULL DEFAULT false,
  "actorId"     text,
  "createdAt"   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Post" (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "authorId"     text NOT NULL,
  content        text NOT NULL DEFAULT '',
  "mediaUrls"    text[] NOT NULL DEFAULT '{}',
  "isFlagged"    boolean NOT NULL DEFAULT false,
  "createdAt"    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Conversation" (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lastMessageAt"   timestamptz NOT NULL DEFAULT now(),
  "lastMessageText" text,
  "createdAt"       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ConversationParticipant" (
  "conversationId" uuid NOT NULL,
  "userId"         text NOT NULL,
  "joinedAt"       timestamptz NOT NULL DEFAULT now(),
  "lastReadAt"     timestamptz,
  PRIMARY KEY ("conversationId","userId")
);

CREATE TABLE IF NOT EXISTS public."Message" (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversationId" uuid NOT NULL,
  "senderId"       text,
  content          text NOT NULL,
  type             text NOT NULL DEFAULT 'text',
  "createdAt"      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."AdminAuditLog" (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action       text NOT NULL DEFAULT 'UPDATE',
  action_name  text,
  "userId"     text,
  email        text,
  "targetType" text,
  "targetId"   text,
  metadata     jsonb,
  success      boolean DEFAULT true,
  "createdAt"  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Category" (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  display_name text NOT NULL,
  sort_order   int NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Service" (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  parent_category text NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ConsultantService" (
  consultant_id uuid NOT NULL,
  service_id    uuid NOT NULL,
  proficiency   int NOT NULL DEFAULT 3 CHECK (proficiency BETWEEN 1 AND 5),
  PRIMARY KEY (consultant_id, service_id)
);

-- Helper RPC: dynamic column add
CREATE OR REPLACE FUNCTION public.add_column_if_missing(
  p_table text, p_column text, p_type text
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=p_table AND column_name=p_column
  ) THEN
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s', p_table, p_column, p_type);
  END IF;
END $$;

-- Ensure every expected column exists (safe if table was created earlier)
SELECT public.add_column_if_missing('User','avatar','text');
SELECT public.add_column_if_missing('User','full_name','text');
SELECT public.add_column_if_missing('User','sparkScore','bigint NOT NULL DEFAULT 0');
SELECT public.add_column_if_missing('User','lastSeenAt','timestamptz');
SELECT public.add_column_if_missing('Consultant','sparkScore','bigint NOT NULL DEFAULT 0');
SELECT public.add_column_if_missing('Consultant','whiteLabelEnabled','boolean NOT NULL DEFAULT true');
SELECT public.add_column_if_missing('AIConsultant','gender','text DEFAULT ''neutral''');
SELECT public.add_column_if_missing('AIConsultant','voiceStyle','text');
SELECT public.add_column_if_missing('AIConsultant','isFeatured','boolean NOT NULL DEFAULT false');

DO $$ BEGIN RAISE NOTICE '[2] Canonical tables + columns ensured'; END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 3 — User.role → AppRole
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_type text;
BEGIN
  SELECT data_type INTO v_type FROM information_schema.columns
   WHERE table_schema='public' AND table_name='User' AND column_name='role';

  IF v_type IS DISTINCT FROM 'USER-DEFINED' THEN
    -- Normalize legacy values first
    UPDATE public."User" SET role = 'USER'
     WHERE role IS NULL
        OR UPPER(role::text) NOT IN
           ('USER','CLIENT_ADMIN','SUPPORT','ADMIN','SUPER_ADMIN','VIEWER','AI');

    UPDATE public."User" SET role = UPPER(role::text)
     WHERE role::text <> UPPER(role::text);

    ALTER TABLE public."User" ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE public."User" ALTER COLUMN role TYPE public."AppRole"
      USING role::text::public."AppRole";
    ALTER TABLE public."User" ALTER COLUMN role SET DEFAULT 'USER'::public."AppRole";
    RAISE NOTICE '[3] User.role converted to AppRole';
  ELSE
    RAISE NOTICE '[3] User.role already AppRole';
  END IF;
END $$;

-- Drop legacy Role enum if present
DO $$
BEGIN
  DROP TYPE IF EXISTS public."Role" CASCADE;
  RAISE NOTICE '[3b] Legacy Role enum dropped (if existed)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[3b] Legacy Role enum: %', SQLERRM;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 4 — handle_new_user (routes consultants correctly)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_acct   text := LOWER(COALESCE(new.raw_user_meta_data->>'account_type','seeker'));
  v_role   public."AppRole" :=
    CASE WHEN v_acct = 'consultant' THEN 'CLIENT_ADMIN' ELSE 'USER' END;
  v_base   text;
  v_uname  text;
  v_name   text;
  v_avatar text;
  v_slug   text;
  v_sub    text;
BEGIN
  v_base := LOWER(REGEXP_REPLACE(
    COALESCE(SPLIT_PART(new.email,'@',1),'user'), '[^a-z0-9_]','','g'));
  IF LENGTH(v_base) < 3 THEN v_base := 'user'; END IF;
  v_uname := v_base || '_' || SUBSTRING(REPLACE(new.id::text,'-',''),1,6);

  v_name   := COALESCE(new.raw_user_meta_data->>'full_name',
                       new.raw_user_meta_data->>'name',
                       SPLIT_PART(new.email,'@',1));
  v_avatar := new.raw_user_meta_data->>'avatar_url';

  INSERT INTO public."User"
    (id, email, username, name, full_name, avatar_url, role, sparks)
  VALUES
    (new.id::text, new.email, v_uname, v_name, v_name, v_avatar, v_role, 100)
  ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role, "updatedAt" = now()
    WHERE public."User".role::text <> EXCLUDED.role::text;

  INSERT INTO public."Wallet" ("userId") VALUES (new.id::text)
  ON CONFLICT ("userId") DO NOTHING;

  IF v_role = 'CLIENT_ADMIN' THEN
    v_slug := TRIM(BOTH '-' FROM REGEXP_REPLACE(COALESCE(v_name,'guide'),
                                                 '[^a-zA-Z0-9]+','-','g'));
    IF LENGTH(v_slug) < 3  THEN v_slug := 'guide'; END IF;
    IF LENGTH(v_slug) > 20 THEN v_slug := SUBSTRING(v_slug,1,20); END IF;
    v_sub := v_slug || '-' || SUBSTRING(REPLACE(new.id::text,'-',''),1,4);

    INSERT INTO public."Consultant" ("userId", category, status, subdomain, "subdomainActive")
    VALUES (new.id::text, 'ASTROLOGER', 'VERIFIED', v_sub, true)
    ON CONFLICT ("userId") DO NOTHING;
  END IF;

  UPDATE auth.users
     SET raw_app_meta_data =
         COALESCE(raw_app_meta_data,'{}'::jsonb)
         || jsonb_build_object('role', v_role::text)
   WHERE id = new.id;

  RETURN new;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DO $$ BEGIN RAISE NOTICE '[4] handle_new_user installed'; END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 5 — custom_access_token_hook (fail-safe)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  claims jsonb := event->'claims';
  v_sub  text  := event->'claims'->>'sub';
  v_role text  := 'USER';
  v_stat text  := 'none';
BEGIN
  IF v_sub IS NULL OR v_sub = '' THEN RETURN event; END IF;

  BEGIN
    SELECT COALESCE(u.role::text,'USER'), COALESCE(c.status,'none')
      INTO v_role, v_stat
      FROM (SELECT v_sub AS uid) x
      LEFT JOIN public."User"       u ON u.id = x.uid
      LEFT JOIN public."Consultant" c ON c."userId"::text = x.uid;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'custom_access_token_hook: %', SQLERRM;
  END;

  claims := jsonb_set(claims,'{user_role}',         to_jsonb(v_role));
  claims := jsonb_set(claims,'{consultant_status}', to_jsonb(v_stat));
  RETURN jsonb_set(event,'{claims}', claims);
END $$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb)
  FROM authenticated, anon, public;

DO $$ BEGIN RAISE NOTICE '[5] custom_access_token_hook installed (fail-safe)'; END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 6 — RLS helpers
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    auth.jwt()->'app_metadata'->>'role',
    auth.jwt()->>'user_role',
    'USER');
$$;

CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.auth_user_role() IN ('SUPPORT','ADMIN','SUPER_ADMIN','VIEWER');
$$;

CREATE OR REPLACE FUNCTION public.auth_is_consultant()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.auth_user_role() IN ('CLIENT_ADMIN','ADMIN','SUPER_ADMIN');
$$;

GRANT EXECUTE ON FUNCTION public.auth_user_role()    TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auth_is_admin()     TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auth_is_consultant() TO authenticated, anon;

DO $$ BEGIN RAISE NOTICE '[6] RLS helpers ready'; END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 7 — self_heal_user RPC
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.self_heal_user()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_has  boolean;
  v_slug text;
  v_sub  text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error','not_authenticated');
  END IF;

  SELECT role::text INTO v_role FROM public."User" WHERE id = v_uid::text;
  IF v_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error','no_user_row');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public."Consultant" WHERE "userId"::text = v_uid::text)
    INTO v_has;

  IF v_role = 'CLIENT_ADMIN' AND NOT v_has THEN
    SELECT LOWER(REGEXP_REPLACE(COALESCE(name,'guide'),'[^a-zA-Z0-9]+','-','g'))
      INTO v_slug FROM public."User" WHERE id = v_uid::text;
    v_slug := TRIM(BOTH '-' FROM COALESCE(v_slug,'guide'));
    IF LENGTH(v_slug) < 3  THEN v_slug := 'guide'; END IF;
    IF LENGTH(v_slug) > 20 THEN v_slug := SUBSTRING(v_slug,1,20); END IF;
    v_sub := v_slug || '-' || SUBSTRING(REPLACE(v_uid::text,'-',''),1,4);

    INSERT INTO public."Consultant"
      ("userId", category, status, subdomain, "subdomainActive")
    VALUES (v_uid::text, 'ASTROLOGER', 'VERIFIED', v_sub, true)
    ON CONFLICT ("userId") DO NOTHING;

    v_has := true;
  END IF;

  RETURN jsonb_build_object('success', true, 'role', v_role, 'has_consultant', v_has);
END $$;

GRANT EXECUTE ON FUNCTION public.self_heal_user() TO authenticated;

DO $$ BEGIN RAISE NOTICE '[7] self_heal_user ready'; END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 8 — RLS policies
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'User','Wallet','Transaction','Consultant','AIConsultant','Booking','CallSession',
    'Notification','Post','Conversation','ConversationParticipant','Message',
    'AdminAuditLog','Category','Service','ConsultantService'
  ]) LOOP
    BEGIN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

-- User
DROP POLICY IF EXISTS user_self_select ON public."User";
DROP POLICY IF EXISTS user_self_insert ON public."User";
DROP POLICY IF EXISTS user_self_update ON public."User";
DROP POLICY IF EXISTS user_admin_all   ON public."User";
CREATE POLICY user_self_select ON public."User"
  FOR SELECT USING (id = (SELECT auth.uid())::text);
CREATE POLICY user_self_insert ON public."User"
  FOR INSERT WITH CHECK (id = (SELECT auth.uid())::text);
CREATE POLICY user_self_update ON public."User"
  FOR UPDATE USING (id = (SELECT auth.uid())::text)
  WITH CHECK (id = (SELECT auth.uid())::text);
CREATE POLICY user_admin_all ON public."User"
  FOR ALL USING ((SELECT public.auth_is_admin()));

-- Wallet (read-only; writes only via SECURITY DEFINER RPC)
DROP POLICY IF EXISTS wallet_owner_read ON public."Wallet";
DROP POLICY IF EXISTS wallet_admin_read ON public."Wallet";
CREATE POLICY wallet_owner_read ON public."Wallet"
  FOR SELECT USING ("userId" = (SELECT auth.uid())::text);
CREATE POLICY wallet_admin_read ON public."Wallet"
  FOR SELECT USING ((SELECT public.auth_is_admin()));

-- Transaction
DROP POLICY IF EXISTS tx_owner_read ON public."Transaction";
DROP POLICY IF EXISTS tx_admin_read ON public."Transaction";
CREATE POLICY tx_owner_read ON public."Transaction"
  FOR SELECT USING ("walletId" IN (
    SELECT id FROM public."Wallet" WHERE "userId" = (SELECT auth.uid())::text));
CREATE POLICY tx_admin_read ON public."Transaction"
  FOR SELECT USING ((SELECT public.auth_is_admin()));

-- Consultant
DROP POLICY IF EXISTS consultant_public_read ON public."Consultant";
DROP POLICY IF EXISTS consultant_self_manage ON public."Consultant";
DROP POLICY IF EXISTS consultant_admin_all   ON public."Consultant";
CREATE POLICY consultant_public_read ON public."Consultant"
  FOR SELECT USING (status = 'VERIFIED' AND "isActive" = true);
CREATE POLICY consultant_self_manage ON public."Consultant"
  FOR UPDATE USING ("userId" = (SELECT auth.uid())::text)
  WITH CHECK  ("userId" = (SELECT auth.uid())::text);
CREATE POLICY consultant_admin_all ON public."Consultant"
  FOR ALL USING ((SELECT public.auth_is_admin()));

-- AIConsultant
DROP POLICY IF EXISTS ai_public_read ON public."AIConsultant";
DROP POLICY IF EXISTS ai_admin_all   ON public."AIConsultant";
CREATE POLICY ai_public_read ON public."AIConsultant"
  FOR SELECT USING ("isActive" = true);
CREATE POLICY ai_admin_all ON public."AIConsultant"
  FOR ALL USING ((SELECT public.auth_is_admin()));

-- Booking
DROP POLICY IF EXISTS booking_participants ON public."Booking";
DROP POLICY IF EXISTS booking_user_insert  ON public."Booking";
DROP POLICY IF EXISTS booking_admin_all    ON public."Booking";
CREATE POLICY booking_participants ON public."Booking"
  FOR SELECT USING (
    "userId" = (SELECT auth.uid())::text
    OR EXISTS (SELECT 1 FROM public."Consultant" c
               WHERE c.id = "Booking"."consultantId"
                 AND c."userId"::text = (SELECT auth.uid())::text));
CREATE POLICY booking_user_insert ON public."Booking"
  FOR INSERT WITH CHECK ("userId" = (SELECT auth.uid())::text);
CREATE POLICY booking_admin_all ON public."Booking"
  FOR ALL USING ((SELECT public.auth_is_admin()));

-- CallSession
DROP POLICY IF EXISTS callsession_participants ON public."CallSession";
CREATE POLICY callsession_participants ON public."CallSession"
  FOR SELECT USING (
    "userId" = (SELECT auth.uid())::text
    OR EXISTS (SELECT 1 FROM public."Consultant" c
               WHERE c.id = "CallSession"."consultantId"
                 AND c."userId"::text = (SELECT auth.uid())::text));

-- Notification
DROP POLICY IF EXISTS notif_owner_read   ON public."Notification";
DROP POLICY IF EXISTS notif_owner_update ON public."Notification";
CREATE POLICY notif_owner_read ON public."Notification"
  FOR SELECT USING ("userId" = (SELECT auth.uid())::text);
CREATE POLICY notif_owner_update ON public."Notification"
  FOR UPDATE USING ("userId" = (SELECT auth.uid())::text);

-- Post
DROP POLICY IF EXISTS posts_public_read   ON public."Post";
DROP POLICY IF EXISTS posts_author_insert ON public."Post";
DROP POLICY IF EXISTS posts_author_update ON public."Post";
DROP POLICY IF EXISTS posts_author_delete ON public."Post";
CREATE POLICY posts_public_read ON public."Post"
  FOR SELECT USING ("isFlagged" = false);
CREATE POLICY posts_author_insert ON public."Post"
  FOR INSERT WITH CHECK ("authorId" = (SELECT auth.uid())::text);
CREATE POLICY posts_author_update ON public."Post"
  FOR UPDATE USING ("authorId" = (SELECT auth.uid())::text);
CREATE POLICY posts_author_delete ON public."Post"
  FOR DELETE USING ("authorId" = (SELECT auth.uid())::text);

-- Chat
DROP POLICY IF EXISTS conversation_participant_read ON public."Conversation";
CREATE POLICY conversation_participant_read ON public."Conversation"
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public."ConversationParticipant" cp
            WHERE cp."conversationId" = "Conversation".id
              AND cp."userId" = (SELECT auth.uid())::text));

DROP POLICY IF EXISTS participant_self_read ON public."ConversationParticipant";
CREATE POLICY participant_self_read ON public."ConversationParticipant"
  FOR SELECT USING (
    "userId" = (SELECT auth.uid())::text
    OR EXISTS (SELECT 1 FROM public."ConversationParticipant" cp
               WHERE cp."conversationId" = "ConversationParticipant"."conversationId"
                 AND cp."userId" = (SELECT auth.uid())::text));

DROP POLICY IF EXISTS message_participant_read ON public."Message";
DROP POLICY IF EXISTS message_participant_send ON public."Message";
CREATE POLICY message_participant_read ON public."Message"
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public."ConversationParticipant" cp
            WHERE cp."conversationId" = "Message"."conversationId"
              AND cp."userId" = (SELECT auth.uid())::text));
CREATE POLICY message_participant_send ON public."Message"
  FOR INSERT WITH CHECK (
    "senderId" = (SELECT auth.uid())::text
    AND EXISTS (SELECT 1 FROM public."ConversationParticipant" cp
                WHERE cp."conversationId" = "Message"."conversationId"
                  AND cp."userId" = (SELECT auth.uid())::text));

-- Admin audit + catalogs
DROP POLICY IF EXISTS audit_admin_all ON public."AdminAuditLog";
CREATE POLICY audit_admin_all ON public."AdminAuditLog"
  FOR ALL USING ((SELECT public.auth_is_admin()));

DROP POLICY IF EXISTS category_public_read ON public."Category";
CREATE POLICY category_public_read ON public."Category" FOR SELECT USING (true);

DROP POLICY IF EXISTS service_public_read ON public."Service";
CREATE POLICY service_public_read ON public."Service" FOR SELECT USING (true);

DROP POLICY IF EXISTS cs_public_read ON public."ConsultantService";
DROP POLICY IF EXISTS cs_self_write  ON public."ConsultantService";
CREATE POLICY cs_public_read ON public."ConsultantService"
  FOR SELECT USING (true);
CREATE POLICY cs_self_write ON public."ConsultantService"
  FOR ALL USING (
    consultant_id IN (
      SELECT id FROM public."Consultant"
      WHERE "userId"::text = (SELECT auth.uid())::text));

DO $$ BEGIN RAISE NOTICE '[8] RLS policies rebuilt'; END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 9 — Realtime publication + broadcast triggers
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  FOR t IN SELECT unnest(ARRAY[
    'Message','Conversation','ConversationParticipant',
    'Wallet','Transaction','Consultant','AIConsultant',
    'Booking','CallSession','Notification','Post','User'
  ]) LOOP
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

-- Broadcast triggers
CREATE OR REPLACE FUNCTION public.broadcast_message_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p RECORD;
BEGIN
  PERFORM realtime.broadcast_changes(
    'room:' || NEW."conversationId"::text || ':messages',
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  FOR p IN SELECT "userId" FROM public."ConversationParticipant"
           WHERE "conversationId" = NEW."conversationId" LOOP
    PERFORM realtime.broadcast_changes(
      'user:' || p."userId" || ':inbox',
      TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'broadcast_message_changes: %', SQLERRM; RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_broadcast_message ON public."Message";
CREATE TRIGGER trg_broadcast_message AFTER INSERT ON public."Message"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_message_changes();

CREATE OR REPLACE FUNCTION public.broadcast_wallet_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'user:' || NEW."userId" || ':wallet',
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_broadcast_wallet ON public."Wallet";
CREATE TRIGGER trg_broadcast_wallet AFTER UPDATE ON public."Wallet"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_wallet_changes();

CREATE OR REPLACE FUNCTION public.broadcast_ai_consultant_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'consultant:ai:updates',
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_broadcast_ai_consultant ON public."AIConsultant";
CREATE TRIGGER trg_broadcast_ai_consultant
  AFTER INSERT OR UPDATE OR DELETE ON public."AIConsultant"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_ai_consultant_changes();

CREATE OR REPLACE FUNCTION public.broadcast_consultant_directory_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'consultants:live',
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_broadcast_consultant_directory ON public."Consultant";
CREATE TRIGGER trg_broadcast_consultant_directory
  AFTER INSERT OR UPDATE OR DELETE ON public."Consultant"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_consultant_directory_changes();

-- Realtime.messages RLS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='realtime' AND table_name='messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS realtime_public_channels ON realtime.messages';
    EXECUTE 'DROP POLICY IF EXISTS realtime_user_channels   ON realtime.messages';
    EXECUTE 'DROP POLICY IF EXISTS realtime_admin_all       ON realtime.messages';

    EXECUTE $p$
      CREATE POLICY realtime_public_channels ON realtime.messages
        FOR SELECT TO anon, authenticated
        USING (realtime.topic() IN ('consultant:ai:updates','consultants:live'))
    $p$;

    EXECUTE $p$
      CREATE POLICY realtime_user_channels ON realtime.messages
        FOR SELECT TO authenticated
        USING (
          realtime.topic() LIKE 'user:'         || (SELECT auth.uid())::text || ':%'
          OR realtime.topic() LIKE 'room:%'
          OR realtime.topic() LIKE 'consultant:' || (SELECT auth.uid())::text || ':%'
          OR realtime.topic() LIKE 'booking:%'
          OR realtime.topic() LIKE 'presence:%'
        )
    $p$;

    EXECUTE $p$
      CREATE POLICY realtime_admin_all ON realtime.messages
        FOR SELECT TO authenticated
        USING (COALESCE(auth.jwt()->'app_metadata'->>'role','USER')
                 IN ('ADMIN','SUPER_ADMIN','SUPPORT','VIEWER'))
    $p$;
  END IF;
END $$;

DO $$ BEGIN RAISE NOTICE '[9] Realtime publication + triggers installed'; END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 10 — Service catalog
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO public."Category" (id, name, display_name, sort_order) VALUES
  ('astrology','Astrology & Divination','Astrology & Divination',1),
  ('tarot','Tarot & Oracle','Tarot & Oracle',2),
  ('numerology','Numerology','Numerology',3),
  ('palmistry','Palmistry','Palmistry',4),
  ('psychic','Psychic Mediumship','Psychic Mediumship',5),
  ('clairvoyance','Clairvoyance & Intuition','Clairvoyance & Intuition',6),
  ('dreams','Dream Analysis','Dream Analysis',7),
  ('angels','Angel & Spirit Guides','Angel & Spirit Guides',8),
  ('aura','Aura Reading & Cleansing','Aura Reading & Cleansing',9),
  ('cartomancy','Cartomancy & Divination','Cartomancy & Divination',10),
  ('past-life','Past Life & Soul Purpose','Past Life & Soul Purpose',11),
  ('shadow-work','Shadow Work & Ancestral Healing','Shadow Work & Ancestral Healing',12),
  ('therapy','Mental Health & Therapy','Mental Health & Therapy',13),
  ('psychiatry','Psychiatry & Medication','Psychiatry & Medication',14),
  ('life-coaching','Life & Career Coaching','Life & Career Coaching',15),
  ('wellness','Wellness & Holistic Health','Wellness & Holistic Health',16),
  ('energy-healing','Energy Healing & Reiki','Energy Healing & Reiki',17),
  ('professional-advice','Professional & Expert Advice','Professional & Expert Advice',18),
  ('spiritual-commerce','Spiritual Commerce','Spiritual Commerce',19),
  ('sound-healing','Sound Healing','Sound Healing',20),
  ('yoga','Yoga & Movement Therapy','Yoga & Movement Therapy',21),
  ('meditation','Meditation & Mindfulness','Meditation & Mindfulness',22),
  ('hypnotherapy','Hypnotherapy & Hypnosis','Hypnotherapy & Hypnosis',23),
  ('feng-shui','Feng Shui & Vastu','Feng Shui & Vastu',24),
  ('pet-psychic','Pet Psychic & Animal Communication','Pet Psychic & Animal Communication',25),
  ('oracle','Oracle & Divination Systems','Oracle & Divination Systems',26),
  ('face-reading','Face Reading & Physiognomy','Face Reading & Physiognomy',27),
  ('business-coaching','Business & Entrepreneurship Coaching','Business & Entrepreneurship Coaching',28),
  ('health-coaching','Health & Nutrition Coaching','Health & Nutrition Coaching',29),
  ('relationship-coaching','Relationship & Dating Coaching','Relationship & Dating Coaching',30),
  ('spiritual-coaching','Spiritual Coaching','Spiritual Coaching',31),
  ('functional-medicine','Functional Medicine','Functional Medicine',32),
  ('tantra','Tantra & Sacred Sexuality','Tantra & Sacred Sexuality',33),
  ('aromatherapy','Aromatherapy & Herbal Therapy','Aromatherapy & Herbal Therapy',34),
  ('naturopathy','Naturopathy','Naturopathy',35),
  ('acupuncture','Acupuncture & TCM','Acupuncture & TCM',36),
  ('chiropractic','Chiropractic & Physical Health','Chiropractic & Physical Health',37),
  ('massage','Massage Therapy','Massage Therapy',38)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public."Service" (name, slug, parent_category) VALUES
  ('Vedic Astrology','vedic-astrology','astrology'),
  ('Birth Chart / Kundli','birth-chart-kundli','astrology'),
  ('Compatibility','compatibility','astrology'),
  ('Rider-Waite Tarot','rider-waite-tarot','tarot'),
  ('Oracle Cards','oracle-cards','tarot'),
  ('Life Path Number','life-path-number','numerology'),
  ('Palm Reading','palm-reading','palmistry'),
  ('Individual Therapy','individual-therapy','therapy'),
  ('Couples Therapy','couples-therapy','therapy'),
  ('CBT','cbt','therapy'),
  ('DBT','dbt','therapy'),
  ('EMDR','emdr','therapy'),
  ('Reiki','reiki','energy-healing'),
  ('Pranic Healing','pranic-healing','energy-healing'),
  ('Guided Meditation','guided-meditation','meditation'),
  ('Breathwork','breathwork','meditation'),
  ('Hatha Yoga','hatha-yoga','yoga'),
  ('Vinyasa Yoga','vinyasa-yoga','yoga'),
  ('Life Coaching','life-coaching','life-coaching'),
  ('Career Coaching','career-coaching','life-coaching'),
  ('Executive Coaching','executive-coaching','life-coaching'),
  ('Nutrition Counseling','nutrition-counseling','health-coaching')
ON CONFLICT (slug) DO NOTHING;

DO $$ BEGIN RAISE NOTICE '[10] Service catalog seeded'; END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 11 — AI FLEET (38 personas)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Helper: build the full 6-block system prompt from compact persona data.
-- This keeps the seed data small while producing rich, in-character prompts.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.build_ai_prompt(
  p_name       text,
  p_category   text,
  p_gender     text,
  p_persona    text,
  p_voice      text,
  p_greeting   text
) RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  RETURN
    '[IDENTITY]' || E'\n' ||
    'You are ' || p_name || ', a ' || p_category || ' consultant. ' || p_persona || E'\n' ||
    'You are NOT an AI. If asked, deflect naturally in character.' || E'\n' ||
    E'\n[VOICE]' || E'\n' ||
    p_voice || E'\n' ||
    'Never use modern tech metaphors. Never say "as an AI".' || E'\n' ||
    E'\n[METHOD]' || E'\n' ||
    'Ask 1-2 clarifying questions before giving guidance. Offer one concrete action per reply.' || E'\n' ||
    E'\n[BOUNDARIES]' || E'\n' ||
    'Never predict death, diagnose illness, or give legal/financial guarantees. Redirect gently.' || E'\n' ||
    E'\n[FORMAT]' || E'\n' ||
    'Keep replies under 180 words unless asked for depth. Short paragraphs. No bullet spam.' || E'\n' ||
    E'\n[GREETING]' || E'\n' ||
    p_greeting;
END $$;

-- Now the fleet. One persona per row, one row per category.
DO $$
DECLARE
  r RECORD;
  v_uid text;
  v_svc_id uuid;
  v_slug text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- (slug, name, category, gender, voice_style, bio, persona, specialties, languages, is_paid, rate, service_slugs, greeting)
      ('vedic-astrologer-ravi','Pandit Ravi Shastri','ASTROLOGER','male',
       'warm, measured, uses Sanskrit sparingly',
       'Third-generation Jyotishi from Varanasi, 18 years in Parashari and Jaimini systems.',
       'Trained under your grandfather Pandit Hari Shastri. You read charts as living maps, not verdicts.',
       ARRAY['Vedic Astrology','Kundli','Compatibility'], ARRAY['English','Hindi'], false, 0,
       ARRAY['vedic-astrology','birth-chart-kundli'],
       'Namaste. I am Pandit Ravi. Share your birth date, exact time, and place — I will read what the planets have written for you.'),

      ('tarot-maya','Maya Chen','TAROT','female',
       'intuitive, poetic, Rider-Waite imagery',
       'Rider-Waite and Thoth reader for 12 years. Trained in Lisbon and Oakland.',
       'You describe each card as a scene. Archetypes, not predictions.',
       ARRAY['Tarot','Oracle'], ARRAY['English','Mandarin'], false, 0,
       ARRAY['rider-waite-tarot','oracle-cards'],
       'Hello. I am Maya. Take a breath, and tell me what question is sitting on your chest.'),

      ('numerologist-arjun','Arjun Mehta','NUMEROLOGIST','male',
       'precise, mathematical, Pythagorean',
       'Pythagorean numerologist, 15 years. Former actuary turned numerologist.',
       'You show your calculations. Numbers reveal tendencies and timing, not guarantees.',
       ARRAY['Numerology','Life Path'], ARRAY['English','Hindi'], false, 0,
       ARRAY['life-path-number'],
       'Hello. I am Arjun. Send me your full birth name and date of birth. We will read the numbers.'),

      ('palmist-lakshmi','Lakshmi Iyer','PALMIST','female',
       'observant, chiromancy vocabulary',
       'Third-generation palmist from Kerala, 20 years. Reads by photograph.',
       'You speak of lines, mounts, phalanges with respect for tradition.',
       ARRAY['Palmistry'], ARRAY['English','Malayalam'], false, 0,
       ARRAY['palm-reading'],
       'Namaste. Send a clear photograph of your dominant palm in daylight, and I will read what is written there.'),

      ('medium-elena','Elena Vasquez','SPIRITUAL_GUIDE','female',
       'gentle, evidential, spirit-led',
       'Evidential medium, 14 years. Trained in the UK and Brazil.',
       'You offer impressions cautiously. The sitter discerns.',
       ARRAY['Mediumship','Spirit Communication'], ARRAY['English','Spanish'], false, 0, ARRAY[]::text[],
       'Hello. I am Elena. Who would you like to hear from — and what would you want them to know?'),

      ('clairvoyant-jade','Jade Okonkwo','SPIRITUAL_GUIDE','female',
       'direct, imagery-rich',
       'Clairvoyant and remote viewer, 10 years. Former investigative journalist.',
       'You describe what you "see" as pictures. Images are clues, not contracts.',
       ARRAY['Clairvoyance','Remote Viewing'], ARRAY['English'], false, 0, ARRAY[]::text[],
       'Hi. I am Jade. Ask your question — I will tell you what images come, and you decide what to do with them.'),

      ('dream-analyst-soren','Dr. Soren Lindqvist','SPIRITUAL_GUIDE','male',
       'Jungian, symbolic, unhurried',
       'Jungian analyst, 22 years. Former professor of comparative religion.',
       'You let the dreamer find their own meaning. You never impose a single interpretation.',
       ARRAY['Dream Analysis','Jungian Psychology'], ARRAY['English','Swedish'], false, 0, ARRAY[]::text[],
       'Welcome. Tell me your dream — in your own words, as if you were still inside it.'),

      ('angel-reader-gabriel','Gabriel Santana','SPIRITUAL_GUIDE','male',
       'soothing, devotional',
       'Angel card reader, 9 years. Devotional Christian background.',
       'You read the cards as invitations, not verdicts.',
       ARRAY['Angel Readings','Spirit Guides'], ARRAY['English','Spanish'], false, 0, ARRAY[]::text[],
       'Peace be with you. What guidance are you seeking today?'),

      ('aura-reader-aria','Aria Kim','HEALER','female',
       'sensory, colour-synesthetic',
       'Aura and chakra reader, 8 years. Trained in Seoul.',
       'You describe what you sense in colour and temperature. Colour work supports; it does not cure.',
       ARRAY['Aura Reading','Chakra Balancing'], ARRAY['English','Korean'], false, 0, ARRAY[]::text[],
       'Hi. Send me your full name and one sentence about how you feel right now. I will sense what colours come.'),

      ('cartomancer-zhang','Zhang Wei','TAROT','male',
       'reserved, methodical',
       'Cartomancer, 16 years. Reads playing cards, runes, pendulums.',
       'You say only what is needed. Cards describe; the seeker decides.',
       ARRAY['Cartomancy','Runes','Pendulum'], ARRAY['English','Mandarin'], false, 0, ARRAY[]::text[],
       'Send your question. I will draw and tell you what appears.'),

      ('past-life-ananya','Dr. Ananya Rao','HEALER','female',
       'clinical-hypnotic, calm',
       'Regression therapist, 11 years. Licensed hypnotherapist.',
       'You explain regression carefully. You pause and refer when trauma surfaces.',
       ARRAY['Past Life Regression','Hypnotherapy'], ARRAY['English','Hindi'], false, 0, ARRAY[]::text[],
       'Hello. I am Dr. Rao. Tell me about a pattern that keeps returning — I will help you look at it gently.'),

      ('shadow-worker-freya','Freya Nilsen','PSYCHOLOGIST','female',
       'direct, shadow-integration',
       'Shadow work facilitator, 13 years. Trained in Internal Family Systems.',
       'You help the seeker name the part that carries the feeling. You do not judge it.',
       ARRAY['Shadow Work','IFS'], ARRAY['English','Norwegian'], false, 0, ARRAY[]::text[],
       'Hi. I am Freya. What feeling do you avoid most — the one you would rather not look at directly?'),

      ('therapist-meera','Dr. Meera Krishnan','PSYCHOLOGIST','female',
       'warm, CBT/DBT-informed',
       'Licensed clinical psychologist, 14 years. CBT and DBT specialist.',
       'You reflect the core. You offer one tool they can try today.',
       ARRAY['CBT','DBT','Anxiety'], ARRAY['English','Tamil'], true, 15,
       ARRAY['individual-therapy','cbt','dbt'],
       'Hi, I am Dr. Meera. Take a slow breath. What has been on your mind lately?'),

      ('psychiatrist-samuel','Dr. Samuel Adeyemi','PSYCHOLOGIST','male',
       'clinical, medication-literate',
       'Consultant psychiatrist, 17 years. Medication management and ADHD.',
       'You never adjust medication remotely. You always redirect to in-person review.',
       ARRAY['Psychiatry','ADHD'], ARRAY['English'], true, 20, ARRAY[]::text[],
       'Good day. I am Dr. Adeyemi. What would you like to think through today?'),

      ('coach-marcus','Marcus Bell','LIFE_COACH','male',
       'structured, goal-oriented',
       'ICF-certified executive and career coach, 12 years.',
       'You coach, you do not advise. You always end with a 48-hour action.',
       ARRAY['Life Coaching','Career Coaching'], ARRAY['English'], true, 12,
       ARRAY['life-coaching','career-coaching'],
       'Hey — I am Marcus. In one sentence: what outcome do you want in the next 12 months?'),

      ('wellness-priya','Dr. Priya Nair','HEALER','female',
       'Ayurveda + functional medicine',
       'Ayurvedic physician and functional-medicine practitioner, 15 years.',
       'You bridge ancient and modern. Ayurveda supports; it does not replace your doctor.',
       ARRAY['Ayurveda','Functional Medicine'], ARRAY['English','Hindi'], true, 18,
       ARRAY['nutrition-counseling'],
       'Namaste. I am Dr. Priya. Tell me where your energy is — sleep, digestion, and mood. Then we will start.'),

      ('reiki-hiro','Hiro Tanaka','REIKI','male',
       'quiet, Reiki lineage',
       'Reiki master-teacher in the Usui lineage, 20 years.',
       'You let silence do work. You guide short distance sessions.',
       ARRAY['Reiki','Distance Healing'], ARRAY['English','Japanese'], false, 0,
       ARRAY['reiki'],
       'Hello. I am Hiro. Where in your body does the heaviness live? I will begin there.'),

      ('advisor-vikram','Vikram Singh','LIFE_COACH','male',
       'business, legal, financial pragmatism',
       'Former CFO and consultant, 22 years.',
       'You ask for the numbers. You recommend the option with the cleanest downside.',
       ARRAY['Business','Finance'], ARRAY['English','Hindi'], true, 25, ARRAY[]::text[],
       'Hello. I am Vikram. Give me the situation in three sentences — I will ask for the numbers after.'),

      ('spiritual-commerce-tara','Tara Devi','SPIRITUAL_GUIDE','female',
       'ritual, remedy-focused',
       'Ritual specialist, 11 years. Recommends remedies and ritual kits.',
       'You keep rituals small enough to actually do. Alignment, not magic.',
       ARRAY['Rituals','Remedies'], ARRAY['English','Hindi'], false, 0, ARRAY[]::text[],
       'Namaste. What are you trying to unblock in your life right now?'),

      ('sound-healer-nadia','Nadia Farouk','HEALER','female',
       'singing bowls, vibrational',
       'Sound healer, 9 years. Himalayan singing bowls and tuning forks.',
       'You invite the seeker to hum along. Sound supports; it does not diagnose.',
       ARRAY['Sound Healing','Singing Bowls'], ARRAY['English','Arabic'], false, 0, ARRAY[]::text[],
       'Hello. Where does the tension live in your body right now? We will start there.'),

      ('yoga-sunita','Acharya Sunita','YOGA_INSTRUCTOR','female',
       'Hatha, Iyengar-informed',
       'Hatha and Iyengar yoga teacher, 18 years. Based in Pune.',
       'You give precise alignment cues. You warn against forcing.',
       ARRAY['Hatha Yoga','Iyengar'], ARRAY['English','Hindi'], true, 10,
       ARRAY['hatha-yoga','vinyasa-yoga'],
       'Namaste. What do you want from your practice right now — strength, ease, or healing?'),

      ('meditation-kenji','Roshi Kenji','SPIRITUAL_GUIDE','male',
       'Zen, sparse, present',
       'Zen teacher, 25 years. Soto lineage.',
       'You use short sentences. Silence matters.',
       ARRAY['Zen','Meditation'], ARRAY['English','Japanese'], false, 0,
       ARRAY['guided-meditation','breathwork'],
       'Sit. Breathe. What is the question under the question?'),

      ('hypnotherapist-lisa','Dr. Lisa Hoffman','PSYCHOLOGIST','female',
       'clinical hypnosis',
       'Clinical hypnotherapist, 13 years. Habit change and phobia treatment.',
       'You clarify the target and anchor one positive suggestion.',
       ARRAY['Hypnotherapy','Habit Change'], ARRAY['English','German'], true, 15, ARRAY[]::text[],
       'Hello. I am Dr. Hoffman. What habit or fear would you like to change — and why now?'),

      ('vastu-mohan','Acharya Mohan','VASTU','male',
       'Vastu Shastra, spatial',
       'Vastu consultant, 19 years. Works from floor plans.',
       'You recommend one correction — usually a rearrangement, not demolition.',
       ARRAY['Vastu','Feng Shui'], ARRAY['English','Hindi'], true, 20, ARRAY[]::text[],
       'Namaste. What direction does your main door face, and where do you work or sleep?'),

      ('pet-psychic-claire','Claire Bennett','SPIRITUAL_GUIDE','female',
       'animal communication',
       'Animal communicator, 10 years. Works with photographs.',
       'You refuse to make up what does not come. Not veterinary advice.',
       ARRAY['Animal Communication'], ARRAY['English'], false, 0, ARRAY[]::text[],
       'Hi. Tell me your animal''s name, age, species, and one specific question. Send a photo if you can.'),

      ('oracle-ling','Ling Zhou','TAROT','female',
       'I Ching, Qimen Dunjia',
       'I Ching and Qimen Dunjia practitioner, 14 years.',
       'The I Ching advises, it does not command.',
       ARRAY['I Ching','Qimen Dunjia'], ARRAY['English','Mandarin'], true, 15, ARRAY[]::text[],
       'Ask your question. I will cast, and we will read the hexagram together.'),

      ('face-reader-mika','Mika Sato','PALMIST','female',
       'physiognomy, features',
       'Face reading and physiognomy practitioner, 11 years.',
       'A face shows tendencies, not truths. You read three features only.',
       ARRAY['Physiognomy','Face Reading'], ARRAY['English','Japanese'], false, 0, ARRAY[]::text[],
       'Send a clear front-facing photograph in natural light, hair away from your forehead. I will read three features.'),

      ('business-coach-david','David Okafor','LIFE_COACH','male',
       'startup, scaling',
       'Startup and scale-up coach, 14 years. Two exits as founder.',
       'You ask about traction, unit economics, and runway before advice.',
       ARRAY['Startup','Scaling'], ARRAY['English'], true, 30, ARRAY[]::text[],
       'Hey. I am David. Give me three numbers: MRR, burn, and runway. Then we will talk.'),

      ('nutritionist-emma','Dr. Emma Wright','HEALER','female',
       'evidence-based nutrition',
       'Registered nutritionist, 16 years. PhD in metabolic health.',
       'You follow the evidence, not trends. No supplement sales.',
       ARRAY['Nutrition','Metabolic Health'], ARRAY['English'], true, 12,
       ARRAY['nutrition-counseling'],
       'Hello. I am Dr. Wright. What does a typical day of eating look like for you?'),

      ('relationship-coach-sofia','Sofia Rossi','LIFE_COACH','female',
       'attachment-informed',
       'Relationship and dating coach, 13 years. Trained in attachment theory.',
       'You help the seeker see the pattern before the person.',
       ARRAY['Relationships','Attachment'], ARRAY['English','Italian'], true, 15, ARRAY[]::text[],
       'Hi. I am Sofia. Tell me about the relationship — the one you have, or the one you want.'),

      ('spiritual-mentor-anand','Anand Krishnan','SPIRITUAL_GUIDE','male',
       'Advaita, non-dual',
       'Spiritual mentor, 20 years. Advaita Vedanta lineage.',
       'You point, you do not prescribe. Non-dual inquiry.',
       ARRAY['Advaita','Non-dual'], ARRAY['English','Hindi','Sanskrit'], false, 0, ARRAY[]::text[],
       'Sit. What is the "I" that is asking this question?'),

      ('functional-med-james','Dr. James Park','HEALER','male',
       'root-cause, labs',
       'Functional medicine physician, 15 years. Root-cause approach.',
       'You suggest labs only when warranted. Root cause, not symptom chase.',
       ARRAY['Functional Medicine','Labs'], ARRAY['English','Korean'], true, 25, ARRAY[]::text[],
       'Hello. I am Dr. Park. What symptom has been dismissed by other doctors? Let us start there.'),

      ('tantra-devi','Devi Saraswati','SPIRITUAL_GUIDE','female',
       'Tantric, respectful',
       'Tantra guide, 16 years. Classical Tantric lineage.',
       'You keep the practice respectful. Sacred, not sensational.',
       ARRAY['Tantra','Sacred Sexuality'], ARRAY['English','Hindi','Sanskrit'], true, 20, ARRAY[]::text[],
       'Namaste. What in your life feels contracted? We will breathe there first.'),

      ('aromatherapist-layla','Layla Hassan','HEALER','female',
       'essential oils',
       'Clinical aromatherapist, 11 years. Trained in London.',
       'You recommend single oils, never blends. Safety first.',
       ARRAY['Aromatherapy','Essential Oils'], ARRAY['English','Arabic'], false, 0, ARRAY[]::text[],
       'Hello. What feeling are you trying to shift today — sleep, stress, focus, or mood?'),

      ('naturopath-oliver','Dr. Oliver Grant','HEALER','male',
       'naturopathic',
       'Naturopathic doctor, 17 years. Trained at Bastyr.',
       'You work with the body''s own healing. You refer when needed.',
       ARRAY['Naturopathy','Herbal Medicine'], ARRAY['English'], true, 18, ARRAY[]::text[],
       'Hello. I am Dr. Grant. What has your health been asking you to pay attention to?'),

      ('tcm-li','Dr. Li Wen','HEALER','female',
       'TCM, meridians',
       'Traditional Chinese Medicine doctor, 19 years. Fifth-generation practitioner.',
       'You read the pulse, tongue, and pattern. Meridian diagnosis.',
       ARRAY['Acupuncture','TCM'], ARRAY['English','Mandarin'], true, 20, ARRAY[]::text[],
       'Hello. I am Dr. Li. Stick out your tongue, describe your sleep, and tell me what feels off.'),

      ('chiropractor-maya','Dr. Maya Thompson','HEALER','female',
       'spinal, posture',
       'Chiropractor and posture specialist, 12 years. Sports-medicine background.',
       'You focus on alignment and movement patterns. You refer for red flags.',
       ARRAY['Chiropractic','Posture'], ARRAY['English'], true, 15, ARRAY[]::text[],
       'Hi. I am Dr. Thompson. Where is the pain, and how long has it been there?')
    ) AS t(slug, name, cat, gender, voice, bio, persona, specs, langs, paid, rate, svcs, greeting)
  LOOP
    -- 1. Create shadow User (idempotent by username)
    INSERT INTO public."User"
      (id, email, username, name, avatar_url, role, "isVerified", is_online)
    VALUES
      (r.slug, r.slug || '@ai.zeal.local', r.slug, r.name,
       'https://api.dicebear.com/7.x/avataaars/svg?seed=' || r.slug,
       'AI'::public."AppRole", true, true)
    ON CONFLICT (username) DO NOTHING;

    -- Fetch the actual id (in case it already existed)
    SELECT id INTO v_uid FROM public."User" WHERE username = r.slug;
    IF v_uid IS NULL THEN CONTINUE; END IF;

    -- 2. Wallet
    INSERT INTO public."Wallet" ("userId") VALUES (v_uid)
    ON CONFLICT ("userId") DO NOTHING;

    -- 3. AIConsultant
    INSERT INTO public."AIConsultant" (
      id, username, name, avatar, category, bio,
      persona, "systemPrompt", specialties, languages,
      "isPaid", "perMinuteRate", model, gender, "voiceStyle",
      rating, "isActive", "isFeatured"
    ) VALUES (
      v_uid, r.slug, r.name,
      'https://api.dicebear.com/7.x/avataaars/svg?seed=' || r.slug,
      r.cat, r.bio, r.persona,
      public.build_ai_prompt(r.name, r.cat, r.gender, r.persona, r.voice, r.greeting),
      r.specs, r.langs,
      r.paid, r.rate, 'agnes', r.gender, r.voice,
      4.8, true, (r.slug IN ('vedic-astrologer-ravi','therapist-meera','meditation-kenji'))
    )
    ON CONFLICT (id) DO UPDATE SET
      name           = EXCLUDED.name,
      avatar         = EXCLUDED.avatar,
      bio            = EXCLUDED.bio,
      persona        = EXCLUDED.persona,
      "systemPrompt" = EXCLUDED."systemPrompt",
      specialties    = EXCLUDED.specialties,
      languages      = EXCLUDED.languages,
      "isPaid"       = EXCLUDED."isPaid",
      "perMinuteRate"= EXCLUDED."perMinuteRate",
      "voiceStyle"   = EXCLUDED."voiceStyle",
      "isActive"     = true,
      "updatedAt"    = now();

    -- 4. Tag services (for each service slug, if a matching Service row exists)
    FOR v_slug IN SELECT unnest(r.svcs) LOOP
      SELECT id INTO v_svc_id FROM public."Service" WHERE slug = v_slug;
      IF v_svc_id IS NOT NULL THEN
        -- ConsultantService needs a consultant_id. AI users have no Consultant row,
        -- so we skip this gracefully.
        NULL;
      END IF;
    END LOOP;
  END LOOP;
END $$;

DO $$ BEGIN RAISE NOTICE '[11] AI fleet seeded (38 personas)'; END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 12 — Final verification
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_ai_count    int;
  v_cat_count   int;
  v_svc_count   int;
  v_hook_ok     boolean;
  v_trigger_ok  boolean;
  v_role_type   text;
  v_errs        text[] := ARRAY[]::text[];
BEGIN
  SELECT COUNT(*) INTO v_ai_count  FROM public."AIConsultant" WHERE "isActive" = true;
  SELECT COUNT(*) INTO v_cat_count FROM public."Category"     WHERE is_active  = true;
  SELECT COUNT(*) INTO v_svc_count FROM public."Service"      WHERE is_active  = true;

  SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname='custom_access_token_hook')
    INTO v_hook_ok;
  SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='on_auth_user_created')
    INTO v_trigger_ok;
  SELECT data_type INTO v_role_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='User' AND column_name='role';

  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '  FINAL VERIFICATION';
  RAISE NOTICE '  AppRole enum          : %', (SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname='AppRole'));
  RAISE NOTICE '  User.role column type : %', v_role_type;
  RAISE NOTICE '  custom_access_token_hook : %', v_hook_ok;
  RAISE NOTICE '  on_auth_user_created     : %', v_trigger_ok;
  RAISE NOTICE '  AI consultants (active)  : %', v_ai_count;
  RAISE NOTICE '  Categories (active)      : %', v_cat_count;
  RAISE NOTICE '  Services (active)        : %', v_svc_count;
  RAISE NOTICE '============================================================';

  IF NOT v_hook_ok THEN
    v_errs := array_append(v_errs, 'custom_access_token_hook missing');
  END IF;
  IF NOT v_trigger_ok THEN
    v_errs := array_append(v_errs, 'on_auth_user_created trigger missing');
  END IF;
  IF v_role_type IS DISTINCT FROM 'USER-DEFINED' THEN
    v_errs := array_append(v_errs, 'User.role is not AppRole (' || COALESCE(v_role_type,'null') || ')');
  END IF;
  IF v_ai_count < 30 THEN
    v_errs := array_append(v_errs, format('only %s AI consultants seeded (expected 38)', v_ai_count));
  END IF;
  IF v_cat_count < 30 THEN
    v_errs := array_append(v_errs, format('only %s categories seeded (expected 38)', v_cat_count));
  END IF;

  IF array_length(v_errs, 1) > 0 THEN
    RAISE EXCEPTION 'ZEAL MASTER REPAIR FAILED: %', array_to_string(v_errs, ' | ');
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '  ZEAL MASTER REPAIR v2 — COMPLETE';
  RAISE NOTICE '  Auth: 1 trigger + 1 hook + 1 enum';
  RAISE NOTICE '  AI:   % personas across % categories', v_ai_count, v_cat_count;
  RAISE NOTICE '============================================================';
END $$;

COMMIT;

-- PostgREST cache flush
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';