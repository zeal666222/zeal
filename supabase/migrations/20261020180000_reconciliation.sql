-- ═══════════════════════════════════════════════════════════════════════════════
-- 20261020180000_reconciliation.sql
-- Make financial reconciliation real, and stop the existing helpers from
-- inventing money.
-- ───────────────────────────────────────────────────────────────────────────────
-- Read from the live database (pg_get_functiondef), four defects:
--
-- 1) reconcile_all_wallets() groups by wallet but calls
--      reconcile_wallet(v_row."userId")
--    while reconcile_wallet resolves WHERE id = p_wallet_id. Wallet id ≠ user
--    id, so every drifted wallet returns {error:'not_found'} — the batch skips
--    the correction, then counts it in "walletsReconciled" anyway.
--
-- 2) reconcile_wallet() sets balance = SUM(Transaction.amount), but it inserts
--    its own ADJUSTMENT row of -drift first. Post-insert the ledger sums to
--    (net - drift) while the column is set to net, so the drift is still there
--    unchanged — and each call appends another ADJUSTMENT row under a fresh
--    random referenceId, so ON CONFLICT never dedupes it.
--
-- 3) Transaction.amount is not a signed net ledger. hold_in_escrow_safe() moves
--    balance → escrow (money leaves available) and records it as a PAYMENT with
--    a POSITIVE amount:
--      UPDATE "Wallet" SET balance = balance - p_amount, escrow = escrow + p_amount;
--      INSERT INTO "Transaction" (…,'PAYMENT', p_amount, …)
--    Every other writer uses the expected sign (process_per_minute_deduction:
--    PAYMENT -amount, COMMISSION +earning; request_withdrawal: -amount;
--    credit_funds_safe/REFUND: +amount). So SUM(amount) is wrong by twice the
--    held amount for any wallet that ever started a session — and because
--    reconcile_wallet *writes* that wrong sum back as the balance, a
--    "reconciliation run" would hand users money that was never topped up.
--
-- 4) process_withdrawal's approval path (fixed separately in
--    20261020150000_withdrawals_fix.sql) never decremented pendingOut, so
--    pendingOut only drifts upward. pendingOut is a derived field — it equals
--    the total of still-pending WITHDRAWAL_REQUEST rows — so recomputing it
--    from those rows is a repair that moves no money.
--
-- This migration therefore:
--   • adds one explicit sign rule (ledger_sign_class / ledger_signed_amount)
--     derived from the functions that actually write this table, and treats an
--     unknown type as *unclassified* rather than guessing its sign;
--   • redefines check_billing_reconciliation() to use that rule;
--   • makes reconcile_wallet() converge, and REFUSE when the wallet's ledger
--     contains rows whose sign contradicts their type (unreconcilable_ledger)
--     instead of writing a fabricated balance;
--   • fixes reconcile_all_wallets() to pass wallet ids and count real
--     corrections;
--   • adds admin_reconciliation_report() (read-only) and
--     admin_reconcile_pending_out() (derived-field repair, audited into
--     BillingDiscrepancy) for /admin/finance/reconciliation.
--
-- Deliberately NOT reconciled here: escrow ↔ CallSession. The session path
-- holds escrow at start and deducts per minute from balance as well
-- (session-service.ts), so which of the two is authoritative is an open product
-- question, not an arithmetic one. Reporting it would assert an invariant the
-- application does not currently maintain.
--
-- Idempotent, and no data is rewritten by this file.
--
-- Apply THIS FILE, not a whole-folder push: the remote history table
-- (supabase_migrations.schema_migrations) stops at 20261001120000 with 27 rows,
-- while this repo holds 78 files, so `supabase db push` would re-attempt dozens
-- of already-applied legacy migrations and abort on the first non-idempotent
-- statement. Run it directly instead:
--   supabase db query --linked -f supabase/migrations/20261020180000_reconciliation.sql
-- Never apply 1203_finance_reconciliation.sql: its BillingDiscrepancy /
-- auto_correct_discrepancy definitions already live in prod in a different shape.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. The sign rule ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ledger_sign_class(p_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN p_type IS NULL THEN 'unknown'
    WHEN p_type IN ('TOPUP','REFUND','COMMISSION','EARNING','CREDIT','DEPOSIT','TRANSFER_IN','CASHBACK')
      THEN 'credit'
    -- A rejected withdrawal keeps its original negative row while the wallet is
    -- refunded in place (process_withdrawal), so that row is a record of a
    -- request, not a money movement: it must not count against the net.
    WHEN p_type IN ('WITHDRAWAL_REJECTED') THEN 'neutral'
    -- reconcile_wallet converges the balance to the ledger, so it never writes
    -- one of these; the class stays for rows an older build may have left.
    WHEN p_type IN ('ADJUSTMENT','CORRECTION') THEN 'signed'
    WHEN p_type IN ('PAYMENT','WITHDRAWAL_REQUEST','WITHDRAWAL','PAYOUT','FEE','DEBIT','CHARGE','TRANSFER_OUT','PENALTY')
      THEN 'debit'
    ELSE 'unknown'
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.ledger_signed_amount(p_type text, p_amount double precision)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE public.ledger_sign_class(p_type)
    WHEN 'credit' THEN abs(coalesce(p_amount, 0))
    WHEN 'debit'  THEN -abs(coalesce(p_amount, 0))
    WHEN 'signed' THEN coalesce(p_amount, 0)
    ELSE 0
  END;
$fn$;

-- A row whose stored sign disagrees with its type is the reason a naive
-- SUM(amount) cannot be trusted.
CREATE OR REPLACE FUNCTION public.ledger_row_is_missigned(p_type text, p_amount double precision)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE public.ledger_sign_class(p_type)
    WHEN 'debit'  THEN coalesce(p_amount, 0) > 0
    WHEN 'credit' THEN coalesce(p_amount, 0) < 0
    WHEN 'unknown' THEN true
    ELSE false
  END;
$fn$;

GRANT EXECUTE ON FUNCTION public.ledger_sign_class(text),
  public.ledger_signed_amount(text, double precision),
  public.ledger_row_is_missigned(text, double precision) TO authenticated, service_role;

-- ── 2. reconcile_wallet: converge, or refuse ─────────────────────────────────
-- p_actor_id defaults to NULL so existing one-argument callers keep working.
DROP FUNCTION IF EXISTS public.reconcile_wallet(uuid);
CREATE OR REPLACE FUNCTION public.reconcile_wallet(p_wallet_id uuid, p_actor_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_wallet  public."Wallet"%ROWTYPE;
  v_net     double precision;
  v_drift   double precision;
  v_bad     integer;
  v_after   double precision;
  v_id      uuid;
BEGIN
  SELECT * INTO v_wallet FROM public."Wallet" WHERE id = p_wallet_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  SELECT COALESCE(SUM(public.ledger_signed_amount(t.type, t.amount)), 0),
         COUNT(*) FILTER (WHERE public.ledger_row_is_missigned(t.type, t.amount))
    INTO v_net, v_bad
    FROM public."Transaction" t
   WHERE t."walletId" = p_wallet_id;

  v_drift := v_wallet.balance - v_net;

  IF abs(v_drift) < 0.01 THEN
    RETURN jsonb_build_object('success', true, 'drift', 0, 'corrected', false);
  END IF;

  -- Never write a balance the ledger cannot justify: with mis-signed rows
  -- present, v_net is not the truth, and "correcting" to it invents money.
  IF v_bad > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'unreconcilable_ledger',
      'drift', round(v_drift::numeric, 2), 'missignedRows', v_bad);
  END IF;

  IF abs(v_drift) >= 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'too_large_for_auto_correction',
      'drift', round(v_drift::numeric, 2));
  END IF;

  -- The ledger is the money truth, so the balance converges to it. Writing an
  -- ADJUSTMENT row here would be a SECOND movement on top of the one being
  -- corrected: a wallet holding 5 with no rows has net 0, so an adjustment of
  -- -5 plus a balance of -5 would erase the user's money and then call the
  -- invariant restored. The correction is recorded in BillingDiscrepancy, which
  -- no net computation reads.
  v_after := v_net;
  v_id := gen_random_uuid();

  INSERT INTO public."BillingDiscrepancy"
        (id, type, "walletId", expected, actual, difference, status, "autoCorrected", notes, "createdAt", "resolvedAt")
    VALUES (v_id, 'ledger_drift', p_wallet_id,
      round(v_net::numeric, 2), round(v_wallet.balance::numeric, 2),
      round(v_drift::numeric, 2), 'resolved', true,
      'Converged balance to its ledger net'
        || CASE WHEN p_actor_id IS NULL THEN '' ELSE ' by ' || p_actor_id::text END,
      now(), now());

  UPDATE public."Wallet"
     SET balance = v_after, "updatedAt" = now()
   WHERE id = p_wallet_id;

  RETURN jsonb_build_object('success', true,
    'drift', round(v_drift::numeric, 2),
    'newBalance', round(v_after::numeric, 2),
    'corrected', true,
    'discrepancyId', v_id);
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.reconcile_wallet(uuid, uuid) TO authenticated, service_role;

