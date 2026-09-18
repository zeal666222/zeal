-- ═══════════════════════════════════════════════════════════════════════════════
-- 024_phase2_ledger_broadcast.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Enterprise ledger realtime:
--   • REPLICA IDENTITY FULL on Wallet + Transaction (so DELETE/UPDATE carry
--     the previous row — clients need it for reconciliation).
--   • Broadcast Wallet changes to user:{uid}:wallet (already exists via 019).
--   • Broadcast Transaction inserts to user:{uid}:wallet:ledger so the UI can
--     append entries without a round-trip.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Replica identity FULL on financial tables ────────────────────────────
ALTER TABLE public."Wallet" REPLICA IDENTITY FULL;
ALTER TABLE public."Transaction" REPLICA IDENTITY FULL;

-- ─── 2. Broadcast new ledger entries to the wallet owner ─────────────────────
CREATE OR REPLACE FUNCTION public.broadcast_ledger_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  owner_id text;
BEGIN
  -- Resolve the wallet owner
  SELECT "userId"::text INTO owner_id
  FROM public."Wallet"
  WHERE id = NEW."walletId";

  IF owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Broadcast the ledger entry to the owner's private channel
  PERFORM realtime.broadcast_changes(
    'user:' || owner_id || ':wallet:ledger',
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_ledger_entry ON public."Transaction";
CREATE TRIGGER trg_broadcast_ledger_entry
  AFTER INSERT ON public."Transaction"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_ledger_entry();

-- ─── 3. Idempotency index on Transaction.referenceId ─────────────────────────
-- (already exists per migration 000 but ensure it survives)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transaction_reference_unique
  ON public."Transaction"("referenceId")
  WHERE "referenceId" IS NOT NULL;

-- ─── 4. Ensure Wallet + Transaction are in realtime publication ──────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'Wallet'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."Wallet";
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'Transaction'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."Transaction";
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '  024_phase2_ledger_broadcast.sql — OK';
  RAISE NOTICE '  Replica identity FULL: Wallet, Transaction';
  RAISE NOTICE '  Broadcast: user:{uid}:wallet:ledger';
  RAISE NOTICE '========================================';
END $$;

COMMIT;
