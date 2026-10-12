#!/usr/bin/env python3
"""Generate the consolidated idempotent migration file."""
import os

path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                    '0000_consolidated_idempotent.sql')

sections = []

# =========================================================================
# HEADER
# =========================================================================
sections.append("""\
-- ============================================================================
-- 0000_consolidated_idempotent.sql - ZEAL platform
-- ============================================================================
-- Single, idempotent, production-quality consolidation of all 67 migrations.
-- Safe to paste into Supabase SQL Editor and run multiple times.
--
-- SECURITY FIX: credit_funds_safe revoked from anon, granted only to authenticated
-- SIGNATURE RESOLUTION: process_per_minute_deduction - 5-arg canonical version only
-- ============================================================================

BEGIN;
SET LOCAL statement_timeout = '10min';
""")

# =========================================================================
# SECTION 1 - EXTENSIONS
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 1 - EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
""")

# =========================================================================
# SECTION 2 - ENUM TYPES
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 2 - ENUM TYPES
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AppRole') THEN
    CREATE TYPE "AppRole" AS ENUM (
      'USER', 'CLIENT_ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'VIEWER', 'AI'
    );
  END IF;
END $$;
""")

# =========================================================================
# SECTION 3 - TABLES
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 3 - TABLES (all IF NOT EXISTS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public."User" (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE,
  username      TEXT UNIQUE,
  name          TEXT,
  full_name     TEXT,
  avatar        TEXT,
  avatar_url    TEXT,
  bio           TEXT,
  role          "AppRole" NOT NULL DEFAULT 'USER',
  "isVerified"  BOOLEAN NOT NULL DEFAULT false,
  is_online     BOOLEAN NOT NULL DEFAULT false,
  "lastSeenAt"  TIMESTAMPTZ,
  sparks        INTEGER NOT NULL DEFAULT 0,
  "sparkScore"  INTEGER NOT NULL DEFAULT 0,
  website       TEXT,
  location      TEXT,
  post_count    INTEGER NOT NULL DEFAULT 0,
  profile_completeness INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Wallet" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    UUID NOT NULL UNIQUE REFERENCES public."User"(id) ON DELETE CASCADE,
  balance     DOUBLE PRECISION NOT NULL DEFAULT 0,
  escrow      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pendingIn"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pendingOut" DOUBLE PRECISION NOT NULL DEFAULT 0,
  blocked     BOOLEAN NOT NULL DEFAULT false,
  version     INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Consultant" (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"           UUID NOT NULL UNIQUE REFERENCES public."User"(id) ON DELETE CASCADE,
  category           TEXT,
  "perMinuteRate"    DOUBLE PRECISION DEFAULT 0,
  "chatRate"         DOUBLE PRECISION DEFAULT 50,
  "audioRate"        DOUBLE PRECISION DEFAULT 75,
  "videoRate"        DOUBLE PRECISION DEFAULT 100,
  "physicalRate"     DOUBLE PRECISION DEFAULT 150,
  rating             DOUBLE PRECISION DEFAULT 0,
  "sparkScore"       INTEGER DEFAULT 0,
  "isVerified"       BOOLEAN DEFAULT false,
  "isActive"         BOOLEAN DEFAULT true,
  status             TEXT DEFAULT 'PENDING',
  subdomain          TEXT UNIQUE,
  "subdomainActive"  BOOLEAN DEFAULT false,
  specialties        TEXT[] DEFAULT '{}',
  languages          TEXT[] DEFAULT '{}',
  bio                TEXT,
  "totalConsultations" INTEGER DEFAULT 0,
  earnings           DOUBLE PRECISION DEFAULT 0,
  "searchVector"     TSVECTOR,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Booking" (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"           UUID NOT NULL REFERENCES public."User"(id),
  "consultantId"     UUID REFERENCES public."Consultant"(id),
  status             TEXT NOT NULL DEFAULT 'PENDING',
  amount             DOUBLE PRECISION NOT NULL DEFAULT 0,
  "platformFee"      NUMERIC,
  "consultantEarning" NUMERIC,
  "platformFeeRate"  NUMERIC(5,4) DEFAULT 0.10,
  "serviceType"      TEXT DEFAULT 'chat' CHECK ("serviceType" IN ('chat','audio','video','physical')),
  "meetingLink"      TEXT,
  "razorpayOrderId"  TEXT,
  "razorpayPaymentId" TEXT,
  "paymentStatus"    TEXT DEFAULT 'pending',
  "cancellationReason" TEXT,
  "cancelledBy"      UUID,
  "noShow"           BOOLEAN DEFAULT false,
  timezone           TEXT DEFAULT 'Asia/Kolkata',
  "startTime"        TIMESTAMPTZ,
  "endTime"          TIMESTAMPTZ,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Conversation" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "isGroup"   BOOLEAN NOT NULL DEFAULT false,
  title       TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ConversationParticipant" (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversationId" UUID NOT NULL REFERENCES public."Conversation"(id) ON DELETE CASCADE,
  "userId"         UUID NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  role             TEXT DEFAULT 'member',
  "joinedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("conversationId", "userId")
);

CREATE TABLE IF NOT EXISTS public."Message" (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversationId" UUID NOT NULL REFERENCES public."Conversation"(id) ON DELETE CASCADE,
  "senderId"       UUID REFERENCES public."User"(id) ON DELETE SET NULL,
  content          TEXT NOT NULL DEFAULT '',
  type             TEXT DEFAULT 'text',
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Post" (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "authorId"     UUID NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  content        TEXT NOT NULL DEFAULT '',
  media          TEXT,
  "cheerCount"   INTEGER NOT NULL DEFAULT 0,
  "commentCount" INTEGER NOT NULL DEFAULT 0,
  "isArchived"   BOOLEAN NOT NULL DEFAULT false,
  "mediaType"    TEXT DEFAULT 'image',
  "locationTag"  TEXT,
  "deletedAt"    TIMESTAMPTZ,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Comment" (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "postId"   UUID NOT NULL REFERENCES public."Post"(id) ON DELETE CASCADE,
  "authorId" UUID NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  content    TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Cheer" (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "postId"   UUID NOT NULL REFERENCES public."Post"(id) ON DELETE CASCADE,
  "userId"   UUID NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("postId", "userId")
);

CREATE TABLE IF NOT EXISTS public."Notification" (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"       UUID NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  type           TEXT NOT NULL DEFAULT 'general',
  message        TEXT NOT NULL DEFAULT '',
  "redirectUrl"  TEXT,
  "actorId"      UUID,
  "isRead"       BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."AdminAuditLog" (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action       TEXT,
  action_name  TEXT,
  actor_id     TEXT,
  "userId"     TEXT,
  "targetId"   TEXT,
  details      JSONB,
  metadata     JSONB,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."CallSession" (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"         UUID NOT NULL REFERENCES public."User"(id),
  "consultantId"   UUID,
  "aiConsultantId" TEXT,
  "isAI"           BOOLEAN DEFAULT false,
  "conversationId" UUID,
  status           TEXT NOT NULL DEFAULT 'INITIATED',
  amount           DOUBLE PRECISION DEFAULT 0,
  "durationSeconds" INTEGER DEFAULT 0,
  "startTime"      TIMESTAMPTZ,
  "endTime"        TEXT,
  "lockedRate"     DOUBLE PRECISION,
  "lastHeartbeatAt" TIMESTAMPTZ,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."AIConsultant" (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  username            TEXT,
  avatar              TEXT,
  category            TEXT,
  "perMinuteRate"     DOUBLE PRECISION DEFAULT 0,
  "isPaid"            BOOLEAN DEFAULT false,
  rating              DOUBLE PRECISION DEFAULT 5,
  sparks              INTEGER DEFAULT 0,
  "isActive"          BOOLEAN DEFAULT true,
  specialties         TEXT[] DEFAULT '{}',
  languages           TEXT[] DEFAULT '{}',
  bio                 TEXT,
  "totalConsultations" INTEGER DEFAULT 0,
  "safetyLevel"       TEXT DEFAULT 'STANDARD',
  "bannedPatterns"    TEXT[] DEFAULT '{}',
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Transaction" (
  id            TEXT PRIMARY KEY,
  "walletId"    UUID NOT NULL REFERENCES public."Wallet"(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  amount        DOUBLE PRECISION NOT NULL DEFAULT 0,
  balance       DOUBLE PRECISION NOT NULL DEFAULT 0,
  description   TEXT,
  "referenceId" TEXT UNIQUE,
  metadata      JSONB,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."UserActivity" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"        UUID NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  "consultantId"  TEXT,
  type            TEXT NOT NULL,
  metadata        JSONB,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Category" (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  icon        TEXT,
  description TEXT,
  "sortOrder" INTEGER DEFAULT 0,
  "isActive"  BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Service" (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  "category_id" TEXT NOT NULL REFERENCES public."Category"(id),
  description   TEXT,
  "defaultRate" DOUBLE PRECISION,
  "sortOrder"   INTEGER DEFAULT 0,
  "isActive"    BOOLEAN DEFAULT true,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ConsultantService" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id   UUID NOT NULL REFERENCES public."Consultant"(id) ON DELETE CASCADE,
  service_id      TEXT NOT NULL REFERENCES public."Service"(id),
  "customRate"    DOUBLE PRECISION,
  "isActive"      BOOLEAN DEFAULT true,
  UNIQUE (consultant_id, service_id)
);

CREATE TABLE IF NOT EXISTS public."ConsultantDraft" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    UUID NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  data        JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."AdminAPIKey" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "keyHash"   TEXT NOT NULL,
  name        TEXT NOT NULL,
  "createdBy" UUID REFERENCES public."User"(id),
  "expiresAt" TIMESTAMPTZ,
  "lastUsedAt" TIMESTAMPTZ,
  "isActive"  BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ContentReport" (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reporterId"  UUID NOT NULL REFERENCES public."User"(id),
  "contentType" TEXT NOT NULL,
  "contentId"   UUID NOT NULL,
  reason        TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  "reviewedBy"  UUID,
  "reviewedAt"  TIMESTAMPTZ,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."BillingDiscrepancy" (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL,
  "sessionId"   UUID,
  "walletId"    UUID,
  expected      DOUBLE PRECISION,
  actual        DOUBLE PRECISION,
  difference    DOUBLE PRECISION,
  status        TEXT NOT NULL DEFAULT 'open',
  "autoCorrected" BOOLEAN DEFAULT false,
  notes         TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "resolvedAt"  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public."JobQueue" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'pending',
  attempts    INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "lockedAt"  TIMESTAMPTZ,
  "lockedBy"  TEXT,
  "scheduledAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completedAt" TIMESTAMPTZ,
  "failedAt"  TIMESTAMPTZ,
  error       TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."LedgerEntry" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "walletId"  UUID NOT NULL REFERENCES public."Wallet"(id),
  type        TEXT NOT NULL,
  amount      DOUBLE PRECISION NOT NULL,
  "balanceAfter" DOUBLE PRECISION NOT NULL,
  reference   TEXT,
  metadata    JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."AIChatSession" (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"         UUID NOT NULL REFERENCES public."User"(id),
  "aiConsultantId" TEXT NOT NULL,
  "startedAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "endedAt"        TIMESTAMPTZ,
  "messageCount"   INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS public."AIChatRateLimit" (
  "userId"     UUID NOT NULL,
  "aiId"       UUID NOT NULL,
  "windowStart" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "messageCount" INT NOT NULL DEFAULT 0,
  CONSTRAINT "AIChatRateLimit_pkey" PRIMARY KEY ("userId", "aiId")
);

CREATE TABLE IF NOT EXISTS public."BirthProfile" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"        UUID NOT NULL UNIQUE REFERENCES public."User"(id) ON DELETE CASCADE,
  "fullName"      TEXT NOT NULL DEFAULT '',
  "dateOfBirth"   DATE,
  "timeOfBirth"   TIME,
  "placeOfBirth"  TEXT NOT NULL DEFAULT '',
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  gender          TEXT CHECK (gender IN ('male','female','non-binary','other','prefer-not')),
  "primaryConcern" TEXT NOT NULL DEFAULT '',
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."RazorpayPayment" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId"   TEXT NOT NULL UNIQUE,
  "paymentId" TEXT UNIQUE,
  "signature" TEXT,
  amount      INTEGER NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'INR',
  status      TEXT NOT NULL DEFAULT 'created'
                CHECK (status IN ('created','authorized','captured','failed','refunded')),
  "userId"    UUID NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  purpose     TEXT NOT NULL CHECK (purpose IN ('wallet_topup','booking_payment','session_prepay')),
  "referenceId" TEXT,
  metadata    JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."RazorpayWebhookEvent" (
  id          TEXT PRIMARY KEY,
  event       TEXT NOT NULL,
  payload     JSONB NOT NULL,
  processed   BOOLEAN NOT NULL DEFAULT false,
  "processedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."BillingHeartbeat" (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId"    UUID NOT NULL REFERENCES public."CallSession"(id) ON DELETE CASCADE,
  "minuteKey"    TEXT NOT NULL,
  amount         DOUBLE PRECISION NOT NULL,
  "balanceAfter" DOUBLE PRECISION NOT NULL,
  "escrowAfter"  DOUBLE PRECISION NOT NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("sessionId", "minuteKey")
);

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL,
  "windowStart" TIMESTAMPTZ NOT NULL DEFAULT now(),
  count       INTEGER NOT NULL DEFAULT 0,
  "maxCount"  INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
""")

# =========================================================================
# SECTION 4 - GENERATED COLUMN
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 4 - GENERATED COLUMN: Consultant.searchVector
-- ============================================================================
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
  END IF;
END $$;
""")

# =========================================================================
# SECTION 5 - INDEXES
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 5 - INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_wallet_user        ON public."Wallet"("userId");
CREATE INDEX IF NOT EXISTS idx_consultant_user     ON public."Consultant"("userId");
CREATE INDEX IF NOT EXISTS idx_consultant_status   ON public."Consultant"(status, "isActive");
CREATE INDEX IF NOT EXISTS idx_consultant_category ON public."Consultant"(category) WHERE "isActive" = true;
CREATE INDEX IF NOT EXISTS idx_consultant_search_vec ON public."Consultant" USING GIN("searchVector");
CREATE INDEX IF NOT EXISTS idx_booking_user        ON public."Booking"("userId");
CREATE INDEX IF NOT EXISTS idx_booking_consultant  ON public."Booking"("consultantId");
CREATE INDEX IF NOT EXISTS idx_booking_status      ON public."Booking"(status);
CREATE INDEX IF NOT EXISTS idx_booking_rzp_order   ON public."Booking"("razorpayOrderId") WHERE "razorpayOrderId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_rzp_payment ON public."Booking"("razorpayPaymentId") WHERE "razorpayPaymentId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_payment_status ON public."Booking"("paymentStatus");
CREATE INDEX IF NOT EXISTS idx_convpart_conv       ON public."ConversationParticipant"("conversationId");
CREATE INDEX IF NOT EXISTS idx_convpart_user       ON public."ConversationParticipant"("userId");
CREATE INDEX IF NOT EXISTS idx_message_conv        ON public."Message"("conversationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_post_author         ON public."Post"("authorId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_post_author_active  ON public."Post"("authorId") WHERE "isArchived" = false;
CREATE INDEX IF NOT EXISTS idx_post_author_created_active ON public."Post"("authorId", "createdAt" DESC) WHERE "isArchived" = false;
CREATE INDEX IF NOT EXISTS idx_comment_post        ON public."Comment"("postId");
CREATE INDEX IF NOT EXISTS idx_cheer_post          ON public."Cheer"("postId");
CREATE INDEX IF NOT EXISTS idx_notification_user   ON public."Notification"("userId", "isRead", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_callsession_user    ON public."CallSession"("userId");
CREATE INDEX IF NOT EXISTS idx_callsession_conv    ON public."CallSession"("conversationId");
CREATE INDEX IF NOT EXISTS idx_callsession_active  ON public."CallSession"(status, "lastHeartbeatAt") WHERE status = 'CONNECTED';
CREATE INDEX IF NOT EXISTS idx_txn_wallet          ON public."Transaction"("walletId");
CREATE INDEX IF NOT EXISTS idx_txn_reference       ON public."Transaction"("referenceId") WHERE "referenceId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_useractivity_user   ON public."UserActivity"("userId");
CREATE INDEX IF NOT EXISTS idx_useractivity_consultant ON public."UserActivity"("consultantId");
CREATE INDEX IF NOT EXISTS idx_adminaudit_action   ON public."AdminAuditLog"(action_name);
CREATE INDEX IF NOT EXISTS idx_adminaudit_created  ON public."AdminAuditLog"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_birthprofile_user   ON public."BirthProfile"("userId");
CREATE INDEX IF NOT EXISTS idx_rzp_user            ON public."RazorpayPayment"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_rzp_status          ON public."RazorpayPayment"(status);
CREATE INDEX IF NOT EXISTS idx_rzp_ref             ON public."RazorpayPayment"("referenceId") WHERE "referenceId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rzp_wh_processed    ON public."RazorpayWebhookEvent"(processed, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_bh_session          ON public."BillingHeartbeat"("sessionId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_jobqueue_status     ON public."JobQueue"(status, "scheduledAt") WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ledger_wallet       ON public."LedgerEntry"("walletId");
CREATE INDEX IF NOT EXISTS idx_aichatsession_user  ON public."AIChatSession"("userId", status);
CREATE INDEX IF NOT EXISTS idx_contentreport_status ON public."ContentReport"(status);
CREATE INDEX IF NOT EXISTS idx_discrepancy_status  ON public."BillingDiscrepancy"(status);
CREATE INDEX IF NOT EXISTS idx_aichatratelimit_user ON public."AIChatRateLimit"("userId");
""")

# =========================================================================
# SECTION 6 - FOREIGN KEYS
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 6 - FOREIGN KEYS (guarded)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_consultantId_fkey') THEN
    ALTER TABLE public."Booking"
      ADD CONSTRAINT "Booking_consultantId_fkey"
      FOREIGN KEY ("consultantId") REFERENCES public."Consultant"(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_conversationId_fkey') THEN
    ALTER TABLE public."Message"
      ADD CONSTRAINT "Message_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES public."Conversation"(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_senderId_fkey') THEN
    ALTER TABLE public."Message"
      ADD CONSTRAINT "Message_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES public."User"(id) ON DELETE SET NULL;
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
""")

# =========================================================================
# SECTION 7 - REPLICA IDENTITY
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 7 - REPLICA IDENTITY FULL (for realtime broadcasts)
-- ============================================================================
ALTER TABLE public."Wallet"       REPLICA IDENTITY FULL;
ALTER TABLE public."Transaction"  REPLICA IDENTITY FULL;
ALTER TABLE public."User"         REPLICA IDENTITY FULL;
ALTER TABLE public."Consultant"   REPLICA IDENTITY FULL;
ALTER TABLE public."Booking"      REPLICA IDENTITY FULL;
ALTER TABLE public."Message"      REPLICA IDENTITY FULL;
ALTER TABLE public."Notification" REPLICA IDENTITY FULL;
""")

# =========================================================================
# SECTION 8 - HELPER FUNCTIONS
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 8 - HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.safe_broadcast(
  p_channel TEXT, p_operation TEXT, p_table TEXT, p_schema TEXT, p_new JSONB, p_old JSONB
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  PERFORM realtime.broadcast_changes(p_channel, p_operation, p_operation, p_table, p_schema, p_new, p_old);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'safe_broadcast(%): %', p_channel, SQLERRM;
END;
$func$;

CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(role::text, 'USER') FROM public."User" WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(role::text, '') IN ('SUPER_ADMIN','CLIENT_ADMIN','SUPPORT','VIEWER')
  FROM public."User" WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.auth_is_consultant()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."Consultant" c
    JOIN public."User" u ON u.id = c."userId"
    WHERE c."userId" = (SELECT auth.uid()) AND c."isActive" = true
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_in_conversation(p_conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."ConversationParticipant"
    WHERE "conversationId" = p_conversation_id AND "userId" = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_booking(p_booking_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."Booking" b
    LEFT JOIN public."Consultant" c ON c.id = b."consultantId"
    WHERE b.id = p_booking_id
      AND (b."userId" = (SELECT auth.uid()) OR c."userId" = (SELECT auth.uid()))
  );
$$;

CREATE OR REPLACE FUNCTION public.category_slug(p_category text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE UPPER(COALESCE(p_category, ''))
    WHEN 'ASTROLOGER'      THEN 'astrology'
    WHEN 'TAROT'           THEN 'tarot'
    WHEN 'NUMEROLOGIST'    THEN 'numerology'
    WHEN 'PALMIST'         THEN 'palmistry'
    WHEN 'SPIRITUAL_GUIDE' THEN 'spiritual-coaching'
    WHEN 'HEALER'          THEN 'energy-healing'
    WHEN 'REIKI'           THEN 'energy-healing'
    WHEN 'PSYCHOLOGIST'    THEN 'therapy'
    WHEN 'LIFE_COACH'      THEN 'life-coaching'
    WHEN 'YOGA_INSTRUCTOR' THEN 'yoga'
    WHEN 'VASTU'           THEN 'feng-shui'
    WHEN 'MASSAGE'         THEN 'massage'
    WHEN 'PSYCHIC'         THEN 'psychic'
    WHEN 'CLAIRVOYANT'     THEN 'clairvoyance'
    ELSE LOWER(REPLACE(COALESCE(p_category, ''), '_', '-'))
  END;
$$;
""")

# =========================================================================
# SECTION 9 - CORE RPC FUNCTIONS
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 9 - CORE RPC FUNCTIONS
-- ============================================================================

-- 9.1  credit_funds_safe  ** SECURITY FIX: no grant to anon **
CREATE OR REPLACE FUNCTION public.credit_funds_safe(
  p_user_id text, p_amount double precision, p_description text, p_reference_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
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
END;
$func$;
-- SECURITY FIX: only authenticated, NOT anon
REVOKE ALL ON FUNCTION public.credit_funds_safe(text,double precision,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.credit_funds_safe(text,double precision,text,text) TO authenticated;

-- 9.2  hold_in_escrow_safe
CREATE OR REPLACE FUNCTION public.hold_in_escrow_safe(
  p_user_id text, p_amount double precision, p_reference_id text, p_description text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
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
  UPDATE "Wallet" SET balance = balance - p_amount, escrow = escrow + p_amount, "updatedAt" = now()
  WHERE id = v_wallet.id;
  v_txn_id := gen_random_uuid()::text;
  INSERT INTO "Transaction" (id,"walletId",type,amount,balance,description,"referenceId")
  VALUES (v_txn_id,v_wallet.id,'PAYMENT',p_amount,v_wallet.balance - p_amount,
          p_description,p_reference_id);
  RETURN jsonb_build_object('success',true,'idempotent',false,
    'transactionId',v_txn_id,'escrow',v_wallet.escrow + p_amount);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success',false,'error',SQLERRM,'code',SQLSTATE);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.hold_in_escrow_safe(text,double precision,text,text) TO authenticated;

-- 9.3  release_session_escrow
CREATE OR REPLACE FUNCTION public.release_session_escrow(
  p_session_id uuid, p_held_amount double precision, p_consumed double precision
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
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
            v_wallet.balance + v_refund,'Session refund - unused escrow',
            'session-refund:'||p_session_id::text)
    ON CONFLICT ("referenceId") DO NOTHING;
  END IF;
  RETURN jsonb_build_object('success',true,'refunded',v_refund,
    'newBalance',v_wallet.balance + v_refund);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.release_session_escrow(uuid,double precision,double precision) TO authenticated;

-- 9.4  process_per_minute_deduction  (5-arg canonical version)
-- Drop any old 4-arg overloads first
DROP FUNCTION IF EXISTS public.process_per_minute_deduction(text,text,double precision,text);
CREATE OR REPLACE FUNCTION public.process_per_minute_deduction(
  p_user_id text, p_consultant_id text, p_amount double precision,
  p_session_id text, p_is_ai boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
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
END;
$func$;
GRANT EXECUTE ON FUNCTION public.process_per_minute_deduction(text,text,double precision,text,boolean) TO authenticated;
""")

# =========================================================================
# SECTION 10 - BILLING & SESSION FUNCTIONS
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 10 - BILLING & SESSION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.billing_active_session(p_user_id uuid, p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_session RECORD;
BEGIN
  SELECT * INTO v_session FROM public."CallSession"
  WHERE id = p_session_id AND "userId" = p_user_id AND status IN ('INITIATED','CONNECTED');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'error','no_active_session');
  END IF;
  RETURN jsonb_build_object('success',true,
    'sessionId',v_session.id,'status',v_session.status,
    'lockedRate',COALESCE(v_session."lockedRate",0),
    'startTime',v_session."startTime");
END;
$func$;
GRANT EXECUTE ON FUNCTION public.billing_active_session(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.billing_settle_session(
  p_session_id uuid, p_total_amount double precision
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_session RECORD;
BEGIN
  SELECT * INTO v_session FROM public."CallSession" WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'error','session_not_found');
  END IF;
  UPDATE public."CallSession"
  SET status = 'ENDED', amount = p_total_amount, "endTime" = now()::text,
      "updatedAt" = now()
  WHERE id = p_session_id;
  RETURN jsonb_build_object('success',true,'amount',p_total_amount);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.billing_settle_session(uuid,double precision) TO authenticated;

CREATE OR REPLACE FUNCTION public.cleanup_stale_sessions(p_stale_minutes INTEGER DEFAULT 5)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
DECLARE v_cutoff TIMESTAMPTZ; v_ended INTEGER := 0; v_session RECORD;
BEGIN
  v_cutoff := now() - (p_stale_minutes || ' minutes')::interval;
  FOR v_session IN
    SELECT "id","userId","startTime","durationSeconds","lockedRate","amount"
    FROM "public"."CallSession"
    WHERE "status" = 'CONNECTED' AND "lastHeartbeatAt" < v_cutoff
  LOOP
    DECLARE
      v_start_ms BIGINT; v_cutoff_ms BIGINT; v_duration_secs INTEGER;
      v_duration_mins INTEGER; v_rate DOUBLE PRECISION; v_total_cost DOUBLE PRECISION; v_held DOUBLE PRECISION;
    BEGIN
      v_start_ms := (EXTRACT(EPOCH FROM v_session."startTime"::timestamptz) * 1000)::BIGINT;
      v_cutoff_ms := (EXTRACT(EPOCH FROM v_cutoff) * 1000)::BIGINT;
      v_duration_secs := ((v_cutoff_ms - v_start_ms) / 1000)::INTEGER;
      v_duration_mins := CEIL(v_duration_secs::DOUBLE PRECISION / 60.0);
      v_rate := COALESCE(v_session."lockedRate", 0);
      v_total_cost := v_duration_mins * v_rate;
      v_held := COALESCE(v_session."amount", 0);
      UPDATE "public"."CallSession"
      SET "status" = 'ENDED', "endTime" = v_cutoff::text,
          "durationSeconds" = v_duration_secs, "amount" = v_total_cost
      WHERE "id" = v_session."id";
      IF v_held > 0 THEN
        PERFORM "public"."release_session_escrow"(v_session."id", v_held, v_total_cost);
      END IF;
      v_ended := v_ended + 1;
    END;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'ended', v_ended);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_sessions(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.resume_session(p_user_id UUID, p_session_id UUID)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
DECLARE v_session RECORD;
BEGIN
  SELECT "id","userId","status","lockedRate","startTime","durationSeconds",
         "consultantId","aiConsultantId","isAI","conversationId"
  INTO v_session FROM "public"."CallSession"
  WHERE "id" = p_session_id AND "userId" = p_user_id;
  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found');
  END IF;
  IF v_session."status" = 'ENDED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session already ended', 'ended', true);
  END IF;
  DECLARE
    v_start_ms BIGINT; v_now_ms BIGINT; v_elapsed_mins INTEGER;
  BEGIN
    v_start_ms := (EXTRACT(EPOCH FROM v_session."startTime"::timestamptz) * 1000)::BIGINT;
    v_now_ms := (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT;
    v_elapsed_mins := ((v_now_ms - v_start_ms) / 60000)::INTEGER;
    IF v_elapsed_mins > 240 THEN
      UPDATE "public"."CallSession"
      SET "status" = 'ENDED', "endTime" = now()::text, "durationSeconds" = v_elapsed_mins * 60
      WHERE "id" = p_session_id;
      RETURN jsonb_build_object('success', false, 'error', 'Session expired', 'ended', true);
    END IF;
  END;
  UPDATE "public"."CallSession" SET "lastHeartbeatAt" = now() WHERE "id" = p_session_id;
  RETURN jsonb_build_object('success', true,
    'session', jsonb_build_object(
      'id', v_session."id", 'consultantId', v_session."consultantId",
      'aiConsultantId', v_session."aiConsultantId", 'isAI', v_session."isAI",
      'lockedRate', v_session."lockedRate", 'durationSeconds', v_session."durationSeconds",
      'conversationId', v_session."conversationId"));
END;
$func$;
GRANT EXECUTE ON FUNCTION public.resume_session(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.auto_start_chat_billing(
  p_conversation_id uuid, p_user_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_existing record; v_partner record; v_rate numeric := 0;
  v_is_ai boolean := false; v_wallet record; v_session_id uuid;
BEGIN
  SELECT a.id, a."perMinuteRate", a."isPaid"
  INTO v_partner
  FROM public."ConversationParticipant" cp
  JOIN public."AIConsultant" a ON a.id = cp."userId"::text
  WHERE cp."conversationId" = p_conversation_id AND cp."userId" <> p_user_id
  LIMIT 1;
  IF FOUND THEN
    v_rate := COALESCE(v_partner."perMinuteRate", 0);
    v_is_ai := true;
    IF v_partner."isPaid" = false THEN v_rate := 0; END IF;
  ELSE
    SELECT c.id, COALESCE(c."chatRate", c."perMinuteRate", 50) AS "perMinuteRate"
    INTO v_partner
    FROM public."ConversationParticipant" cp
    JOIN public."Consultant" c ON c."userId" = cp."userId"
    WHERE cp."conversationId" = p_conversation_id
      AND cp."userId" <> p_user_id AND c."isActive" = true
    LIMIT 1;
    IF FOUND THEN
      v_rate := COALESCE(v_partner."perMinuteRate", 50);
    ELSE
      v_rate := 0;
    END IF;
  END IF;
  SELECT * INTO v_existing FROM public."CallSession"
  WHERE "conversationId" = p_conversation_id AND "userId" = p_user_id
    AND status IN ('INITIATED', 'CONNECTED') LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('success',true,'sessionId',v_existing.id,'reused',true,
      'rate',v_rate,'isAI',v_is_ai,'free',v_rate=0);
  END IF;
  IF v_rate = 0 THEN
    RETURN jsonb_build_object('success',true,'free',true,'rate',0,'isAI',v_is_ai);
  END IF;
  SELECT * INTO v_wallet FROM public."Wallet" WHERE "userId" = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_wallet.balance < v_rate THEN
    RETURN jsonb_build_object('success',false,'error','insufficient_balance',
      'required',v_rate,'available',COALESCE(v_wallet.balance,0),'rate',v_rate,'isAI',v_is_ai);
  END IF;
  INSERT INTO public."CallSession" (
    "userId","consultantId","aiConsultantId","isAI",
    "conversationId","startTime",status,amount,"durationSeconds","lockedRate"
  ) VALUES (
    p_user_id,
    CASE WHEN v_is_ai THEN NULL ELSE v_partner.id::uuid END,
    CASE WHEN v_is_ai THEN v_partner.id::text ELSE NULL END,
    v_is_ai, p_conversation_id, now(), 'CONNECTED', 0, 0, v_rate
  ) RETURNING id INTO v_session_id;
  RETURN jsonb_build_object('success',true,'sessionId',v_session_id,
    'rate',v_rate,'isAI',v_is_ai,'startTime',now());
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success',false,'error',SQLERRM);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.auto_start_chat_billing(uuid,uuid) TO authenticated;
""")

# =========================================================================
# SECTION 11 - BOOKING FUNCTIONS
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 11 - BOOKING FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id text, p_actor_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_booking RECORD; v_wallet RECORD;
BEGIN
  SELECT * INTO v_booking FROM "Booking" WHERE id = p_booking_id::uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF v_booking.status = 'CANCELLED' THEN RETURN jsonb_build_object('alreadyCancelled',true); END IF;
  IF v_booking.status = 'COMPLETED' THEN RETURN jsonb_build_object('error','completed'); END IF;
  IF v_booking."userId" IS NOT NULL THEN
    SELECT * INTO v_wallet FROM "Wallet" WHERE "userId" = v_booking."userId"::uuid FOR UPDATE;
    IF FOUND THEN
      UPDATE "Wallet" SET balance = balance + v_booking.amount,
        escrow = GREATEST(0,escrow - v_booking.amount), "updatedAt" = now()
      WHERE id = v_wallet.id;
      INSERT INTO "Transaction" (id,"walletId",type,amount,balance,description,"referenceId")
      VALUES (gen_random_uuid()::text,v_wallet.id,'REFUND',v_booking.amount,
        v_wallet.balance + v_booking.amount,
        'Refund for cancelled booking ' || p_booking_id,
        p_booking_id || ':refund')
      ON CONFLICT ("referenceId") DO NOTHING;
    END IF;
  END IF;
  UPDATE "Booking" SET status = 'CANCELLED', "updatedAt" = now() WHERE id = p_booking_id::uuid;
  RETURN jsonb_build_object('success',true);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'error',SQLERRM);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.cancel_booking(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_booking_payment(
  p_booking_id uuid, p_razorpay_payment_id text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_caller uuid := auth.uid(); v_booking RECORD; v_consultant_user uuid;
  v_platform_fee numeric; v_consultant_earning numeric;
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
  v_platform_fee := v_booking.amount * COALESCE(v_booking."platformFeeRate", 0.10);
  v_consultant_earning := v_booking.amount - v_platform_fee;
  UPDATE public."Booking"
    SET status = 'CONFIRMED', "platformFee" = v_platform_fee,
        "consultantEarning" = v_consultant_earning,
        "razorpayPaymentId" = COALESCE(p_razorpay_payment_id, "razorpayPaymentId"),
        "paymentStatus" = 'captured', "updatedAt" = now()
    WHERE id = p_booking_id;
  SELECT c."userId" INTO v_consultant_user
  FROM public."Consultant" c WHERE c.id = v_booking."consultantId";
  IF v_consultant_user IS NOT NULL AND v_consultant_earning > 0 THEN
    PERFORM public.credit_funds_safe(v_consultant_user::text, v_consultant_earning,
      'Booking earning: '||p_booking_id::text, 'booking-earn:'||p_booking_id::text);
    INSERT INTO public."Notification" ("userId",type,message,"redirectUrl","actorId")
    VALUES (v_consultant_user,'booking',
      'Booking confirmed. You earned Rs.'||v_consultant_earning::text,
      '/consultant/bookings',v_caller);
  END IF;
  RETURN jsonb_build_object('success',true,
    'platformFee',v_platform_fee,'consultantEarning',v_consultant_earning,'total',v_booking.amount);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success',false,'error',SQLERRM,'code',SQLSTATE);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.confirm_booking_payment(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.share_meeting_link(p_booking_id uuid, p_meeting_link text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_caller uuid := auth.uid(); v_booking RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','not_authenticated');
  END IF;
  SELECT * INTO v_booking FROM public."Booking" WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'error','booking_not_found');
  END IF;
  IF NOT public.auth_is_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public."Consultant"
       WHERE id = v_booking."consultantId" AND "userId" = v_caller) THEN
    RETURN jsonb_build_object('success',false,'error','forbidden');
  END IF;
  UPDATE public."Booking" SET "meetingLink" = p_meeting_link, "updatedAt" = now()
  WHERE id = p_booking_id;
  RETURN jsonb_build_object('success',true,'meetingLink',p_meeting_link);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success',false,'error',SQLERRM);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.share_meeting_link(uuid,text) TO authenticated;
""")

# =========================================================================
# SECTION 12 - WALLET & LEDGER FUNCTIONS
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 12 - WALLET & LEDGER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_wallet_deduction(
  p_user_id text, p_amount double precision, p_reference text, p_description text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_wallet RECORD;
BEGIN
  SELECT * INTO v_wallet FROM public."Wallet" WHERE "userId" = p_user_id::uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','wallet_not_found'); END IF;
  IF v_wallet.balance < p_amount THEN
    RETURN jsonb_build_object('success',false,'error','insufficient_funds');
  END IF;
  UPDATE public."Wallet" SET balance = balance - p_amount, "updatedAt" = now() WHERE id = v_wallet.id;
  INSERT INTO public."Transaction" (id,"walletId",type,amount,balance,description,"referenceId")
  VALUES (gen_random_uuid()::text, v_wallet.id, 'PAYMENT', -p_amount,
    v_wallet.balance - p_amount, p_description, p_reference)
  ON CONFLICT ("referenceId") DO NOTHING;
  RETURN jsonb_build_object('success',true,'balance',v_wallet.balance - p_amount);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.process_wallet_deduction(text,double precision,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.process_wallet_topup(
  p_user_id text, p_amount double precision, p_reference text, p_description text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  RETURN public.credit_funds_safe(p_user_id, p_amount, p_description, p_reference);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.process_wallet_topup(text,double precision,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.process_escrow_hold(
  p_user_id text, p_amount double precision, p_reference text, p_description text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  RETURN public.hold_in_escrow_safe(p_user_id, p_amount, p_reference, p_description);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.process_escrow_hold(text,double precision,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.process_escrow_release(
  p_session_id uuid, p_held double precision, p_consumed double precision
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  RETURN public.release_session_escrow(p_session_id, p_held, p_consumed);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.process_escrow_release(uuid,double precision,double precision) TO authenticated;

CREATE OR REPLACE FUNCTION public.reconcile_wallet(p_wallet_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_wallet RECORD; v_sum numeric; v_diff numeric;
BEGIN
  SELECT * INTO v_wallet FROM public."Wallet" WHERE id = p_wallet_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  SELECT COALESCE(SUM(amount),0) INTO v_sum FROM public."Transaction" WHERE "walletId" = p_wallet_id;
  v_diff := v_wallet.balance - v_sum;
  IF ABS(v_diff) < 0.01 THEN
    RETURN jsonb_build_object('success',true,'drift',0);
  END IF;
  INSERT INTO public."Transaction" (id,"walletId",type,amount,balance,description,"referenceId")
  VALUES (gen_random_uuid()::text, p_wallet_id, 'ADJUSTMENT', -v_diff, v_sum,
    'Reconciliation adjustment', 'reconcile:'||p_wallet_id::text||':'||gen_random_uuid()::text)
  ON CONFLICT ("referenceId") DO NOTHING;
  UPDATE public."Wallet" SET balance = v_sum, "updatedAt" = now() WHERE id = p_wallet_id;
  RETURN jsonb_build_object('success',true,'drift',v_diff,'corrected',true);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.reconcile_wallet(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.debit_wallet_versioned(
  p_user_id uuid, p_amount double precision, p_reference text, p_description text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_wallet RECORD;
BEGIN
  SELECT * INTO v_wallet FROM public."Wallet" WHERE "userId" = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','wallet_not_found'); END IF;
  IF v_wallet.balance < p_amount THEN
    RETURN jsonb_build_object('success',false,'error','insufficient_funds');
  END IF;
  UPDATE public."Wallet" SET balance = balance - p_amount,
    version = version + 1, "updatedAt" = now() WHERE id = v_wallet.id;
  INSERT INTO public."LedgerEntry" ("walletId",type,amount,"balanceAfter",reference,metadata)
  VALUES (v_wallet.id, 'DEBIT', -p_amount, v_wallet.balance - p_amount, p_reference,
    jsonb_build_object('description', p_description));
  RETURN jsonb_build_object('success',true,'balance',v_wallet.balance - p_amount,
    'version',v_wallet.version + 1);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.debit_wallet_versioned(uuid,double precision,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.credit_wallet_versioned(
  p_user_id uuid, p_amount double precision, p_reference text, p_description text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_wallet RECORD;
BEGIN
  SELECT * INTO v_wallet FROM public."Wallet" WHERE "userId" = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','wallet_not_found'); END IF;
  UPDATE public."Wallet" SET balance = balance + p_amount,
    version = version + 1, "updatedAt" = now() WHERE id = v_wallet.id;
  INSERT INTO public."LedgerEntry" ("walletId",type,amount,"balanceAfter",reference,metadata)
  VALUES (v_wallet.id, 'CREDIT', p_amount, v_wallet.balance + p_amount, p_reference,
    jsonb_build_object('description', p_description));
  RETURN jsonb_build_object('success',true,'balance',v_wallet.balance + p_amount,
    'version',v_wallet.version + 1);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.credit_wallet_versioned(uuid,double precision,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ledger_debit(
  p_wallet_id uuid, p_amount double precision, p_reference text, p_description text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_wallet RECORD;
BEGIN
  SELECT * INTO v_wallet FROM public."Wallet" WHERE id = p_wallet_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  IF v_wallet.balance < p_amount THEN RETURN jsonb_build_object('success',false,'error','insufficient'); END IF;
  UPDATE public."Wallet" SET balance = balance - p_amount, "updatedAt" = now() WHERE id = p_wallet_id;
  INSERT INTO public."LedgerEntry" ("walletId",type,amount,"balanceAfter",reference)
  VALUES (p_wallet_id, 'DEBIT', -p_amount, v_wallet.balance - p_amount, p_reference);
  RETURN jsonb_build_object('success',true,'balance',v_wallet.balance - p_amount);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.ledger_debit(uuid,double precision,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ledger_credit(
  p_wallet_id uuid, p_amount double precision, p_reference text, p_description text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_wallet RECORD;
BEGIN
  SELECT * INTO v_wallet FROM public."Wallet" WHERE id = p_wallet_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  UPDATE public."Wallet" SET balance = balance + p_amount, "updatedAt" = now() WHERE id = p_wallet_id;
  INSERT INTO public."LedgerEntry" ("walletId",type,amount,"balanceAfter",reference)
  VALUES (p_wallet_id, 'CREDIT', p_amount, v_wallet.balance + p_amount, p_reference);
  RETURN jsonb_build_object('success',true,'balance',v_wallet.balance + p_amount);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.ledger_credit(uuid,double precision,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ledger_transfer(
  p_from uuid, p_to uuid, p_amount double precision, p_reference text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_debit jsonb; v_credit jsonb;
BEGIN
  v_debit := public.ledger_debit(p_from, p_amount, p_reference, 'Transfer out');
  IF NOT (v_debit->>'success')::boolean THEN RETURN v_debit; END IF;
  v_credit := public.ledger_credit(p_to, p_amount, p_reference, 'Transfer in');
  RETURN jsonb_build_object('success',true);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.ledger_transfer(uuid,uuid,double precision,text) TO authenticated;
""")

# =========================================================================
# SECTION 13 - CHAT & CONVERSATION FUNCTIONS
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 13 - CHAT & CONVERSATION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  p_user_a uuid, p_user_b uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_conv_id uuid; v_partner_is_ai boolean := false;
BEGIN
  SELECT c.id INTO v_conv_id
  FROM public."Conversation" c
  JOIN public."ConversationParticipant" cp1
    ON cp1."conversationId" = c.id AND cp1."userId" = p_user_a
  JOIN public."ConversationParticipant" cp2
    ON cp2."conversationId" = c.id AND cp2."userId" = p_user_b
  WHERE c."isGroup" = false
  LIMIT 1;

  IF NOT FOUND THEN
    -- Check if user_b is an AI consultant
    SELECT true INTO v_partner_is_ai
    FROM public."AIConsultant" WHERE id = p_user_b::text;

    INSERT INTO public."Conversation" ("isGroup") VALUES (false) RETURNING id INTO v_conv_id;
    INSERT INTO public."ConversationParticipant" ("conversationId","userId") VALUES (v_conv_id, p_user_a);
    INSERT INTO public."ConversationParticipant" ("conversationId","userId") VALUES (v_conv_id, p_user_b);
  END IF;

  RETURN jsonb_build_object('success',true,'conversationId',v_conv_id,'isAI',COALESCE(v_partner_is_ai,false));
END;
$func$;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_partner_view(p_conversation_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_me uuid := auth.uid(); v_partner record;
  v_is_ai boolean := false; v_rate numeric := 0; v_session uuid;
BEGIN
  IF v_me IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','not_authenticated');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public."ConversationParticipant"
    WHERE "conversationId" = p_conversation_id AND "userId" = v_me
  ) THEN
    RETURN jsonb_build_object('ok',false,'error','not_participant');
  END IF;
  -- AI partner
  SELECT a.id::uuid AS id, a.name, a.username, a.avatar, 'AI'::text AS role,
    (CASE WHEN a."isPaid" THEN a."perMinuteRate" ELSE 0 END)::numeric AS rate
  INTO v_partner
  FROM public."ConversationParticipant" cp
  JOIN public."AIConsultant" a ON a.id = cp."userId"::text
  WHERE cp."conversationId" = p_conversation_id AND cp."userId" <> v_me LIMIT 1;
  IF FOUND THEN
    v_is_ai := true;
    v_rate := COALESCE(v_partner.rate, 0);
  ELSE
    SELECT u.id, COALESCE(u.name, u.full_name, u.username, 'Zeal Member') AS name,
      u.username, COALESCE(u.avatar, u.avatar_url) AS avatar,
      COALESCE(u.role::text, 'USER') AS role,
      COALESCE(c."chatRate", c."perMinuteRate", 0)::numeric AS rate
    INTO v_partner
    FROM public."ConversationParticipant" cp
    JOIN public."User" u ON u.id = cp."userId"
    LEFT JOIN public."Consultant" c ON c."userId" = u.id
    WHERE cp."conversationId" = p_conversation_id AND cp."userId" <> v_me LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok',false,'error','no_partner');
    END IF;
    v_rate := COALESCE(v_partner.rate, 0);
  END IF;
  SELECT id INTO v_session FROM public."CallSession"
  WHERE "conversationId" = p_conversation_id AND "userId" = v_me
    AND status IN ('INITIATED','CONNECTED')
  ORDER BY "startTime" DESC LIMIT 1;
  RETURN jsonb_build_object('ok',true,
    'partner', jsonb_build_object('id',v_partner.id,'name',v_partner.name,
      'username',v_partner.username,'avatar',v_partner.avatar,'role',v_partner.role),
    'isAI',v_is_ai,'rate',v_rate,'sessionId',v_session);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.chat_partner_view(uuid) TO authenticated;
""")

# =========================================================================
# SECTION 14 - AUTH FUNCTIONS
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 14 - AUTH FUNCTIONS
-- ============================================================================

-- 14.1  custom_access_token_hook (JWT injection)
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_user_id uuid;
  v_role text;
  v_claims jsonb;
BEGIN
  v_user_id := (event->>'user_id')::uuid;
  v_claims := event->'claims';

  SELECT role::text INTO v_role FROM public."User" WHERE id = v_user_id;

  IF v_role IS NOT NULL THEN
    v_claims := jsonb_set(v_claims, '{app_metadata}', 
      COALESCE(v_claims->'app_metadata', '{}'::jsonb) || jsonb_build_object('role', v_role));
    v_claims := jsonb_set(v_claims, '{user_metadata}',
      COALESCE(v_claims->'user_metadata', '{}'::jsonb) || jsonb_build_object('role', v_role));
  END IF;

  RETURN jsonb_set(event, '{claims}', v_claims);
EXCEPTION WHEN OTHERS THEN
  RETURN event;
END;
$func$;
REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

-- 14.2  handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_account_type text;
  v_role "AppRole";
BEGIN
  v_account_type := COALESCE(NEW.raw_user_meta_data->>'account_type', 'seeker');

  IF v_account_type = 'consultant' THEN
    v_role := 'CLIENT_ADMIN'::"AppRole";
  ELSE
    v_role := 'USER'::"AppRole";
  END IF;

  INSERT INTO public."User" (id, email, username, name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'avatar'),
    v_role
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public."Wallet" ("userId", balance)
  VALUES (NEW.id, 0)
  ON CONFLICT ("userId") DO NOTHING;

  IF v_account_type = 'consultant' THEN
    INSERT INTO public."Consultant" ("userId", status, "isActive", "isVerified")
    VALUES (NEW.id, 'VERIFIED', true, true)
    ON CONFLICT ("userId") DO NOTHING;
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(NEW.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', v_role::text)
  WHERE id = NEW.id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 14.3  self_heal_user
CREATE OR REPLACE FUNCTION public.self_heal_user()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_authenticated'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public."User" WHERE id = v_uid) THEN
    INSERT INTO public."User" (id, email, role) VALUES (v_uid, 'healed@zeal.local', 'USER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public."Wallet" WHERE "userId" = v_uid) THEN
    INSERT INTO public."Wallet" ("userId", balance) VALUES (v_uid, 0);
  END IF;
  RETURN jsonb_build_object('success',true);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.self_heal_user() TO authenticated;

-- 14.4  ensure_ai_user
CREATE OR REPLACE FUNCTION public.ensure_ai_user(p_ai_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_uid uuid; v_ai record;
BEGIN
  BEGIN v_uid := p_ai_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_uid := ('00000000-0000-0000-0000-' || LPAD(SUBSTRING(MD5(p_ai_id), 1, 12), 12, '0'))::uuid;
  END;
  SELECT * INTO v_ai FROM public."AIConsultant" WHERE id = p_ai_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  INSERT INTO public."User" (id, email, username, name, avatar_url, role, "isVerified", is_online)
  VALUES (v_uid, COALESCE(v_ai.username, 'ai_' || LEFT(v_uid::text, 8)) || '@ai.zeal.local',
          COALESCE(v_ai.username, 'ai_' || LEFT(v_uid::text, 8)),
          v_ai.name, v_ai.avatar, 'AI'::"AppRole", true, true)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public."Wallet" ("userId", balance) VALUES (v_uid, 0)
  ON CONFLICT ("userId") DO NOTHING;
  RETURN v_uid;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.ensure_ai_user(text) TO authenticated, service_role;

-- 14.5  hook_health
CREATE OR REPLACE FUNCTION public.hook_health()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'hook_exists', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'custom_access_token_hook'),
    'trigger_exists', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'),
    'auth_admin_grant', has_function_privilege('supabase_auth_admin',
      'public.custom_access_token_hook(jsonb)', 'EXECUTE'),
    'checked_at', now()
  );
$$;
GRANT EXECUTE ON FUNCTION public.hook_health() TO authenticated;
""")

# =========================================================================
# SECTION 15 - FEED & SOCIAL FUNCTIONS
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 15 - FEED & SOCIAL FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.toggle_cheer(p_post_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_uid uuid := (SELECT auth.uid()); v_existing uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_authenticated'); END IF;
  SELECT id INTO v_existing FROM public."Cheer" WHERE "postId" = p_post_id AND "userId" = v_uid;
  IF FOUND THEN
    DELETE FROM public."Cheer" WHERE id = v_existing;
    UPDATE public."Post" SET "cheerCount" = GREATEST(0, "cheerCount" - 1) WHERE id = p_post_id;
    RETURN jsonb_build_object('success',true,'cheered',false);
  ELSE
    INSERT INTO public."Cheer" ("postId","userId") VALUES (p_post_id, v_uid);
    UPDATE public."Post" SET "cheerCount" = "cheerCount" + 1 WHERE id = p_post_id;
    RETURN jsonb_build_object('success',true,'cheered',true);
  END IF;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.toggle_cheer(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.increment_comment_count(p_post_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  UPDATE public."Post" SET "commentCount" = "commentCount" + 1 WHERE id = p_post_id;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.increment_comment_count(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_quest(p_quest_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_uid uuid := (SELECT auth.uid());
BEGIN
  INSERT INTO public."UserActivity" ("userId","consultantId",type,metadata)
  VALUES (v_uid, p_quest_id, 'quest_claim', jsonb_build_object('claimed_at', now()))
  ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('success',true);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.claim_quest(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.end_call_session(p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_session RECORD;
BEGIN
  SELECT * INTO v_session FROM public."CallSession" WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  UPDATE public."CallSession" SET status = 'ENDED', "endTime" = now()::text, "updatedAt" = now()
  WHERE id = p_session_id;
  RETURN jsonb_build_object('success',true);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.end_call_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_consultant(p_consultant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  IF NOT public.auth_is_admin() THEN
    RETURN jsonb_build_object('success',false,'error','forbidden');
  END IF;
  UPDATE public."Consultant" SET "isVerified" = true, status = 'VERIFIED', "updatedAt" = now()
  WHERE id = p_consultant_id;
  RETURN jsonb_build_object('success',true);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.verify_consultant(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_booking_conflict(
  p_consultant_id uuid, p_start timestamptz, p_end timestamptz
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('conflict',
    EXISTS (SELECT 1 FROM public."Booking"
      WHERE "consultantId" = p_consultant_id
        AND status NOT IN ('CANCELLED','COMPLETED')
        AND "startTime" < p_end AND "endTime" > p_start));
$$;
GRANT EXECUTE ON FUNCTION public.check_booking_conflict(uuid,timestamptz,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_withdrawal(p_amount double precision)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_uid uuid := (SELECT auth.uid()); v_wallet RECORD;
BEGIN
  SELECT * INTO v_wallet FROM public."Wallet" WHERE "userId" = v_uid FOR UPDATE;
  IF NOT FOUND OR v_wallet.balance < p_amount THEN
    RETURN jsonb_build_object('success',false,'error','insufficient_funds');
  END IF;
  UPDATE public."Wallet" SET balance = balance - p_amount, "pendingOut" = "pendingOut" + p_amount,
    "updatedAt" = now() WHERE id = v_wallet.id;
  INSERT INTO public."Transaction" (id,"walletId",type,amount,balance,description,"referenceId")
  VALUES (gen_random_uuid()::text, v_wallet.id, 'WITHDRAWAL_REQUEST', -p_amount,
    v_wallet.balance - p_amount, 'Withdrawal request', 'withdrawal:'||gen_random_uuid()::text);
  RETURN jsonb_build_object('success',true);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(double precision) TO authenticated;

CREATE OR REPLACE FUNCTION public.process_withdrawal(p_txn_id text, p_approved boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  IF NOT public.auth_is_admin() THEN
    RETURN jsonb_build_object('success',false,'error','forbidden');
  END IF;
  IF p_approved THEN
    UPDATE public."Transaction" SET type = 'WITHDRAWAL' WHERE id = p_txn_id;
  ELSE
    DECLARE v_txn RECORD;
    BEGIN
      SELECT * INTO v_txn FROM public."Transaction" WHERE id = p_txn_id;
      IF FOUND THEN
        UPDATE public."Wallet" SET balance = balance + ABS(v_txn.amount),
          "pendingOut" = GREATEST(0, "pendingOut" - ABS(v_txn.amount)), "updatedAt" = now()
        WHERE id = v_txn."walletId";
        UPDATE public."Transaction" SET type = 'WITHDRAWAL_REJECTED' WHERE id = p_txn_id;
      END IF;
    END;
  END IF;
  RETURN jsonb_build_object('success',true);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.process_withdrawal(text,boolean) TO authenticated;
""")

# =========================================================================
# SECTION 16 - PROFILE & CONTENT FUNCTIONS
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 16 - PROFILE & CONTENT FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.upsert_birth_profile(
  p_user_id UUID, p_full_name TEXT DEFAULT '', p_date_of_birth DATE DEFAULT NULL,
  p_time_of_birth TIME DEFAULT NULL, p_place_of_birth TEXT DEFAULT '',
  p_latitude DOUBLE PRECISION DEFAULT NULL, p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_gender TEXT DEFAULT NULL, p_primary_concern TEXT DEFAULT ''
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
DECLARE v_profile RECORD;
BEGIN
  IF p_user_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','User ID required'); END IF;
  INSERT INTO "public"."BirthProfile" (
    "userId","fullName","dateOfBirth","timeOfBirth","placeOfBirth",
    "latitude","longitude","gender","primaryConcern","createdAt","updatedAt"
  ) VALUES (p_user_id,p_full_name,p_date_of_birth,p_time_of_birth,p_place_of_birth,
    p_latitude,p_longitude,p_gender,p_primary_concern,now(),now()
  ) ON CONFLICT ("userId") DO UPDATE SET
    "fullName" = COALESCE(NULLIF(p_full_name,''),"public"."BirthProfile"."fullName"),
    "dateOfBirth" = COALESCE(p_date_of_birth,"public"."BirthProfile"."dateOfBirth"),
    "timeOfBirth" = COALESCE(p_time_of_birth,"public"."BirthProfile"."timeOfBirth"),
    "placeOfBirth" = COALESCE(NULLIF(p_place_of_birth,''),"public"."BirthProfile"."placeOfBirth"),
    "latitude" = COALESCE(p_latitude,"public"."BirthProfile"."latitude"),
    "longitude" = COALESCE(p_longitude,"public"."BirthProfile"."longitude"),
    "gender" = COALESCE(p_gender,"public"."BirthProfile"."gender"),
    "primaryConcern" = COALESCE(NULLIF(p_primary_concern,''),"public"."BirthProfile"."primaryConcern"),
    "updatedAt" = now();
  SELECT * INTO v_profile FROM "public"."BirthProfile" WHERE "userId" = p_user_id;
  RETURN jsonb_build_object('success',true,'profile',row_to_json(v_profile));
END;
$func$;
GRANT EXECUTE ON FUNCTION public.upsert_birth_profile(uuid,text,date,time,text,double precision,double precision,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_birth_profile(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
DECLARE v_profile RECORD;
BEGIN
  SELECT * INTO v_profile FROM "public"."BirthProfile" WHERE "userId" = p_user_id;
  IF v_profile IS NULL THEN RETURN jsonb_build_object('success',true,'profile',NULL); END IF;
  RETURN jsonb_build_object('success',true,'profile',row_to_json(v_profile));
END;
$func$;
GRANT EXECUTE ON FUNCTION public.get_birth_profile(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_username()
RETURNS trigger LANGUAGE plpgsql AS $func$
BEGIN
  IF NEW.username IS NULL THEN RETURN NEW; END IF;
  NEW.username := LOWER(TRIM(NEW.username));
  IF LENGTH(NEW.username) < 3 OR LENGTH(NEW.username) > 30 THEN
    RAISE EXCEPTION 'Username must be 3-30 characters';
  END IF;
  IF NEW.username !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Username can only contain letters, numbers, and underscores';
  END IF;
  IF NEW.username = ANY(ARRAY['admin','zeal','support','help','api','www','mail','root','system',
    'official','moderator','staff','team','null','undefined']) THEN
    RAISE EXCEPTION 'Username is reserved';
  END IF;
  RETURN NEW;
END;
$func$;
DROP TRIGGER IF EXISTS trg_validate_username ON public."User";
CREATE TRIGGER trg_validate_username BEFORE UPDATE OF username ON public."User"
  FOR EACH ROW EXECUTE FUNCTION public.validate_username();

CREATE OR REPLACE FUNCTION public.sync_post_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  IF TG_OP = 'INSERT' AND NOT NEW."isArchived" THEN
    UPDATE public."User" SET "post_count" = "post_count" + 1 WHERE id = NEW."authorId";
  ELSIF TG_OP = 'UPDATE' AND OLD."isArchived" IS DISTINCT FROM NEW."isArchived" THEN
    UPDATE public."User"
      SET "post_count" = GREATEST(0, "post_count" + CASE WHEN NEW."isArchived" THEN -1 ELSE 1 END)
      WHERE id = NEW."authorId";
  ELSIF TG_OP = 'DELETE' AND NOT OLD."isArchived" THEN
    UPDATE public."User" SET "post_count" = GREATEST(0, "post_count" - 1) WHERE id = OLD."authorId";
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$func$;
DROP TRIGGER IF EXISTS trg_sync_post_count ON public."Post";
CREATE TRIGGER trg_sync_post_count
  AFTER INSERT OR UPDATE OF "isArchived" OR DELETE ON public."Post"
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_count();

CREATE OR REPLACE FUNCTION public.get_profile_stats(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'user', jsonb_build_object(
      'id',u.id,'name',u.name,'username',u.username,'avatar',u.avatar,'bio',u.bio,
      'website',u."website",'location',u."location",'role',u.role::text,
      'isVerified',u."isVerified",'is_online',u.is_online,'sparks',u.sparks,
      'postCount',u."post_count",'createdAt',u."createdAt"),
    'stats', jsonb_build_object(
      'posts',(SELECT COUNT(*) FROM public."Post" WHERE "authorId"=u.id AND "isArchived"=false),
      'cheers',(SELECT COALESCE(SUM("cheerCount"),0) FROM public."Post" WHERE "authorId"=u.id AND "isArchived"=false),
      'comments',(SELECT COALESCE(SUM("commentCount"),0) FROM public."Post" WHERE "authorId"=u.id AND "isArchived"=false),
      'followers',(SELECT COUNT(*) FROM public."UserActivity" WHERE "consultantId"=u.id::text AND type='follow'),
      'following',(SELECT COUNT(*) FROM public."UserActivity" WHERE "userId"=u.id AND type='follow')),
    'isConsultant',(u.role = 'CLIENT_ADMIN'::"AppRole"),
    'isSelf',(u.id = (SELECT auth.uid())))
  FROM public."User" u WHERE u.id = p_user_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_profile_stats(uuid) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.can_create_post()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_uid uuid := (SELECT auth.uid()); v_role text; v_current int; v_limit int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('canPost',false,'limit',0,'current',0); END IF;
  SELECT role::text INTO v_role FROM public."User" WHERE id = v_uid;
  v_limit := CASE WHEN v_role = 'CLIENT_ADMIN' THEN 6 ELSE 3 END;
  SELECT COUNT(*) INTO v_current FROM public."Post" WHERE "authorId" = v_uid AND "isArchived" = false;
  RETURN jsonb_build_object('canPost',v_current < v_limit,'limit',v_limit,
    'current',v_current,'remaining',GREATEST(0,v_limit - v_current));
END;
$func$;
GRANT EXECUTE ON FUNCTION public.can_create_post() TO authenticated;

CREATE OR REPLACE FUNCTION public.check_username_available(p_username text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'available', NOT EXISTS (SELECT 1 FROM public."User"
      WHERE username = LOWER(TRIM(p_username))
        AND id <> COALESCE((SELECT auth.uid()),'00000000-0000-0000-0000-000000000000'::uuid)),
    'reserved', LOWER(TRIM(p_username)) = ANY(ARRAY['admin','zeal','support','help','api','www',
      'mail','root','system','official','moderator','staff','team','null','undefined']));
$$;
GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.update_profile(
  p_name text DEFAULT NULL, p_username text DEFAULT NULL, p_bio text DEFAULT NULL,
  p_website text DEFAULT NULL, p_location text DEFAULT NULL, p_avatar text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_uid uuid := (SELECT auth.uid()); v_existing RECORD;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','NOT_AUTHENTICATED'); END IF;
  SELECT * INTO v_existing FROM public."User" WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','USER_NOT_FOUND'); END IF;
  IF p_name IS NOT NULL AND (LENGTH(TRIM(p_name)) < 1 OR LENGTH(p_name) > 80) THEN
    RETURN jsonb_build_object('success',false,'error','INVALID_NAME'); END IF;
  IF p_bio IS NOT NULL AND LENGTH(p_bio) > 500 THEN
    RETURN jsonb_build_object('success',false,'error','BIO_TOO_LONG'); END IF;
  IF p_website IS NOT NULL AND p_website <> '' AND p_website !~* '^https?://' THEN
    RETURN jsonb_build_object('success',false,'error','WEBSITE_INVALID'); END IF;
  IF p_location IS NOT NULL AND LENGTH(p_location) > 100 THEN
    RETURN jsonb_build_object('success',false,'error','LOCATION_TOO_LONG'); END IF;
  IF p_username IS NOT NULL AND LOWER(TRIM(p_username)) <> COALESCE(v_existing.username,'') THEN
    IF EXISTS (SELECT 1 FROM public."User" WHERE username = LOWER(TRIM(p_username)) AND id <> v_uid) THEN
      RETURN jsonb_build_object('success',false,'error','USERNAME_TAKEN'); END IF;
  END IF;
  UPDATE public."User" SET
    name = COALESCE(p_name, name), username = COALESCE(LOWER(TRIM(p_username)), username),
    bio = COALESCE(p_bio, bio), website = COALESCE(p_website, website),
    location = COALESCE(p_location, location), avatar = COALESCE(p_avatar, avatar),
    "updatedAt" = now()
  WHERE id = v_uid;
  RETURN jsonb_build_object('success',true,
    'user',(SELECT jsonb_build_object('id',u.id,'name',u.name,'username',u.username,
      'bio',u.bio,'website',u."website",'location',u."location",'avatar',u.avatar)
      FROM public."User" u WHERE u.id = v_uid));
EXCEPTION
  WHEN unique_violation THEN RETURN jsonb_build_object('success',false,'error','USERNAME_TAKEN');
  WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'error','VALIDATION','message',SQLERRM);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.update_profile(text,text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_post(p_post_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_uid uuid := (SELECT auth.uid()); v_author uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','NOT_AUTHENTICATED'); END IF;
  SELECT "authorId" INTO v_author FROM public."Post" WHERE id = p_post_id;
  IF v_author IS NULL THEN RETURN jsonb_build_object('success',false,'error','POST_NOT_FOUND'); END IF;
  IF v_author <> v_uid AND NOT public.auth_is_admin() THEN
    RETURN jsonb_build_object('success',false,'error','FORBIDDEN'); END IF;
  UPDATE public."Post" SET "isArchived" = true, "deletedAt" = now() WHERE id = p_post_id;
  RETURN jsonb_build_object('success',true);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.delete_post(uuid) TO authenticated;
""")

# =========================================================================
# SECTION 17 - AI & RATE LIMIT FUNCTIONS
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 17 - AI & RATE LIMIT FUNCTIONS
-- ============================================================================

-- Drop all overloads first to avoid ambiguity
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'check_ai_rate_limit'
  LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP;
END $$;

CREATE FUNCTION public.check_ai_rate_limit(
  p_user_id uuid, p_ai_id text, p_max_per_minute int DEFAULT 10
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_count int; v_window timestamptz; v_ai uuid;
BEGIN
  BEGIN v_ai := p_ai_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok',true,'remaining',p_max_per_minute);
  END;
  SELECT "messageCount","windowStart" INTO v_count, v_window
  FROM public."AIChatRateLimit" WHERE "userId" = p_user_id AND "aiId" = v_ai FOR UPDATE;
  IF NOT FOUND OR v_window < now() - interval '1 minute' THEN
    INSERT INTO public."AIChatRateLimit" ("userId","aiId","windowStart","messageCount")
    VALUES (p_user_id, v_ai, now(), 1)
    ON CONFLICT ("userId","aiId") DO UPDATE SET "windowStart" = now(), "messageCount" = 1;
    RETURN jsonb_build_object('ok',true,'remaining',p_max_per_minute - 1);
  END IF;
  IF v_count >= p_max_per_minute THEN
    RETURN jsonb_build_object('ok',false,'retryAfter',
      GREATEST(1, EXTRACT(EPOCH FROM (v_window + interval '1 minute' - now()))::int));
  END IF;
  UPDATE public."AIChatRateLimit" SET "messageCount" = "messageCount" + 1
  WHERE "userId" = p_user_id AND "aiId" = v_ai;
  RETURN jsonb_build_object('ok',true,'remaining',p_max_per_minute - v_count - 1);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(uuid,text,int) TO authenticated;

-- Drop all overloads of check_ai_safety
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'check_ai_safety'
  LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP;
END $$;

CREATE FUNCTION public.check_ai_safety(p_ai_id text, p_content text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_ai record; v_pattern text; v_clean text;
BEGIN
  SELECT "safetyLevel","bannedPatterns" INTO v_ai FROM public."AIConsultant" WHERE id = p_ai_id LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('safe',true,'reason','unknown_ai'); END IF;
  IF COALESCE(v_ai."safetyLevel",'STANDARD') = 'RELAXED' THEN RETURN jsonb_build_object('safe',true); END IF;
  FOREACH v_pattern IN ARRAY COALESCE(v_ai."bannedPatterns", ARRAY[]::text[]) LOOP
    v_clean := REPLACE(v_pattern, '(?i)', '');
    BEGIN
      IF p_content ~* v_clean THEN RETURN jsonb_build_object('safe',false,'reason',v_clean); END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
  RETURN jsonb_build_object('safe',true);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.check_ai_safety(text,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.try_start_ai_chat(p_user_id uuid, p_ai_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_session_id uuid;
BEGIN
  INSERT INTO public."AIChatSession" ("userId","aiConsultantId",status)
  VALUES (p_user_id, p_ai_id, 'active') RETURNING id INTO v_session_id;
  RETURN jsonb_build_object('success',true,'sessionId',v_session_id);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.try_start_ai_chat(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.end_ai_chat_session(p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  UPDATE public."AIChatSession" SET status = 'ended', "endedAt" = now() WHERE id = p_session_id;
  RETURN jsonb_build_object('success',true);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.end_ai_chat_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_ai_chat_stats(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'total_sessions', COUNT(*),
    'total_messages', COALESCE(SUM("messageCount"),0),
    'active_sessions', COUNT(*) FILTER (WHERE status = 'active'))
  FROM public."AIChatSession" WHERE "userId" = p_user_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_ai_chat_stats(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key text, p_max int DEFAULT 100, p_window_secs int DEFAULT 60)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_rec RECORD;
BEGIN
  SELECT * INTO v_rec FROM public.rate_limits WHERE key = p_key FOR UPDATE;
  IF NOT FOUND OR v_rec."windowStart" < now() - (p_window_secs || ' seconds')::interval THEN
    INSERT INTO public.rate_limits (key,"windowStart",count,"maxCount")
    VALUES (p_key, now(), 1, p_max)
    ON CONFLICT (key) DO UPDATE SET "windowStart" = now(), count = 1;
    RETURN jsonb_build_object('ok',true,'remaining',p_max - 1);
  END IF;
  IF v_rec.count >= p_max THEN
    RETURN jsonb_build_object('ok',false,'retryAfter',
      EXTRACT(EPOCH FROM (v_rec."windowStart" + (p_window_secs||' seconds')::interval - now()))::int);
  END IF;
  UPDATE public.rate_limits SET count = count + 1 WHERE key = p_key;
  RETURN jsonb_build_object('ok',true,'remaining',p_max - v_rec.count - 1);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text,int,int) TO authenticated;
""")

# =========================================================================
# SECTION 18 - ADMIN FUNCTIONS
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 18 - ADMIN FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_timeseries(p_days integer DEFAULT 7)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  RETURN jsonb_build_object(
    'signups', (SELECT COUNT(*) FROM public."User" WHERE "createdAt" > now() - (p_days||' days')::interval),
    'bookings', (SELECT COUNT(*) FROM public."Booking" WHERE "createdAt" > now() - (p_days||' days')::interval),
    'revenue', (SELECT COALESCE(SUM(amount),0) FROM public."Booking"
      WHERE status = 'CONFIRMED' AND "createdAt" > now() - (p_days||' days')::interval),
    'messages', (SELECT COUNT(*) FROM public."Message" WHERE "createdAt" > now() - (p_days||' days')::interval));
END;
$func$;
GRANT EXECUTE ON FUNCTION public.admin_timeseries(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_treasury()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'total_balance', COALESCE((SELECT SUM(balance) FROM public."Wallet"),0),
    'total_escrow', COALESCE((SELECT SUM(escrow) FROM public."Wallet"),0),
    'negative_wallets', (SELECT COUNT(*) FROM public."Wallet" WHERE balance < 0),
    'pending_withdrawals', COALESCE((SELECT SUM("pendingOut") FROM public."Wallet"),0));
$$;
GRANT EXECUTE ON FUNCTION public.admin_treasury() TO authenticated;

CREATE OR REPLACE FUNCTION public.cleanup_admin_logs(p_days integer DEFAULT 90)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_count int;
BEGIN
  DELETE FROM public."AdminAuditLog" WHERE "createdAt" < now() - (p_days||' days')::interval;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.cleanup_admin_logs(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.impersonation_active(p_actor uuid, p_target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public."AdminAuditLog" l
    WHERE l.action = 'IMPERSONATE_START' AND l."userId" = p_actor::text
      AND l."targetId" = p_target::text AND l."createdAt" > now() - interval '15 minutes');
$$;
GRANT EXECUTE ON FUNCTION public.impersonation_active(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.generate_admin_api_key(p_name text, p_expires_days int DEFAULT 90)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_key text; v_hash text; v_id uuid;
BEGIN
  IF NOT public.auth_is_admin() THEN RETURN jsonb_build_object('success',false,'error','forbidden'); END IF;
  v_key := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_key, 'sha256'), 'hex');
  INSERT INTO public."AdminAPIKey" ("keyHash",name,"expiresAt","createdBy")
  VALUES (v_hash, p_name, now() + (p_expires_days||' days')::interval, (SELECT auth.uid()))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'id',v_id,'key',v_key);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.generate_admin_api_key(text,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_admin_api_key(p_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_hash text; v_rec RECORD;
BEGIN
  v_hash := encode(digest(p_key, 'sha256'), 'hex');
  SELECT * INTO v_rec FROM public."AdminAPIKey"
  WHERE "keyHash" = v_hash AND "isActive" = true
    AND ("expiresAt" IS NULL OR "expiresAt" > now())
  LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('valid',false); END IF;
  UPDATE public."AdminAPIKey" SET "lastUsedAt" = now() WHERE id = v_rec.id;
  RETURN jsonb_build_object('valid',true,'name',v_rec.name);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.validate_admin_api_key(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.auto_correct_discrepancy(p_discrepancy_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_disc RECORD;
BEGIN
  SELECT * INTO v_disc FROM public."BillingDiscrepancy" WHERE id = p_discrepancy_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  UPDATE public."BillingDiscrepancy"
  SET status = 'resolved', "autoCorrected" = true, "resolvedAt" = now()
  WHERE id = p_discrepancy_id;
  RETURN jsonb_build_object('success',true);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.auto_correct_discrepancy(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_billing_reconciliation()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'wallet_drift', (SELECT COUNT(*)::int FROM (
      SELECT w.id FROM public."Wallet" w
      LEFT JOIN public."Transaction" t ON t."walletId" = w.id
      GROUP BY w.id, w.balance
      HAVING ABS(w.balance - COALESCE(SUM(t.amount),0)) > 0.01) x),
    'open_discrepancies', (SELECT COUNT(*)::int FROM public."BillingDiscrepancy" WHERE status = 'open'));
$$;
GRANT EXECUTE ON FUNCTION public.check_billing_reconciliation() TO authenticated;

CREATE OR REPLACE FUNCTION public.dequeue_jobs(p_worker text, p_limit int DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_jobs jsonb;
BEGIN
  UPDATE public."JobQueue" SET status = 'processing', "lockedAt" = now(), "lockedBy" = p_worker,
    attempts = attempts + 1
  WHERE id IN (SELECT id FROM public."JobQueue" WHERE status = 'pending' AND "scheduledAt" <= now()
    ORDER BY "scheduledAt" LIMIT p_limit FOR UPDATE SKIP LOCKED);
  SELECT COALESCE(jsonb_agg(row_to_json(j)), '[]'::jsonb) INTO v_jobs
  FROM public."JobQueue" j WHERE j."lockedBy" = p_worker AND j.status = 'processing';
  RETURN jsonb_build_object('success',true,'jobs',v_jobs);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.dequeue_jobs(text,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_job(p_job_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  UPDATE public."JobQueue" SET status = 'completed', "completedAt" = now(), "updatedAt" = now()
  WHERE id = p_job_id;
  RETURN jsonb_build_object('success',true);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.complete_job(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fail_job(p_job_id uuid, p_error text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_rec RECORD;
BEGIN
  SELECT * INTO v_rec FROM public."JobQueue" WHERE id = p_job_id;
  IF v_rec.attempts >= v_rec."maxAttempts" THEN
    UPDATE public."JobQueue" SET status = 'failed', "failedAt" = now(), error = p_error, "updatedAt" = now()
    WHERE id = p_job_id;
  ELSE
    UPDATE public."JobQueue" SET status = 'pending', "lockedAt" = NULL, "lockedBy" = NULL,
      error = p_error, "scheduledAt" = now() + '30 seconds'::interval, "updatedAt" = now()
    WHERE id = p_job_id;
  END IF;
  RETURN jsonb_build_object('success',true);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.fail_job(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cleanup_completed_jobs(p_days int DEFAULT 7)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_count int;
BEGIN
  DELETE FROM public."JobQueue" WHERE status = 'completed' AND "completedAt" < now() - (p_days||' days')::interval;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.cleanup_completed_jobs(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.try_advisory_lock(p_key bigint)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT pg_try_advisory_xact_lock(p_key);
$$;
GRANT EXECUTE ON FUNCTION public.try_advisory_lock(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.advisory_unlock(p_key bigint)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT pg_advisory_unlock(p_key);
$$;
GRANT EXECUTE ON FUNCTION public.advisory_unlock(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_user_cascade(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  IF NOT public.auth_is_admin() THEN RETURN jsonb_build_object('success',false,'error','forbidden'); END IF;
  DELETE FROM public."Message" WHERE "senderId" = p_user_id;
  DELETE FROM public."ConversationParticipant" WHERE "userId" = p_user_id;
  DELETE FROM public."Cheer" WHERE "userId" = p_user_id;
  DELETE FROM public."Comment" WHERE "authorId" = p_user_id;
  DELETE FROM public."Post" WHERE "authorId" = p_user_id;
  DELETE FROM public."Notification" WHERE "userId" = p_user_id;
  DELETE FROM public."UserActivity" WHERE "userId" = p_user_id;
  DELETE FROM public."Transaction" WHERE "walletId" IN (SELECT id FROM public."Wallet" WHERE "userId" = p_user_id);
  DELETE FROM public."Wallet" WHERE "userId" = p_user_id;
  DELETE FROM public."Consultant" WHERE "userId" = p_user_id;
  DELETE FROM public."User" WHERE id = p_user_id;
  RETURN jsonb_build_object('success',true);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.delete_user_cascade(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.increment_spark(p_user_id uuid, p_amount int DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  UPDATE public."User" SET sparks = sparks + p_amount, "sparkScore" = "sparkScore" + p_amount,
    "updatedAt" = now() WHERE id = p_user_id;
  RETURN jsonb_build_object('success',true);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.increment_spark(uuid,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.pulse_deduct_inr(p_user_id text, p_amount double precision, p_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  RETURN public.process_wallet_deduction(p_user_id, p_amount, p_ref, 'Pulse deduction');
END;
$func$;
GRANT EXECUTE ON FUNCTION public.pulse_deduct_inr(text,double precision,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_health()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'wallet_drift_count', (SELECT COUNT(*)::int FROM (
      SELECT w.id FROM public."Wallet" w LEFT JOIN public."Transaction" t ON t."walletId" = w.id
      GROUP BY w.id, w.balance HAVING ABS(w.balance - COALESCE(SUM(t.amount),0)) > 0.01) x),
    'uncredited_bookings', (SELECT COUNT(*)::int FROM public."Booking" b
      WHERE b.status = 'CONFIRMED' AND b."consultantEarning" > 0
        AND NOT EXISTS (SELECT 1 FROM public."Transaction" t WHERE t."referenceId" = 'booking-earn:' || b.id::text)),
    'stuck_webhooks', (SELECT COUNT(*)::int FROM public."RazorpayWebhookEvent"
      WHERE processed = false AND "createdAt" < now() - interval '5 minutes'),
    'orphan_users', (SELECT COUNT(*)::int FROM public."User" u
      LEFT JOIN public."Wallet" w ON w."userId" = u.id WHERE w.id IS NULL),
    'negative_balances', (SELECT COUNT(*)::int FROM public."Wallet" WHERE balance < 0 OR escrow < 0),
    'duplicate_references', (SELECT COUNT(*)::int FROM (
      SELECT "referenceId" FROM public."Transaction" WHERE "referenceId" IS NOT NULL
      GROUP BY "referenceId" HAVING COUNT(*) > 1) x),
    'checked_at', now());
$$;
GRANT EXECUTE ON FUNCTION public.audit_health() TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.v_wallet_health()
RETURNS TABLE("walletId" uuid, "userId" uuid, balance double precision, expected double precision, drift double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT w.id, w."userId", w.balance,
    COALESCE(s.sum, 0)::double precision,
    (w.balance - COALESCE(s.sum, 0))::double precision
  FROM public."Wallet" w
  LEFT JOIN (SELECT "walletId", SUM(amount) as sum FROM public."Transaction" GROUP BY "walletId") s
    ON s."walletId" = w.id
  WHERE ABS(w.balance - COALESCE(s.sum, 0)) > 0.01;
$$;
GRANT EXECUTE ON FUNCTION public.v_wallet_health() TO authenticated;
""")

# =========================================================================
# SECTION 19 - CONSULTANT DIRECTORY / SEARCH / MATERIALIZED VIEW
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 19 - CONSULTANT DIRECTORY / SEARCH / MATERIALIZED VIEW
-- ============================================================================

-- Materialized view for consultant directory
DROP MATERIALIZED VIEW IF EXISTS public."mv_consultant_directory";
CREATE MATERIALIZED VIEW public."mv_consultant_directory" AS
SELECT
  c.id, c."userId", u.name, u.username, u.avatar_url,
  COALESCE(u.is_online, false) AS is_online, u."lastSeenAt",
  c.category, c."perMinuteRate", c.rating, c."sparkScore",
  c."isVerified", c."isActive", c.status, c.subdomain, c."subdomainActive",
  c.specialties, c.languages, c.bio, c."totalConsultations", c."searchVector",
  COALESCE(ARRAY(SELECT s.slug FROM public."ConsultantService" cs
    JOIN public."Service" s ON s.id = cs.service_id WHERE cs.consultant_id = c.id), ARRAY[]::text[]) AS service_slugs,
  COALESCE(ARRAY(SELECT s.parent_category FROM public."ConsultantService" cs
    JOIN public."Service" s ON s.id = cs.service_id WHERE cs.consultant_id = c.id), ARRAY[]::text[]) AS category_ids
FROM public."Consultant" c
JOIN public."User" u ON u.id = c."userId"
WHERE c.status = 'VERIFIED' AND c."isActive" = true AND c."isVerified" = true;

CREATE UNIQUE INDEX IF NOT EXISTS mv_consultant_directory_id ON public."mv_consultant_directory"(id);
CREATE INDEX IF NOT EXISTS mv_consultant_directory_online ON public."mv_consultant_directory"(is_online, "sparkScore" DESC);
CREATE INDEX IF NOT EXISTS mv_consultant_directory_category ON public."mv_consultant_directory"(category, rating DESC);
CREATE INDEX IF NOT EXISTS mv_consultant_directory_services ON public."mv_consultant_directory" USING GIN(service_slugs);
CREATE INDEX IF NOT EXISTS mv_consultant_directory_search ON public."mv_consultant_directory" USING GIN("searchVector");
GRANT SELECT ON public."mv_consultant_directory" TO anon, authenticated;

-- Refresh RPC (advisory-lock debounced)
CREATE OR REPLACE FUNCTION public.refresh_consultant_directory()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  IF NOT pg_try_advisory_lock(hashtext('mv_consultant_directory')) THEN RETURN; END IF;
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public."mv_consultant_directory";
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'refresh_consultant_directory failed: %', SQLERRM;
  END;
  PERFORM pg_advisory_unlock(hashtext('mv_consultant_directory'));
END;
$func$;
GRANT EXECUTE ON FUNCTION public.refresh_consultant_directory() TO authenticated;

-- search_consultants (human + AI union, direct tables — canonical from 20261001120000)
CREATE OR REPLACE FUNCTION public.search_consultants(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_category   text := NULLIF(p_filters->>'category', '');
  v_service    text := NULLIF(p_filters->>'service', '');
  v_online     boolean := COALESCE((p_filters->>'online')::boolean, false);
  v_q          text := NULLIF(TRIM(p_filters->>'q'), '');
  v_min_rating numeric := COALESCE((p_filters->>'minRating')::numeric, 0);
  v_max_rate   numeric := COALESCE((p_filters->>'maxRate')::numeric, 0);
  v_limit      int := LEAST(GREATEST(COALESCE((p_filters->>'limit')::int, 40), 1), 100);
  v_offset     int := GREATEST(COALESCE((p_filters->>'offset')::int, 0), 0);
  v_sort       text := COALESCE(p_filters->>'sort', 'relevance');
  v_result     jsonb;
BEGIN
  WITH dir AS MATERIALIZED (
    SELECT c.id::text AS id, c."userId"::text AS "userId",
      COALESCE(u.name, u.full_name, u.username) AS name, u.username, COALESCE(u.avatar, u.avatar_url) AS avatar_url,
      COALESCE(u.is_online, false) AS is_online, u."lastSeenAt", c.category, c."perMinuteRate"::numeric AS "perMinuteRate",
      c.rating::numeric AS rating, COALESCE(c."sparkScore", 0)::bigint AS "sparkScore",
      c."isVerified", c."isActive", c.status, c.subdomain, c."subdomainActive",
      c.specialties, c.languages, COALESCE(c.bio, u.bio) AS bio, c."totalConsultations",
      COALESCE(ARRAY(SELECT s.slug FROM public."ConsultantService" cs JOIN public."Service" s ON s.id = cs.service_id WHERE cs.consultant_id = c.id), ARRAY[]::text[]) AS service_slugs,
      ARRAY[public.category_slug(c.category)] AS category_ids, false AS "isAI"
    FROM public."Consultant" c JOIN public."User" u ON u.id = c."userId"
    WHERE c.status = 'VERIFIED' AND c."isActive" = true
    UNION ALL
    SELECT a.id, a.id AS "userId", a.name, a.username, a.avatar, true AS is_online, NULL::timestamptz AS "lastSeenAt",
      a.category, (CASE WHEN a."isPaid" THEN a."perMinuteRate" ELSE 0 END)::numeric AS "perMinuteRate",
      a.rating::numeric AS rating, COALESCE(a.sparks, 0)::bigint AS "sparkScore",
      true AS "isVerified", a."isActive", 'VERIFIED'::text AS status, NULL::text AS subdomain, false AS "subdomainActive",
      a.specialties, a.languages, a.bio, a."totalConsultations",
      ARRAY[]::text[] AS service_slugs, ARRAY[public.category_slug(a.category)] AS category_ids, true AS "isAI"
    FROM public."AIConsultant" a WHERE a."isActive" = true
  ),
  filtered AS MATERIALIZED (
    SELECT d.* FROM dir d
    WHERE (v_category IS NULL OR public.category_slug(d.category) = LOWER(v_category) OR UPPER(d.category) = UPPER(v_category) OR LOWER(v_category) = ANY(d.category_ids))
      AND (v_service IS NULL OR v_service = ANY(d.service_slugs))
      AND (NOT v_online OR d.is_online)
      AND (v_min_rating <= 0 OR d.rating >= v_min_rating)
      AND (v_max_rate <= 0 OR d."perMinuteRate" <= v_max_rate)
      AND (v_q IS NULL OR d.name ILIKE '%' || v_q || '%' OR d.username ILIKE '%' || v_q || '%'
           OR d.bio ILIKE '%' || v_q || '%' OR d.category ILIKE '%' || v_q || '%'
           OR EXISTS (SELECT 1 FROM unnest(d.specialties) sp WHERE sp ILIKE '%' || v_q || '%'))
  ),
  page AS (
    SELECT f.* FROM filtered f
    ORDER BY
      CASE WHEN v_sort IN ('price_asc','price-asc') THEN f."perMinuteRate" END ASC NULLS LAST,
      CASE WHEN v_sort IN ('price_desc','price-desc') THEN f."perMinuteRate" END DESC NULLS LAST,
      CASE WHEN v_sort = 'rating' THEN f.rating END DESC NULLS LAST,
      f.is_online DESC, f."isAI" ASC, f."sparkScore" DESC NULLS LAST, f.rating DESC NULLS LAST, f.name ASC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'consultants', COALESCE((SELECT jsonb_agg(row_to_json(p)) FROM page p), '[]'::jsonb),
    'total', (SELECT COUNT(*) FROM filtered), 'limit', v_limit, 'offset', v_offset, 'source', 'union'
  ) INTO v_result;
  RETURN v_result;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.search_consultants(jsonb) TO anon, authenticated;

-- category_counts with mapped slugs
CREATE OR REPLACE FUNCTION public.category_counts()
RETURNS TABLE("categoryId" text, count bigint, "onlineCount" bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $func$
  SELECT slug AS "categoryId", COUNT(*)::bigint, COUNT(*) FILTER (WHERE is_online)::bigint
  FROM (
    SELECT public.category_slug(c.category) AS slug, COALESCE(u.is_online, false) AS is_online
    FROM public."Consultant" c JOIN public."User" u ON u.id = c."userId"
    WHERE c.status = 'VERIFIED' AND c."isActive" = true
    UNION ALL
    SELECT public.category_slug(a.category), true FROM public."AIConsultant" a WHERE a."isActive" = true
  ) t GROUP BY slug;
$func$;
GRANT EXECUTE ON FUNCTION public.category_counts() TO anon, authenticated;

-- Stale presence cleanup
CREATE OR REPLACE FUNCTION public.cleanup_stale_online_users(p_stale_after_seconds int DEFAULT 120)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_count int;
BEGIN
  UPDATE public."User" SET "is_online" = false, "updatedAt" = now()
  WHERE "is_online" = true AND ("lastSeenAt" IS NULL OR "lastSeenAt" < now() - (p_stale_after_seconds || ' seconds')::interval);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN BEGIN PERFORM public.refresh_consultant_directory(); EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
  RETURN v_count;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_online_users(int) TO authenticated;

-- MV auto-refresh trigger on Consultant changes
CREATE OR REPLACE FUNCTION public.trg_fn_consultant_refresh_mv()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  BEGIN PERFORM public.refresh_consultant_directory(); EXCEPTION WHEN OTHERS THEN RAISE WARNING 'mv refresh skipped: %', SQLERRM; END;
  RETURN COALESCE(NEW, OLD);
END;
$func$;
DROP TRIGGER IF EXISTS trg_consultant_refresh_mv ON public."Consultant";
CREATE TRIGGER trg_consultant_refresh_mv
  AFTER INSERT OR UPDATE OF status, "isActive", "isVerified", rating, "sparkScore", specialties
  ON public."Consultant" FOR EACH ROW EXECUTE FUNCTION public.trg_fn_consultant_refresh_mv();
""")

# =========================================================================
# SECTION 20 - BROADCAST TRIGGERS
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 20 - BROADCAST TRIGGERS
-- ============================================================================

-- 1. Message -> room + participant inboxes
CREATE OR REPLACE FUNCTION public.trg_fn_message_broadcast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
DECLARE p record;
BEGIN
  PERFORM public.safe_broadcast('room:' || NEW."conversationId"::text || ':messages', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD));
  FOR p IN SELECT "userId" FROM public."ConversationParticipant" WHERE "conversationId" = NEW."conversationId" LOOP
    PERFORM public.safe_broadcast('user:' || p."userId"::text || ':inbox', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD));
  END LOOP;
  RETURN NEW;
END;
$func$;
DROP TRIGGER IF EXISTS trg_broadcast_message ON public."Message";
CREATE TRIGGER trg_broadcast_message AFTER INSERT ON public."Message" FOR EACH ROW EXECUTE FUNCTION public.trg_fn_message_broadcast();

-- 2. Wallet -> user:{uid}:wallet
CREATE OR REPLACE FUNCTION public.trg_fn_wallet_broadcast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  PERFORM public.safe_broadcast('user:' || NEW."userId"::text || ':wallet', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD));
  RETURN NEW;
END;
$func$;
DROP TRIGGER IF EXISTS trg_broadcast_wallet ON public."Wallet";
CREATE TRIGGER trg_broadcast_wallet AFTER UPDATE ON public."Wallet" FOR EACH ROW EXECUTE FUNCTION public.trg_fn_wallet_broadcast();

-- 3. Transaction -> user:{uid}:wallet:ledger
CREATE OR REPLACE FUNCTION public.trg_fn_ledger_broadcast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
DECLARE owner_id text;
BEGIN
  SELECT "userId"::text INTO owner_id FROM public."Wallet" WHERE id = NEW."walletId";
  IF owner_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.safe_broadcast('user:' || owner_id || ':wallet:ledger', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD));
  RETURN NEW;
END;
$func$;
DROP TRIGGER IF EXISTS trg_broadcast_ledger_entry ON public."Transaction";
CREATE TRIGGER trg_broadcast_ledger_entry AFTER INSERT ON public."Transaction" FOR EACH ROW EXECUTE FUNCTION public.trg_fn_ledger_broadcast();

-- 4. Notification -> user:{uid}:notifications
CREATE OR REPLACE FUNCTION public.trg_fn_notification_broadcast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  PERFORM public.safe_broadcast('user:' || NEW."userId"::text || ':notifications', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD));
  RETURN NEW;
END;
$func$;
DROP TRIGGER IF EXISTS trg_broadcast_notification ON public."Notification";
CREATE TRIGGER trg_broadcast_notification AFTER INSERT ON public."Notification" FOR EACH ROW EXECUTE FUNCTION public.trg_fn_notification_broadcast();

-- 5. Booking -> admin + booking status
CREATE OR REPLACE FUNCTION public.trg_fn_booking_broadcast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  PERFORM public.safe_broadcast('admin:bookings', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD));
  PERFORM public.safe_broadcast('booking:' || NEW.id::text || ':status', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD));
  RETURN NEW;
END;
$func$;
DROP TRIGGER IF EXISTS trg_broadcast_booking ON public."Booking";
CREATE TRIGGER trg_broadcast_booking AFTER INSERT OR UPDATE ON public."Booking" FOR EACH ROW EXECUTE FUNCTION public.trg_fn_booking_broadcast();

-- 6. Consultant -> sparks + verification
CREATE OR REPLACE FUNCTION public.trg_fn_consultant_broadcast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  IF NEW."sparkScore" IS DISTINCT FROM OLD."sparkScore" THEN
    PERFORM public.safe_broadcast('consultant:' || NEW."userId"::text || ':sparks', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD));
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.safe_broadcast('admin:verification', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD));
  END IF;
  RETURN NEW;
END;
$func$;
DROP TRIGGER IF EXISTS trg_broadcast_consultant ON public."Consultant";
CREATE TRIGGER trg_broadcast_consultant AFTER UPDATE ON public."Consultant" FOR EACH ROW EXECUTE FUNCTION public.trg_fn_consultant_broadcast();

-- 7. AIConsultant -> public updates
CREATE OR REPLACE FUNCTION public.trg_fn_ai_consultant_broadcast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  PERFORM public.safe_broadcast('consultant:ai:updates', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA,
    CASE WHEN NEW IS NULL THEN NULL ELSE to_jsonb(NEW) END, CASE WHEN OLD IS NULL THEN NULL ELSE to_jsonb(OLD) END);
  RETURN COALESCE(NEW, OLD);
END;
$func$;
DROP TRIGGER IF EXISTS trg_broadcast_ai_consultant ON public."AIConsultant";
CREATE TRIGGER trg_broadcast_ai_consultant AFTER INSERT OR UPDATE OR DELETE ON public."AIConsultant" FOR EACH ROW EXECUTE FUNCTION public.trg_fn_ai_consultant_broadcast();

-- 8. Directory -> consultants:live (public)
CREATE OR REPLACE FUNCTION public.trg_fn_directory_broadcast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  PERFORM public.safe_broadcast('consultants:live', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA,
    CASE WHEN NEW IS NULL THEN NULL ELSE to_jsonb(NEW) END, CASE WHEN OLD IS NULL THEN NULL ELSE to_jsonb(OLD) END);
  RETURN COALESCE(NEW, OLD);
END;
$func$;
DROP TRIGGER IF EXISTS trg_broadcast_consultant_directory ON public."Consultant";
CREATE TRIGGER trg_broadcast_consultant_directory AFTER INSERT OR UPDATE OR DELETE ON public."Consultant" FOR EACH ROW EXECUTE FUNCTION public.trg_fn_directory_broadcast();

-- 9. Post -> feed:posts
CREATE OR REPLACE FUNCTION public.trg_fn_post_broadcast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  IF NEW."isFlagged" = false THEN
    PERFORM public.safe_broadcast('feed:posts', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD));
  END IF;
  RETURN NEW;
END;
$func$;
DROP TRIGGER IF EXISTS trg_broadcast_post ON public."Post";
CREATE TRIGGER trg_broadcast_post AFTER INSERT OR UPDATE ON public."Post" FOR EACH ROW EXECUTE FUNCTION public.trg_fn_post_broadcast();

-- 10. User presence -> consultants:live
CREATE OR REPLACE FUNCTION public.broadcast_user_presence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  IF NEW.is_online IS DISTINCT FROM OLD.is_online THEN
    PERFORM realtime.broadcast_changes('consultants:live', 'UPDATE', 'UPDATE', 'User', 'public',
      jsonb_build_object('consultantId', NEW.id::text, 'is_online', NEW.is_online, 'at', now()),
      jsonb_build_object('consultantId', OLD.id::text, 'is_online', OLD.is_online));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'broadcast_user_presence: %', SQLERRM; RETURN NEW;
END;
$func$;
DROP TRIGGER IF EXISTS trg_broadcast_user_presence ON public."User";
CREATE TRIGGER trg_broadcast_user_presence AFTER UPDATE OF is_online ON public."User" FOR EACH ROW EXECUTE FUNCTION public.broadcast_user_presence();

-- 11. User avatar -> user:profile:{uid}
CREATE OR REPLACE FUNCTION public.trg_fn_user_avatar_broadcast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  IF OLD.avatar IS DISTINCT FROM NEW.avatar THEN
    PERFORM public.safe_broadcast('user:profile:' || NEW.id::text, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA,
      jsonb_build_object('userId', NEW.id, 'avatar', NEW.avatar), jsonb_build_object('userId', OLD.id, 'avatar', OLD.avatar));
  END IF;
  RETURN NEW;
END;
$func$;
DROP TRIGGER IF EXISTS trg_broadcast_user_avatar ON public."User";
CREATE TRIGGER trg_broadcast_user_avatar AFTER UPDATE ON public."User" FOR EACH ROW EXECUTE FUNCTION public.trg_fn_user_avatar_broadcast();

-- 12. RazorpayPayment -> admin:payments
CREATE OR REPLACE FUNCTION public.broadcast_razorpay_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  PERFORM public.safe_broadcast('admin:payments', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD));
  RETURN NEW;
END;
$func$;
DROP TRIGGER IF EXISTS trg_broadcast_razorpay ON public."RazorpayPayment";
CREATE TRIGGER trg_broadcast_razorpay AFTER INSERT OR UPDATE ON public."RazorpayPayment" FOR EACH ROW EXECUTE FUNCTION public.broadcast_razorpay_changes();

-- 13. BillingHeartbeat -> admin:billing
CREATE OR REPLACE FUNCTION public.broadcast_billing_heartbeat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  PERFORM public.safe_broadcast('admin:billing', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, to_jsonb(NEW), to_jsonb(OLD));
  RETURN NEW;
END;
$func$;
DROP TRIGGER IF EXISTS trg_broadcast_billing ON public."BillingHeartbeat";
CREATE TRIGGER trg_broadcast_billing AFTER INSERT ON public."BillingHeartbeat" FOR EACH ROW EXECUTE FUNCTION public.broadcast_billing_heartbeat();

-- 14. BirthProfile -> user:{uid}:birth-profile (pg_notify)
CREATE OR REPLACE FUNCTION public.birth_profile_realtime_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
  PERFORM pg_notify('realtime', jsonb_build_object(
    'topic', 'user:' || NEW."userId" || ':birth-profile', 'event', 'UPDATED',
    'payload', jsonb_build_object('fullName', NEW."fullName", 'dateOfBirth', NEW."dateOfBirth",
      'timeOfBirth', NEW."timeOfBirth", 'placeOfBirth', NEW."placeOfBirth", 'primaryConcern', NEW."primaryConcern")
  )::text);
  RETURN NEW;
END;
$func$;
DROP TRIGGER IF EXISTS trg_birth_profile_realtime ON public."BirthProfile";
CREATE TRIGGER trg_birth_profile_realtime AFTER INSERT OR UPDATE ON public."BirthProfile" FOR EACH ROW EXECUTE FUNCTION public.birth_profile_realtime_notify();
""")

# =========================================================================
# SECTION 21 - ROW LEVEL SECURITY POLICIES
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 21 - ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable + Force RLS on all user-data tables
DO $$
DECLARE t text;
  skip text[] := ARRAY['Category','Service','rate_limits'];
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT (c.relname = ANY(skip))
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- User
DROP POLICY IF EXISTS user_self_select ON public."User";
DROP POLICY IF EXISTS user_self_insert ON public."User";
DROP POLICY IF EXISTS user_self_update ON public."User";
DROP POLICY IF EXISTS user_admin_all ON public."User";
CREATE POLICY user_self_select ON public."User" FOR SELECT USING (id = (SELECT auth.uid()));
CREATE POLICY user_self_insert ON public."User" FOR INSERT WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY user_self_update ON public."User" FOR UPDATE USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid())
    AND role IS NOT DISTINCT FROM (SELECT role FROM public."User" WHERE id = (SELECT auth.uid()))
    AND sparks IS NOT DISTINCT FROM (SELECT sparks FROM public."User" WHERE id = (SELECT auth.uid()))
    AND "isVerified" IS NOT DISTINCT FROM (SELECT "isVerified" FROM public."User" WHERE id = (SELECT auth.uid()))
    AND "sparkScore" IS NOT DISTINCT FROM (SELECT "sparkScore" FROM public."User" WHERE id = (SELECT auth.uid())));
CREATE POLICY user_admin_all ON public."User" FOR ALL USING ((SELECT public.auth_is_admin()));

-- Wallet (read-only for owner; writes via SECURITY DEFINER RPC)
DROP POLICY IF EXISTS wallet_owner_read ON public."Wallet";
DROP POLICY IF EXISTS wallet_admin_read ON public."Wallet";
CREATE POLICY wallet_owner_read ON public."Wallet" FOR SELECT USING ("userId" = (SELECT auth.uid()));
CREATE POLICY wallet_admin_read ON public."Wallet" FOR SELECT USING ((SELECT public.auth_is_admin()));

-- Transaction (read-only for owner)
DROP POLICY IF EXISTS tx_owner_read ON public."Transaction";
DROP POLICY IF EXISTS tx_admin_read ON public."Transaction";
CREATE POLICY tx_owner_read ON public."Transaction" FOR SELECT USING ("walletId" IN (SELECT id FROM public."Wallet" WHERE "userId" = (SELECT auth.uid())));
CREATE POLICY tx_admin_read ON public."Transaction" FOR SELECT USING ((SELECT public.auth_is_admin()));

-- Consultant
DROP POLICY IF EXISTS consultant_public_read ON public."Consultant";
DROP POLICY IF EXISTS consultant_self_manage ON public."Consultant";
DROP POLICY IF EXISTS consultant_admin_all ON public."Consultant";
CREATE POLICY consultant_public_read ON public."Consultant" FOR SELECT USING (status = 'VERIFIED' AND "isActive" = true);
CREATE POLICY consultant_self_manage ON public."Consultant" FOR UPDATE USING ("userId" = (SELECT auth.uid())) WITH CHECK ("userId" = (SELECT auth.uid()));
CREATE POLICY consultant_admin_all ON public."Consultant" FOR ALL USING ((SELECT public.auth_is_admin()));

-- AIConsultant
DROP POLICY IF EXISTS ai_consultants_public_read ON public."AIConsultant";
DROP POLICY IF EXISTS ai_consultants_admin_all ON public."AIConsultant";
CREATE POLICY ai_consultants_public_read ON public."AIConsultant" FOR SELECT USING ("isActive" = true);
CREATE POLICY ai_consultants_admin_all ON public."AIConsultant" FOR ALL USING ((SELECT public.auth_is_admin()));

-- Booking
DROP POLICY IF EXISTS booking_participants ON public."Booking";
DROP POLICY IF EXISTS booking_user_insert ON public."Booking";
DROP POLICY IF EXISTS booking_admin_all ON public."Booking";
CREATE POLICY booking_participants ON public."Booking" FOR SELECT USING (
  "userId" = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public."Consultant" c WHERE c.id = "Booking"."consultantId" AND c."userId" = (SELECT auth.uid())));
CREATE POLICY booking_user_insert ON public."Booking" FOR INSERT WITH CHECK ("userId" = (SELECT auth.uid()));
CREATE POLICY booking_admin_all ON public."Booking" FOR ALL USING ((SELECT public.auth_is_admin()));

-- CallSession
DROP POLICY IF EXISTS callsession_participants ON public."CallSession";
CREATE POLICY callsession_participants ON public."CallSession" FOR SELECT USING (
  "userId" = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public."Consultant" c WHERE c.id = "CallSession"."consultantId" AND c."userId" = (SELECT auth.uid())));

-- Post
DROP POLICY IF EXISTS posts_public_read ON public."Post";
DROP POLICY IF EXISTS posts_author_insert ON public."Post";
DROP POLICY IF EXISTS posts_author_update ON public."Post";
DROP POLICY IF EXISTS posts_author_delete ON public."Post";
CREATE POLICY posts_public_read ON public."Post" FOR SELECT USING ("isFlagged" = false);
CREATE POLICY posts_author_insert ON public."Post" FOR INSERT WITH CHECK ("authorId" = (SELECT auth.uid()));
CREATE POLICY posts_author_update ON public."Post" FOR UPDATE USING ("authorId" = (SELECT auth.uid()));
CREATE POLICY posts_author_delete ON public."Post" FOR DELETE USING ("authorId" = (SELECT auth.uid()));

-- Comment
DROP POLICY IF EXISTS comments_public_read ON public."Comment";
DROP POLICY IF EXISTS comments_author_insert ON public."Comment";
CREATE POLICY comments_public_read ON public."Comment" FOR SELECT USING (true);
CREATE POLICY comments_author_insert ON public."Comment" FOR INSERT WITH CHECK ("authorId" = (SELECT auth.uid()));

-- Cheer
DROP POLICY IF EXISTS cheers_public_read ON public."Cheer";
DROP POLICY IF EXISTS cheers_self_write ON public."Cheer";
DROP POLICY IF EXISTS cheers_self_delete ON public."Cheer";
CREATE POLICY cheers_public_read ON public."Cheer" FOR SELECT USING (true);
CREATE POLICY cheers_self_write ON public."Cheer" FOR INSERT WITH CHECK ("userId" = (SELECT auth.uid()));
CREATE POLICY cheers_self_delete ON public."Cheer" FOR DELETE USING ("userId" = (SELECT auth.uid()));

-- Notification
DROP POLICY IF EXISTS notif_owner_read ON public."Notification";
DROP POLICY IF EXISTS notif_owner_update ON public."Notification";
CREATE POLICY notif_owner_read ON public."Notification" FOR SELECT USING ("userId" = (SELECT auth.uid()));
CREATE POLICY notif_owner_update ON public."Notification" FOR UPDATE USING ("userId" = (SELECT auth.uid()));

-- Conversation / Participant / Message (using helper to avoid recursion)
DROP POLICY IF EXISTS conversation_participant_read ON public."Conversation";
CREATE POLICY conversation_participant_read ON public."Conversation" FOR SELECT TO authenticated
  USING (public.user_is_in_conversation("Conversation".id));

DROP POLICY IF EXISTS participant_self_read ON public."ConversationParticipant";
CREATE POLICY participant_self_read ON public."ConversationParticipant" FOR SELECT TO authenticated
  USING ("userId" = (SELECT auth.uid()) OR public.user_is_in_conversation("ConversationParticipant"."conversationId"));

DROP POLICY IF EXISTS message_participant_read ON public."Message";
DROP POLICY IF EXISTS message_participant_send ON public."Message";
CREATE POLICY message_participant_read ON public."Message" FOR SELECT TO authenticated
  USING (public.user_is_in_conversation("Message"."conversationId"));
CREATE POLICY message_participant_send ON public."Message" FOR INSERT TO authenticated
  WITH CHECK ("senderId" = (SELECT auth.uid()) AND public.user_is_in_conversation("Message"."conversationId"));

-- ConsultantService / ConsultantDraft
DROP POLICY IF EXISTS consultant_service_public_read ON public."ConsultantService";
DROP POLICY IF EXISTS consultant_service_self_write ON public."ConsultantService";
CREATE POLICY consultant_service_public_read ON public."ConsultantService" FOR SELECT USING (true);
CREATE POLICY consultant_service_self_write ON public."ConsultantService" FOR ALL
  USING (consultant_id IN (SELECT id FROM public."Consultant" WHERE "userId" = (SELECT auth.uid())));

DROP POLICY IF EXISTS consultant_draft_self ON public."ConsultantDraft";
CREATE POLICY consultant_draft_self ON public."ConsultantDraft" FOR ALL USING ("userId" = (SELECT auth.uid())) WITH CHECK ("userId" = (SELECT auth.uid()));

-- UserPreferences / UserActivity
DROP POLICY IF EXISTS prefs_owner_all ON public."UserPreferences";
DROP POLICY IF EXISTS activity_owner_all ON public."UserActivity";
CREATE POLICY prefs_owner_all ON public."UserPreferences" FOR ALL USING ("userId" = (SELECT auth.uid()));
CREATE POLICY activity_owner_all ON public."UserActivity" FOR ALL USING ("userId" = (SELECT auth.uid()));

-- Public catalogs (read-only)
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

-- Admin-only tables
DO $$
DECLARE t text; admin_tables text[] := ARRAY['AdminAuditLog','AdminInvite','AdminLoginAttempt','DebugLog'];
BEGIN
  FOREACH t IN ARRAY admin_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r') THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING ((SELECT public.auth_is_admin()))', t || '_admin_all', t);
    END IF;
  END LOOP;
END $$;

-- RazorpayPayment
DO $$ BEGIN
  IF to_regclass('public."RazorpayPayment"') IS NOT NULL THEN
    ALTER TABLE public."RazorpayPayment" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS rzp_owner_read ON public."RazorpayPayment";
    CREATE POLICY rzp_owner_read ON public."RazorpayPayment" FOR SELECT USING ("userId" = (SELECT auth.uid()));
  END IF;
END $$;

-- BillingHeartbeat
DO $$ BEGIN
  IF to_regclass('public."BillingHeartbeat"') IS NOT NULL THEN
    ALTER TABLE public."BillingHeartbeat" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS bh_session_read ON public."BillingHeartbeat";
    CREATE POLICY bh_session_read ON public."BillingHeartbeat" FOR SELECT USING (
      EXISTS (SELECT 1 FROM public."CallSession" cs WHERE cs.id = "BillingHeartbeat"."sessionId" AND cs."userId" = (SELECT auth.uid())));
  END IF;
END $$;

-- rate_limits (no public access)
DO $$ BEGIN
  IF to_regclass('public.rate_limits') IS NOT NULL THEN
    ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.rate_limits FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS rate_limits_no_public ON public.rate_limits;
    CREATE POLICY rate_limits_no_public ON public.rate_limits FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
END $$;

-- AIChatRateLimit
DO $$ BEGIN
  IF to_regclass('public."AIChatRateLimit"') IS NOT NULL THEN
    ALTER TABLE public."AIChatRateLimit" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public."AIChatRateLimit" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS ai_rate_limit_owner ON public."AIChatRateLimit";
    CREATE POLICY ai_rate_limit_owner ON public."AIChatRateLimit" FOR ALL USING ("userId" = (SELECT auth.uid())) WITH CHECK ("userId" = (SELECT auth.uid()));
  END IF;
END $$;

-- BirthProfile
DROP POLICY IF EXISTS user_read_own_birth_profile ON public."BirthProfile";
DROP POLICY IF EXISTS user_update_own_birth_profile ON public."BirthProfile";
CREATE POLICY user_read_own_birth_profile ON public."BirthProfile" FOR SELECT USING (auth.uid() = "userId");
CREATE POLICY user_update_own_birth_profile ON public."BirthProfile" FOR ALL USING (auth.uid() = "userId") WITH CHECK (auth.uid() = "userId");

-- AdminAPIKey
DO $$ BEGIN
  IF to_regclass('public."AdminAPIKey"') IS NOT NULL THEN
    ALTER TABLE public."AdminAPIKey" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS admin_api_keys_select ON public."AdminAPIKey";
    CREATE POLICY admin_api_keys_select ON public."AdminAPIKey" FOR SELECT USING (
      "adminId" = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public."User" WHERE "User".id = (SELECT auth.uid()) AND role IN ('SUPER_ADMIN','ADMIN')));
    DROP POLICY IF EXISTS admin_api_keys_insert ON public."AdminAPIKey";
    CREATE POLICY admin_api_keys_insert ON public."AdminAPIKey" FOR INSERT WITH CHECK (
      "adminId" = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public."User" WHERE "User".id = (SELECT auth.uid()) AND role = 'SUPER_ADMIN'));
    DROP POLICY IF EXISTS admin_api_keys_delete ON public."AdminAPIKey";
    CREATE POLICY admin_api_keys_delete ON public."AdminAPIKey" FOR DELETE USING (
      "adminId" = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public."User" WHERE "User".id = (SELECT auth.uid()) AND role = 'SUPER_ADMIN'));
  END IF;
END $$;

-- ContentReport
DO $$ BEGIN
  IF to_regclass('public."ContentReport"') IS NOT NULL THEN
    ALTER TABLE public."ContentReport" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS content_report_insert ON public."ContentReport";
    CREATE POLICY content_report_insert ON public."ContentReport" FOR INSERT WITH CHECK (auth.uid() = "reporterId");
    DROP POLICY IF EXISTS content_report_select_own ON public."ContentReport";
    CREATE POLICY content_report_select_own ON public."ContentReport" FOR SELECT USING (auth.uid() = "reporterId");
    DROP POLICY IF EXISTS content_report_select_admin ON public."ContentReport";
    CREATE POLICY content_report_select_admin ON public."ContentReport" FOR SELECT USING (
      EXISTS (SELECT 1 FROM public."User" WHERE "User".id = auth.uid() AND role IN ('SUPER_ADMIN','ADMIN','SUPPORT')));
    DROP POLICY IF EXISTS content_report_update_admin ON public."ContentReport";
    CREATE POLICY content_report_update_admin ON public."ContentReport" FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public."User" WHERE "User".id = auth.uid() AND role IN ('SUPER_ADMIN','ADMIN','SUPPORT')));
  END IF;
END $$;

-- BillingDiscrepancy
DO $$ BEGIN
  IF to_regclass('public."BillingDiscrepancy"') IS NOT NULL THEN
    ALTER TABLE public."BillingDiscrepancy" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS billing_discrepancy_select ON public."BillingDiscrepancy";
    CREATE POLICY billing_discrepancy_select ON public."BillingDiscrepancy" FOR SELECT USING (
      EXISTS (SELECT 1 FROM public."User" WHERE "User".id = auth.uid() AND role IN ('SUPER_ADMIN','ADMIN')));
    DROP POLICY IF EXISTS billing_discrepancy_insert ON public."BillingDiscrepancy";
    CREATE POLICY billing_discrepancy_insert ON public."BillingDiscrepancy" FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public."User" WHERE "User".id = auth.uid() AND role IN ('SUPER_ADMIN','ADMIN')));
    DROP POLICY IF EXISTS billing_discrepancy_update ON public."BillingDiscrepancy";
    CREATE POLICY billing_discrepancy_update ON public."BillingDiscrepancy" FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public."User" WHERE "User".id = auth.uid() AND role IN ('SUPER_ADMIN','ADMIN')));
  END IF;
END $$;

-- JobQueue (service role only)
DO $$ BEGIN
  IF to_regclass('public."JobQueue"') IS NOT NULL THEN
    ALTER TABLE public."JobQueue" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS service_role_full_access ON public."JobQueue";
    CREATE POLICY service_role_full_access ON public."JobQueue" FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- LedgerEntry
DO $$ BEGIN
  IF to_regclass('public."LedgerEntry"') IS NOT NULL THEN
    ALTER TABLE public."LedgerEntry" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS ledger_entry_owner_read ON public."LedgerEntry";
    CREATE POLICY ledger_entry_owner_read ON public."LedgerEntry" FOR SELECT USING (
      "walletId" IN (SELECT id FROM public."Wallet" WHERE "userId" = (SELECT auth.uid())));
  END IF;
END $$;

-- AIChatSession
DO $$ BEGIN
  IF to_regclass('public."AIChatSession"') IS NOT NULL THEN
    ALTER TABLE public."AIChatSession" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS ai_chat_session_owner ON public."AIChatSession";
    CREATE POLICY ai_chat_session_owner ON public."AIChatSession" FOR SELECT USING ("userId" = (SELECT auth.uid()));
  END IF;
END $$;
""")

# =========================================================================
# SECTION 22 - SEED DATA
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 22 - SEED DATA
-- ============================================================================

-- Categories
INSERT INTO public."Category" (id, name, display_name, sort_order) VALUES
  ('astrology','Astrology & Divination','Astrology & Divination',1),
  ('tarot','Tarot & Oracle','Tarot & Oracle',2),
  ('numerology','Numerology','Numerology',3),
  ('palmistry','Palmistry','Palmistry',4),
  ('therapy','Mental Health & Therapy','Mental Health & Therapy',5),
  ('wellness','Wellness & Holistic Health','Wellness & Holistic Health',6),
  ('life-coaching','Life & Career Coaching','Life & Career Coaching',7),
  ('energy-healing','Energy Healing & Reiki','Energy Healing & Reiki',8),
  ('meditation','Meditation & Mindfulness','Meditation & Mindfulness',9),
  ('yoga','Yoga & Movement Therapy','Yoga & Movement Therapy',10),
  ('psychic','Psychic Mediumship','Psychic Mediumship',11),
  ('clairvoyance','Clairvoyance & Intuition','Clairvoyance & Intuition',12),
  ('dreams','Dream Analysis','Dream Analysis',13),
  ('angels','Angel & Spirit Guides','Angel & Spirit Guides',14),
  ('aura','Aura Reading & Cleansing','Aura Reading & Cleansing',15),
  ('past-life','Past Life & Soul Purpose','Past Life & Soul Purpose',16),
  ('shadow-work','Shadow Work & Ancestral','Shadow Work & Ancestral',17),
  ('relationship-coaching','Relationship & Dating','Relationship & Dating',18),
  ('health-coaching','Health & Nutrition Coaching','Health & Nutrition Coaching',19),
  ('business-coaching','Business Coaching','Business Coaching',20)
ON CONFLICT (id) DO NOTHING;

-- Services
INSERT INTO public."Service" (name, slug, parent_category) VALUES
  ('Vedic Astrology','vedic-astrology','astrology'),
  ('Western Astrology','western-astrology','astrology'),
  ('Birth Chart / Kundli','birth-chart-kundli','astrology'),
  ('Compatibility','compatibility','astrology'),
  ('Rider-Waite Tarot','rider-waite-tarot','tarot'),
  ('Oracle Cards','oracle-cards','tarot'),
  ('Life Path Number','life-path-number','numerology'),
  ('Palm Reading','palm-reading','palmistry'),
  ('Individual Therapy','individual-therapy','therapy'),
  ('Couples Therapy','couples-therapy','therapy'),
  ('CBT','cbt','therapy'),
  ('DBT','dbt','therapy'),
  ('EMDR','emdr','therapy'),
  ('Reiki','reiki','energy-healing'),
  ('Pranic Healing','pranic-healing','energy-healing'),
  ('Guided Meditation','guided-meditation','meditation'),
  ('Breathwork','breathwork','meditation'),
  ('Hatha Yoga','hatha-yoga','yoga'),
  ('Vinyasa Yoga','vinyasa-yoga','yoga'),
  ('Life Coaching','life-coaching','life-coaching'),
  ('Career Coaching','career-coaching','life-coaching'),
  ('Executive Coaching','executive-coaching','life-coaching'),
  ('Nutrition Counseling','nutrition-counseling','health-coaching')
ON CONFLICT (slug) DO NOTHING;

-- AI shadow users (mirror AIConsultant into User with role='AI')
INSERT INTO public."User" (id, email, username, name, avatar, role, "isVerified", "is_online")
SELECT a.id,
  COALESCE(a.username, 'ai_' || LEFT(a.id::text, 8)) || '@ai.zeal.local',
  COALESCE(a.username, 'ai_' || LEFT(a.id::text, 8)),
  a.name, a.avatar, 'AI', true, true
FROM public."AIConsultant" a
ON CONFLICT (id) DO NOTHING;

-- Wallets for AI users
INSERT INTO public."Wallet" ("userId", balance)
SELECT id, 0 FROM public."User" WHERE role = 'AI'
ON CONFLICT ("userId") DO NOTHING;
""")

# =========================================================================
# SECTION 23 - REALTIME PUBLICATION + RLS ON realtime.messages
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 23 - REALTIME PUBLICATION + RLS ON realtime.messages
-- ============================================================================

-- Ensure key tables are in the supabase_realtime publication
DO $$
DECLARE tbl text;
  tables text[] := ARRAY['Message','Conversation','Wallet','Transaction','Consultant','AIConsultant',
    'Booking','CallSession','Notification','Post','User','Comment','Cheer','BirthProfile',
    'RazorpayPayment','BillingHeartbeat'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl) THEN
      BEGIN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl); EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
  END LOOP;
END $$;

-- REPLICA IDENTITY FULL on all realtime tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Message','Conversation','Wallet','Transaction','Consultant','AIConsultant',
    'Booking','CallSession','Notification','Post','User','Comment','Cheer','BirthProfile',
    'RazorpayPayment','BillingHeartbeat'] LOOP
    BEGIN EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

-- RLS on realtime.messages
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "realtime_public_channels" ON realtime.messages;
CREATE POLICY "realtime_public_channels" ON realtime.messages
  FOR SELECT TO anon, authenticated
  USING (realtime.topic() IN ('consultant:ai:updates', 'consultants:live'));

DROP POLICY IF EXISTS "realtime_user_channels" ON realtime.messages;
CREATE POLICY "realtime_user_channels" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE 'user:' || (SELECT auth.uid())::text || ':%'
    OR realtime.topic() LIKE 'consultant:' || (SELECT auth.uid())::text || ':%'
    OR (realtime.topic() LIKE 'room:%' AND public.user_is_in_conversation(
      SUBSTRING(realtime.topic() FROM 'room:([0-9a-f-]{36}):')::uuid))
    OR (realtime.topic() LIKE 'booking:%' AND public.user_can_view_booking(
      SUBSTRING(realtime.topic() FROM 'booking:([0-9a-f-]{36}):')::uuid))
    OR realtime.topic() LIKE 'presence:%'
  );

DROP POLICY IF EXISTS "realtime_admin_all" ON realtime.messages;
CREATE POLICY "realtime_admin_all" ON realtime.messages
  FOR SELECT TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', 'USER') IN ('ADMIN','SUPER_ADMIN','SUPPORT','VIEWER'));
""")

# =========================================================================
# SECTION 24 - GRANTS / SECURITY FIXES
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 24 - GRANTS / SECURITY FIXES
-- ============================================================================

-- SECURITY FIX: Revoke credit_funds_safe from anon (was granted in multiple migrations)
REVOKE ALL ON FUNCTION public.credit_funds_safe(text, double precision, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.credit_funds_safe(text, double precision, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_funds_safe(text, double precision, text, text) TO authenticated, service_role;

-- Grant custom_access_token_hook to supabase_auth_admin
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

-- Grant handle_new_user trigger function to supabase_auth_admin
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- Ensure self_heal_user is restricted
REVOKE ALL ON FUNCTION public.self_heal_user() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.self_heal_user() TO service_role;

-- Ensure ensure_ai_user is restricted
REVOKE ALL ON FUNCTION public.ensure_ai_user(text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_ai_user(text) TO authenticated, service_role;
""")

# =========================================================================
# SECTION 25 - FINALIZE
# =========================================================================
sections.append("""\
-- ============================================================================
-- SECTION 25 - FINALIZE
-- ============================================================================

-- Refresh materialized view (initial population)
DO $$ BEGIN
  REFRESH MATERIALIZED VIEW public."mv_consultant_directory";
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Initial MV refresh failed: %', SQLERRM;
END $$;

-- PostgREST cache reload
NOTIFY pgrst, 'reload schema';

COMMIT;
""")

with open(path, 'w', encoding='utf-8') as f:
    for s in sections:
        f.write(s)

print(f"Written successfully: {sum(len(s) for s in sections)} chars")
