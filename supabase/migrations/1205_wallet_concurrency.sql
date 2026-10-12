-- ═══════════════════════════════════════════════════════════════════════════════
-- 1205 — Wallet optimistic locking + advisory lock RPCs
-- ═══════════════════════════════════════════════════════════════════════════════
-- Adds:
--   1. `version` column to Wallet table for optimistic locking
--   2. debit_wallet_versioned() — atomic debit with version check
--   3. credit_wallet_versioned() — atomic credit with version check
--   4. try_advisory_lock() / advisory_unlock() — session heartbeat locks
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Add version column to Wallet ─────────────────────────────────────────
ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

-- ─── 1b. Create LedgerEntry table for audit trail ─────────────────────────────
CREATE TABLE IF NOT EXISTS "LedgerEntry" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"       UUID NOT NULL REFERENCES "User"(id),
  "amount"       NUMERIC NOT NULL,
  "type"         TEXT NOT NULL CHECK ("type" IN ('DEBIT', 'CREDIT')),
  "description"  TEXT NOT NULL DEFAULT '',
  "referenceId"  TEXT NOT NULL DEFAULT '',
  "balanceAfter" NUMERIC NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_ledgerentry_user" ON "LedgerEntry" ("userId");
CREATE INDEX IF NOT EXISTS "idx_ledgerentry_reference" ON "LedgerEntry" ("referenceId") WHERE "referenceId" != '';

ALTER TABLE "LedgerEntry" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON "LedgerEntry";
CREATE POLICY "service_role_full_access" ON "LedgerEntry"
  FOR ALL USING (true) WITH CHECK (true);

