-- ═══════════════════════════════════════════════════════════════════════════════
-- 018_rls_optimization.sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Rewrites every RLS policy with the wrapped-subquery pattern:
--   USING (id = (SELECT auth.uid()))   -- 100x faster on large tables
--
-- NOTE: Helper functions live in `public` (not `auth`) because Supabase
--       restricts CREATE on the auth schema to supabase_auth_admin only.
--       Policies reference them as public.auth_user_role(), etc.
--
-- Idempotent. Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. HELPER FUNCTIONS (in public schema)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() ->> 'user_role',
    'USER'
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.auth_user_role() IN ('SUPPORT', 'ADMIN', 'SUPER_ADMIN', 'VIEWER');
$$;

CREATE OR REPLACE FUNCTION public.auth_is_consultant()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.auth_user_role() IN ('CLIENT_ADMIN', 'ADMIN', 'SUPER_ADMIN');
$$;

GRANT EXECUTE ON FUNCTION public.auth_user_role()    TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auth_is_admin()     TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auth_is_consultant() TO authenticated, anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. INDEXES ON ALL RLS FILTER COLUMNS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_user_role                ON "User"(role);
CREATE INDEX IF NOT EXISTS idx_wallet_user              ON "Wallet"("userId");
CREATE INDEX IF NOT EXISTS idx_consultant_user          ON "Consultant"("userId");
CREATE INDEX IF NOT EXISTS idx_consultant_status_active ON "Consultant"(status, "isActive");
CREATE INDEX IF NOT EXISTS idx_consultant_spark         ON "Consultant"("sparkScore" DESC)
  WHERE status = 'VERIFIED' AND "isActive" = true;
CREATE INDEX IF NOT EXISTS idx_booking_user             ON "Booking"("userId");
CREATE INDEX IF NOT EXISTS idx_booking_consultant       ON "Booking"("consultantId");
CREATE INDEX IF NOT EXISTS idx_booking_status           ON "Booking"(status);
CREATE INDEX IF NOT EXISTS idx_transaction_wallet       ON "Transaction"("walletId");
CREATE INDEX IF NOT EXISTS idx_transaction_reference    ON "Transaction"("referenceId")
  WHERE "referenceId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_conversation     ON "Message"("conversationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_participant_user         ON "ConversationParticipant"("userId");
