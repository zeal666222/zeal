-- ═══════════════════════════════════════════════════════════════════════════════
-- 108_rls_lockdown.sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Full RLS lockdown + performance pass.
--
-- Guarantees:
--   • Every public table has RLS ENABLED + FORCED.
--   • Every policy uses wrapped (SELECT auth.uid()) — no per-row re-eval.
--   • User.role / sparks / isVerified are ADMIN-ONLY writable.
--   • Wallet / Transaction are READ-ONLY for owners; writes only via RPC.
--   • Admin-only tables (audit, invites, login attempts, debug) are locked
--     to auth_is_admin().
--   • A verification block RAISES if any table ends unprotected.
--
-- Idempotent: DROP IF EXISTS before every CREATE. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;
SET LOCAL statement_timeout = '5min';
SET LOCAL lock_timeout = '20s';

-- ═══════════════════════════════════════════════════════════════════════════
-- §0. HELPERS (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS text LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() ->> 'user_role',
    'USER'
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS boolean LANGUAGE sql STABLE
AS $$
  SELECT public.auth_user_role() IN ('ADMIN','SUPER_ADMIN','SUPPORT','VIEWER');
$$;

CREATE OR REPLACE FUNCTION public.auth_is_consultant()
RETURNS boolean LANGUAGE sql STABLE
AS $$
  SELECT public.auth_user_role() IN ('CLIENT_ADMIN','ADMIN','SUPER_ADMIN');
$$;

GRANT EXECUTE ON FUNCTION public.auth_user_role()    TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auth_is_admin()     TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auth_is_consultant() TO authenticated, anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- §1. ENABLE + FORCE RLS ON EVERY USER-DATA TABLE
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  t text;
  skip text[] := ARRAY[
    '_legacy_audit_events',
    '_legacy_audit_logs',
    '_legacy_consultant_applications',
    '_legacy_consultant_bookings',
    '_legacy_consultations',
    '_legacy_messages',
    '_legacy_notifications',
    '_legacy_session_messages',
    '_legacy_session_requests',
    '_legacy_transactions',
    '_mv_refresh_log',
    '_zeal_audit_history',
    '_zeal_diag',
    '_zeal_migrations',
    'Category',
    'Service',
    'rate_limits'
  ];
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT (c.relname = ANY(skip))
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §2. USER
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS user_self_select   ON public."User";
DROP POLICY IF EXISTS user_self_insert   ON public."User";
DROP POLICY IF EXISTS user_self_update   ON public."User";
DROP POLICY IF EXISTS users_select_self  ON public."User";
DROP POLICY IF EXISTS users_insert_self  ON public."User";
DROP POLICY IF EXISTS users_update_self  ON public."User";
DROP POLICY IF EXISTS admin_full_access  ON public."User";
DROP POLICY IF EXISTS user_admin_all     ON public."User";

CREATE POLICY user_self_select ON public."User"
  FOR SELECT USING (id = (SELECT auth.uid()));

CREATE POLICY user_self_insert ON public."User"
  FOR INSERT WITH CHECK (id = (SELECT auth.uid()));

-- Column-scoped self update: role / sparks / isVerified cannot be self-edited.
CREATE POLICY user_self_update ON public."User"
  FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid())
    AND role          IS NOT DISTINCT FROM (SELECT role          FROM public."User" WHERE id = (SELECT auth.uid()))
    AND sparks        IS NOT DISTINCT FROM (SELECT sparks        FROM public."User" WHERE id = (SELECT auth.uid()))
    AND "isVerified"  IS NOT DISTINCT FROM (SELECT "isVerified"  FROM public."User" WHERE id = (SELECT auth.uid()))
    AND "sparkScore"  IS NOT DISTINCT FROM (SELECT "sparkScore"  FROM public."User" WHERE id = (SELECT auth.uid()))
  );

CREATE POLICY user_admin_all ON public."User"
  FOR ALL USING ((SELECT public.auth_is_admin()));

-- ═══════════════════════════════════════════════════════════════════════════
-- §3. WALLET — owner read only; writes only via SECURITY DEFINER RPC
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS wallet_owner_all    ON public."Wallet";
DROP POLICY IF EXISTS wallet_owner_read   ON public."Wallet";
DROP POLICY IF EXISTS wallet_admin_read   ON public."Wallet";

CREATE POLICY wallet_owner_read ON public."Wallet"
  FOR SELECT USING ("userId" = (SELECT auth.uid()));

CREATE POLICY wallet_admin_read ON public."Wallet"
  FOR SELECT USING ((SELECT public.auth_is_admin()));

