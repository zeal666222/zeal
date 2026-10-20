-- ═══════════════════════════════════════════════════════════════════════════════
-- 20261020150000_withdrawals_fix.sql
-- Two independent breakages froze the payout workflow:
--   1) request_withdrawal is (p_amount) only, but the route calls it with 4 named
--      args (p_user_id/p_upi/p_bank) → Postgres "function does not exist" → every
--      consultant withdrawal 500s. The UPI/bank were collected but never stored.
--   2) The admin list filters type='PAYOUT' + metadata.pending, yet the request
--      writes type='WITHDRAWAL_REQUEST' with no metadata → the queue is ALWAYS
--      empty. And process_withdrawal(p_txn_id,p_approved) gates on auth_is_admin()
--      which reads auth.uid() = NULL under the service-role admin client → every
--      approval returns forbidden. A stale 3-arg overload from 002_functions also
--      makes process_withdrawal ambiguous.
-- This rewrites both RPCs to a consistent, service-role-safe shape. Idempotent.
-- Apply with `supabase db push`.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── request_withdrawal: store UPI/bank + stamp metadata.pending for the admin queue
DROP FUNCTION IF EXISTS public.request_withdrawal(double precision);
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_amount double precision,
  p_upi    text DEFAULT NULL,
  p_bank   text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_uid uuid := (SELECT auth.uid()); v_wallet RECORD; v_id uuid := gen_random_uuid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_authenticated'); END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_amount'); END IF;

  SELECT * INTO v_wallet FROM public."Wallet" WHERE "userId" = v_uid FOR UPDATE;
  IF NOT FOUND OR v_wallet.balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_funds');
  END IF;

  UPDATE public."Wallet"
     SET balance = balance - p_amount, "pendingOut" = "pendingOut" + p_amount, "updatedAt" = now()
   WHERE id = v_wallet.id;

  -- "Transaction".id is uuid: a dashed-down text id cannot be assigned to it
  -- (42804), so the ledger row keeps a real uuid and only the reference stays text.
  INSERT INTO public."Transaction" (id, "walletId", type, amount, balance, description, "referenceId", metadata)
    VALUES (v_id, v_wallet.id, 'WITHDRAWAL_REQUEST', -p_amount, v_wallet.balance - p_amount,
            'Withdrawal request', 'withdrawal:' || v_id::text,
            jsonb_build_object('pending', true, 'upi', p_upi, 'bank', p_bank));

  PERFORM public.safe_broadcast('admin:withdrawals', 'INSERT', 'Transaction', 'public',
            jsonb_build_object('id', v_id, 'amount', p_amount, 'status', 'PENDING'), NULL);
  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(double precision, text, text) TO authenticated, service_role;

-- ── process_withdrawal: explicit actor authorization (no auth.uid), reconciles pendingOut
DROP FUNCTION IF EXISTS public.process_withdrawal(text, boolean);
DROP FUNCTION IF EXISTS public.process_withdrawal(text, text, text);
CREATE OR REPLACE FUNCTION public.process_withdrawal(
  p_txn_id   text,
  p_action   text,     -- 'APPROVE' | 'REJECT'
  p_actor_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_txn RECORD; v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."User" WHERE id = p_actor_id
                 AND upper(coalesce(role::text,'USER')) IN ('SUPER_ADMIN','ADMIN','SUPPORT')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  IF p_action NOT IN ('APPROVE', 'REJECT') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_action');
  END IF;

  -- "Transaction".id is uuid and p_txn_id is text. There is no uuid = text
  -- operator in Postgres, so comparing them straight raises 42883 at runtime —
  -- the whole payout decision would abort. Cast once, and answer cleanly when
  -- the caller hands us something that is not an id.
  BEGIN v_id := p_txn_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_txn_id');
  END;

  SELECT * INTO v_txn FROM public."Transaction" WHERE id = v_id AND type = 'WITHDRAWAL_REQUEST' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_pending'); END IF;

  IF p_action = 'APPROVE' THEN
    -- Money actually leaves the platform: it is no longer "pending out".
    UPDATE public."Wallet" SET "pendingOut" = GREATEST(0, "pendingOut" - ABS(v_txn.amount)), "updatedAt" = now()
     WHERE id = v_txn."walletId";
    UPDATE public."Transaction"
       SET type = 'WITHDRAWAL',
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
             'pending', false, 'processedAt', now()::text, 'processedBy', p_actor_id::text)
     WHERE id = v_id;
  ELSE
    -- Rejected: refund the held funds back to available balance.
    UPDATE public."Wallet"
       SET balance = balance + ABS(v_txn.amount),
           "pendingOut" = GREATEST(0, "pendingOut" - ABS(v_txn.amount)), "updatedAt" = now()
     WHERE id = v_txn."walletId";
    UPDATE public."Transaction"
       SET type = 'WITHDRAWAL_REJECTED',
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
             'pending', false, 'rejectedAt', now()::text, 'processedBy', p_actor_id::text)
     WHERE id = v_id;
  END IF;

  PERFORM public.safe_broadcast('admin:withdrawals', 'UPDATE', 'Transaction', 'public',
            jsonb_build_object('id', p_txn_id, 'action', p_action), NULL);
  RETURN jsonb_build_object('success', true);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.process_withdrawal(text, text, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