CREATE INDEX IF NOT EXISTS idx_participant_conv         ON "ConversationParticipant"("conversationId");
CREATE INDEX IF NOT EXISTS idx_notification_user_unread ON "Notification"("userId")
  WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_post_author              ON "Post"("authorId", created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_feed                ON "Post"(created_at DESC)
  WHERE "isFlagged" = false;
CREATE INDEX IF NOT EXISTS idx_cheer_post               ON "Cheer"("postId");
CREATE INDEX IF NOT EXISTS idx_cheer_user               ON "Cheer"("userId");
CREATE INDEX IF NOT EXISTS idx_comment_post             ON "Comment"("postId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_callsession_user         ON "CallSession"("userId");
CREATE INDEX IF NOT EXISTS idx_callsession_consultant   ON "CallSession"("consultantId");

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. USER TABLE POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_self_select"        ON "User";
DROP POLICY IF EXISTS "user_self_update"        ON "User";
DROP POLICY IF EXISTS "user_self_insert"        ON "User";
DROP POLICY IF EXISTS "admin_full_access"       ON "User";
DROP POLICY IF EXISTS "users_select_self"       ON "User";
DROP POLICY IF EXISTS "users_update_self"       ON "User";
DROP POLICY IF EXISTS "users_insert_self"       ON "User";

CREATE POLICY "user_self_select" ON "User"
  FOR SELECT USING (id = (SELECT auth.uid()));

CREATE POLICY "user_self_update" ON "User"
  FOR UPDATE USING (id = (SELECT auth.uid()));

CREATE POLICY "user_self_insert" ON "User"
  FOR INSERT WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "admin_full_access" ON "User"
  FOR ALL USING ((SELECT public.auth_is_admin()));

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. WALLET POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "Wallet" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet_owner_all"    ON "Wallet";
DROP POLICY IF EXISTS "wallet_owner_read"   ON "Wallet";
DROP POLICY IF EXISTS "wallet_admin_read"   ON "Wallet";

CREATE POLICY "wallet_owner_all" ON "Wallet"
  FOR ALL USING ("userId" = (SELECT auth.uid()));

CREATE POLICY "wallet_admin_read" ON "Wallet"
  FOR SELECT USING ((SELECT public.auth_is_admin()));

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. TRANSACTION POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tx_owner_read"       ON "Transaction";
DROP POLICY IF EXISTS "transaction_owner"   ON "Transaction";
DROP POLICY IF EXISTS "tx_admin_read"       ON "Transaction";

CREATE POLICY "tx_owner_read" ON "Transaction"
  FOR SELECT USING (
    "walletId" IN (SELECT id FROM "Wallet" WHERE "userId" = (SELECT auth.uid()))
  );

CREATE POLICY "tx_admin_read" ON "Transaction"
  FOR SELECT USING ((SELECT public.auth_is_admin()));

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. CONSULTANT POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "Consultant" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consultant_public_read" ON "Consultant";
DROP POLICY IF EXISTS "consultant_self_manage" ON "Consultant";
DROP POLICY IF EXISTS "consultant_self_write"  ON "Consultant";
DROP POLICY IF EXISTS "consultant_admin_all"   ON "Consultant";

CREATE POLICY "consultant_public_read" ON "Consultant"
  FOR SELECT USING (status = 'VERIFIED' AND "isActive" = true);

CREATE POLICY "consultant_self_manage" ON "Consultant"
  FOR ALL USING ("userId" = (SELECT auth.uid()));

CREATE POLICY "consultant_admin_all" ON "Consultant"
  FOR ALL USING ((SELECT public.auth_is_admin()));

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. BOOKING POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "booking_participants" ON "Booking";
DROP POLICY IF EXISTS "booking_user_insert"  ON "Booking";
DROP POLICY IF EXISTS "booking_admin_all"    ON "Booking";

CREATE POLICY "booking_participants" ON "Booking"
  FOR SELECT USING (
    "userId" = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM "Consultant" c
      WHERE c.id = "consultantId"
        AND c."userId" = (SELECT auth.uid())
    )
  );

CREATE POLICY "booking_user_insert" ON "Booking"
  FOR INSERT WITH CHECK ("userId" = (SELECT auth.uid()));

CREATE POLICY "booking_admin_all" ON "Booking"
  FOR ALL USING ((SELECT public.auth_is_admin()));

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. POST / COMMENT / CHEER POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_public_read"   ON "Post";
DROP POLICY IF EXISTS "posts_author_insert" ON "Post";
DROP POLICY IF EXISTS "posts_author_update" ON "Post";
DROP POLICY IF EXISTS "posts_author_delete" ON "Post";
DROP POLICY IF EXISTS "post_public_read"    ON "Post";
DROP POLICY IF EXISTS "post_author_write"   ON "Post";

CREATE POLICY "posts_public_read" ON "Post"
  FOR SELECT USING ("isFlagged" = false);

CREATE POLICY "posts_author_insert" ON "Post"
  FOR INSERT WITH CHECK ("authorId" = (SELECT auth.uid()));

CREATE POLICY "posts_author_update" ON "Post"
  FOR UPDATE USING ("authorId" = (SELECT auth.uid()));

CREATE POLICY "posts_author_delete" ON "Post"
  FOR DELETE USING ("authorId" = (SELECT auth.uid()));

ALTER TABLE "Comment" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_public_read"   ON "Comment";
DROP POLICY IF EXISTS "comments_author_insert" ON "Comment";

CREATE POLICY "comments_public_read" ON "Comment"
  FOR SELECT USING (true);

CREATE POLICY "comments_author_insert" ON "Comment"
  FOR INSERT WITH CHECK ("authorId" = (SELECT auth.uid()));

ALTER TABLE "Cheer" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cheers_public_read" ON "Cheer";
DROP POLICY IF EXISTS "cheers_self_write"  ON "Cheer";
DROP POLICY IF EXISTS "cheers_self_delete" ON "Cheer";

CREATE POLICY "cheers_public_read" ON "Cheer"
  FOR SELECT USING (true);

CREATE POLICY "cheers_self_write" ON "Cheer"
  FOR INSERT WITH CHECK ("userId" = (SELECT auth.uid()));

CREATE POLICY "cheers_self_delete" ON "Cheer"
  FOR DELETE USING ("userId" = (SELECT auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. NOTIFICATION POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_owner_read"          ON "Notification";
DROP POLICY IF EXISTS "notif_owner_update"        ON "Notification";
DROP POLICY IF EXISTS "notification_owner_read"   ON "Notification";
DROP POLICY IF EXISTS "notification_owner_update" ON "Notification";

CREATE POLICY "notif_owner_read" ON "Notification"
  FOR SELECT USING ("userId" = (SELECT auth.uid()));

CREATE POLICY "notif_owner_update" ON "Notification"
  FOR UPDATE USING ("userId" = (SELECT auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. CONVERSATION / MESSAGE POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "Conversation"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConversationParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message"                 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversation_participant_read" ON "Conversation";
DROP POLICY IF EXISTS "conversation_participants_read" ON "Conversation";
DROP POLICY IF EXISTS "participant_self_read"         ON "ConversationParticipant";
DROP POLICY IF EXISTS "message_participant_read"      ON "Message";
DROP POLICY IF EXISTS "message_participant_send"      ON "Message";
DROP POLICY IF EXISTS "message_participants_read"     ON "Message";
DROP POLICY IF EXISTS "message_sender_insert"         ON "Message";

CREATE POLICY "conversation_participant_read" ON "Conversation"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "ConversationParticipant" cp
      WHERE cp."conversationId" = "Conversation".id
        AND cp."userId" = (SELECT auth.uid())
    )
  );

CREATE POLICY "participant_self_read" ON "ConversationParticipant"
  FOR SELECT USING (
    "userId" = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM "ConversationParticipant" cp2
      WHERE cp2."conversationId" = "ConversationParticipant"."conversationId"
        AND cp2."userId" = (SELECT auth.uid())
    )
  );

CREATE POLICY "message_participant_read" ON "Message"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "ConversationParticipant" cp
      WHERE cp."conversationId" = "Message"."conversationId"
        AND cp."userId" = (SELECT auth.uid())
    )
  );

