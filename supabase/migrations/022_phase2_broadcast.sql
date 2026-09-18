-- ═══════════════════════════════════════════════════════════════════════════════
-- 022_phase2_broadcast.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2 realtime triggers:
--   • AIConsultant → consultant:ai:updates (public, anon-readable)
--   • Consultant   → consultants:live (public, anon-readable)
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. AI Consultant broadcast ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.broadcast_ai_consultant_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'consultant:ai:updates',
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_ai_consultant ON "AIConsultant";
CREATE TRIGGER trg_broadcast_ai_consultant
  AFTER INSERT OR UPDATE OR DELETE ON "AIConsultant"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_ai_consultant_changes();

-- ─── 2. Generic Consultant broadcast (public directory) ──────────────────────
CREATE OR REPLACE FUNCTION public.broadcast_consultant_directory_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'consultants:live',
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_consultant_directory ON "Consultant";
CREATE TRIGGER trg_broadcast_consultant_directory
  AFTER INSERT OR UPDATE OR DELETE ON "Consultant"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_consultant_directory_changes();

-- ─── 3. Ensure AIConsultant is in the realtime publication ───────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'AIConsultant'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."AIConsultant";
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'Consultant'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."Consultant";
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '  022_phase2_broadcast.sql — VERIFIED';
  RAISE NOTICE '  AI + directory broadcast triggers active';
  RAISE NOTICE '========================================';
END $$;

COMMIT;
