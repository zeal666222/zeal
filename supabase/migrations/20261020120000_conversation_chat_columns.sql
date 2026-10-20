-- ═══════════════════════════════════════════════════════════════════════════
-- 20261020120000_conversation_chat_columns.sql
-- Idempotent: guarantee the columns the AI-chat + conversation-list flows rely
-- on exist on the live DB regardless of which historical migration created
-- "Conversation" (schema drift: consolidated 0000 omits them; 012/015 define
-- them differently). Missing `metadata` broke POST /api/chat/conversations
-- ("could not start chat"); missing lastMessageAt/Text broke GET listing order.
-- Safe to run repeatedly.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public."Conversation"
  ADD COLUMN IF NOT EXISTS metadata        JSONB,
  ADD COLUMN IF NOT EXISTS "lastMessageAt"  TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "lastMessageText" TEXT;

-- GIN index so the AI-conversation lookup
-- (ConversationParticipant → Conversation.metadata->>aiConsultantId) stays fast.
CREATE INDEX IF NOT EXISTS idx_conversation_metadata_gin
  ON public."Conversation" USING GIN (metadata jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_conversation_metadata_ai
  ON public."Conversation" ((metadata->>'aiConsultantId'));

CREATE INDEX IF NOT EXISTS idx_conversation_last_message_at
  ON public."Conversation" ("lastMessageAt" DESC);

-- Keep lastMessageAt/Text fresh on every new Message (AI + human alike).
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public."Conversation"
     SET "lastMessageAt"  = NEW."createdAt",
         "lastMessageText" = LEFT(NEW.content, 120)
   WHERE id = NEW."conversationId";
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_conv_last_message ON public."Message";
CREATE TRIGGER trg_update_conv_last_message
  AFTER INSERT ON public."Message"
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

-- Warm PostgREST's schema cache so the just-added columns are visible to the
-- API immediately (avoids PGRST204 "column not found" on the first request).
NOTIFY pgrst, 'reload schema';