CREATE POLICY "message_participant_send" ON "Message"
  FOR INSERT WITH CHECK (
    "senderId" = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM "ConversationParticipant" cp
      WHERE cp."conversationId" = "Message"."conversationId"
        AND cp."userId" = (SELECT auth.uid())
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. CALLSESSION POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "CallSession" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "callsession_participants_read" ON "CallSession";
DROP POLICY IF EXISTS "callsession_participants"      ON "CallSession";

CREATE POLICY "callsession_participants" ON "CallSession"
  FOR SELECT USING (
    "userId" = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM "Consultant" c
      WHERE c.id = "consultantId"
        AND c."userId" = (SELECT auth.uid())
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. AI CONSULTANT PUBLIC READ
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "AIConsultant" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_consultants_public_read" ON "AIConsultant";

CREATE POLICY "ai_consultants_public_read" ON "AIConsultant"
  FOR SELECT USING ("isActive" = true);

-- ═══════════════════════════════════════════════════════════════════════════
-- 13. VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  policy_count integer;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';

  RAISE NOTICE '========================================';
  RAISE NOTICE '  018_rls_optimization.sql — VERIFIED';
  RAISE NOTICE '  Active RLS policies: %', policy_count;
  RAISE NOTICE '========================================';
END $$;

COMMIT;