-- ─── 2. debit_wallet_versioned ───────────────────────────────────────────────
-- Atomically debit a wallet with optimistic locking.
-- Returns {success, new_balance, conflict} where conflict=true means the
-- version didn't match (caller should retry).
CREATE OR REPLACE FUNCTION debit_wallet_versioned(
  p_user_id UUID,
  p_amount NUMERIC,
  p_version INTEGER,
  p_description TEXT DEFAULT '',
  p_reference_id TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_balance NUMERIC;
  v_updated BOOLEAN;
BEGIN
  -- Check for duplicate reference_id (idempotency)
  IF p_reference_id != '' THEN
    IF EXISTS (
      SELECT 1 FROM "LedgerEntry" WHERE "referenceId" = p_reference_id
    ) THEN
      RETURN jsonb_build_object('success', true, 'duplicate', true);
    END IF;
  END IF;

  -- Attempt versioned update
  UPDATE "Wallet"
  SET "balance" = "balance" - p_amount,
      "version" = "version" + 1
  WHERE "userId" = p_user_id
    AND "version" = p_version
    AND "balance" >= p_amount
  RETURNING "balance" INTO v_new_balance;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    -- Check if it was a version conflict or insufficient balance
    DECLARE
      v_current_version INTEGER;
      v_current_balance NUMERIC;
    BEGIN
      SELECT "version", "balance"
      INTO v_current_version, v_current_balance
      FROM "Wallet"
      WHERE "userId" = p_user_id;

      IF v_current_version != p_version THEN
        RETURN jsonb_build_object('success', false, 'conflict', true);
      ELSE
        RETURN jsonb_build_object('success', false, 'conflict', false,
          'error', 'Insufficient balance');
      END IF;
    END;
  END IF;

  -- Record in ledger
  IF p_reference_id != '' THEN
    INSERT INTO "LedgerEntry" ("userId", "amount", "type", "description", "referenceId", "balanceAfter")
    VALUES (p_user_id, -p_amount, 'DEBIT', p_description, p_reference_id, v_new_balance);
  END IF;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- ─── 3. credit_wallet_versioned ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION credit_wallet_versioned(
  p_user_id UUID,
  p_amount NUMERIC,
  p_version INTEGER,
  p_description TEXT DEFAULT '',
  p_reference_id TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_balance NUMERIC;
  v_updated BOOLEAN;
BEGIN
  -- Check for duplicate reference_id (idempotency)
  IF p_reference_id != '' THEN
    IF EXISTS (
      SELECT 1 FROM "LedgerEntry" WHERE "referenceId" = p_reference_id
    ) THEN
      RETURN jsonb_build_object('success', true, 'duplicate', true);
    END IF;
  END IF;

  UPDATE "Wallet"
  SET "balance" = "balance" + p_amount,
      "version" = "version" + 1
  WHERE "userId" = p_user_id
    AND "version" = p_version
  RETURNING "balance" INTO v_new_balance;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('success', false, 'conflict', true);
  END IF;

  IF p_reference_id != '' THEN
    INSERT INTO "LedgerEntry" ("userId", "amount", "type", "description", "referenceId", "balanceAfter")
    VALUES (p_user_id, p_amount, 'CREDIT', p_description, p_reference_id, v_new_balance);
  END IF;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- ─── 4. Advisory lock helpers ────────────────────────────────────────────────
-- These wrap pg_try_advisory_lock / pg_advisory_unlock using a text key
-- hashed to a bigint (Postgres advisory locks use int8 keys).

CREATE OR REPLACE FUNCTION try_advisory_lock(
  p_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_lock_id BIGINT;
  v_acquired BOOLEAN;
BEGIN
  -- Hash the text key to a bigint. hashtext returns int4; cast to int8.
  v_lock_id = hashtext(p_key)::BIGINT;
  v_acquired = pg_try_advisory_lock(v_lock_id);
  RETURN jsonb_build_object('locked', v_acquired, 'lock_id', v_lock_id);
END;
$$;

CREATE OR REPLACE FUNCTION advisory_unlock(
  p_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_lock_id BIGINT;
  v_released BOOLEAN;
BEGIN
  v_lock_id = hashtext(p_key)::BIGINT;
  v_released = pg_advisory_unlock(v_lock_id);
  RETURN jsonb_build_object('released', v_released);
END;
$$;

-- ─── 5. Per-user AI chat concurrency counter ─────────────────────────────────
-- Track concurrent AI chats per user using a simple Postgres table.
-- Used by the enhanced ConcurrencyGate to enforce per-user limits.

CREATE TABLE IF NOT EXISTS "AIChatSession" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"      UUID NOT NULL REFERENCES "User"(id),
  "startedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "endedAt"     TIMESTAMPTZ,
  "isActive"    BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS "idx_aichatsession_user_active"
  ON "AIChatSession" ("userId", "isActive")
  WHERE "isActive" = true;

ALTER TABLE "AIChatSession" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON "AIChatSession";
CREATE POLICY "service_role_full_access" ON "AIChatSession"
  FOR ALL USING (true) WITH CHECK (true);

-- Function to check and increment per-user AI chat count
CREATE OR REPLACE FUNCTION try_start_ai_chat(
  p_user_id UUID,
  p_max_concurrent INTEGER DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM "AIChatSession"
  WHERE "userId" = p_user_id AND "isActive" = true;

  IF v_count >= p_max_concurrent THEN
    RETURN jsonb_build_object('allowed', false, 'current', v_count, 'max', p_max_concurrent);
  END IF;

  INSERT INTO "AIChatSession" ("userId") VALUES (p_user_id);

  RETURN jsonb_build_object('allowed', true, 'current', v_count + 1, 'max', p_max_concurrent);
END;
$$;

-- Function to end an AI chat session
CREATE OR REPLACE FUNCTION end_ai_chat_session(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE "AIChatSession"
  SET "isActive" = false, "endedAt" = now()
  WHERE "userId" = p_user_id
    AND "isActive" = true
    AND "endedAt" IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('ended', v_updated);
END;
$$;

-- Function to get platform-wide concurrent AI chat count
CREATE OR REPLACE FUNCTION get_ai_chat_stats()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_active INTEGER;
  v_per_user JSONB;
BEGIN
  SELECT COUNT(*) INTO v_active
  FROM "AIChatSession"
  WHERE "isActive" = true;

  SELECT jsonb_agg(jsonb_build_object('userId', "userId", 'count', cnt))
  INTO v_per_user
  FROM (
    SELECT "userId", COUNT(*) as cnt
    FROM "AIChatSession"
    WHERE "isActive" = true
    GROUP BY "userId"
    ORDER BY cnt DESC
    LIMIT 20
  ) sub;

  RETURN jsonb_build_object(
    'totalActive', v_active,
    'topUsers', COALESCE(v_per_user, '[]'::jsonb)
  );
END;
$$;
