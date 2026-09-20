-- PHASE2_INDUSTRIAL
-- ═══════════════════════════════════════════════════════════════════════════════
-- 107_phase2_industrial.sql
-- Industrial-grade directory: categories, services, materialized view,
-- full-text search, drafts, heartbeat. Every statement is additive.
-- ═══════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ─── 1. Category catalog ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."Category" (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  display_name  text NOT NULL,
  icon          text,
  sort_order    int NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── 2. Service catalog ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."Service" (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  parent_category text NOT NULL REFERENCES public."Category"(id) ON DELETE CASCADE,
  description     text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── 3. Consultant ↔ Service join ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."ConsultantService" (
  consultant_id uuid NOT NULL REFERENCES public."Consultant"(id) ON DELETE CASCADE,
  service_id    uuid NOT NULL REFERENCES public."Service"(id)    ON DELETE CASCADE,
  proficiency   int NOT NULL DEFAULT 3 CHECK (proficiency BETWEEN 1 AND 5),
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consultant_id, service_id)
);

-- ─── 4. Draft state for the resumable wizard ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public."ConsultantDraft" (
  "userId"     uuid PRIMARY KEY REFERENCES public."User"(id) ON DELETE CASCADE,
  "step"       int  NOT NULL DEFAULT 1,
  "payload"    jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updatedAt"  timestamptz NOT NULL DEFAULT now(),
  "createdAt"  timestamptz NOT NULL DEFAULT now()
);

-- ─── 5. Heartbeat column ─────────────────────────────────────────────────────
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "lastSeenAt" timestamptz;

-- ─── 6. Full-text search vector on Consultant ────────────────────────────────
ALTER TABLE public."Consultant"
  ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(bio, '')), 'B')
    || setweight(to_tsvector('simple', coalesce(array_to_string(specialties, ' '), '')), 'A')
    || setweight(to_tsvector('simple', coalesce(category, '')), 'A')
  ) STORED;

-- ─── 7. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_service_category          ON public."Service"(parent_category);
CREATE INDEX IF NOT EXISTS idx_service_slug              ON public."Service"(slug);
CREATE INDEX IF NOT EXISTS idx_consultant_service_cid    ON public."ConsultantService"(consultant_id);
CREATE INDEX IF NOT EXISTS idx_consultant_service_sid    ON public."ConsultantService"(service_id);
CREATE INDEX IF NOT EXISTS idx_consultant_status_active  ON public."Consultant"(status, "isActive");
CREATE INDEX IF NOT EXISTS idx_consultant_search_vec     ON public."Consultant" USING GIN("searchVector");
CREATE INDEX IF NOT EXISTS idx_user_last_seen            ON public."User"("lastSeenAt" DESC)
  WHERE "is_online" = true;
CREATE INDEX IF NOT EXISTS idx_user_online               ON public."User"("is_online") WHERE "is_online" = true;

-- ─── 8. Seed categories ──────────────────────────────────────────────────────
INSERT INTO public."Category" (id, name, display_name, sort_order) VALUES
  ('astrology','Astrology & Divination','Astrology & Divination',1),
  ('tarot','Tarot & Oracle','Tarot & Oracle',2),
  ('numerology','Numerology','Numerology',3),
  ('palmistry','Palmistry','Palmistry',4),
  ('therapy','Mental Health & Therapy','Mental Health & Therapy',5),
  ('wellness','Wellness & Holistic Health','Wellness & Holistic Health',6),
  ('life-coaching','Life & Career Coaching','Life & Career Coaching',7),
  ('energy-healing','Energy Healing & Reiki','Energy Healing & Reiki',8),
  ('meditation','Meditation & Mindfulness','Meditation & Mindfulness',9),
  ('yoga','Yoga & Movement Therapy','Yoga & Movement Therapy',10),
  ('psychic','Psychic Mediumship','Psychic Mediumship',11),
  ('clairvoyance','Clairvoyance & Intuition','Clairvoyance & Intuition',12),
  ('dreams','Dream Analysis','Dream Analysis',13),
  ('angels','Angel & Spirit Guides','Angel & Spirit Guides',14),
  ('aura','Aura Reading & Cleansing','Aura Reading & Cleansing',15),
  ('past-life','Past Life & Soul Purpose','Past Life & Soul Purpose',16),
  ('shadow-work','Shadow Work & Ancestral','Shadow Work & Ancestral',17),
  ('relationship-coaching','Relationship & Dating','Relationship & Dating',18),
  ('health-coaching','Health & Nutrition Coaching','Health & Nutrition Coaching',19),
  ('business-coaching','Business Coaching','Business Coaching',20)
