-- =============================================================================
-- 1202_content_moderation.sql
-- Content reporting and moderation queue
-- =============================================================================
-- Enables users to flag posts/comments for review. Admins can approve, reject,
-- or delete flagged content. Supports severity levels and bulk actions.
-- =============================================================================

BEGIN;

-- ─── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."ContentReport" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reporterId" UUID NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  "targetType" TEXT NOT NULL CHECK ("targetType" IN ('post', 'comment', 'message')),
  "targetId"  UUID NOT NULL,
  reason      TEXT NOT NULL DEFAULT 'other',
  severity    TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high')),
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  "reviewedBy" UUID REFERENCES public."User"(id) ON DELETE SET NULL,
  "reviewedAt" TIMESTAMPTZ,
  notes       TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_report_status
  ON public."ContentReport" (status);

CREATE INDEX IF NOT EXISTS idx_content_report_severity
  ON public."ContentReport" (severity);

CREATE INDEX IF NOT EXISTS idx_content_report_target
  ON public."ContentReport" ("targetType", "targetId");

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public."ContentReport" ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can create a report
DROP POLICY IF EXISTS content_report_insert ON public."ContentReport";
CREATE POLICY content_report_insert ON public."ContentReport"
  FOR INSERT
  WITH CHECK (auth.uid() = "reporterId");

-- Users can see their own reports
DROP POLICY IF EXISTS content_report_select_own ON public."ContentReport";
CREATE POLICY content_report_select_own ON public."ContentReport"
  FOR SELECT
  USING (auth.uid() = "reporterId");

-- Admins (via service role) can read/update all — enforced at API level
-- For RLS, allow SUPER_ADMIN/ADMIN/SUPPORT to read all
DROP POLICY IF EXISTS content_report_select_admin ON public."ContentReport";
CREATE POLICY content_report_select_admin ON public."ContentReport"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public."User"
      WHERE "User".id = auth.uid()
        AND "User".role::text IN ('SUPER_ADMIN', 'ADMIN', 'SUPPORT')
    )
  );

-- Admins can update reports
DROP POLICY IF EXISTS content_report_update_admin ON public."ContentReport";
CREATE POLICY content_report_update_admin ON public."ContentReport"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public."User"
      WHERE "User".id = auth.uid()
        AND "User".role::text IN ('SUPER_ADMIN', 'ADMIN', 'SUPPORT')
    )
  );

-- ─── Realtime broadcast ──────────────────────────────────────────────────────
-- Broadcast new reports to admin moderation channel (guarded for re-runs)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public."ContentReport";
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
