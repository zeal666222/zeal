-- ═══════════════════════════════════════════════════════════════════════════════
-- 20261020190000_rpc_privilege_hardening.sql
--
-- Why: every money and admin RPC the previous five migrations install or replace
-- is SECURITY DEFINER and, since Postgres grants EXECUTE to PUBLIC on creation,
-- reachable by the ANON key. Before this change an anonymous caller could POST
-- /rpc/process_withdrawal or /rpc/verify_consultant. Those two older versions
-- survived only because their gate read auth.uid(), which is NULL for anon.
-- The new versions take the acting user as an explicit parameter (they must,
-- because the routes run on the service-role key where auth.uid() is always
-- NULL), which removes that accidental shield: an anon caller who learns any
-- admin uuid could then approve payouts.
--
-- This file makes the rule explicit instead of inherited: no anonymous access to
-- a mutating or money-reading RPC. It walks the full list, so a future overload
-- added by an earlier migration is covered by re-running it.
--
-- Idempotent. Apply with
-- `supabase db query --linked -f supabase/migrations/20261020190000_rpc_privilege_hardening.sql`.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_name   text;
  v_args   text;
  v_left   text;
  v_names  text[] := ARRAY[
    -- withdrawals (20261020150000)
    'request_withdrawal', 'process_withdrawal',
    -- rpc alignment (20261020160000)
    'verify_consultant', 'claim_quest', 'toggle_cheer', 'validate_admin_api_key',
    -- reconciliation (20261020180000)
    'ledger_sign_class', 'ledger_signed_amount', 'ledger_row_is_missigned',
    'reconcile_wallet', 'reconcile_all_wallets', 'check_billing_reconciliation',
    'admin_reconciliation_report', 'admin_reconcile_pending_out',
    -- pricing (20261020140000)
    'request_pricing_change', 'approve_pricing_change', 'reject_pricing_change'
  ];
BEGIN
  FOR v_name IN SELECT unnest(v_names) LOOP
    -- Every overload, including the ones prod deployed outside migration history.
    FOR v_args IN
      SELECT pg_get_function_identity_arguments(p.oid)
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = v_name
    LOOP
      -- validate_admin_api_key is a service-role-only oracle; everything else
      -- may be called by a signed-in user through their own guarded route.
      v_left := CASE WHEN v_name = 'validate_admin_api_key' THEN 'service_role'
                     ELSE 'authenticated, service_role' END;

      EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                     v_name, v_args);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO %s', v_name, v_args, v_left);

      RAISE NOTICE 'hardened %(%) -> %', v_name, v_args, v_left;
    END LOOP;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