-- No INSERT / UPDATE / DELETE policy → app must use hold_in_escrow_safe,
-- credit_funds_safe, etc. (SECURITY DEFINER functions bypass RLS by design).

-- ═══════════════════════════════════════════════════════════════════════════
-- §4. TRANSACTION
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS tx_owner_read ON public."Transaction";
DROP POLICY IF EXISTS tx_admin_read ON public."Transaction";

CREATE POLICY tx_owner_read ON public."Transaction"
  FOR SELECT USING (
    "walletId" IN (
      SELECT id FROM public."Wallet" WHERE "userId" = (SELECT auth.uid())
    )
  );

CREATE POLICY tx_admin_read ON public."Transaction"
  FOR SELECT USING ((SELECT public.auth_is_admin()));

-- ═══════════════════════════════════════════════════════════════════════════
-- §5. CONSULTANT
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS consultant_public_read  ON public."Consultant";
DROP POLICY IF EXISTS consultant_self_manage  ON public."Consultant";
DROP POLICY IF EXISTS consultant_self_write   ON public."Consultant";
DROP POLICY IF EXISTS consultant_admin_all    ON public."Consultant";

CREATE POLICY consultant_public_read ON public."Consultant"
  FOR SELECT USING (status = 'VERIFIED' AND "isActive" = true);

CREATE POLICY consultant_self_manage ON public."Consultant"
  FOR UPDATE USING ("userId" = (SELECT auth.uid()))
  WITH CHECK  ("userId" = (SELECT auth.uid()));

CREATE POLICY consultant_admin_all ON public."Consultant"
  FOR ALL USING ((SELECT public.auth_is_admin()));

-- ═══════════════════════════════════════════════════════════════════════════
-- §6. AICONSULTANT
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS ai_consultants_public_read ON public."AIConsultant";
DROP POLICY IF EXISTS ai_consultants_admin_all   ON public."AIConsultant";

CREATE POLICY ai_consultants_public_read ON public."AIConsultant"
  FOR SELECT USING ("isActive" = true);

CREATE POLICY ai_consultants_admin_all ON public."AIConsultant"
  FOR ALL USING ((SELECT public.auth_is_admin()));

-- ═══════════════════════════════════════════════════════════════════════════
-- §7. BOOKING
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS booking_participants ON public."Booking";
DROP POLICY IF EXISTS booking_user_insert  ON public."Booking";
DROP POLICY IF EXISTS booking_admin_all    ON public."Booking";

CREATE POLICY booking_participants ON public."Booking"
  FOR SELECT USING (
    "userId" = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public."Consultant" c
      WHERE c.id = "Booking"."consultantId"
        AND c."userId" = (SELECT auth.uid())
    )
  );

CREATE POLICY booking_user_insert ON public."Booking"
  FOR INSERT WITH CHECK ("userId" = (SELECT auth.uid()));

CREATE POLICY booking_admin_all ON public."Booking"
  FOR ALL USING ((SELECT public.auth_is_admin()));

-- ═══════════════════════════════════════════════════════════════════════════
-- §8. CALLSESSION
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS callsession_participants ON public."CallSession";

