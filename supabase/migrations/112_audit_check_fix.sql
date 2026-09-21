-- ═══════════════════════════════════════════════════════════════════════════════
-- 112_audit_check_fix.sql
-- ═══════════════════════════════════════════════════════════════════════════════
BEGIN;

DO $do$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public."AdminAuditLog"'::regclass
    AND contype  = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%action%INSERT%UPDATE%DELETE%';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public."AdminAuditLog" DROP CONSTRAINT %I', cname);
    RAISE NOTICE '[112] Dropped CHECK: %', cname;
  ELSE
    RAISE NOTICE '[112] No CHECK constraint to drop';
  END IF;
END $do$;

ALTER TABLE public."AdminAuditLog"
  ADD COLUMN IF NOT EXISTS action_name text;

UPDATE public."AdminAuditLog"
SET action_name = COALESCE(action_name, action)
WHERE action_name IS NULL;

ALTER TABLE public."AdminAuditLog"
  ALTER COLUMN action SET DEFAULT 'UPDATE';

NOTIFY pgrst, 'reload schema';
COMMIT;