-- ── 3. reconcile_all_wallets: pass wallet ids, count what actually changed ───
CREATE OR REPLACE FUNCTION public.reconcile_all_wallets()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_row     RECORD;
  v_result  jsonb;
  v_count   int := 0;
  v_skipped int := 0;
  v_total   double precision := 0;
  v_details jsonb := '[]'::jsonb;
BEGIN
  FOR v_row IN
    SELECT w.id AS wallet_id, w."userId",
           w.balance - COALESCE(SUM(public.ledger_signed_amount(t.type, t.amount)), 0) AS drift
      FROM public."Wallet" w
      LEFT JOIN public."Transaction" t ON t."walletId" = w.id
     GROUP BY w.id, w."userId", w.balance
    HAVING ABS(w.balance - COALESCE(SUM(public.ledger_signed_amount(t.type, t.amount)), 0)) > 0.01
  LOOP
    v_result := public.reconcile_wallet(v_row.wallet_id);
    v_details := v_details || jsonb_build_array(jsonb_build_object(
      'walletId', v_row.wallet_id,
      'userId', v_row."userId",
      'drift', round(v_row.drift::numeric, 2),
      'result', v_result));
    IF COALESCE(v_result ->> 'success', 'false') = 'true'
       AND COALESCE((v_result ->> 'corrected')::boolean, false) THEN
      v_count := v_count + 1;
      v_total := v_total + COALESCE(v_row.drift, 0);
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'walletsReconciled', v_count,
    'walletsSkipped', v_skipped,
    'totalDriftCorrected', round(v_total::numeric, 2),
    'details', v_details);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.reconcile_all_wallets() TO authenticated, service_role;

