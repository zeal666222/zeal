-- 095_escrow_release_fix.sql — decrement escrow on session end
BEGIN;

CREATE OR REPLACE FUNCTION public.release_session_escrow(
  p_session_id uuid, p_held_amount double precision, p_consumed double precision
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; v_wallet "Wallet"%ROWTYPE; v_refund double precision;
BEGIN
  SELECT "userId" INTO v_user FROM public."CallSession" WHERE id = p_session_id;
  IF v_user IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'no_session'); END IF;

  SELECT * INTO v_wallet FROM public."Wallet" WHERE "userId" = v_user FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'no_wallet'); END IF;

  v_refund := GREATEST(0, p_held_amount - p_consumed);

  UPDATE public."Wallet"
  SET escrow = GREATEST(0, escrow - p_held_amount),
      balance = balance + v_refund,
      "updatedAt" = now()
  WHERE id = v_wallet.id;

  IF v_refund > 0 THEN
    INSERT INTO public."Transaction" (id, "walletId", type, amount, balance, description, "referenceId")
    VALUES (gen_random_uuid(), v_wallet.id, 'REFUND', v_refund,
            v_wallet.balance + v_refund, 'Session refund — unused escrow',
            'session-refund:' || p_session_id::text)
    ON CONFLICT ("referenceId") DO NOTHING;
  END IF;

  RETURN jsonb_build_object('success', true, 'refunded', v_refund);
END $$;
GRANT EXECUTE ON FUNCTION public.release_session_escrow(uuid, double precision, double precision) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
