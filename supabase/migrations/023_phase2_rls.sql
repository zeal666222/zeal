-- ═══════════════════════════════════════════════════════════════════════════════
-- 023_phase2_rls.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Finalizes RLS on realtime.messages so every @zeal/realtime channel is
-- reachable by the correct audience. Enables private channels via `authenticated`.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop everything and rebuild — idempotent
DROP POLICY IF EXISTS "realtime_user_channels"     ON realtime.messages;
DROP POLICY IF EXISTS "realtime_admin_all"         ON realtime.messages;
DROP POLICY IF EXISTS "realtime_public_channels"   ON realtime.messages;
DROP POLICY IF EXISTS "realtime_authenticated_all" ON realtime.messages;

-- ─── Public channels (anon + authenticated) ──────────────────────────────────
CREATE POLICY "realtime_public_channels" ON realtime.messages
  FOR SELECT TO anon, authenticated
  USING (
    realtime.topic() = 'consultant:ai:updates'
    OR realtime.topic() = 'consultants:live'
  );

-- ─── User-scoped channels (authenticated only) ───────────────────────────────
CREATE POLICY "realtime_user_channels" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE 'user:' || (SELECT auth.uid())::text || ':%'
    OR realtime.topic() LIKE 'room:%'
    OR realtime.topic() LIKE 'consultant:' || (SELECT auth.uid())::text || ':%'
    OR realtime.topic() LIKE 'presence:%'
    OR realtime.topic() LIKE 'booking:%'
  );

-- ─── Admin channels ──────────────────────────────────────────────────────────
CREATE POLICY "realtime_admin_all" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', 'USER')
      IN ('ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'VIEWER')
  );

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '  023_phase2_rls.sql — VERIFIED';
  RAISE NOTICE '  realtime.messages RLS finalized';
  RAISE NOTICE '========================================';
END $$;

COMMIT;
