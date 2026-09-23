-- 201_realtime_rls_restore.sql — restore participant guards loosened by 091
BEGIN;

DROP POLICY IF EXISTS "realtime_user_channels" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_public_channels" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_admin_all" ON realtime.messages;

CREATE POLICY "realtime_public_channels" ON realtime.messages
  FOR SELECT TO anon, authenticated
  USING (realtime.topic() IN ('consultant:ai:updates', 'consultants:live'));

CREATE POLICY "realtime_user_channels" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE 'user:' || (SELECT auth.uid())::text || ':%'
    OR realtime.topic() LIKE 'consultant:' || (SELECT auth.uid())::text || ':%'
    OR (
      realtime.topic() LIKE 'room:%'
      AND public.user_is_in_conversation(
        SUBSTRING(realtime.topic() FROM 'room:([0-9a-f-]{36}):')::uuid)
    )
    OR (
      realtime.topic() LIKE 'booking:%'
      AND public.user_can_view_booking(
        SUBSTRING(realtime.topic() FROM 'booking:([0-9a-f-]{36}):')::uuid)
    )
    OR realtime.topic() LIKE 'presence:%'
  );

CREATE POLICY "realtime_admin_all" ON realtime.messages
  FOR SELECT TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', 'USER')
         IN ('ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'VIEWER'));

-- Guard functions (idempotent)
CREATE OR REPLACE FUNCTION public.user_is_in_conversation(p_conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."ConversationParticipant"
    WHERE "conversationId" = p_conversation_id AND "userId" = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_booking(p_booking_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."Booking" b
    LEFT JOIN public."Consultant" c ON c.id = b."consultantId"
    WHERE b.id = p_booking_id
      AND (b."userId" = (SELECT auth.uid()) OR c."userId" = (SELECT auth.uid()))
  );
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