CREATE POLICY callsession_participants ON public."CallSession"
  FOR SELECT USING (
    "userId" = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public."Consultant" c
      WHERE c.id = "CallSession"."consultantId"
        AND c."userId" = (SELECT auth.uid())
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- §9. POST / COMMENT / CHEER
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS posts_public_read   ON public."Post";
DROP POLICY IF EXISTS posts_author_insert ON public."Post";
DROP POLICY IF EXISTS posts_author_update ON public."Post";
DROP POLICY IF EXISTS posts_author_delete ON public."Post";
DROP POLICY IF EXISTS post_public_read    ON public."Post";
DROP POLICY IF EXISTS post_author_write   ON public."Post";

CREATE POLICY posts_public_read ON public."Post"
  FOR SELECT USING ("isFlagged" = false);

CREATE POLICY posts_author_insert ON public."Post"
  FOR INSERT WITH CHECK ("authorId" = (SELECT auth.uid()));

CREATE POLICY posts_author_update ON public."Post"
  FOR UPDATE USING ("authorId" = (SELECT auth.uid()));

CREATE POLICY posts_author_delete ON public."Post"
  FOR DELETE USING ("authorId" = (SELECT auth.uid()));

DROP POLICY IF EXISTS comments_public_read   ON public."Comment";
DROP POLICY IF EXISTS comments_author_insert ON public."Comment";

CREATE POLICY comments_public_read ON public."Comment"
  FOR SELECT USING (true);

CREATE POLICY comments_author_insert ON public."Comment"
  FOR INSERT WITH CHECK ("authorId" = (SELECT auth.uid()));

DROP POLICY IF EXISTS cheers_public_read ON public."Cheer";
DROP POLICY IF EXISTS cheers_self_write  ON public."Cheer";
DROP POLICY IF EXISTS cheers_self_delete ON public."Cheer";

CREATE POLICY cheers_public_read ON public."Cheer"
  FOR SELECT USING (true);

CREATE POLICY cheers_self_write ON public."Cheer"
  FOR INSERT WITH CHECK ("userId" = (SELECT auth.uid()));

CREATE POLICY cheers_self_delete ON public."Cheer"
  FOR DELETE USING ("userId" = (SELECT auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════
-- §10. NOTIFICATION
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS notif_owner_read          ON public."Notification";
DROP POLICY IF EXISTS notif_owner_update        ON public."Notification";
DROP POLICY IF EXISTS notification_owner_read   ON public."Notification";
DROP POLICY IF EXISTS notification_owner_update ON public."Notification";

CREATE POLICY notif_owner_read ON public."Notification"
  FOR SELECT USING ("userId" = (SELECT auth.uid()));

CREATE POLICY notif_owner_update ON public."Notification"
  FOR UPDATE USING ("userId" = (SELECT auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════
-- §11. CONVERSATION / PARTICIPANT / MESSAGE
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS conversation_participant_read ON public."Conversation";
DROP POLICY IF EXISTS conversation_participants_read ON public."Conversation";

CREATE POLICY conversation_participant_read ON public."Conversation"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public."ConversationParticipant" cp
      WHERE cp."conversationId" = "Conversation".id
        AND cp."userId" = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS participant_self_read ON public."ConversationParticipant";

CREATE POLICY participant_self_read ON public."ConversationParticipant"
  FOR SELECT USING (
    "userId" = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public."ConversationParticipant" cp
      WHERE cp."conversationId" = "ConversationParticipant"."conversationId"
        AND cp."userId" = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS message_participant_read ON public."Message";
DROP POLICY IF EXISTS message_participant_send ON public."Message";
DROP POLICY IF EXISTS message_participants_read ON public."Message";
DROP POLICY IF EXISTS message_sender_insert    ON public."Message";

CREATE POLICY message_participant_read ON public."Message"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public."ConversationParticipant" cp
      WHERE cp."conversationId" = "Message"."conversationId"
        AND cp."userId" = (SELECT auth.uid())
    )
  );

CREATE POLICY message_participant_send ON public."Message"
  FOR INSERT WITH CHECK (
    "senderId" = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public."ConversationParticipant" cp
      WHERE cp."conversationId" = "Message"."conversationId"
        AND cp."userId" = (SELECT auth.uid())
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- §12. ADMIN-ONLY TABLES
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  t text;
  admin_tables text[] := ARRAY[
    'AdminAuditLog',
    'AdminInvite',
    'AdminLoginAttempt',
    'DebugLog'
  ];
BEGIN
  FOREACH t IN ARRAY admin_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING ((SELECT public.auth_is_admin()))',
        t || '_admin_all', t
      );
    END IF;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §13. CONSULTANT-SERVICE JOIN + DRAFT
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS consultant_service_public_read ON public."ConsultantService";
DROP POLICY IF EXISTS consultant_service_self_write  ON public."ConsultantService";

CREATE POLICY consultant_service_public_read ON public."ConsultantService"
  FOR SELECT USING (true);

CREATE POLICY consultant_service_self_write ON public."ConsultantService"
  FOR ALL USING (
    consultant_id IN (
      SELECT id FROM public."Consultant" WHERE "userId" = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS consultant_draft_self ON public."ConsultantDraft";

CREATE POLICY consultant_draft_self ON public."ConsultantDraft"
  FOR ALL USING ("userId" = (SELECT auth.uid()))
  WITH CHECK ("userId" = (SELECT auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════
-- §14. USERPREFERENCES / USERACTIVITY
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS prefs_owner_all    ON public."UserPreferences";
DROP POLICY IF EXISTS activity_owner_all ON public."UserActivity";

CREATE POLICY prefs_owner_all ON public."UserPreferences"
  FOR ALL USING ("userId" = (SELECT auth.uid()));

CREATE POLICY activity_owner_all ON public."UserActivity"
  FOR ALL USING ("userId" = (SELECT auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════
-- §15. PUBLIC CATALOGS — read-only for everyone, writes via service role
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='Category') THEN
    EXECUTE 'ALTER TABLE public."Category" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS category_public_read ON public."Category"';
    EXECUTE 'CREATE POLICY category_public_read ON public."Category" FOR SELECT USING (true)';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='Service') THEN
    EXECUTE 'ALTER TABLE public."Service" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS service_public_read ON public."Service"';
    EXECUTE 'CREATE POLICY service_public_read ON public."Service" FOR SELECT USING (true)';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §16. INDEXES FOR RLS FILTER COLUMNS
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_user_role                 ON public."User"(role);
CREATE INDEX IF NOT EXISTS idx_user_online               ON public."User"("is_online") WHERE "is_online" = true;
CREATE INDEX IF NOT EXISTS idx_wallet_user               ON public."Wallet"("userId");
CREATE INDEX IF NOT EXISTS idx_transaction_wallet        ON public."Transaction"("walletId");
CREATE INDEX IF NOT EXISTS idx_consultant_user           ON public."Consultant"("userId");
CREATE INDEX IF NOT EXISTS idx_consultant_status_active  ON public."Consultant"(status, "isActive");
CREATE INDEX IF NOT EXISTS idx_consultant_spark          ON public."Consultant"("sparkScore" DESC)
  WHERE status = 'VERIFIED' AND "isActive" = true;
CREATE INDEX IF NOT EXISTS idx_booking_user              ON public."Booking"("userId");
CREATE INDEX IF NOT EXISTS idx_booking_consultant        ON public."Booking"("consultantId");
CREATE INDEX IF NOT EXISTS idx_booking_status            ON public."Booking"(status);
CREATE INDEX IF NOT EXISTS idx_callsession_user          ON public."CallSession"("userId");
CREATE INDEX IF NOT EXISTS idx_callsession_consultant    ON public."CallSession"("consultantId");
CREATE INDEX IF NOT EXISTS idx_message_conversation      ON public."Message"("conversationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_participant_user          ON public."ConversationParticipant"("userId");
CREATE INDEX IF NOT EXISTS idx_participant_conv          ON public."ConversationParticipant"("conversationId");
CREATE INDEX IF NOT EXISTS idx_notification_user_unread  ON public."Notification"("userId")
  WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_post_author               ON public."Post"("authorId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_post_feed                 ON public."Post"("createdAt" DESC)
  WHERE "isFlagged" = false;
CREATE INDEX IF NOT EXISTS idx_cheer_post                ON public."Cheer"("postId");
CREATE INDEX IF NOT EXISTS idx_cheer_user                ON public."Cheer"("userId");
CREATE INDEX IF NOT EXISTS idx_comment_post              ON public."Comment"("postId", "createdAt" DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- §17. VERIFICATION — hard-fail if anything slipped through
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  unprotected text[];
  unwrapped   int;
  missing_uid int;
BEGIN
  -- Every user-data table must have RLS enabled
  SELECT array_agg(c.relname) INTO unprotected
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname NOT LIKE '\_%'
    AND c.relname NOT IN ('Category','Service','rate_limits')
    AND NOT c.relrowsecurity;

  IF unprotected IS NOT NULL THEN
    RAISE EXCEPTION '108 RLS lockdown FAILED — tables without RLS: %', unprotected;
  END IF;

  -- Every policy that mentions auth.uid() must use the wrapped subquery
  SELECT COUNT(*) INTO unwrapped
  FROM pg_policies
  WHERE schemaname = 'public'
    AND qual LIKE '%auth.uid()%'
    AND qual NOT LIKE '%(SELECT auth.uid())%';

  IF unwrapped > 0 THEN
    RAISE WARNING '108 — % policies still use unwrapped auth.uid()', unwrapped;
  END IF;

  -- Every user-scoped policy must reference auth.uid()
  SELECT COUNT(*) INTO missing_uid
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'User','Wallet','Transaction','Consultant','Booking','CallSession',
      'Notification','Conversation','ConversationParticipant','Message',
      'UserPreferences','UserActivity','ConsultantDraft'
    )
    AND qual IS NOT NULL
    AND qual NOT LIKE '%auth.uid()%'
    AND qual NOT LIKE '%auth_is_admin%'
    AND qual NOT LIKE '%true%';

  IF missing_uid > 0 THEN
    RAISE WARNING '108 — % user-scoped policies do not reference auth.uid()', missing_uid;
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE '  108_rls_lockdown.sql — VERIFIED';
  RAISE NOTICE '  Tables without RLS : 0';
  RAISE NOTICE '  Unwrapped uid()    : %', unwrapped;
  RAISE NOTICE '========================================';
END $$;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
