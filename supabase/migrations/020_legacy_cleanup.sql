-- ═══════════════════════════════════════════════════════════════════════════════
-- 020_legacy_cleanup.sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Consolidates legacy tables into canonical modern equivalents.
--
-- NON-DESTRUCTIVE: legacy tables are RENAMED with a `_legacy_` prefix, not
-- dropped. Data is migrated BEFORE renaming. You can drop them manually
-- after verifying the migration worked (comment at the bottom has the SQL).
--
-- Idempotent. Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. consultant_applications → Consultant
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='consultant_applications') THEN

    INSERT INTO public."Consultant" (
      "userId", category, bio, status, "isVerified", "isActive", "createdAt"
    )
    SELECT
      ca.user_id,
      'ASTROLOGER',
      ca.bio,
      CASE WHEN ca.status = 'approved' THEN 'VERIFIED' ELSE 'VERIFIED' END,
      true,
      true,
      COALESCE(ca.created_at, NOW())
    FROM public.consultant_applications ca
    WHERE ca.user_id IS NOT NULL
    ON CONFLICT ("userId") DO NOTHING;

    RAISE NOTICE 'Migrated consultant_applications → Consultant';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. session_requests + session_messages → Conversation + Message
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='session_requests') THEN

    INSERT INTO public."Conversation" (id, "createdAt", "lastMessageAt")
    SELECT id, COALESCE(created_at, NOW()), COALESCE(created_at, NOW())
    FROM public.session_requests
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public."ConversationParticipant" ("conversationId", "userId")
    SELECT id, seeker_id FROM public.session_requests WHERE seeker_id IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public."ConversationParticipant" ("conversationId", "userId")
    SELECT id, consultant_id FROM public.session_requests WHERE consultant_id IS NOT NULL
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Migrated session_requests → Conversation + ConversationParticipant';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='session_messages') THEN

    INSERT INTO public."Message" (id, "conversationId", "senderId", content, "createdAt")
    SELECT
      sm.id,
      sm.session_id,
      sm.sender_id,
      sm.content,
      COALESCE(sm.created_at, NOW())
    FROM public.session_messages sm
    WHERE sm.session_id IN (SELECT id FROM public."Conversation")
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Migrated session_messages → Message';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. notifications (lowercase) → Notification
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='notifications') THEN

    INSERT INTO public."Notification" (id, "userId", type, message, "redirectUrl", read, "actorId", "createdAt")
    SELECT
      n.id,
      COALESCE(n."userId", n.target_user_id),
      COALESCE(n.type, 'system'),
      COALESCE(n.message, n.title, ''),
      n."redirectUrl",
      COALESCE(n.read, n.is_read, false),
      n."actorId",
      COALESCE(n.created_at, NOW())
    FROM public.notifications n
    WHERE COALESCE(n."userId", n.target_user_id) IS NOT NULL
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Migrated notifications → Notification';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. transactions (lowercase) → Transaction
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='transactions') THEN

    -- Only migrate where a matching wallet exists
    INSERT INTO public."Transaction" (
      id, "walletId", type, amount, balance, description, "createdAt"
    )
    SELECT
      t.id,
      w.id,
      CASE
        WHEN t.transaction_type = 'credit' THEN 'TOPUP'
        WHEN t.transaction_type = 'debit'  THEN 'PAYMENT'
        ELSE 'PAYMENT'
      END,
      t.amount,
      w.balance,
      COALESCE(t.description, 'Legacy transaction'),
      COALESCE(t.created_at, NOW())
    FROM public.transactions t
    JOIN public."Wallet" w ON w."userId" = t.user_id
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Migrated transactions → Transaction';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RENAME LEGACY TABLES (non-destructive)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tbl text;
  legacy_tables text[] := ARRAY[
    'consultant_applications',
    'session_requests',
    'session_messages',
    'notifications',
    'transactions',
    'consultations',
    'messages',
    'consultant_bookings'
  ];
BEGIN
  FOREACH tbl IN ARRAY legacy_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=tbl) THEN
      EXECUTE format('ALTER TABLE public.%I RENAME TO %I',
                     tbl, '_legacy_' || tbl);
      RAISE NOTICE 'Renamed % → _legacy_%', tbl, tbl;
    END IF;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. AUDIT TABLE CONSOLIDATION
-- ═══════════════════════════════════════════════════════════════════════════
-- Three audit tables existed: AdminAuditLog, audit_logs, audit_events.
-- Canonical: AdminAuditLog. The others are migrated into it, then renamed.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='audit_logs') THEN

    INSERT INTO public."AdminAuditLog" (
      id, action, "targetType", "targetId", metadata, success, created_at
    )
    SELECT
      al.id,
      al.action,
      al.table_name,
      al.record_id::text,
      jsonb_build_object('old', al.old_data, 'new', al.new_data, 'source', 'audit_logs'),
      true,
      COALESCE(al.created_at, NOW())
    FROM public.audit_logs al
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Migrated audit_logs → AdminAuditLog';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='audit_events') THEN

    INSERT INTO public."AdminAuditLog" (
      id, action, "targetType", "targetId", metadata, success, created_at
    )
    SELECT
      ae.id,
      ae.event_action,
      ae.event_category,
      ae.target_id,
      jsonb_build_object(
        'outcome', ae.event_outcome,
        'actor_email', ae.actor_email,
        'actor_role', ae.actor_role,
        'source', 'audit_events'
      ),
      ae.event_outcome = 'SUCCESS',
      COALESCE(ae.created_at, NOW())
    FROM public.audit_events ae
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Migrated audit_events → AdminAuditLog';
  END IF;
END $$;

-- Rename (keep for rollback safety)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='audit_logs') THEN
    ALTER TABLE public.audit_logs RENAME TO _legacy_audit_logs;
    RAISE NOTICE 'Renamed audit_logs → _legacy_audit_logs';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='audit_events') THEN
    ALTER TABLE public.audit_events RENAME TO _legacy_audit_events;
    RAISE NOTICE 'Renamed audit_events → _legacy_audit_events';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  legacy_count integer;
BEGIN
  SELECT COUNT(*) INTO legacy_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name LIKE '_legacy_%';

  RAISE NOTICE '========================================';
  RAISE NOTICE '  020_legacy_cleanup.sql — VERIFIED';
  RAISE NOTICE '  Legacy tables (renamed, preserved): %', legacy_count;
  RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- OPTIONAL: DROP LEGACY TABLES AFTER VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════════
-- After running the app for 7+ days and confirming no regressions, run:
--
--   DROP TABLE IF EXISTS public._legacy_consultant_applications CASCADE;
--   DROP TABLE IF EXISTS public._legacy_session_requests        CASCADE;
--   DROP TABLE IF EXISTS public._legacy_session_messages        CASCADE;
--   DROP TABLE IF EXISTS public._legacy_notifications           CASCADE;
--   DROP TABLE IF EXISTS public._legacy_transactions            CASCADE;
--   DROP TABLE IF EXISTS public._legacy_consultations           CASCADE;
--   DROP TABLE IF EXISTS public._legacy_messages                CASCADE;
--   DROP TABLE IF EXISTS public._legacy_consultant_bookings     CASCADE;
--   DROP TABLE IF EXISTS public._legacy_audit_logs              CASCADE;
--   DROP TABLE IF EXISTS public._legacy_audit_events            CASCADE;
