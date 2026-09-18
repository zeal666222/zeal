-- ═══════════════════════════════════════════════════════════════════════════════
-- 025_chat_indexes.sql
-- Phase 3 chat performance indexes + broadcast trigger sanity check.
-- ═══════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE INDEX IF NOT EXISTS idx_participant_conv_user
  ON "ConversationParticipant"("conversationId", "userId");

CREATE INDEX IF NOT EXISTS idx_conversation_last_msg_at
  ON "Conversation"("lastMessageAt" DESC);

CREATE INDEX IF NOT EXISTS idx_message_conv_created_desc
  ON "Message"("conversationId", "createdAt" DESC);

DO $$
DECLARE
  has_message_trigger boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_broadcast_message')
    INTO has_message_trigger;

  IF NOT has_message_trigger THEN
    RAISE EXCEPTION 'Missing trg_broadcast_message — apply migration 019 first';
  END IF;

  RAISE NOTICE '025_chat_indexes.sql — OK';
END $$;

COMMIT;
