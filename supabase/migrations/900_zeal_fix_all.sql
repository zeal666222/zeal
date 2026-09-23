-- 900_zeal_fix_all.sql — idempotent correctness pass
BEGIN;
SET LOCAL statement_timeout = '5min';

CREATE OR REPLACE FUNCTION public.credit_funds_safe(
  p_user_id text, p_amount double precision, p_description text, p_reference_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet "Wallet"%ROWTYPE; v_existing "Transaction"%ROWTYPE; v_txn_id text;
BEGIN
  IF p_reference_id IS NOT NULL AND p_reference_id <> '' THEN
    SELECT * INTO v_existing FROM "Transaction" WHERE "referenceId" = p_reference_id;
    IF FOUND THEN RETURN jsonb_build_object('success',true,'idempotent',true,'balance',v_existing.balance,'transactionId',v_existing.id); END IF;
  END IF;
  SELECT * INTO v_wallet FROM "Wallet" WHERE "userId" = p_user_id::uuid FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO "Wallet" ("userId",balance,escrow,"pendingIn","pendingOut",blocked) VALUES (p_user_id::uuid,p_amount,0,0,0,0) RETURNING * INTO v_wallet;
    v_txn_id := gen_random_uuid()::text;
    INSERT INTO "Transaction" (id,"walletId",type,amount,balance,description,"referenceId") VALUES (v_txn_id,v_wallet.id,'TOPUP',p_amount,p_amount,p_description,p_reference_id);
    RETURN jsonb_build_object('success',true,'idempotent',false,'balance',p_amount,'transactionId',v_txn_id,'walletCreated',true);
  END IF;
  UPDATE "Wallet" SET balance = balance + p_amount, "updatedAt" = now() WHERE id = v_wallet.id;
  v_txn_id := gen_random_uuid()::text;
  INSERT INTO "Transaction" (id,"walletId",type,amount,balance,description,"referenceId") VALUES (v_txn_id,v_wallet.id,'TOPUP',p_amount,v_wallet.balance + p_amount,p_description,p_reference_id);
  RETURN jsonb_build_object('success',true,'idempotent',false,'balance',v_wallet.balance + p_amount,'transactionId',v_txn_id);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'error',SQLERRM,'code',SQLSTATE); END $$;
GRANT EXECUTE ON FUNCTION public.credit_funds_safe(text,double precision,text,text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.hold_in_escrow_safe(
  p_user_id text, p_amount double precision, p_reference_id text, p_description text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet "Wallet"%ROWTYPE; v_existing "Transaction"%ROWTYPE; v_txn_id text;
BEGIN
  IF p_reference_id IS NOT NULL AND p_reference_id <> '' THEN
    SELECT * INTO v_existing FROM "Transaction" WHERE "referenceId" = p_reference_id;
    IF FOUND THEN RETURN jsonb_build_object('success',true,'idempotent',true,'transactionId',v_existing.id); END IF;
  END IF;
  SELECT * INTO v_wallet FROM "Wallet" WHERE "userId" = p_user_id::uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','wallet_not_found','code','NOT_FOUND'); END IF;
  IF v_wallet.balance < p_amount THEN RETURN jsonb_build_object('success',false,'error','insufficient_balance','code','INSUFFICIENT_FUNDS','balance',v_wallet.balance); END IF;
  UPDATE "Wallet" SET balance = balance - p_amount, escrow = escrow + p_amount, "updatedAt" = now() WHERE id = v_wallet.id;
  v_txn_id := gen_random_uuid()::text;
  INSERT INTO "Transaction" (id,"walletId",type,amount,balance,description,"referenceId") VALUES (v_txn_id,v_wallet.id,'PAYMENT',p_amount,v_wallet.balance - p_amount,p_description,p_reference_id);
  RETURN jsonb_build_object('success',true,'idempotent',false,'transactionId',v_txn_id,'escrow',v_wallet.escrow + p_amount);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'error',SQLERRM,'code',SQLSTATE); END $$;
GRANT EXECUTE ON FUNCTION public.hold_in_escrow_safe(text,double precision,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id text, p_actor_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_booking RECORD; v_wallet RECORD;
BEGIN
  SELECT * INTO v_booking FROM "Booking" WHERE id = p_booking_id::uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF v_booking.status = 'CANCELLED' THEN RETURN jsonb_build_object('alreadyCancelled',true); END IF;
  IF v_booking.status = 'COMPLETED' THEN RETURN jsonb_build_object('error','completed'); END IF;
  IF v_booking."userId" IS NOT NULL THEN
    SELECT * INTO v_wallet FROM "Wallet" WHERE "userId" = v_booking."userId"::uuid FOR UPDATE;
    IF FOUND THEN
      UPDATE "Wallet" SET balance = balance + v_booking.amount, escrow = GREATEST(0,escrow - v_booking.amount), "updatedAt" = now() WHERE id = v_wallet.id;
      INSERT INTO "Transaction" (id,"walletId",type,amount,balance,description,"referenceId") VALUES (gen_random_uuid()::text,v_wallet.id,'REFUND',v_booking.amount,v_wallet.balance + v_booking.amount,'Refund for cancelled booking ' || p_booking_id, p_booking_id || ':refund') ON CONFLICT ("referenceId") DO NOTHING;
    END IF;
  END IF;
  UPDATE "Booking" SET status = 'CANCELLED', "updatedAt" = now() WHERE id = p_booking_id::uuid;
  RETURN jsonb_build_object('success',true);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'error',SQLERRM); END $$;
GRANT EXECUTE ON FUNCTION public.cancel_booking(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.impersonation_active(p_actor uuid, p_target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public."AdminAuditLog" l WHERE l.action = 'IMPERSONATE_START' AND l."userId" = p_actor AND l."targetId" = p_target::text AND l."createdAt" > now() - interval '15 minutes');
$$;
GRANT EXECUTE ON FUNCTION public.impersonation_active(uuid,uuid) TO authenticated;

DO $$ BEGIN
  IF to_regclass('public.rate_limits') IS NOT NULL THEN
    ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.rate_limits FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS rate_limits_no_public ON public.rate_limits;
    CREATE POLICY rate_limits_no_public ON public.rate_limits FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
  IF to_regclass('public."AIChatRateLimit"') IS NOT NULL THEN
    ALTER TABLE public."AIChatRateLimit" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public."AIChatRateLimit" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS ai_rate_limit_owner ON public."AIChatRateLimit";
    CREATE POLICY ai_rate_limit_owner ON public."AIChatRateLimit" FOR ALL USING ("userId" = (SELECT auth.uid())) WITH CHECK ("userId" = (SELECT auth.uid()));
  END IF;
END $$;

DO $$ DECLARE pol text; BEGIN
  FOREACH pol IN ARRAY ARRAY['Users can view own wallet','Users can view own transactions','Users view own bookings','Consultants view assigned bookings','Public can view verified consultants','Consultants can manage own profile'] LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public."Wallet"', pol);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public."Transaction"', pol);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public."Booking"', pol);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public."Consultant"', pol);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.process_per_minute_deduction(text,text,double precision,text);
