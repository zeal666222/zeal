-- ═══════════════════════════════════════════════════════════════════════════════
-- 021_phase1_audit_fix.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1 fixes for AdminAuditLog:
--   • Drop the restrictive `action IN ('INSERT','UPDATE','DELETE')` CHECK
--   • Add action_name (real event, e.g. BROADCAST, VERIFY_CONSULTANT)
--   • Add actor_* columns aliased to existing userId/email
--   • Make record_id nullable
--   • Add indexes for audit queries
--
-- Idempotent. Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Drop the restrictive CHECK constraint
ALTER TABLE public."AdminAuditLog"
  DROP CONSTRAINT IF EXISTS "AdminAuditLog_action_check";

-- Make record_id nullable (was NOT NULL, blocking most inserts)
ALTER TABLE public."AdminAuditLog"
  ALTER COLUMN record_id DROP NOT NULL;

-- Add semantic action name + actor columns
ALTER TABLE public."AdminAuditLog"
  ADD COLUMN IF NOT EXISTS action_name text;
ALTER TABLE public."AdminAuditLog"
  ADD COLUMN IF NOT EXISTS actor_id uuid;
ALTER TABLE public."AdminAuditLog"
  ADD COLUMN IF NOT EXISTS actor_email text;
ALTER TABLE public."AdminAuditLog"
  ADD COLUMN IF NOT EXISTS actor_role text;
ALTER TABLE public."AdminAuditLog"
  ADD COLUMN IF NOT EXISTS target_type text;
ALTER TABLE public."AdminAuditLog"
  ADD COLUMN IF NOT EXISTS target_id text;
ALTER TABLE public."AdminAuditLog"
  ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE public."AdminAuditLog"
  ADD COLUMN IF NOT EXISTS ip text;
ALTER TABLE public."AdminAuditLog"
  ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE public."AdminAuditLog"
  ADD COLUMN IF NOT EXISTS success boolean DEFAULT true;
ALTER TABLE public."AdminAuditLog"
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Backfill action_name from legacy action column
UPDATE public."AdminAuditLog"
SET action_name = action
WHERE action_name IS NULL;

-- Backfill actor_id from legacy changed_by
UPDATE public."AdminAuditLog"
SET actor_id = changed_by
WHERE actor_id IS NULL AND changed_by IS NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_audit_created
  ON public."AdminAuditLog"(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_actor
  ON public."AdminAuditLog"(actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_action
  ON public."AdminAuditLog"(action_name, created_at DESC);

-- Verification
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '  021_phase1_audit_fix.sql — VERIFIED';
  RAISE NOTICE '  AdminAuditLog columns extended';
  RAISE NOTICE '========================================';
END $$;

COMMIT;
