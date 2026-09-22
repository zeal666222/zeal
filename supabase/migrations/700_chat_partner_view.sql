-- ═══════════════════════════════════════════════════════════════════════════════
-- 700_chat_partner_view.sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- The chat page needs the partner's display name, avatar, and role (to detect
-- AI). The User table's RLS policy blocks reading other users' rows. This RPC
-- returns only the minimum public fields, and only for users who share a
-- conversation with the caller.
--
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE OR REPLACE FUNCTION public.chat_partner_view(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller  uuid := auth.uid();
  v_partner RECORD;
  v_is_ai   boolean := false;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Caller must be a participant
  IF NOT EXISTS (
    SELECT 1 FROM public."ConversationParticipant"
    WHERE "conversationId" = p_conversation_id AND "userId" = v_caller
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_a_participant');
  END IF;

  -- Fetch the partner (the other participant)
  SELECT u.id, u.name, u.username, u.avatar, u.role::text AS role
  INTO v_partner
  FROM public."ConversationParticipant" cp
  JOIN public."User" u ON u.id = cp."userId"
  WHERE cp."conversationId" = p_conversation_id
    AND cp."userId" <> v_caller
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'partner', jsonb_build_object(
        'id', '', 'name', 'Chat', 'username', '',
        'avatar', null, 'role', 'USER'
      ),
      'isAI', false
    );
  END IF;

  v_is_ai := (v_partner.role = 'AI');

  RETURN jsonb_build_object(
    'ok', true,
    'partner', jsonb_build_object(
      'id',       v_partner.id,
      'name',     COALESCE(v_partner.name, v_partner.username, 'Zeal Member'),
      'username', COALESCE(v_partner.username, ''),
      'avatar',   v_partner.avatar,
      'role',     v_partner.role
    ),
    'isAI', v_is_ai
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'code', SQLSTATE);
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.chat_partner_view(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

DO $do$ BEGIN RAISE NOTICE '700_chat_partner_view.sql — OK'; END $do$;
COMMIT;
