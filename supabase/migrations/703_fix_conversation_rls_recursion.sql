BEGIN;
SET LOCAL statement_timeout = '2min';

DROP POLICY IF EXISTS participant_self_read         ON public."ConversationParticipant";
DROP POLICY IF EXISTS message_participant_read      ON public."Message";
DROP POLICY IF EXISTS message_participant_send      ON public."Message";
DROP POLICY IF EXISTS conversation_participant_read ON public."Conversation";

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
      AND "userId" = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.user_is_in_conversation(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_in_conversation(uuid) TO authenticated;

CREATE POLICY conversation_participant_read ON public."Conversation"
  FOR SELECT TO authenticated
  USING (public.user_is_in_conversation("Conversation".id));

CREATE POLICY participant_self_read ON public."ConversationParticipant"
  FOR SELECT TO authenticated
  USING (
    "userId" = (SELECT auth.uid())
    OR public.user_is_in_conversation("ConversationParticipant"."conversationId")
  );

CREATE POLICY message_participant_read ON public."Message"
  FOR SELECT TO authenticated
  USING (public.user_is_in_conversation("Message"."conversationId"));

CREATE POLICY message_participant_send ON public."Message"
  FOR INSERT TO authenticated
  WITH CHECK (
    "senderId" = (SELECT auth.uid())
    AND public.user_is_in_conversation("Message"."conversationId")
  );

NOTIFY pgrst, 'reload schema';
COMMIT;