ON CONFLICT (id) DO NOTHING;

-- ─── 9. Seed services ────────────────────────────────────────────────────────
INSERT INTO public."Service" (name, slug, parent_category) VALUES
  ('Vedic Astrology','vedic-astrology','astrology'),
  ('Western Astrology','western-astrology','astrology'),
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

-- ─── 10. Migrate existing specialties → ConsultantService ────────────────────
INSERT INTO public."ConsultantService" (consultant_id, service_id)
SELECT DISTINCT c.id, s.id
FROM public."Consultant" c
CROSS JOIN LATERAL unnest(c.specialties) AS spec
JOIN public."Service" s ON LOWER(s.name) = LOWER(spec)
ON CONFLICT DO NOTHING;

-- ─── 11. RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE public."Category"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Service"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ConsultantService"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ConsultantDraft"    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "category_public_read" ON public."Category";
CREATE POLICY "category_public_read" ON public."Category" FOR SELECT USING (true);

DROP POLICY IF EXISTS "service_public_read" ON public."Service";
CREATE POLICY "service_public_read" ON public."Service" FOR SELECT USING (true);

DROP POLICY IF EXISTS "consultant_service_public_read" ON public."ConsultantService";
CREATE POLICY "consultant_service_public_read" ON public."ConsultantService"
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "consultant_service_self_write" ON public."ConsultantService";
CREATE POLICY "consultant_service_self_write" ON public."ConsultantService"
  FOR ALL USING (
    consultant_id IN (
      SELECT id FROM public."Consultant" WHERE "userId" = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "consultant_draft_self" ON public."ConsultantDraft";
CREATE POLICY "consultant_draft_self" ON public."ConsultantDraft"
  FOR ALL USING ("userId" = (SELECT auth.uid()))
  WITH CHECK ("userId" = (SELECT auth.uid()));

-- ─── 12. Materialized view ───────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS public."mv_consultant_directory";

CREATE MATERIALIZED VIEW public."mv_consultant_directory" AS
SELECT
  c.id,
  c."userId",
  u.name,
  u.username,
  u.avatar_url,
  COALESCE(u.is_online, false) AS is_online,
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
  c."searchVector",
  COALESCE(
    ARRAY(
      SELECT s.slug FROM public."ConsultantService" cs
      JOIN public."Service" s ON s.id = cs.service_id
      WHERE cs.consultant_id = c.id
    ),
    ARRAY[]::text[]
  ) AS service_slugs,
  COALESCE(
    ARRAY(
      SELECT s.parent_category FROM public."ConsultantService" cs
      JOIN public."Service" s ON s.id = cs.service_id
      WHERE cs.consultant_id = c.id
    ),
    ARRAY[]::text[]
  ) AS category_ids
FROM public."Consultant" c
JOIN public."User" u ON u.id = c."userId"
WHERE c.status = 'VERIFIED'
  AND c."isActive" = true
  AND c."isVerified" = true;

CREATE UNIQUE INDEX IF NOT EXISTS mv_consultant_directory_id
  ON public."mv_consultant_directory"(id);

CREATE INDEX IF NOT EXISTS mv_consultant_directory_online
  ON public."mv_consultant_directory"(is_online, "sparkScore" DESC);

CREATE INDEX IF NOT EXISTS mv_consultant_directory_category
  ON public."mv_consultant_directory"(category, rating DESC);

CREATE INDEX IF NOT EXISTS mv_consultant_directory_services
  ON public."mv_consultant_directory" USING GIN(service_slugs);

CREATE INDEX IF NOT EXISTS mv_consultant_directory_search
  ON public."mv_consultant_directory" USING GIN("searchVector");

GRANT SELECT ON public."mv_consultant_directory" TO anon, authenticated;

-- ─── 13. Refresh RPC (advisory-lock debounced) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_consultant_directory()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT pg_try_advisory_lock(hashtext('mv_consultant_directory')) THEN
    RETURN;
  END IF;
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public."mv_consultant_directory";
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'refresh_consultant_directory failed: %', SQLERRM;
  END;
  PERFORM pg_advisory_unlock(hashtext('mv_consultant_directory'));
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.refresh_consultant_directory() TO authenticated;

-- ─── 14. Faceted search RPC ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.search_consultants(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_category       text := NULLIF(p_filters->>'category', '');
  v_service        text := NULLIF(p_filters->>'service', '');
  v_online_only    boolean := COALESCE((p_filters->>'online')::boolean, false);
  v_search         text := NULLIF(TRIM(p_filters->>'q'), '');
  v_min_rating     numeric := COALESCE((p_filters->>'minRating')::numeric, 0);
  v_max_rate       numeric := COALESCE((p_filters->>'maxRate')::numeric, 0);
  v_limit          int := LEAST(GREATEST(COALESCE((p_filters->>'limit')::int, 40), 1), 100);
  v_offset         int := GREATEST(COALESCE((p_filters->>'offset')::int, 0), 0);
  v_sort           text := COALESCE(p_filters->>'sort', 'relevance');
  v_tsquery        tsquery;
  v_results        jsonb;
  v_total          int;
BEGIN
  IF v_search IS NOT NULL THEN
    v_tsquery := plainto_tsquery('simple', v_search);
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public."mv_consultant_directory" m
  WHERE (v_category   IS NULL OR m.category = v_category)
    AND (v_service    IS NULL OR v_service = ANY(m.service_slugs))
    AND (NOT v_online_only OR m.is_online = true)
    AND (v_min_rating <= 0 OR m.rating >= v_min_rating)
    AND (v_max_rate <= 0 OR m."perMinuteRate" <= v_max_rate)
    AND (v_tsquery IS NULL OR m."searchVector" @@ v_tsquery
         OR m.name ILIKE '%' || v_search || '%'
         OR m.username ILIKE '%' || v_search || '%');

  SELECT COALESCE(jsonb_agg(row_to_json(page)), '[]'::jsonb)
  INTO v_results
  FROM (
    SELECT m.*
    FROM public."mv_consultant_directory" m
    WHERE (v_category   IS NULL OR m.category = v_category)
      AND (v_service    IS NULL OR v_service = ANY(m.service_slugs))
      AND (NOT v_online_only OR m.is_online = true)
      AND (v_min_rating <= 0 OR m.rating >= v_min_rating)
      AND (v_max_rate <= 0 OR m."perMinuteRate" <= v_max_rate)
      AND (v_tsquery IS NULL OR m."searchVector" @@ v_tsquery
           OR m.name ILIKE '%' || v_search || '%'
           OR m.username ILIKE '%' || v_search || '%')
    ORDER BY
      CASE WHEN v_sort = 'price-asc'  THEN m."perMinuteRate" END ASC  NULLS LAST,
      CASE WHEN v_sort = 'price-desc' THEN m."perMinuteRate" END DESC NULLS LAST,
      CASE WHEN v_sort = 'relevance' AND v_tsquery IS NOT NULL
           THEN ts_rank(m."searchVector", v_tsquery) END DESC NULLS LAST,
      CASE WHEN v_sort NOT IN ('price-asc','price-desc')
           THEN m.is_online END DESC NULLS LAST,
      CASE WHEN v_sort NOT IN ('price-asc','price-desc')
           THEN m."sparkScore" END DESC NULLS LAST,
      CASE WHEN v_sort NOT IN ('price-asc','price-desc')
           THEN m.rating END DESC NULLS LAST,
      m.id ASC
    LIMIT v_limit OFFSET v_offset
  ) page;

  RETURN jsonb_build_object(
    'consultants', v_results,
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'source', 'mv'
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.search_consultants(jsonb) TO anon, authenticated;

-- ─── 15. Stale presence cleanup ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_stale_online_users(p_stale_after_seconds int DEFAULT 120)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_count int;
BEGIN
  UPDATE public."User"
  SET "is_online" = false, "updatedAt" = now()
  WHERE "is_online" = true
    AND ("lastSeenAt" IS NULL OR "lastSeenAt" < now() - (p_stale_after_seconds || ' seconds')::interval);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    BEGIN
      PERFORM public.refresh_consultant_directory();
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN v_count;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.cleanup_stale_online_users(int) TO authenticated;

-- ─── 16. MV auto-refresh trigger ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_fn_consultant_refresh_mv()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  BEGIN
    PERFORM public.refresh_consultant_directory();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'mv refresh skipped: %', SQLERRM;
  END;
  RETURN COALESCE(NEW, OLD);
END;
$fn$;

DROP TRIGGER IF EXISTS trg_consultant_refresh_mv ON public."Consultant";
CREATE TRIGGER trg_consultant_refresh_mv
  AFTER INSERT OR UPDATE OF status, "isActive", "isVerified", rating, "sparkScore", specialties
  ON public."Consultant"
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_consultant_refresh_mv();

-- ─── 17. Initial population ──────────────────────────────────────────────────
REFRESH MATERIALIZED VIEW public."mv_consultant_directory";

-- ─── 18. PostgREST cache reload ──────────────────────────────────────────────
DO $do$ BEGIN PERFORM pg_notification_queue_usage(); EXCEPTION WHEN undefined_function THEN NULL; END $do$;
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
