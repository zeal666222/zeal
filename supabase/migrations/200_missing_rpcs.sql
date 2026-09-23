-- 200_missing_rpcs.sql — RPCs referenced by code, previously never created.
BEGIN;

-- MV-backed directory search
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_consultant_directory AS
SELECT
  c.id,
  c."userId",
  u.name,
  u.username,
  u.avatar_url,
  u.is_online,
  u."lastSeenAt",
  c.category,
  c."perMinuteRate",
  c.rating,
  c."sparkScore",
  c."isVerified",
  c."isActive",
  c.status,
  c.subdomain,
  c."subdomainActive",
  c.specialties,
  c.languages,
  c.bio,
  c."totalConsultations",
  ARRAY[]::text[] AS service_slugs,
  ARRAY[]::text[] AS category_ids
FROM public."Consultant" c
JOIN public."User" u ON u.id = c."userId"
WHERE c.status = 'VERIFIED' AND c."isActive" = true;

CREATE UNIQUE INDEX IF NOT EXISTS mv_consultant_directory_id
  ON public.mv_consultant_directory(id);

CREATE OR REPLACE FUNCTION public.refresh_consultant_directory()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_consultant_directory;
EXCEPTION WHEN OTHERS THEN
  REFRESH MATERIALIZED VIEW public.mv_consultant_directory;
END $$;
GRANT EXECUTE ON FUNCTION public.refresh_consultant_directory() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.search_consultants(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_category text; v_q text; v_limit int; v_offset int; v_online boolean;
  v_min_rating numeric; v_max_rate numeric; v_sort text;
  v_rows jsonb; v_total int;
BEGIN
  v_category := p_filters->>'category';
  v_q        := p_filters->>'q';
  v_limit    := COALESCE((p_filters->>'limit')::int, 40);
  v_offset   := COALESCE((p_filters->>'offset')::int, 0);
  v_online   := (p_filters->>'online')::boolean;
  v_min_rating := (p_filters->>'minRating')::numeric;
  v_max_rate   := (p_filters->>'maxRate')::numeric;
  v_sort       := COALESCE(p_filters->>'sort', 'relevance');

  SELECT jsonb_agg(row_to_json(t)), COUNT(*) OVER ()
  INTO v_rows, v_total
  FROM (
    SELECT * FROM public.mv_consultant_directory d
    WHERE (v_category IS NULL OR d.category = v_category)
      AND (v_q IS NULL OR d.name ILIKE '%' || v_q || '%'
                       OR d.username ILIKE '%' || v_q || '%'
                       OR d.bio ILIKE '%' || v_q || '%')
      AND (v_online IS NULL OR v_online = false OR d.is_online = true)
      AND (v_min_rating IS NULL OR d.rating >= v_min_rating)
      AND (v_max_rate IS NULL OR d."perMinuteRate" <= v_max_rate)
    ORDER BY
      CASE WHEN v_sort = 'rating'    THEN d.rating END DESC NULLS LAST,
      CASE WHEN v_sort = 'price_asc' THEN d."perMinuteRate" END ASC NULLS LAST,
      CASE WHEN v_sort = 'price_desc'THEN d."perMinuteRate" END DESC NULLS LAST,
      d."sparkScore" DESC NULLS LAST,
      d.rating DESC NULLS LAST
    LIMIT v_limit OFFSET v_offset
  ) t;

  RETURN jsonb_build_object(
    'consultants', COALESCE(v_rows, '[]'::jsonb),
    'total', COALESCE(v_total, 0)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.search_consultants(jsonb) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.category_counts()
RETURNS TABLE("categoryId" text, count bigint, "onlineCount" bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    LOWER(c.category) AS "categoryId",
    COUNT(*)::bigint AS count,
    COUNT(*) FILTER (WHERE u.is_online = true)::bigint AS "onlineCount"
  FROM public."Consultant" c
  JOIN public."User" u ON u.id = c."userId"
  WHERE c.status = 'VERIFIED' AND c."isActive" = true
  GROUP BY LOWER(c.category);
$$;
GRANT EXECUTE ON FUNCTION public.category_counts() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(
  p_user_id uuid, p_ai_id text, p_max_per_minute int DEFAULT 10
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int; v_window timestamptz;
BEGIN
  SELECT "messageCount", "windowStart" INTO v_count, v_window
  FROM public."AIChatRateLimit" WHERE "userId" = p_user_id AND "aiId" = p_ai_id::uuid
  FOR UPDATE;

  IF NOT FOUND OR v_window < now() - interval '1 minute' THEN
    INSERT INTO public."AIChatRateLimit" ("userId", "aiId", "windowStart", "messageCount")
    VALUES (p_user_id, p_ai_id::uuid, now(), 1)
    ON CONFLICT ("userId", "aiId") DO UPDATE
      SET "windowStart" = now(), "messageCount" = 1;
    RETURN jsonb_build_object('ok', true, 'remaining', p_max_per_minute - 1);
  END IF;

  IF v_count >= p_max_per_minute THEN
    RETURN jsonb_build_object('ok', false, 'retryAfter',
      EXTRACT(EPOCH FROM (v_window + interval '1 minute' - now()))::int);
  END IF;

  UPDATE public."AIChatRateLimit" SET "messageCount" = "messageCount" + 1
  WHERE "userId" = p_user_id AND "aiId" = p_ai_id::uuid;
  RETURN jsonb_build_object('ok', true, 'remaining', p_max_per_minute - v_count - 1);
END $$;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(uuid, text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_partner_view(p_conversation_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := auth.uid(); v_partner RECORD;
BEGIN
  SELECT u.id, u.name, u.username, u.avatar, u.role
  INTO v_partner
  FROM public."ConversationParticipant" cp
  JOIN public."User" u ON u.id = cp."userId"
  WHERE cp."conversationId" = p_conversation_id AND cp."userId" <> v_me
  LIMIT 1;

  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false); END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'partner', jsonb_build_object(
      'id', v_partner.id, 'name', COALESCE(v_partner.name, v_partner.username, 'Zeal Member'),
      'username', v_partner.username, 'avatar', v_partner.avatar, 'role', v_partner.role
    ),
    'isAI', v_partner.role = 'AI'
  );
END $$;
GRANT EXECUTE ON FUNCTION public.chat_partner_view(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cleanup_stale_online_users(p_stale_after_seconds int DEFAULT 120)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  UPDATE public."User"
  SET is_online = false, "updatedAt" = now()
  WHERE is_online = true
    AND COALESCE("lastSeenAt", "updatedAt") < now() - (p_stale_after_seconds || ' seconds')::interval;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_online_users(int) TO authenticated, anon;

-- Ensure AIChatRateLimit exists
CREATE TABLE IF NOT EXISTS public."AIChatRateLimit" (
  "userId" uuid NOT NULL,
  "aiId" uuid NOT NULL,
  "windowStart" timestamptz NOT NULL DEFAULT now(),
  "messageCount" int NOT NULL DEFAULT 0,
  CONSTRAINT "AIChatRateLimit_pkey" PRIMARY KEY ("userId", "aiId")
);

NOTIFY pgrst, 'reload schema';
COMMIT;
