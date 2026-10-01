-- 20261001120000_repair_live_functions.sql
-- Repairs verified against the LIVE schema (project zyrunsnweznyrhuroduo) on 2026-10-01:
--   1. search_consultants   → live body errors: "column reference rating is ambiguous"; also
--                             category chips send Category.id slugs ('astrology') while
--                             Consultant.category is 'ASTROLOGER' → zero results. Replaced with a
--                             direct-query version (no MV staleness) that unions human + AI
--                             consultants and maps categories via category_slug().
--   2. auto_start_chat_billing → live body errors: "operator does not exist: text = uuid"
--                             (AIConsultant.id is text, ConversationParticipant.userId is uuid).
--   3. chat_partner_view    → extended to return rate + active sessionId so the chat UI can show
--                             the per-minute funnel without a ?session= query param.
--   4. check_ai_safety      → live body errors "text = uuid"; also default bannedPatterns use
--                             (?i) inline flags which Postgres regex does not support. Replaced.
--   5. check_ai_rate_limit  → live has ambiguous overloads (PGRST203). All overloads dropped,
--                             single canonical (uuid, text, int) recreated.
--   6. category_counts      → returns mapped Category.id slugs so catalog chips can be filtered.
-- Idempotent: safe to re-run.

BEGIN;
SET LOCAL statement_timeout = '2min';

-- ─── 1. category slug mapping ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.category_slug(p_category text)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE UPPER(COALESCE(p_category, ''))
    WHEN 'ASTROLOGER'      THEN 'astrology'
    WHEN 'TAROT'           THEN 'tarot'
    WHEN 'NUMEROLOGIST'    THEN 'numerology'
    WHEN 'PALMIST'         THEN 'palmistry'
    WHEN 'SPIRITUAL_GUIDE' THEN 'spiritual-coaching'
    WHEN 'HEALER'          THEN 'energy-healing'
    WHEN 'REIKI'           THEN 'energy-healing'
    WHEN 'PSYCHOLOGIST'    THEN 'therapy'
    WHEN 'LIFE_COACH'      THEN 'life-coaching'
    WHEN 'YOGA_INSTRUCTOR' THEN 'yoga'
    WHEN 'VASTU'           THEN 'feng-shui'
    WHEN 'MASSAGE'         THEN 'massage'
    WHEN 'PSYCHIC'         THEN 'psychic'
    WHEN 'CLAIRVOYANT'     THEN 'clairvoyance'
    ELSE LOWER(REPLACE(COALESCE(p_category, ''), '_', '-'))
  END;
$$;
GRANT EXECUTE ON FUNCTION public.category_slug(text) TO anon, authenticated;