-- ── 4. check_billing_reconciliation: honest drift count ──────────────────────
CREATE OR REPLACE FUNCTION public.check_billing_reconciliation()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'wallet_drift', (SELECT COUNT(*)::int FROM (
      SELECT w.id
        FROM public."Wallet" w
        LEFT JOIN public."Transaction" t ON t."walletId" = w.id
       GROUP BY w.id, w.balance
      HAVING ABS(w.balance - COALESCE(SUM(public.ledger_signed_amount(t.type, t.amount)), 0)) > 0.01) x),
    'missigned_rows', (SELECT COUNT(*)::int FROM public."Transaction" t
                        WHERE public.ledger_row_is_missigned(t.type, t.amount)),
    'open_discrepancies', (SELECT COUNT(*)::int FROM public."BillingDiscrepancy" WHERE status = 'open'));
$fn$;

GRANT EXECUTE ON FUNCTION public.check_billing_reconciliation() TO authenticated, service_role;

-- ── 5. The report the admin console reads ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_reconciliation_report(
  p_actor_id uuid,
  p_limit    integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_limit integer := LEAST(GREATEST(coalesce(p_limit, 50), 10), 200);
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
       SELECT 1 FROM public."User" u
        WHERE u.id = p_actor_id
          AND upper(coalesce(u.role::text, 'USER')) = 'SUPER_ADMIN') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'generatedAt', now(),
    'scanned', jsonb_build_object(
      'wallets',      (SELECT COUNT(*)::int FROM public."Wallet"),
      'bookings',     (SELECT COUNT(*)::int FROM public."Booking"),
      'transactions', (SELECT COUNT(*)::int FROM public."Transaction")),
    'checks', (
      WITH drift AS (
        SELECT w.id AS "walletId", w."userId", u.email,
               round(w.balance::numeric, 2)          AS balance,
               round(SUM(public.ledger_signed_amount(t.type, t.amount))::numeric, 2) AS ledger_net,
               round((w.balance - COALESCE(SUM(public.ledger_signed_amount(t.type, t.amount)), 0))::numeric, 2) AS drift
          FROM public."Wallet" w
          LEFT JOIN public."Transaction" t ON t."walletId" = w.id
          LEFT JOIN public."User" u ON u.id = w."userId"
         GROUP BY w.id, w."userId", u.email, w.balance
        HAVING ABS(w.balance - COALESCE(SUM(public.ledger_signed_amount(t.type, t.amount)), 0)) > 0.01
      ),
      negatives AS (
        SELECT w.id AS "walletId", w."userId", u.email,
               greatest(0, -least(w.balance, 0)) + greatest(0, -least(w.escrow, 0))
             + greatest(0, -least(w."pendingIn", 0)) + greatest(0, -least(w."pendingOut", 0))
             + greatest(0, -least(w.blocked, 0)) AS negative_total,
               jsonb_build_object('balance', round(w.balance::numeric, 2),
                                  'escrow', round(w.escrow::numeric, 2),
                                  'pendingIn', round(w."pendingIn"::numeric, 2),
                                  'pendingOut', round(w."pendingOut"::numeric, 2),
                                  'blocked', round(w.blocked::numeric, 2)) AS fields
          FROM public."Wallet" w
          LEFT JOIN public."User" u ON u.id = w."userId"
         WHERE w.balance < -0.005 OR w.escrow < -0.005 OR w."pendingIn" < -0.005
            OR w."pendingOut" < -0.005 OR w.blocked < -0.005
      ),
      pending_out AS (
        SELECT w.id AS "walletId", w."userId", u.email,
               round(w."pendingOut"::numeric, 2) AS pending_out,
               round(COALESCE(p.held, 0)::numeric, 2) AS requests_total,
               round((w."pendingOut" - COALESCE(p.held, 0))::numeric, 2) AS drift
          FROM public."Wallet" w
          LEFT JOIN public."User" u ON u.id = w."userId"
          LEFT JOIN (
            SELECT t."walletId", SUM(abs(t.amount)) AS held
              FROM public."Transaction" t
             WHERE t.type = 'WITHDRAWAL_REQUEST'
               -- ->> yields text; casting it to boolean would abort the whole
               -- report on any row whose tag was hand-written as "yes"/"no".
               AND COALESCE(t.metadata ->> 'pending', 'true') <> 'false'
             GROUP BY t."walletId") p ON p."walletId" = w.id
         WHERE ABS(w."pendingOut" - COALESCE(p.held, 0)) > 0.01
      ),
      missigned AS (
        SELECT t.id, t."walletId", u.id AS "userId", t.type, t."referenceId",
               round(t.amount::numeric, 2) AS amount,
               public.ledger_sign_class(t.type) AS expected_class,
               t.description,
               date_trunc('second', t."createdAt") AT TIME ZONE 'UTC' AS created_at
          FROM public."Transaction" t
          LEFT JOIN public."Wallet" w ON w.id = t."walletId"
          LEFT JOIN public."User" u ON u.id = w."userId"
         WHERE public.ledger_row_is_missigned(t.type, t.amount)
      ),
      missing_credit AS (
        SELECT b.id AS "bookingId", b."consultantId", c."userId" AS "consultantUserId",
               u.email, round(b."consultantEarning"::numeric, 2) AS earning,
               round(b.amount::numeric, 2) AS amount,
               date_trunc('second', b."updatedAt") AT TIME ZONE 'UTC' AS settled_at
          FROM public."Booking" b
          JOIN public."Consultant" c ON c.id = b."consultantId"
          LEFT JOIN public."User" u ON u.id = c."userId"
         WHERE b.status IN ('CONFIRMED','IN_PROGRESS','COMPLETED')
           AND b."consultantEarning" > 0.005
           AND NOT EXISTS (
             SELECT 1 FROM public."Transaction" t
              WHERE t."referenceId" = 'booking-earn:' || b.id)
      ),
      split_mismatch AS (
        SELECT b.id AS "bookingId", round(b.amount::numeric, 2) AS amount,
               round(b."platformFee"::numeric, 2)      AS platform_fee,
               round(b."consultantEarning"::numeric, 2) AS earning,
               round((COALESCE(b."platformFee", 0) + COALESCE(b."consultantEarning", 0)
                      - COALESCE(b.amount, 0))::numeric, 2) AS difference,
               b."platformFeeRate"
          FROM public."Booking" b
         WHERE b.status IN ('CONFIRMED','IN_PROGRESS','COMPLETED')
           AND ABS(COALESCE(b."platformFee", 0) + COALESCE(b."consultantEarning", 0)
                   - COALESCE(b.amount, 0)) > 0.02
      ),
      uncollected AS (
        SELECT b.id AS "bookingId", u.email AS seeker_email,
               round(b.amount::numeric, 2) AS amount,
               coalesce(b."paymentStatus", '(null)') AS payment_status,
               b.status
          FROM public."Booking" b
          LEFT JOIN public."User" u ON u.id = b."userId"
         WHERE b.status IN ('CONFIRMED','IN_PROGRESS','COMPLETED')
           AND coalesce(b."paymentStatus", '') <> 'captured'
      )
      SELECT jsonb_build_array(
        jsonb_build_object(
          'key', 'ledger_drift',
          'label', 'Wallet balance does not match its ledger',
          'help', 'Signed per transaction type. A wallet is listed only when balance and ledger disagree by more than ₹0.01.',
          'severity', 'review',
          'count', (SELECT COUNT(*) FROM drift),
          'total', (SELECT round(COALESCE(SUM(abs(drift)), 0), 2) FROM drift),
          'items', (SELECT COALESCE(jsonb_agg(x ORDER BY abs(x.drift) DESC), '[]'::jsonb)
                      FROM (SELECT * FROM drift ORDER BY abs(drift) DESC LIMIT v_limit) x)),
        jsonb_build_object(
          'key', 'negative_components',
          'label', 'Wallet holds a negative amount',
          'help', 'No wallet field can legitimately go below zero: a debit bypassed its guard.',
          'severity', 'review',
          'count', (SELECT COUNT(*) FROM negatives),
          'total', (SELECT round(COALESCE(SUM(negative_total), 0)::numeric, 2) FROM negatives),
          'items', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (SELECT * FROM negatives LIMIT v_limit) x)),
        jsonb_build_object(
          'key', 'pendingout_drift',
          'label', 'pendingOut is not the total of pending payouts',
          'help', 'pendingOut is derived from WITHDRAWAL_REQUEST rows, so recomputing it moves no money. Approved payouts never released it before 20261020150000.',
          'severity', 'auto',
          'count', (SELECT COUNT(*) FROM pending_out),
          'total', (SELECT round(COALESCE(SUM(abs(drift)), 0), 2) FROM pending_out),
          'items', (SELECT COALESCE(jsonb_agg(x ORDER BY abs(x.drift) DESC), '[]'::jsonb)
                      FROM (SELECT * FROM pending_out ORDER BY abs(drift) DESC LIMIT v_limit) x)),
        jsonb_build_object(
          'key', 'missigned_ledger',
          'label', 'Ledger rows whose sign contradicts their type',
          'help', 'These rows are why balance cannot be recomputed from SUM(amount). hold_in_escrow_safe writes an escrow hold as a positive PAYMENT.',
          'severity', 'review',
          'count', (SELECT COUNT(*) FROM missigned),
          'total', (SELECT round(COALESCE(SUM(abs(amount)), 0), 2) FROM missigned),
          'items', (SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb)
                      FROM (SELECT * FROM missigned ORDER BY created_at DESC LIMIT v_limit) x)),
        jsonb_build_object(
          'key', 'booking_credit_missing',
          'label', 'Settled booking with no consultant credit',
          'help', 'Confirm writes a ledger row keyed booking-earn:<id>. A settled booking without one means the consultant was never paid.',
          'severity', 'review',
          'count', (SELECT COUNT(*) FROM missing_credit),
          'total', (SELECT round(COALESCE(SUM(earning), 0), 2) FROM missing_credit),
          'items', (SELECT COALESCE(jsonb_agg(x ORDER BY x.settled_at DESC), '[]'::jsonb)
                      FROM (SELECT * FROM missing_credit ORDER BY settled_at DESC LIMIT v_limit) x)),
        jsonb_build_object(
          'key', 'booking_fee_split',
          'label', 'Fee split does not add up to the booking amount',
          'help', 'platformFee + consultantEarning must equal amount at the rate stamped on the booking.',
          'severity', 'review',
          'count', (SELECT COUNT(*) FROM split_mismatch),
          'total', (SELECT round(COALESCE(SUM(abs(difference)), 0), 2) FROM split_mismatch),
          'items', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
                      FROM (SELECT * FROM split_mismatch LIMIT v_limit) x)),
        jsonb_build_object(
          'key', 'booking_uncollected',
          'label', 'Settled booking that was never captured',
          'help', 'Credit is paid at confirm, so a confirm without a captured payment means the platform paid out money it did not collect.',
          'severity', 'review',
          'count', (SELECT COUNT(*) FROM uncollected),
          'total', (SELECT round(COALESCE(SUM(amount), 0), 2) FROM uncollected),
          'items', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
                      FROM (SELECT * FROM uncollected LIMIT v_limit) x))
      )
    )
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.admin_reconciliation_report(uuid, integer) TO authenticated, service_role;

