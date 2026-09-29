-- ═══════════════════════════════════════════════════════════════════════════════
-- 990_phase1_financial_core.sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Financial core rewrite: canonical RPCs, Razorpay tables, escrow release,
-- FK fixes, GENERATED searchVector. Idempotent. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════
BEGIN;
SET LOCAL statement_timeout = '10min';
SET LOCAL lock_timeout = '30s';

-- ─── 1. RAZORPAY TRACKING ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."RazorpayPayment" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" text NOT NULL UNIQUE,
  "paymentId" text UNIQUE,
  "signature" text,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','authorized','captured','failed','refunded')),
  "userId" uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('wallet_topup','booking_payment','session_prepay')),
  "referenceId" text,
  metadata jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rzp_user   ON public."RazorpayPayment"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_rzp_status ON public."RazorpayPayment"(status);
CREATE INDEX IF NOT EXISTS idx_rzp_ref    ON public."RazorpayPayment"("referenceId") WHERE "referenceId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS public."RazorpayWebhookEvent" (
  id text PRIMARY KEY,
  event text NOT NULL,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  "processedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rzp_wh_processed ON public."RazorpayWebhookEvent"(processed, "createdAt" DESC);

CREATE TABLE IF NOT EXISTS public."BillingHeartbeat" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId" uuid NOT NULL REFERENCES public."CallSession"(id) ON DELETE CASCADE,
  "minuteKey" text NOT NULL,
  amount double precision NOT NULL,
  "balanceAfter" double precision NOT NULL,
  "escrowAfter" double precision NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("sessionId", "minuteKey")
);
CREATE INDEX IF NOT EXISTS idx_bh_session ON public."BillingHeartbeat"("sessionId", "createdAt" DESC);

-- ─── 2. FK FIXES (guarded) ───────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_consultantId_fkey') THEN
    ALTER TABLE public."Booking"
      ADD CONSTRAINT "Booking_consultantId_fkey"
      FOREIGN KEY ("consultantId") REFERENCES public."Consultant"(id) ON DELETE RESTRICT;
    RAISE NOTICE 'Added Booking_consultantId_fkey';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_conversationId_fkey') THEN
    ALTER TABLE public."Message"
      ADD CONSTRAINT "Message_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES public."Conversation"(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added Message_conversationId_fkey';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_senderId_fkey') THEN
    ALTER TABLE public."Message"
      ADD CONSTRAINT "Message_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES public."User"(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added Message_senderId_fkey';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Comment_postId_fkey') THEN
    ALTER TABLE public."Comment"
      ADD CONSTRAINT "Comment_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES public."Post"(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Cheer_postId_fkey') THEN
    ALTER TABLE public."Cheer"
      ADD CONSTRAINT "Cheer_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES public."Post"(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ─── 3. GENERATED searchVector ───────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Consultant'
      AND column_name='searchVector' AND is_generated='NEVER'
  ) THEN
    ALTER TABLE public."Consultant" DROP COLUMN "searchVector";
    ALTER TABLE public."Consultant"
      ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(bio, '')), 'B')
        || setweight(to_tsvector('simple', coalesce(array_to_string(specialties, ' '), '')), 'A')
        || setweight(to_tsvector('simple', coalesce(category, '')), 'A')
      ) STORED;
    RAISE NOTICE 'searchVector rebuilt as GENERATED ALWAYS';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_consultant_search_vec
  ON public."Consultant" USING GIN("searchVector");

