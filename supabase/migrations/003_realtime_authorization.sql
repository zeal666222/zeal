-- ═══════════════════════════════════════════════════════════════════════════════
-- 003_realtime_authorization.sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Enables Realtime Authorization — every Realtime connection must pass RLS
-- policies on realtime.messages before receiving broadcast/presence.
--
-- Reference: Supabase Realtime Authorization docs
--   - RLS is enabled on realtime.messages by default (do NOT ALTER)
--   - Policy decides who can subscribe to a channel topic
--   - Client must set `private: true` when instantiating the channel
--   - Realtime runs the policy query and rolls it back — no data stored
--
-- Channel naming convention (from @zeal/realtime/src/channels.ts):
--   user:{uid}:inbox | wallet | wallet:ledger | notifications | status | sparks
--   room:{conversationId}:messages | typing
--   consultant:{uid}:incoming | sparks | bookings | status
--   consultant:ai:updates | consultants:live
--   booking:{bookingId}:status
--   admin:bookings | verification | broadcasts
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Clean slate (idempotent re-run) ─────────────────────────────────────────
DROP POLICY IF EXISTS "realtime_public_channels"   ON realtime.messages;
DROP POLICY IF EXISTS "realtime_user_channels"     ON realtime.messages;
DROP POLICY IF EXISTS "realtime_room_channels"     ON realtime.messages;
DROP POLICY IF EXISTS "realtime_admin_all"         ON realtime.messages;
DROP POLICY IF EXISTS "realtime_consultant_channels" ON realtime.messages;

-- ─── 1. Public channels (no auth required) ───────────────────────────────────
-- consultants:live and consultant:ai:updates are intentionally public — they
-- power the anonymous explore page and the AI consultant directory.
CREATE POLICY "realtime_public_channels" ON realtime.messages
FOR SELECT TO anon, authenticated
USING (
  (select realtime.topic()) = 'consultants:live'
  OR (select realtime.topic()) = 'consultant:ai:updates'
);

-- ─── 2. User-scoped channels ─────────────────────────────────────────────────
-- Users can only subscribe to channels prefixed with their own uid.
CREATE POLICY "realtime_user_channels" ON realtime.messages
FOR SELECT TO authenticated
USING (
  -- user:{my_uid}:inbox | :wallet | :wallet:ledger | :notifications | :status | :sparks
  (select realtime.topic()) LIKE 'user:' || (select auth.uid())::text || ':%'
);

-- ─── 3. Room channels (chat messages + typing) ───────────────────────────────
-- Access requires participation in the conversation. We resolve via a
-- SECURITY DEFINER function to avoid RLS recursion on ConversationParticipant.
CREATE OR REPLACE FUNCTION public.user_is_in_conversation(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."ConversationParticipant"
    WHERE "conversationId" = p_conversation_id
      AND "userId" = (select auth.uid())
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_is_in_conversation(uuid) TO authenticated;

CREATE POLICY "realtime_room_channels" ON realtime.messages
FOR SELECT TO authenticated
USING (
  -- room:{uuid}:messages or room:{uuid}:typing
  (select realtime.topic()) LIKE 'room:%'
  AND (
    (select public.user_is_in_conversation(
      -- Extract UUID between 'room:' and the next ':'
      substring((select realtime.topic()) from 'room:([0-9a-f-]{36}):')::uuid
    ))
  )
);

-- ─── 4. Consultant-scoped channels ───────────────────────────────────────────
-- consultant:{my_uid}:incoming | :sparks | :bookings | :status
CREATE POLICY "realtime_consultant_channels" ON realtime.messages
FOR SELECT TO authenticated
USING (
  (select realtime.topic()) LIKE 'consultant:' || (select auth.uid())::text || ':%'
);

-- ─── 5. Booking status (participants only) ───────────────────────────────────
-- booking:{uuid}:status — accessible to the booking's user or consultant
CREATE OR REPLACE FUNCTION public.user_can_view_booking(p_booking_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."Booking" b
    LEFT JOIN public."Consultant" c ON c.id = b."consultantId"
    WHERE b.id = p_booking_id
      AND (b."userId" = (select auth.uid()) OR c."userId" = (select auth.uid()))
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_view_booking(uuid) TO authenticated;

-- Add booking: policy on top of the existing set (combined via OR in engine)
-- We express it inside realtime_user_channels by extending it. Since PostgreSQL
-- combines multiple SELECT policies with OR, add a dedicated policy:
DROP POLICY IF EXISTS "realtime_booking_channels" ON realtime.messages;
CREATE POLICY "realtime_booking_channels" ON realtime.messages
FOR SELECT TO authenticated
USING (
  (select realtime.topic()) LIKE 'booking:%:status'
  AND public.user_can_view_booking(
    substring((select realtime.topic()) from 'booking:([0-9a-f-]{36}):')::uuid
  )
);

-- ─── 6. Admin channels ───────────────────────────────────────────────────────
-- admin:bookings | admin:verification | admin:broadcasts
-- Requires ADMIN/SUPER_ADMIN/SUPPORT/VIEWER role from JWT.
CREATE POLICY "realtime_admin_all" ON realtime.messages
FOR SELECT TO authenticated
USING (
  (select realtime.topic()) LIKE 'admin:%'
  AND (select public.auth_is_admin())
);

NOTIFY pgrst, 'reload schema';

DO $$ BEGIN
  RAISE NOTICE '  003 — Realtime Authorization policies installed';
  RAISE NOTICE '  Public: consultants:live, consultant:ai:updates';
  RAISE NOTICE '  User: user:{uid}:*';
  RAISE NOTICE '  Room: room:{conv_id}:* (participant only)';
  RAISE NOTICE '  Consultant: consultant:{uid}:*';
  RAISE NOTICE '  Booking: booking:{id}:status (participant only)';
  RAISE NOTICE '  Admin: admin:* (role-gated)';
END $$;

COMMIT;