-- ─── 2. search_consultants (human + AI union, direct tables, correct total) ──
CREATE OR REPLACE FUNCTION public.search_consultants(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_category   text := NULLIF(p_filters->>'category', '');
  v_service    text := NULLIF(p_filters->>'service', '');
  v_online     boolean := COALESCE((p_filters->>'online')::boolean, false);
  v_q          text := NULLIF(TRIM(p_filters->>'q'), '');
  v_min_rating numeric := COALESCE((p_filters->>'minRating')::numeric, 0);
  v_max_rate   numeric := COALESCE((p_filters->>'maxRate')::numeric, 0);
  v_limit      int := LEAST(GREATEST(COALESCE((p_filters->>'limit')::int, 40), 1), 100);
  v_offset     int := GREATEST(COALESCE((p_filters->>'offset')::int, 0), 0);
  v_sort       text := COALESCE(p_filters->>'sort', 'relevance');
  v_result     jsonb;
BEGIN
  WITH dir AS MATERIALIZED (
    SELECT
      c.id::text                                        AS id,
      c."userId"::text                                  AS "userId",
      COALESCE(u.name, u.full_name, u.username)         AS name,
      u.username                                        AS username,
      COALESCE(u.avatar, u.avatar_url)                  AS avatar_url,
      COALESCE(u.is_online, false)                      AS is_online,
      u."lastSeenAt"                                    AS "lastSeenAt",
      c.category                                        AS category,
      c."perMinuteRate"::numeric                        AS "perMinuteRate",
      c.rating::numeric                                 AS rating,
      COALESCE(c."sparkScore", 0)::bigint               AS "sparkScore",
      c."isVerified"                                    AS "isVerified",
      c."isActive"                                      AS "isActive",
      c.status                                          AS status,
      c.subdomain                                       AS subdomain,
      c."subdomainActive"                               AS "subdomainActive",
      c.specialties                                     AS specialties,
      c.languages                                       AS languages,
      COALESCE(c.bio, u.bio)                            AS bio,
      c."totalConsultations"                            AS "totalConsultations",
      COALESCE(
        ARRAY(SELECT s.slug FROM public."ConsultantService" cs
              JOIN public."Service" s ON s.id = cs.service_id
              WHERE cs.consultant_id = c.id),
        ARRAY[]::text[]
      )                                                 AS service_slugs,
      ARRAY[public.category_slug(c.category)]           AS category_ids,
      false                                             AS "isAI"
    FROM public."Consultant" c
    JOIN public."User" u ON u.id = c."userId"
    WHERE c.status = 'VERIFIED' AND c."isActive" = true
    UNION ALL
    SELECT
      a.id                                              AS id,
      a.id                                              AS "userId",
      a.name                                            AS name,
      a.username                                        AS username,
      a.avatar                                          AS avatar_url,
      true                                              AS is_online,
      NULL::timestamptz                                 AS "lastSeenAt",
      a.category                                        AS category,
      (CASE WHEN a."isPaid" THEN a."perMinuteRate" ELSE 0 END)::numeric AS "perMinuteRate",
      a.rating::numeric                                 AS rating,
      COALESCE(a.sparks, 0)::bigint                     AS "sparkScore",
      true                                              AS "isVerified",
      a."isActive"                                      AS "isActive",
      'VERIFIED'::text                                  AS status,
      NULL::text                                        AS subdomain,
      false                                             AS "subdomainActive",
      a.specialties                                     AS specialties,
      a.languages                                       AS languages,
      a.bio                                             AS bio,
      a."totalConsultations"                            AS "totalConsultations",
      ARRAY[]::text[]                                   AS service_slugs,
      ARRAY[public.category_slug(a.category)]           AS category_ids,
      true                                              AS "isAI"
    FROM public."AIConsultant" a
    WHERE a."isActive" = true
  ),
  filtered AS MATERIALIZED (
    SELECT d.*
    FROM dir d
    WHERE (v_category IS NULL
           OR public.category_slug(d.category) = LOWER(v_category)
           OR UPPER(d.category) = UPPER(v_category)
           OR LOWER(v_category) = ANY(d.category_ids))
      AND (v_service IS NULL OR v_service = ANY(d.service_slugs))
      AND (NOT v_online OR d.is_online)
      AND (v_min_rating <= 0 OR d.rating >= v_min_rating)
      AND (v_max_rate <= 0 OR d."perMinuteRate" <= v_max_rate)
      AND (v_q IS NULL
           OR d.name ILIKE '%' || v_q || '%'
           OR d.username ILIKE '%' || v_q || '%'
           OR d.bio ILIKE '%' || v_q || '%'
           OR d.category ILIKE '%' || v_q || '%'
           OR EXISTS (SELECT 1 FROM unnest(d.specialties) sp WHERE sp ILIKE '%' || v_q || '%'))
  ),
  page AS (
    SELECT f.*
    FROM filtered f
    ORDER BY
      CASE WHEN v_sort IN ('price_asc','price-asc')  THEN f."perMinuteRate" END ASC NULLS LAST,
      CASE WHEN v_sort IN ('price_desc','price-desc') THEN f."perMinuteRate" END DESC NULLS LAST,
      CASE WHEN v_sort = 'rating' THEN f.rating END DESC NULLS LAST,
      f.is_online DESC,
      f."isAI" ASC,
      f."sparkScore" DESC NULLS LAST,
      f.rating DESC NULLS LAST,
      f.name ASC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'consultants', COALESCE((SELECT jsonb_agg(row_to_json(p)) FROM page p), '[]'::jsonb),
    'total', (SELECT COUNT(*) FROM filtered),
    'limit', v_limit,
    'offset', v_offset,
    'source', 'union'
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.search_consultants(jsonb) TO anon, authenticated;

-- ─── 3. category_counts with mapped slugs ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.category_counts()
RETURNS TABLE("categoryId" text, count bigint, "onlineCount" bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT slug AS "categoryId", COUNT(*)::bigint, COUNT(*) FILTER (WHERE is_online)::bigint
  FROM (
    SELECT public.category_slug(c.category) AS slug, COALESCE(u.is_online, false) AS is_online
    FROM public."Consultant" c JOIN public."User" u ON u.id = c."userId"
    WHERE c.status = 'VERIFIED' AND c."isActive" = true
    UNION ALL
    SELECT public.category_slug(a.category), true
    FROM public."AIConsultant" a WHERE a."isActive" = true
  ) t
  GROUP BY slug;
$$;
GRANT EXECUTE ON FUNCTION public.category_counts() TO anon, authenticated;

-- ─── 4. chat_partner_view (+ rate + active session) ──────────────────────────
CREATE OR REPLACE FUNCTION public.chat_partner_view(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_me uuid := auth.uid();
  v_partner record;
  v_is_ai boolean := false;
  v_rate numeric := 0;
  v_session uuid;
BEGIN
  IF v_me IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public."ConversationParticipant"
    WHERE "conversationId" = p_conversation_id AND "userId" = v_me
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_participant');
  END IF;

  -- AI partner first (AIConsultant.id is text; participant userId is uuid)
  SELECT a.id::uuid AS id, a.name AS name, a.username AS username,
         a.avatar AS avatar, 'AI'::text AS role,
         (CASE WHEN a."isPaid" THEN a."perMinuteRate" ELSE 0 END)::numeric AS rate
  INTO v_partner
  FROM public."ConversationParticipant" cp
  JOIN public."AIConsultant" a ON a.id = cp."userId"::text
  WHERE cp."conversationId" = p_conversation_id AND cp."userId" <> v_me
  LIMIT 1;

  IF FOUND THEN
    v_is_ai := true;
    v_rate := COALESCE(v_partner.rate, 0);
  ELSE
    SELECT u.id AS id,
           COALESCE(u.name, u.full_name, u.username, 'Zeal Member') AS name,
           u.username AS username,
           COALESCE(u.avatar, u.avatar_url) AS avatar,
           COALESCE(u.role::text, 'USER') AS role,
           COALESCE(c."chatRate", c."perMinuteRate", 0)::numeric AS rate
    INTO v_partner
    FROM public."ConversationParticipant" cp
    JOIN public."User" u ON u.id = cp."userId"
    LEFT JOIN public."Consultant" c ON c."userId" = u.id
    WHERE cp."conversationId" = p_conversation_id AND cp."userId" <> v_me
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'no_partner');
    END IF;
    v_rate := COALESCE(v_partner.rate, 0);
  END IF;

  SELECT id INTO v_session
  FROM public."CallSession"
  WHERE "conversationId" = p_conversation_id
    AND "userId" = v_me
    AND status IN ('INITIATED', 'CONNECTED')
  ORDER BY "startTime" DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'partner', jsonb_build_object(
      'id', v_partner.id,
      'name', v_partner.name,
      'username', v_partner.username,
      'avatar', v_partner.avatar,
      'role', v_partner.role
    ),
    'isAI', v_is_ai,
    'rate', v_rate,
    'sessionId', v_session
  );
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.chat_partner_view(uuid) TO authenticated;

-- ─── 5. auto_start_chat_billing (text/uuid join fix + chatRate) ──────────────
CREATE OR REPLACE FUNCTION public.auto_start_chat_billing(
  p_conversation_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_existing record;
  v_partner record;
  v_rate numeric := 0;
  v_is_ai boolean := false;
  v_wallet record;
  v_session_id uuid;
BEGIN
  -- Resolve the billable partner first (AIConsultant.id is text; participant userId is uuid)
  SELECT a.id, a."perMinuteRate", a."isPaid"
  INTO v_partner
  FROM public."ConversationParticipant" cp
  JOIN public."AIConsultant" a ON a.id = cp."userId"::text
  WHERE cp."conversationId" = p_conversation_id
    AND cp."userId" <> p_user_id
  LIMIT 1;

  IF FOUND THEN
    v_rate := COALESCE(v_partner."perMinuteRate", 0);
    v_is_ai := true;
    IF v_partner."isPaid" = false THEN v_rate := 0; END IF;
  ELSE
    SELECT c.id, COALESCE(c."chatRate", c."perMinuteRate", 50) AS "perMinuteRate"
    INTO v_partner
    FROM public."ConversationParticipant" cp
    JOIN public."Consultant" c ON c."userId" = cp."userId"
    WHERE cp."conversationId" = p_conversation_id
      AND cp."userId" <> p_user_id AND c."isActive" = true
    LIMIT 1;

    IF FOUND THEN
      v_rate := COALESCE(v_partner."perMinuteRate", 50);
    ELSE
      v_rate := 0; -- plain user-to-user chat: not billable
    END IF;
  END IF;

  -- Reuse an already-active session for this conversation/user
  SELECT * INTO v_existing FROM public."CallSession"
  WHERE "conversationId" = p_conversation_id
    AND "userId" = p_user_id
    AND status IN ('INITIATED', 'CONNECTED')
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true, 'sessionId', v_existing.id, 'reused', true,
      'rate', v_rate, 'isAI', v_is_ai, 'free', v_rate = 0
    );
  END IF;

  IF v_rate = 0 THEN
    RETURN jsonb_build_object('success', true, 'free', true, 'rate', 0, 'isAI', v_is_ai);
  END IF;

  SELECT * INTO v_wallet FROM public."Wallet"
  WHERE "userId" = p_user_id FOR UPDATE;

  IF NOT FOUND OR v_wallet.balance < v_rate THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'insufficient_balance',
      'required', v_rate, 'available', COALESCE(v_wallet.balance, 0),
      'rate', v_rate, 'isAI', v_is_ai
    );
  END IF;

  INSERT INTO public."CallSession" (
    "userId", "consultantId", "aiConsultantId", "isAI",
    "conversationId", "startTime", status, amount, "durationSeconds"
  ) VALUES (
    p_user_id,
    CASE WHEN v_is_ai THEN NULL ELSE v_partner.id::uuid END,
    CASE WHEN v_is_ai THEN v_partner.id::text ELSE NULL END,
    v_is_ai, p_conversation_id, now(), 'CONNECTED', 0, 0
  ) RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'success', true, 'sessionId', v_session_id,
    'rate', v_rate, 'isAI', v_is_ai, 'startTime', now()
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.auto_start_chat_billing(uuid, uuid) TO authenticated;

-- ─── 6. check_ai_safety (text id, case-insensitive regex without (?i)) ──────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'check_ai_safety'
  LOOP
    EXECUTE 'DROP FUNCTION ' || r.sig;
  END LOOP;
END $$;

CREATE FUNCTION public.check_ai_safety(p_ai_id text, p_content text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_ai record;
  v_pattern text;
  v_clean text;
BEGIN
  SELECT "safetyLevel", "bannedPatterns" INTO v_ai
  FROM public."AIConsultant" WHERE id = p_ai_id LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('safe', true, 'reason', 'unknown_ai');
  END IF;
  IF COALESCE(v_ai."safetyLevel", 'STANDARD') = 'RELAXED' THEN
    RETURN jsonb_build_object('safe', true);
  END IF;

  FOREACH v_pattern IN ARRAY COALESCE(v_ai."bannedPatterns", ARRAY[]::text[]) LOOP
    v_clean := REPLACE(v_pattern, '(?i)', '');
    BEGIN
      IF p_content ~* v_clean THEN
        RETURN jsonb_build_object('safe', false, 'reason', v_clean);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- invalid regex pattern: skip
    END;
  END LOOP;

  RETURN jsonb_build_object('safe', true);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.check_ai_safety(text, text) TO anon, authenticated;

-- ─── 7. check_ai_rate_limit (single canonical overload) ──────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'check_ai_rate_limit'
  LOOP
    EXECUTE 'DROP FUNCTION ' || r.sig;
  END LOOP;
END $$;

CREATE FUNCTION public.check_ai_rate_limit(
  p_user_id uuid, p_ai_id text, p_max_per_minute int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_count int; v_window timestamptz; v_ai uuid;
BEGIN
  BEGIN
    v_ai := p_ai_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', true, 'remaining', p_max_per_minute);
  END;

  SELECT "messageCount", "windowStart" INTO v_count, v_window
  FROM public."AIChatRateLimit" WHERE "userId" = p_user_id AND "aiId" = v_ai
  FOR UPDATE;

  IF NOT FOUND OR v_window < now() - interval '1 minute' THEN
    INSERT INTO public."AIChatRateLimit" ("userId", "aiId", "windowStart", "messageCount")
    VALUES (p_user_id, v_ai, now(), 1)
    ON CONFLICT ("userId", "aiId") DO UPDATE
      SET "windowStart" = now(), "messageCount" = 1;
    RETURN jsonb_build_object('ok', true, 'remaining', p_max_per_minute - 1);
  END IF;

  IF v_count >= p_max_per_minute THEN
    RETURN jsonb_build_object('ok', false, 'retryAfter',
      GREATEST(1, EXTRACT(EPOCH FROM (v_window + interval '1 minute' - now()))::int));
  END IF;

  UPDATE public."AIChatRateLimit" SET "messageCount" = "messageCount" + 1
  WHERE "userId" = p_user_id AND "aiId" = v_ai;
  RETURN jsonb_build_object('ok', true, 'remaining', p_max_per_minute - v_count - 1);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(uuid, text, int) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