DROP FUNCTION IF EXISTS public.process_per_minute_deduction(text,text,double precision,text,boolean);
CREATE OR REPLACE FUNCTION public.process_per_minute_deduction(
  p_user_id text, p_consultant_id text, p_amount double precision, p_session_id text, p_is_ai boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ref text; v_existing "Transaction"%ROWTYPE; v_uw "Wallet"%ROWTYPE; v_cw "Wallet"%ROWTYPE; v_consultant_uid uuid; v_fee double precision; v_earning double precision;
BEGIN
  v_ref := 'permin:' || p_session_id;
  SELECT * INTO v_existing FROM "Transaction" WHERE "referenceId" = v_ref FOR UPDATE;
  IF FOUND THEN RETURN jsonb_build_object('success',true,'idempotent',true,'transactionId',v_existing.id); END IF;
  SELECT * INTO v_uw FROM "Wallet" WHERE "userId" = p_user_id::uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','user_wallet_not_found','code','NOT_FOUND'); END IF;
  IF v_uw.balance < p_amount THEN RETURN jsonb_build_object('success',false,'error','Insufficient funds','code','INSUFFICIENT_FUNDS','terminate',true,'remaining',v_uw.balance); END IF;
  IF p_is_ai THEN
    SELECT id INTO v_consultant_uid FROM "User" WHERE id = p_consultant_id::uuid AND role = 'AI'::"AppRole";
  ELSE
    SELECT "userId" INTO v_consultant_uid FROM "Consultant" WHERE id = p_consultant_id::uuid;
  END IF;
  v_fee := p_amount * 0.20; v_earning := p_amount - v_fee;
  UPDATE "Wallet" SET balance = balance - p_amount, "updatedAt" = now() WHERE id = v_uw.id;
  INSERT INTO "Transaction" (id,"walletId",type,amount,balance,description,"referenceId") VALUES (gen_random_uuid()::text,v_uw.id,'PAYMENT',-p_amount,v_uw.balance - p_amount,'Per-minute billing',v_ref);
  IF v_consultant_uid IS NOT NULL THEN
    SELECT * INTO v_cw FROM "Wallet" WHERE "userId" = v_consultant_uid FOR UPDATE;
    IF FOUND THEN
      UPDATE "Wallet" SET balance = balance + v_earning, "updatedAt" = now() WHERE id = v_cw.id;
      INSERT INTO "Transaction" (id,"walletId",type,amount,balance,description,"referenceId") VALUES (gen_random_uuid()::text,v_cw.id,'COMMISSION',v_earning,v_cw.balance + v_earning,'Per-minute earning',v_ref || ':earn');
    END IF;
  END IF;
  RETURN jsonb_build_object('success',true,'idempotent',false,'remaining',v_uw.balance - p_amount,'consultant_credited',v_consultant_uid IS NOT NULL,'earning',v_earning);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'error',SQLERRM,'code',SQLSTATE); END $$;
GRANT EXECUTE ON FUNCTION public.process_per_minute_deduction(text,text,double precision,text,boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
