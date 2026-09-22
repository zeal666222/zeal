-- 800_auto_start_chat_billing.sql
-- Auto-starts a CallSession on the first message of a paid conversation.
BEGIN;
SET LOCAL statement_timeout = '2min';

CREATE OR REPLACE FUNCTION public.auto_start_chat_billing(
  p_conversation_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_existing RECORD;
  v_partner RECORD;
  v_rate numeric := 0;
  v_is_ai boolean := false;
  v_wallet RECORD;
  v_session_id uuid;
BEGIN
  SELECT * INTO v_existing FROM public."CallSession"
  WHERE "conversationId" = p_conversation_id
    AND "userId" = p_user_id
    AND status IN ('INITIATED', 'CONNECTED')
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'sessionId', v_existing.id, 'reused', true);
  END IF;

  SELECT a.id, a."perMinuteRate", a."isPaid"
  INTO v_partner
  FROM public."ConversationParticipant" cp
  JOIN public."AIConsultant" a ON a.id = cp."userId"
  WHERE cp."conversationId" = p_conversation_id
    AND cp."userId" <> p_user_id
  LIMIT 1;

  IF FOUND THEN
    v_rate := COALESCE(v_partner."perMinuteRate", 0);
    v_is_ai := true;
    IF v_rate = 0 OR v_partner."isPaid" = false THEN
      RETURN jsonb_build_object('success', true, 'free', true);
    END IF;
  ELSE
    SELECT c.id, c."perMinuteRate" INTO v_partner
    FROM public."ConversationParticipant" cp
    JOIN public."Consultant" c ON c."userId" = cp."userId"
    WHERE cp."conversationId" = p_conversation_id
      AND cp."userId" <> p_user_id AND c."isActive" = true
    LIMIT 1;

    IF FOUND THEN
      v_rate := COALESCE(v_partner."perMinuteRate", 50);
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'no_billable_partner');
    END IF;
  END IF;

  SELECT * INTO v_wallet FROM public."Wallet"
  WHERE "userId" = p_user_id FOR UPDATE;

  IF NOT FOUND OR v_wallet.balance < v_rate THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'insufficient_balance',
      'required', v_rate, 'available', COALESCE(v_wallet.balance, 0)
    );
  END IF;

  INSERT INTO public."CallSession" (
    "userId", "consultantId", "aiConsultantId", "isAI",
    "conversationId", "startTime", status, amount, "durationSeconds"
  ) VALUES (
    p_user_id,
    CASE WHEN v_is_ai THEN NULL ELSE v_partner.id END,
    CASE WHEN v_is_ai THEN v_partner.id ELSE NULL END,
    v_is_ai, p_conversation_id, now(), 'CONNECTED', 0, 0
  ) RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'success', true, 'sessionId', v_session_id,
    'rate', v_rate, 'isAI', v_is_ai, 'startTime', now()
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.auto_start_chat_billing(uuid, uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