-- ── 6. The one repair that cannot invent money ───────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_reconcile_pending_out(
  p_wallet_id uuid,
  p_actor_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_wallet public."Wallet"%ROWTYPE;
  v_expected double precision;
  v_id       uuid := gen_random_uuid();
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
       SELECT 1 FROM public."User" u
        WHERE u.id = p_actor_id
          AND upper(coalesce(u.role::text, 'USER')) = 'SUPER_ADMIN') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_wallet FROM public."Wallet" WHERE id = p_wallet_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  SELECT COALESCE(SUM(abs(t.amount)), 0) INTO v_expected
    FROM public."Transaction" t
   WHERE t."walletId" = p_wallet_id
     AND t.type = 'WITHDRAWAL_REQUEST'
     AND COALESCE(t.metadata ->> 'pending', 'true') <> 'false';

  IF ABS(v_wallet."pendingOut" - v_expected) < 0.01 THEN
    RETURN jsonb_build_object('success', true, 'changed', false,
      'pendingOut', round(v_wallet."pendingOut"::numeric, 2));
  END IF;

  UPDATE public."Wallet"
     SET "pendingOut" = v_expected, "updatedAt" = now()
   WHERE id = p_wallet_id;

  INSERT INTO public."BillingDiscrepancy"
        (id, type, "walletId", expected, actual, difference, status, "autoCorrected", notes, "createdAt", "resolvedAt")
    VALUES (v_id, 'pendingout_drift', p_wallet_id,
      round(v_wallet."pendingOut"::numeric, 2),
      round(v_expected::numeric, 2),
      round((v_wallet."pendingOut" - v_expected)::numeric, 2),
      'resolved', true,
      'Recomputed pendingOut from pending WITHDRAWAL_REQUEST rows by ' || p_actor_id::text,
      now(), now());

  RETURN jsonb_build_object('success', true, 'changed', true,
    'discrepancyId', v_id,
    'before', round(v_wallet."pendingOut"::numeric, 2),
    'after', round(v_expected::numeric, 2));
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.admin_reconcile_pending_out(uuid, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