-- ─── 4. CANONICAL RPCs ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.credit_funds_safe(
  p_user_id text, p_amount double precision, p_description text, p_reference_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet "Wallet"%ROWTYPE; v_existing "Transaction"%ROWTYPE; v_txn_id text;
BEGIN
  IF p_reference_id IS NOT NULL AND p_reference_id <> '' THEN
    SELECT * INTO v_existing FROM "Transaction" WHERE "referenceId" = p_reference_id;
    IF FOUND THEN
      RETURN jsonb_build_object('success',true,'idempotent',true,
        'balance',v_existing.balance,'transactionId',v_existing.id);
    END IF;
  END IF;
  SELECT * INTO v_wallet FROM "Wallet" WHERE "userId" = p_user_id::uuid FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO "Wallet" ("userId",balance,escrow,"pendingIn","pendingOut",blocked)
    VALUES (p_user_id::uuid,p_amount,0,0,0,0) RETURNING * INTO v_wallet;
    v_txn_id := gen_random_uuid()::text;
    INSERT INTO "Transaction" (id,"walletId",type,amount,balance,description,"referenceId")
    VALUES (v_txn_id,v_wallet.id,'TOPUP',p_amount,p_amount,p_description,p_reference_id);
    RETURN jsonb_build_object('success',true,'idempotent',false,
      'balance',p_amount,'transactionId',v_txn_id,'walletCreated',true);
  END IF;
  UPDATE "Wallet" SET balance = balance + p_amount, "updatedAt" = now() WHERE id = v_wallet.id;
  v_txn_id := gen_random_uuid()::text;
  INSERT INTO "Transaction" (id,"walletId",type,amount,balance,description,"referenceId")
  VALUES (v_txn_id,v_wallet.id,'TOPUP',p_amount,v_wallet.balance + p_amount,p_description,p_reference_id);
  RETURN jsonb_build_object('success',true,'idempotent',false,
    'balance',v_wallet.balance + p_amount,'transactionId',v_txn_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success',false,'error',SQLERRM,'code',SQLSTATE);
END $$;
GRANT EXECUTE ON FUNCTION public.credit_funds_safe(text,double precision,text,text)
  TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.hold_in_escrow_safe(
  p_user_id text, p_amount double precision, p_reference_id text, p_description text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet "Wallet"%ROWTYPE; v_existing "Transaction"%ROWTYPE; v_txn_id text;
BEGIN
  IF p_reference_id IS NOT NULL AND p_reference_id <> '' THEN
    SELECT * INTO v_existing FROM "Transaction" WHERE "referenceId" = p_reference_id;
    IF FOUND THEN
      RETURN jsonb_build_object('success',true,'idempotent',true,'transactionId',v_existing.id);
    END IF;
  END IF;
  SELECT * INTO v_wallet FROM "Wallet" WHERE "userId" = p_user_id::uuid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'error','wallet_not_found','code','NOT_FOUND');
  END IF;
  IF v_wallet.balance < p_amount THEN
    RETURN jsonb_build_object('success',false,'error','insufficient_balance',
      'code','INSUFFICIENT_FUNDS','balance',v_wallet.balance);
  END IF;
  UPDATE "Wallet"
    SET balance = balance - p_amount, escrow = escrow + p_amount, "updatedAt" = now()
    WHERE id = v_wallet.id;
  v_txn_id := gen_random_uuid()::text;
  INSERT INTO "Transaction" (id,"walletId",type,amount,balance,description,"referenceId")
  VALUES (v_txn_id,v_wallet.id,'PAYMENT',p_amount,v_wallet.balance - p_amount,
          p_description,p_reference_id);
  RETURN jsonb_build_object('success',true,'idempotent',false,
    'transactionId',v_txn_id,'escrow',v_wallet.escrow + p_amount);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success',false,'error',SQLERRM,'code',SQLSTATE);
END $$;
GRANT EXECUTE ON FUNCTION public.hold_in_escrow_safe(text,double precision,text,text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.release_session_escrow(
  p_session_id uuid, p_held_amount double precision, p_consumed double precision
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; v_wallet "Wallet"%ROWTYPE; v_refund double precision;
BEGIN
  SELECT "userId" INTO v_user FROM public."CallSession" WHERE id = p_session_id;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','no_session');
  END IF;
  SELECT * INTO v_wallet FROM public."Wallet" WHERE "userId" = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'error','no_wallet');
  END IF;
  v_refund := GREATEST(0, p_held_amount - p_consumed);
  UPDATE public."Wallet"
    SET escrow  = GREATEST(0, escrow - p_held_amount),
        balance = balance + v_refund,
        "updatedAt" = now()
    WHERE id = v_wallet.id;
  IF v_refund > 0 THEN
    INSERT INTO public."Transaction" (id,"walletId",type,amount,balance,description,"referenceId")
    VALUES (gen_random_uuid(),v_wallet.id,'REFUND',v_refund,
            v_wallet.balance + v_refund,'Session refund — unused escrow',
            'session-refund:'||p_session_id::text)
    ON CONFLICT ("referenceId") DO NOTHING;
  END IF;
  RETURN jsonb_build_object('success',true,'refunded',v_refund,
    'newBalance',v_wallet.balance + v_refund);
END $$;
GRANT EXECUTE ON FUNCTION public.release_session_escrow(uuid,double precision,double precision)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_booking_payment(
  p_booking_id uuid, p_razorpay_payment_id text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_booking RECORD;
  v_consultant_user uuid;
  v_platform_fee numeric;
  v_consultant_earning numeric;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','not_authenticated');
  END IF;
  SELECT * INTO v_booking FROM public."Booking" WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'error','booking_not_found');
  END IF;
  IF v_booking."userId" <> v_caller AND NOT public.auth_is_admin() THEN
    RETURN jsonb_build_object('success',false,'error','forbidden');
  END IF;
  IF v_booking.status = 'CONFIRMED'
     AND (p_razorpay_payment_id IS NULL OR v_booking."razorpayPaymentId" = p_razorpay_payment_id) THEN
    RETURN jsonb_build_object('success',true,'alreadyConfirmed',true);
  END IF;

  -- Hold escrow on the user's behalf (idempotent by referenceId)
  PERFORM public.hold_in_escrow_safe(
    v_booking."userId"::text,
    v_booking.amount,
    'booking_hold:'||p_booking_id::text,
    'Booking escrow: '||p_booking_id::text
  );

  v_platform_fee := v_booking.amount * COALESCE(v_booking."platformFeeRate", 0.10);
  v_consultant_earning := v_booking.amount - v_platform_fee;

  UPDATE public."Booking"
    SET status = 'CONFIRMED',
        "platformFee" = v_platform_fee,
        "consultantEarning" = v_consultant_earning,
        "razorpayPaymentId" = COALESCE(p_razorpay_payment_id, "razorpayPaymentId"),
        "paymentStatus" = 'captured',
        "updatedAt" = now()
    WHERE id = p_booking_id;

  SELECT c."userId" INTO v_consultant_user
  FROM public."Consultant" c WHERE c.id = v_booking."consultantId";

  IF v_consultant_user IS NOT NULL AND v_consultant_earning > 0 THEN
    PERFORM public.credit_funds_safe(
      v_consultant_user::text,
      v_consultant_earning,
      'Booking earning: '||p_booking_id::text,
      'booking-earn:'||p_booking_id::text
    );
    INSERT INTO public."Notification" ("userId",type,message,"redirectUrl","actorId")
    VALUES (v_consultant_user,'booking',
            'Booking confirmed. You earned ₹'||v_consultant_earning::text,
            '/consultant/bookings',v_caller);
  END IF;

  RETURN jsonb_build_object('success',true,
    'platformFee',v_platform_fee,
    'consultantEarning',v_consultant_earning,
    'total',v_booking.amount);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success',false,'error',SQLERRM,'code',SQLSTATE);
END $$;
GRANT EXECUTE ON FUNCTION public.confirm_booking_payment(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.process_per_minute_deduction(
  p_user_id text, p_consultant_id text, p_amount double precision,
  p_session_id text, p_is_ai boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ref text; v_existing "Transaction"%ROWTYPE;
  v_uw "Wallet"%ROWTYPE; v_cw "Wallet"%ROWTYPE;
  v_consultant_uid uuid; v_fee double precision; v_earning double precision;
BEGIN
  v_ref := 'permin:'||p_session_id;
  SELECT * INTO v_existing FROM "Transaction" WHERE "referenceId" = v_ref FOR UPDATE;
  IF FOUND THEN
    RETURN jsonb_build_object('success',true,'idempotent',true,'transactionId',v_existing.id);
  END IF;
  SELECT * INTO v_uw FROM "Wallet" WHERE "userId" = p_user_id::uuid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'error','user_wallet_not_found','code','NOT_FOUND');
  END IF;
  IF v_uw.balance < p_amount THEN
    RETURN jsonb_build_object('success',false,'error','Insufficient funds',
      'code','INSUFFICIENT_FUNDS','terminate',true,'remaining',v_uw.balance);
  END IF;

  IF p_is_ai THEN
    SELECT id INTO v_consultant_uid FROM "User"
      WHERE id = p_consultant_id::uuid AND role = 'AI'::"AppRole";
  ELSE
    SELECT "userId" INTO v_consultant_uid FROM "Consultant"
      WHERE id = p_consultant_id::uuid;
  END IF;

  v_fee := p_amount * 0.20; v_earning := p_amount - v_fee;

  UPDATE "Wallet" SET balance = balance - p_amount, "updatedAt" = now() WHERE id = v_uw.id;
  INSERT INTO "Transaction" (id,"walletId",type,amount,balance,description,"referenceId")
  VALUES (gen_random_uuid()::text,v_uw.id,'PAYMENT',-p_amount,
          v_uw.balance - p_amount,'Per-minute billing',v_ref);

  IF v_consultant_uid IS NOT NULL THEN
    SELECT * INTO v_cw FROM "Wallet" WHERE "userId" = v_consultant_uid FOR UPDATE;
    IF FOUND THEN
      UPDATE "Wallet" SET balance = balance + v_earning, "updatedAt" = now() WHERE id = v_cw.id;
      INSERT INTO "Transaction" (id,"walletId",type,amount,balance,description,"referenceId")
      VALUES (gen_random_uuid()::text,v_cw.id,'COMMISSION',v_earning,
              v_cw.balance + v_earning,'Per-minute earning',v_ref||':earn');
    END IF;
    IF NOT p_is_ai THEN
      UPDATE "Consultant" SET earnings = earnings + v_earning, "updatedAt" = now()
        WHERE id = p_consultant_id::uuid;
    END IF;
  END IF;

  RETURN jsonb_build_object('success',true,'idempotent',false,
    'remaining',v_uw.balance - p_amount,
    'consultant_credited',v_consultant_uid IS NOT NULL,'earning',v_earning);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success',false,'error',SQLERRM,'code',SQLSTATE);
END $$;
GRANT EXECUTE ON FUNCTION public.process_per_minute_deduction(text,text,double precision,text,boolean)
  TO authenticated;

-- ─── 5. REALTIME BROADCASTS ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.broadcast_razorpay_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'user:'||NEW."userId"::text||':payments',
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'broadcast_razorpay_changes: %', SQLERRM; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_broadcast_razorpay ON public."RazorpayPayment";
CREATE TRIGGER trg_broadcast_razorpay
  AFTER INSERT OR UPDATE ON public."RazorpayPayment"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_razorpay_changes();

CREATE OR REPLACE FUNCTION public.broadcast_billing_heartbeat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'session:'||NEW."sessionId"::text||':billing',
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'broadcast_billing_heartbeat: %', SQLERRM; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_broadcast_billing ON public."BillingHeartbeat";
CREATE TRIGGER trg_broadcast_billing
  AFTER INSERT ON public."BillingHeartbeat"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_billing_heartbeat();

-- ─── 6. RLS on new tables ────────────────────────────────────────────────────
ALTER TABLE public."RazorpayPayment"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RazorpayWebhookEvent"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BillingHeartbeat"      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rzp_owner_read ON public."RazorpayPayment";
CREATE POLICY rzp_owner_read ON public."RazorpayPayment"
  FOR SELECT USING ("userId" = (SELECT auth.uid()));

DROP POLICY IF EXISTS bh_session_read ON public."BillingHeartbeat";
CREATE POLICY bh_session_read ON public."BillingHeartbeat"
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public."CallSession" cs
            WHERE cs.id = "BillingHeartbeat"."sessionId"
              AND cs."userId" = (SELECT auth.uid()))
  );

-- ─── 7. VERIFY ───────────────────────────────────────────────────────────────
DO $$
DECLARE missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public."RazorpayPayment"')      IS NULL THEN missing := missing || 'RazorpayPayment'; END IF;
  IF to_regclass('public."RazorpayWebhookEvent"') IS NULL THEN missing := missing || 'RazorpayWebhookEvent'; END IF;
  IF to_regclass('public."BillingHeartbeat"')     IS NULL THEN missing := missing || 'BillingHeartbeat'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_consultantId_fkey') THEN
    missing := missing || 'Booking_consultantId_fkey';
  END IF;
  IF array_length(missing,1) > 0 THEN
    RAISE EXCEPTION '990 verify failed — missing: %', array_to_string(missing, ', ');
  END IF;
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '  990_phase1_financial_core.sql — VERIFIED';
  RAISE NOTICE '════════════════════════════════════════════════════════';
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
