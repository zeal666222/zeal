-- ═══════════════════════════════════════════════════════════════════════════════
-- ZEAL — PHASE 2: BILLING CORRECTNESS + RLS OPTIMIZATION
-- ═══════════════════════════════════════════════════════════════════════════════
-- Depends : Phase 1 (000_phase1_foundation.sql)
-- Safety  : Idempotent · Transaction-wrapped · Self-verifying · Zero data loss
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;
SET LOCAL statement_timeout = '10min';
SET LOCAL lock_timeout = '30s';
SET LOCAL client_min_messages = 'notice';

-- ─────────────────────────────────────────────────────────────────────────────
-- §1  PRE-FLIGHT
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_count int;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '  PHASE 2 — PRE-FLIGHT AUDIT';
  RAISE NOTICE '════════════════════════════════════════════════════════════';

  IF to_regclass('public."Wallet"') IS NOT NULL
     AND to_regclass('public."Transaction"') IS NOT NULL THEN
    EXECUTE $q$
      SELECT COUNT(*) FROM (
        SELECT w.id, w.balance - COALESCE(SUM(t.amount), 0) AS drift
        FROM public."Wallet" w
        LEFT JOIN public."Transaction" t ON t."walletId" = w.id
        GROUP BY w.id, w.balance
      ) d WHERE ABS(d.drift) > 0.01
    $q$ INTO v_count;
    RAISE NOTICE '[AUDIT] Wallets with ledger drift: %', v_count;
  END IF;

  IF to_regclass('public."CallSession"') IS NOT NULL THEN
    EXECUTE $q$
      SELECT COUNT(*) FROM public."CallSession"
      WHERE status IN ('INITIATED','CONNECTED')
        AND "startTime" < now() - interval '4 hours'
    $q$ INTO v_count;
    RAISE NOTICE '[AUDIT] Zombie CallSessions (>4h): %', v_count;
  END IF;

  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- §2  CallSession.conversationId
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public."CallSession"') IS NULL THEN RETURN; END IF;

  ALTER TABLE public."CallSession"
    ADD COLUMN IF NOT EXISTS "conversationId" uuid;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CallSession_conversationId_fkey'
  ) THEN
    ALTER TABLE public."CallSession"
      ADD CONSTRAINT "CallSession_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES public."Conversation"(id) ON DELETE SET NULL;
  END IF;

  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_callsession_conversation
           ON public."CallSession"("conversationId")
           WHERE "conversationId" IS NOT NULL';

  RAISE NOTICE '[§2] ✓ CallSession.conversationId + FK + index';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- §3  process_per_minute_deduction — AI MONEY LEAK FIX
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_per_minute_deduction(
  p_user_id       text,
  p_consultant_id text,
  p_amount        double precision,
  p_session_id    text,
  p_is_ai         boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ref            text;
  v_existing       "Transaction"%ROWTYPE;
  v_uw             "Wallet"%ROWTYPE;
  v_cw             "Wallet"%ROWTYPE;
  v_consultant_uid uuid;
  v_fee            double precision;
  v_earning        double precision;
BEGIN
  v_ref := 'permin:' || p_session_id;

  SELECT * INTO v_existing FROM "Transaction" WHERE "referenceId" = v_ref FOR UPDATE;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true,
                              'transactionId', v_existing.id);
  END IF;

  SELECT * INTO v_uw FROM "Wallet" WHERE "userId" = p_user_id::uuid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_wallet_not_found', 'code', 'NOT_FOUND');
  END IF;
  IF v_uw.balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds',
                              'code', 'INSUFFICIENT_FUNDS', 'terminate', true,
                              'remaining', v_uw.balance);
  END IF;

  IF p_is_ai THEN
    SELECT id INTO v_consultant_uid FROM "User"
    WHERE id = p_consultant_id::uuid AND role = 'AI'::"AppRole";
  ELSE
    SELECT "userId" INTO v_consultant_uid FROM "Consultant"
    WHERE id = p_consultant_id::uuid;
  END IF;

  v_fee     := p_amount * 0.20;
  v_earning := p_amount - v_fee;

  UPDATE "Wallet" SET balance = balance - p_amount, updated_at = now() WHERE id = v_uw.id;

  INSERT INTO "Transaction" (id, "walletId", type, amount, balance, description, "referenceId")
  VALUES (gen_random_uuid(), v_uw.id, 'PAYMENT'::"TransactionType", -p_amount,
          v_uw.balance - p_amount, 'Per-minute billing', v_ref);

  IF v_consultant_uid IS NOT NULL THEN
    SELECT * INTO v_cw FROM "Wallet" WHERE "userId" = v_consultant_uid FOR UPDATE;
    IF FOUND THEN
      UPDATE "Wallet" SET balance = balance + v_earning, updated_at = now() WHERE id = v_cw.id;
      INSERT INTO "Transaction" (id, "walletId", type, amount, balance, description, "referenceId")
      VALUES (gen_random_uuid(), v_cw.id, 'COMMISSION'::"TransactionType", v_earning,
              v_cw.balance + v_earning, 'Per-minute earning', v_ref || ':earn');
    END IF;
    IF NOT p_is_ai THEN
      UPDATE "Consultant" SET earnings = earnings + v_earning, updated_at = now()
      WHERE id = p_consultant_id::uuid;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'idempotent', false,
                            'remaining', v_uw.balance - p_amount,
                            'consultant_credited', v_consultant_uid IS NOT NULL,
                            'earning', v_earning);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'code', SQLSTATE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_per_minute_deduction(
  text, text, double precision, text, boolean) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- §4  credit_funds_safe — idempotent
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.credit_funds_safe(
  p_user_id      text,
  p_amount       double precision,
  p_description  text,
  p_reference_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_wallet   "Wallet"%ROWTYPE;
  v_existing "Transaction"%ROWTYPE;
  v_txn_id   text;
BEGIN
  IF p_reference_id IS NOT NULL AND p_reference_id <> '' THEN
    SELECT * INTO v_existing FROM "Transaction" WHERE "referenceId" = p_reference_id;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true,
                                'balance', v_existing.balance,
                                'transactionId', v_existing.id);
    END IF;
  END IF;

  SELECT * INTO v_wallet FROM "Wallet" WHERE "userId" = p_user_id::uuid FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO "Wallet" ("userId", balance, escrow, "pendingIn", "pendingOut", blocked)
    VALUES (p_user_id::uuid, p_amount, 0, 0, 0, 0) RETURNING * INTO v_wallet;

    v_txn_id := gen_random_uuid()::text;
    INSERT INTO "Transaction" (id, "walletId", type, amount, balance, description, "referenceId")
    VALUES (v_txn_id, v_wallet.id, 'TOPUP'::"TransactionType", p_amount, p_amount,
            p_description, p_reference_id);

    RETURN jsonb_build_object('success', true, 'idempotent', false,
                              'balance', p_amount, 'transactionId', v_txn_id,
                              'walletCreated', true);
  END IF;

  UPDATE "Wallet" SET balance = balance + p_amount, updated_at = now() WHERE id = v_wallet.id;

  v_txn_id := gen_random_uuid()::text;
  INSERT INTO "Transaction" (id, "walletId", type, amount, balance, description, "referenceId")
  VALUES (v_txn_id, v_wallet.id, 'TOPUP'::"TransactionType", p_amount,
          v_wallet.balance + p_amount, p_description, p_reference_id);

  RETURN jsonb_build_object('success', true, 'idempotent', false,
                            'balance', v_wallet.balance + p_amount,
                            'transactionId', v_txn_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'code', SQLSTATE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_funds_safe(
  text, double precision, text, text) TO authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- §5  hold_in_escrow_safe — idempotent
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hold_in_escrow_safe(
  p_user_id      text,
  p_amount       double precision,
  p_reference_id text,
  p_description  text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_wallet   "Wallet"%ROWTYPE;
  v_existing "Transaction"%ROWTYPE;
  v_txn_id   text;
BEGIN
  IF p_reference_id IS NOT NULL AND p_reference_id <> '' THEN
    SELECT * INTO v_existing FROM "Transaction" WHERE "referenceId" = p_reference_id;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true,
                                'transactionId', v_existing.id);
    END IF;
  END IF;

  SELECT * INTO v_wallet FROM "Wallet" WHERE "userId" = p_user_id::uuid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'wallet_not_found', 'code', 'NOT_FOUND');
  END IF;
  IF v_wallet.balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance',
                              'code', 'INSUFFICIENT_FUNDS', 'balance', v_wallet.balance);
  END IF;

  UPDATE "Wallet" SET balance = balance - p_amount, escrow = escrow + p_amount,
                       updated_at = now() WHERE id = v_wallet.id;

  v_txn_id := gen_random_uuid()::text;
  INSERT INTO "Transaction" (id, "walletId", type, amount, balance, description, "referenceId")
  VALUES (v_txn_id, v_wallet.id, 'PAYMENT'::"TransactionType", p_amount,
          v_wallet.balance - p_amount, p_description, p_reference_id);

  RETURN jsonb_build_object('success', true, 'idempotent', false,
                            'transactionId', v_txn_id,
                            'escrow', v_wallet.escrow + p_amount);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'code', SQLSTATE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.hold_in_escrow_safe(
  text, double precision, text, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- §6  Transaction.referenceId — partial UNIQUE index
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_dupes int;
BEGIN
  IF to_regclass('public."Transaction"') IS NULL THEN RETURN; END IF;

  EXECUTE $q$
    SELECT COUNT(*) FROM (
      SELECT "referenceId" FROM public."Transaction"
      WHERE "referenceId" IS NOT NULL
      GROUP BY "referenceId" HAVING COUNT(*) > 1
    ) dup
  $q$ INTO v_dupes;

  IF v_dupes > 0 THEN
    RAISE WARNING '[§6] % duplicate referenceIds — skipping UNIQUE index', v_dupes;
    RETURN;
  END IF;

  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_transaction_reference_unique
           ON public."Transaction"("referenceId")
           WHERE "referenceId" IS NOT NULL';
  RAISE NOTICE '[§6] ✓ Transaction.referenceId unique index present';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- §7  RLS POLICY REBUILD (wrapped auth.uid())
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '[§7] Rebuilding RLS policies...';

  -- User
  IF to_regclass('public."User"') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "user_self_select"  ON public."User"';
    EXECUTE 'DROP POLICY IF EXISTS "user_self_update"  ON public."User"';
    EXECUTE 'DROP POLICY IF EXISTS "user_self_insert"  ON public."User"';
    EXECUTE 'DROP POLICY IF EXISTS "admin_full_access" ON public."User"';
    EXECUTE 'DROP POLICY IF EXISTS "users_select_self" ON public."User"';
    EXECUTE 'DROP POLICY IF EXISTS "users_update_self" ON public."User"';
    EXECUTE 'DROP POLICY IF EXISTS "users_insert_self" ON public."User"';

    EXECUTE 'CREATE POLICY "user_self_select" ON public."User"
             FOR SELECT USING (id = (SELECT auth.uid()))';
    EXECUTE 'CREATE POLICY "user_self_update" ON public."User"
             FOR UPDATE USING (id = (SELECT auth.uid()))';
    EXECUTE 'CREATE POLICY "user_self_insert" ON public."User"
             FOR INSERT WITH CHECK (id = (SELECT auth.uid()))';
    EXECUTE 'CREATE POLICY "admin_full_access" ON public."User"
             FOR ALL USING ((SELECT public.auth_is_admin()))';
  END IF;

  -- Wallet
  IF to_regclass('public."Wallet"') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "wallet_owner_all"  ON public."Wallet"';
    EXECUTE 'DROP POLICY IF EXISTS "wallet_admin_read" ON public."Wallet"';
    EXECUTE 'CREATE POLICY "wallet_owner_all" ON public."Wallet"
             FOR ALL USING ("userId" = (SELECT auth.uid()))';
    EXECUTE 'CREATE POLICY "wallet_admin_read" ON public."Wallet"
             FOR SELECT USING ((SELECT public.auth_is_admin()))';
  END IF;

  -- Transaction
  IF to_regclass('public."Transaction"') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "tx_owner_read" ON public."Transaction"';
    EXECUTE 'DROP POLICY IF EXISTS "tx_admin_read" ON public."Transaction"';
    EXECUTE 'CREATE POLICY "tx_owner_read" ON public."Transaction"
             FOR SELECT USING (
               "walletId" IN (SELECT id FROM public."Wallet" WHERE "userId" = (SELECT auth.uid()))
             )';
    EXECUTE 'CREATE POLICY "tx_admin_read" ON public."Transaction"
             FOR SELECT USING ((SELECT public.auth_is_admin()))';
  END IF;

  -- Consultant
  IF to_regclass('public."Consultant"') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "consultant_public_read" ON public."Consultant"';
    EXECUTE 'DROP POLICY IF EXISTS "consultant_self_manage" ON public."Consultant"';
    EXECUTE 'DROP POLICY IF EXISTS "consultant_admin_all"   ON public."Consultant"';
    EXECUTE 'CREATE POLICY "consultant_public_read" ON public."Consultant"
             FOR SELECT USING (status = ''VERIFIED'' AND "isActive" = true)';
    EXECUTE 'CREATE POLICY "consultant_self_manage" ON public."Consultant"
             FOR ALL USING ("userId" = (SELECT auth.uid()))';
    EXECUTE 'CREATE POLICY "consultant_admin_all" ON public."Consultant"
             FOR ALL USING ((SELECT public.auth_is_admin()))';
  END IF;

  -- AIConsultant
  IF to_regclass('public."AIConsultant"') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "ai_consultants_public_read" ON public."AIConsultant"';
    EXECUTE 'CREATE POLICY "ai_consultants_public_read" ON public."AIConsultant"
             FOR SELECT USING ("isActive" = true)';
  END IF;

  -- Booking
  IF to_regclass('public."Booking"') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "booking_participants" ON public."Booking"';
    EXECUTE 'DROP POLICY IF EXISTS "booking_user_insert"  ON public."Booking"';
    EXECUTE 'DROP POLICY IF EXISTS "booking_admin_all"    ON public."Booking"';
    EXECUTE 'CREATE POLICY "booking_participants" ON public."Booking"
             FOR SELECT USING (
               "userId" = (SELECT auth.uid())
               OR EXISTS (SELECT 1 FROM public."Consultant" c
                          WHERE c.id = "consultantId" AND c."userId" = (SELECT auth.uid()))
             )';
    EXECUTE 'CREATE POLICY "booking_user_insert" ON public."Booking"
             FOR INSERT WITH CHECK ("userId" = (SELECT auth.uid()))';
    EXECUTE 'CREATE POLICY "booking_admin_all" ON public."Booking"
             FOR ALL USING ((SELECT public.auth_is_admin()))';
  END IF;

  -- CallSession
  IF to_regclass('public."CallSession"') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "callsession_participants" ON public."CallSession"';
    EXECUTE 'CREATE POLICY "callsession_participants" ON public."CallSession"
             FOR SELECT USING (
               "userId" = (SELECT auth.uid())
               OR EXISTS (SELECT 1 FROM public."Consultant" c
                          WHERE c.id = "consultantId" AND c."userId" = (SELECT auth.uid()))
             )';
  END IF;

  -- Post
  IF to_regclass('public."Post"') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "posts_public_read"   ON public."Post"';
    EXECUTE 'DROP POLICY IF EXISTS "posts_author_insert" ON public."Post"';
    EXECUTE 'DROP POLICY IF EXISTS "posts_author_update" ON public."Post"';
    EXECUTE 'DROP POLICY IF EXISTS "posts_author_delete" ON public."Post"';
    EXECUTE 'CREATE POLICY "posts_public_read" ON public."Post"
             FOR SELECT USING ("isFlagged" = false)';
    EXECUTE 'CREATE POLICY "posts_author_insert" ON public."Post"
             FOR INSERT WITH CHECK ("authorId" = (SELECT auth.uid()))';
    EXECUTE 'CREATE POLICY "posts_author_update" ON public."Post"
             FOR UPDATE USING ("authorId" = (SELECT auth.uid()))';
    EXECUTE 'CREATE POLICY "posts_author_delete" ON public."Post"
             FOR DELETE USING ("authorId" = (SELECT auth.uid()))';
  END IF;

  -- Comment
  IF to_regclass('public."Comment"') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "comments_public_read"   ON public."Comment"';
    EXECUTE 'DROP POLICY IF EXISTS "comments_author_insert" ON public."Comment"';
    EXECUTE 'CREATE POLICY "comments_public_read" ON public."Comment"
             FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "comments_author_insert" ON public."Comment"
             FOR INSERT WITH CHECK ("authorId" = (SELECT auth.uid()))';
  END IF;

  -- Cheer
  IF to_regclass('public."Cheer"') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "cheers_public_read" ON public."Cheer"';
    EXECUTE 'DROP POLICY IF EXISTS "cheers_self_write"  ON public."Cheer"';
    EXECUTE 'DROP POLICY IF EXISTS "cheers_self_delete" ON public."Cheer"';
    EXECUTE 'CREATE POLICY "cheers_public_read" ON public."Cheer"
             FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "cheers_self_write" ON public."Cheer"
             FOR INSERT WITH CHECK ("userId" = (SELECT auth.uid()))';
    EXECUTE 'CREATE POLICY "cheers_self_delete" ON public."Cheer"
             FOR DELETE USING ("userId" = (SELECT auth.uid()))';
  END IF;

  -- Notification
  IF to_regclass('public."Notification"') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "notif_owner_read"   ON public."Notification"';
    EXECUTE 'DROP POLICY IF EXISTS "notif_owner_update" ON public."Notification"';
    EXECUTE 'CREATE POLICY "notif_owner_read" ON public."Notification"
             FOR SELECT USING ("userId" = (SELECT auth.uid()))';
    EXECUTE 'CREATE POLICY "notif_owner_update" ON public."Notification"
             FOR UPDATE USING ("userId" = (SELECT auth.uid()))';
  END IF;

  -- Conversation
  IF to_regclass('public."Conversation"') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "conversation_participant_read" ON public."Conversation"';
    EXECUTE 'CREATE POLICY "conversation_participant_read" ON public."Conversation"
             FOR SELECT USING (
               EXISTS (SELECT 1 FROM public."ConversationParticipant" cp
                       WHERE cp."conversationId" = "Conversation".id
                         AND cp."userId" = (SELECT auth.uid()))
             )';
  END IF;

  -- ConversationParticipant
  IF to_regclass('public."ConversationParticipant"') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "participant_self_read" ON public."ConversationParticipant"';
    EXECUTE 'CREATE POLICY "participant_self_read" ON public."ConversationParticipant"
             FOR SELECT USING (
               "userId" = (SELECT auth.uid())
               OR EXISTS (SELECT 1 FROM public."ConversationParticipant" cp2
                          WHERE cp2."conversationId" = "ConversationParticipant"."conversationId"
                            AND cp2."userId" = (SELECT auth.uid()))
             )';
  END IF;

  -- Message
  IF to_regclass('public."Message"') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "message_participant_read" ON public."Message"';
    EXECUTE 'DROP POLICY IF EXISTS "message_participant_send" ON public."Message"';
    EXECUTE 'CREATE POLICY "message_participant_read" ON public."Message"
             FOR SELECT USING (
               EXISTS (SELECT 1 FROM public."ConversationParticipant" cp
                       WHERE cp."conversationId" = "Message"."conversationId"
                         AND cp."userId" = (SELECT auth.uid()))
             )';
    EXECUTE 'CREATE POLICY "message_participant_send" ON public."Message"
             FOR INSERT WITH CHECK (
               "senderId" = (SELECT auth.uid())
               AND EXISTS (SELECT 1 FROM public."ConversationParticipant" cp
                           WHERE cp."conversationId" = "Message"."conversationId"
                             AND cp."userId" = (SELECT auth.uid()))
             )';
  END IF;

  -- AdminAuditLog
  IF to_regclass('public."AdminAuditLog"') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "audit_admin_read" ON public."AdminAuditLog"';
    EXECUTE 'CREATE POLICY "audit_admin_read" ON public."AdminAuditLog"
             FOR SELECT USING ((SELECT public.auth_is_admin()))';
  END IF;

  RAISE NOTICE '[§7] ✓ RLS policies rebuilt';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- §8  RLS performance indexes
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_id_rls ON public."User"(id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_role_rls ON public."User"(role)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_wallet_userid_rls ON public."Wallet"("userId")';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_transaction_walletid_rls ON public."Transaction"("walletId")';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_consultant_userid_rls ON public."Consultant"("userId")';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_consultant_status_rls ON public."Consultant"(status, "isActive")';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_booking_userid_rls ON public."Booking"("userId")';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_booking_consultantid_rls ON public."Booking"("consultantId")';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_callsession_userid_rls ON public."CallSession"("userId")';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_callsession_consultantid_rls ON public."CallSession"("consultantId")';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_post_authorid_rls ON public."Post"("authorId")';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_post_isflagged_rls ON public."Post"("isFlagged") WHERE "isFlagged" = false';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_comment_authorid_rls ON public."Comment"("authorId")';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_comment_postid_rls ON public."Comment"("postId")';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cheer_userid_rls ON public."Cheer"("userId")';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cheer_postid_rls ON public."Cheer"("postId")';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notification_userid_rls ON public."Notification"("userId")';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notification_unread_rls ON public."Notification"("userId") WHERE read = false';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_participant_userid_rls ON public."ConversationParticipant"("userId")';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_participant_convid_userid_rls ON public."ConversationParticipant"("conversationId", "userId")';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_message_convid_rls ON public."Message"("conversationId")';

  RAISE NOTICE '[§8] ✓ RLS indexes created';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- §9  Helper RPCs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reconcile_wallet(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_wallet "Wallet"%ROWTYPE;
  v_ledger double precision;
  v_drift  double precision;
BEGIN
  SELECT * INTO v_wallet FROM "Wallet" WHERE "userId" = p_user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'wallet_not_found'); END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_ledger
  FROM "Transaction" WHERE "walletId" = v_wallet.id;

  v_drift := v_wallet.balance - v_ledger;

  RETURN jsonb_build_object(
    'success', true,
    'storedBalance', v_wallet.balance,
    'ledgerSum', v_ledger,
    'drift', v_drift,
    'reconciled', ABS(v_drift) <= 0.01
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.reconcile_wallet(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cleanup_zombie_sessions(p_older_than_hours int DEFAULT 4)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  UPDATE public."CallSession"
  SET status = 'ENDED'::"CallStatus", "endTime" = now(), updated_at = now()
  WHERE status IN ('INITIATED'::"CallStatus", 'CONNECTED'::"CallStatus")
    AND "startTime" < now() - (p_older_than_hours || ' hours')::interval;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'ended', v_count);
END;
$$;
GRANT EXECUTE ON FUNCTION public.cleanup_zombie_sessions(int) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- §10  POST-FLIGHT
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_errors         text[] := ARRAY[]::text[];
  v_policy_count   int;
  v_slow_policies  int;
  v_index_count    int;
  v_count          int;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '  PHASE 2 — POST-FLIGHT VERIFICATION';
  RAISE NOTICE '════════════════════════════════════════════════════════════';

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public."CallSession"'::regclass
      AND a.attname = 'conversationId' AND NOT a.attisdropped
  ) THEN
    v_errors := array_append(v_errors, 'CallSession.conversationId missing');
  ELSE
    RAISE NOTICE '  ✓ Check 1: CallSession.conversationId present';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='process_per_minute_deduction' AND p.pronargs = 5
  ) THEN
    v_errors := array_append(v_errors, 'process_per_minute_deduction wrong arity');
  ELSE
    RAISE NOTICE '  ✓ Check 2: process_per_minute_deduction 5-arg signature';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='Transaction'
      AND indexdef ILIKE '%unique%referenceId%'
  ) THEN
    v_errors := array_append(v_errors, 'Transaction.referenceId missing UNIQUE');
  ELSE
    RAISE NOTICE '  ✓ Check 3: Transaction.referenceId unique index';
  END IF;

  SELECT COUNT(*) INTO v_policy_count FROM pg_policies WHERE schemaname='public';
  IF v_policy_count < 20 THEN
    v_errors := array_append(v_errors, format('only %s RLS policies', v_policy_count));
  ELSE
    RAISE NOTICE '  ✓ Check 4: % RLS policies active', v_policy_count;
  END IF;

  SELECT COUNT(*) INTO v_slow_policies
  FROM pg_policies WHERE schemaname='public'
    AND qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(SELECT auth.uid())%';

  IF v_slow_policies > 0 THEN
    RAISE WARNING '  ⚠ Check 5: % policies still unwrapped', v_slow_policies;
  ELSE
    RAISE NOTICE '  ✓ Check 5: All policies wrapped';
  END IF;

  SELECT COUNT(*) INTO v_index_count FROM pg_indexes
  WHERE schemaname='public' AND indexname LIKE 'idx_%_rls';
  IF v_index_count < 15 THEN
    v_errors := array_append(v_errors, format('only %s RLS indexes', v_index_count));
  ELSE
    RAISE NOTICE '  ✓ Check 6: % RLS indexes', v_index_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='reconcile_wallet'
  ) THEN
    v_errors := array_append(v_errors, 'reconcile_wallet missing');
  ELSE
    RAISE NOTICE '  ✓ Check 7: Helper RPCs present';
  END IF;

  IF to_regclass('public."Wallet"') IS NOT NULL
     AND to_regclass('public."Transaction"') IS NOT NULL THEN
    EXECUTE $q$
      SELECT COUNT(*) FROM (
        SELECT w.id, w.balance - COALESCE(SUM(t.amount), 0) AS drift
        FROM public."Wallet" w
        LEFT JOIN public."Transaction" t ON t."walletId" = w.id
        GROUP BY w.id, w.balance
      ) d WHERE ABS(d.drift) > 0.01
    $q$ INTO v_count;

    IF v_count > 0 THEN
      RAISE WARNING '  ⚠ Check 8: % wallets with ledger drift', v_count;
    ELSE
      RAISE NOTICE '  ✓ Check 8: Zero wallet ledger drift';
    END IF;
  END IF;

  RAISE NOTICE '════════════════════════════════════════════════════════════';

  IF array_length(v_errors, 1) > 0 THEN
    RAISE EXCEPTION 'PHASE 2 FAILED: %', array_to_string(v_errors, ' | ');
  END IF;

  IF to_regclass('public._zeal_migrations') IS NOT NULL THEN
    INSERT INTO public._zeal_migrations (name, details)
    VALUES ('001_phase2_billing_rls',
            jsonb_build_object(
              'rls_policies', v_policy_count,
              'rls_indexes', v_index_count,
              'billing_rpc_fixed', true
            ))
    ON CONFLICT (name) DO UPDATE SET applied_at = now(), details = EXCLUDED.details;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '  PHASE 2 COMPLETE — BILLING + RLS READY';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
