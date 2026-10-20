-- ═══════════════════════════════════════════════════════════════════════════════
-- 20261020170000_admin_settings.sql
-- ───────────────────────────────────────────────────────────────────────────────
-- A real store for platform settings.
--
-- Before this, GET /api/admin/settings returned three hardcoded numbers and the
-- PUT only wrote an audit row, so the Settings screen looked like a control panel
-- and behaved like a screenshot. The values below are the ones the application
-- code can actually honour: the fee stamped on a booking at creation time, and
-- the floor enforced on a withdrawal request.
--
-- Deliberately NOT here: the AI-session platform fee. That 20% is applied inside
-- the money-moving `process_per_minute_deduction` RPC, so an app-level toggle
-- would change the report without changing the ledger. Add it when the RPC reads
-- this table.
--
-- Additive and idempotent: safe to re-run, never drops anything.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public."AdminSetting" (
  key          text PRIMARY KEY,
  value        jsonb NOT NULL,
  "updatedAt"  timestamptz NOT NULL DEFAULT now(),
  "updatedBy"  uuid REFERENCES public."User"(id) ON DELETE SET NULL
);

ALTER TABLE public."AdminSetting" ENABLE ROW LEVEL SECURITY;

-- No policies on purpose: anon and authenticated cannot read or write this table
-- at all. Only the service role (which the admin API routes use) bypasses RLS.
REVOKE ALL ON public."AdminSetting" FROM anon, authenticated;

-- Seed with the behaviour that already ships, so applying this migration changes
-- nothing about what any user is charged.
INSERT INTO public."AdminSetting" (key, value) VALUES
  ('platform_fee_percent', '10'::jsonb),
  ('minimum_withdrawal_rupees', '100'::jsonb)
ON CONFLICT (key) DO NOTHING;
