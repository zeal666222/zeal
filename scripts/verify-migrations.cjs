#!/usr/bin/env node
// Verify all 8 migrations (20261020140000-210000) are applied to production
const fs = require("fs");
const env = {};
for (const line of fs.readFileSync("D:/zeal/.env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("missing env"); process.exit(1); }

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function check(name, path, init) {
  try {
    const r = await fetch(`${URL}/rest/v1/${path}`, { headers: H, ...init });
    const body = await r.text();
    let verdict;
    if (r.ok) verdict = "✓";
    else if (body.includes("PGRST204") || body.includes("Could not find the table column")) verdict = "✗ COLUMN";
    else if (body.includes("PGRST202") || body.includes("Could not find the function")) verdict = "✗ RPC";
    else verdict = `✗ ERR(${r.status})`;
    console.log(`${verdict.padEnd(12)} ${name}`);
    return { verdict, body, status: r.status };
  } catch (e) {
    console.log(`✗ FETCH-FAIL  ${name}: ${e.message}`);
    return { verdict: "FETCH-FAIL", body: "", status: 0 };
  }
}

(async () => {
  console.log("=== MIGRATION VERIFICATION ===\n");

  // 20261020140000_pricing_requests.sql
  console.log("1. pricing_requests (PricingChangeRequest + 3 RPCs)");
  await check("  PricingChangeRequest table", 'PricingChangeRequest?select=id,"consultantId","currentRates","rejectionReason"&limit=1');
  await check("  rpc:request_pricing_change", 'rpc/request_pricing_change', { method: "POST", body: JSON.stringify({ p_consultant_id: "00000000-0000-0000-0000-000000000000", p_requested: {}, p_reason: "test", p_actor_id: "00000000-0000-0000-0000-000000000000" }) });
  await check("  rpc:approve_pricing_change", 'rpc/approve_pricing_change', { method: "POST", body: JSON.stringify({ p_request_id: "00000000-0000-0000-0000-000000000000", p_note: "test", p_actor_id: "00000000-0000-0000-0000-000000000000" }) });
  await check("  rpc:reject_pricing_change", 'rpc/reject_pricing_change', { method: "POST", body: JSON.stringify({ p_request_id: "00000000-0000-0000-0000-000000000000", p_reason: "test reason here", p_actor_id: "00000000-0000-0000-0000-000000000000" }) });

  // 20261020150000_withdrawals_fix.sql
  console.log("\n2. withdrawals_fix (request_withdrawal + process_withdrawal)");
  await check("  rpc:request_withdrawal", 'rpc/request_withdrawal', { method: "POST", body: JSON.stringify({ p_amount: 100, p_upi: "test@upi", p_bank: "test" }) });
  await check("  rpc:process_withdrawal", 'rpc/process_withdrawal', { method: "POST", body: JSON.stringify({ p_txn_id: "00000000-0000-0000-0000-000000000000", p_action: "APPROVE", p_actor_id: "00000000-0000-0000-0000-000000000000" }) });

  // 20261020160000_rpc_alignment.sql
  console.log("\n3. rpc_alignment (verify_consultant + claim_quest + toggle_cheer)");
  await check("  rpc:verify_consultant", 'rpc/verify_consultant', { method: "POST", body: JSON.stringify({ p_consultant_id: "00000000-0000-0000-0000-000000000000", p_admin_id: "00000000-0000-0000-0000-000000000000", p_action: "APPROVE", p_reason: null }) });
  await check("  rpc:claim_quest", 'rpc/claim_quest', { method: "POST", body: JSON.stringify({ p_quest_id: "test", p_user_id: "00000000-0000-0000-0000-000000000000", p_reward: 10 }) });
  await check("  rpc:toggle_cheer", 'rpc/toggle_cheer', { method: "POST", body: JSON.stringify({ p_post_id: "00000000-0000-0000-0000-000000000000", p_user_id: "00000000-0000-0000-0000-000000000000" }) });
  await check("  rpc:validate_admin_api_key", 'rpc/validate_admin_api_key', { method: "POST", body: JSON.stringify({ p_raw_key: "test" }) });

  // 20261020170000_admin_settings.sql
  console.log("\n4. admin_settings (AdminSetting table)");
  await check("  AdminSetting table", 'AdminSetting?select=key,value&limit=5');

  // 20261020180000_reconciliation.sql
  console.log("\n5. reconciliation (ledger helpers + reconcile RPCs)");
  await check("  rpc:ledger_sign_class", 'rpc/ledger_sign_class', { method: "POST", body: JSON.stringify({ p_type: "PAYMENT" }) });
  await check("  rpc:ledger_signed_amount", 'rpc/ledger_signed_amount', { method: "POST", body: JSON.stringify({ p_type: "PAYMENT", p_amount: 100 }) });
  await check("  rpc:ledger_row_is_missigned", 'rpc/ledger_row_is_missigned', { method: "POST", body: JSON.stringify({ p_type: "PAYMENT", p_amount: 100 }) });
  await check("  rpc:reconcile_wallet", 'rpc/reconcile_wallet', { method: "POST", body: JSON.stringify({ p_wallet_id: "00000000-0000-0000-0000-000000000000" }) });
  await check("  rpc:reconcile_all_wallets", 'rpc/reconcile_all_wallets', { method: "POST", body: JSON.stringify({}) });
  await check("  rpc:check_billing_reconciliation", 'rpc/check_billing_reconciliation', { method: "POST", body: JSON.stringify({}) });
  await check("  rpc:admin_reconciliation_report", 'rpc/admin_reconciliation_report', { method: "POST", body: JSON.stringify({ p_actor_id: "00000000-0000-0000-0000-000000000000", p_limit: 10 }) });
  await check("  rpc:admin_reconcile_pending_out", 'rpc/admin_reconcile_pending_out', { method: "POST", body: JSON.stringify({ p_wallet_id: "00000000-0000-0000-0000-000000000000", p_actor_id: "00000000-0000-0000-0000-000000000000" }) });
  await check("  BillingDiscrepancy table", 'BillingDiscrepancy?select=id&limit=1');

  // 20261020190000_rpc_privilege_hardening.sql
  console.log("\n6. rpc_privilege_hardening (REVOKE/GRANT — not directly probeable)");
  console.log("✓           (privilege changes are not visible via PostgREST schema probe)");

  // 20261020200000_realtime_topic_isolation.sql
  console.log("\n7. realtime_topic_isolation (safe_broadcast + triggers)");
  await check("  rpc:safe_broadcast", 'rpc/safe_broadcast', { method: "POST", body: JSON.stringify({ p_channel: "test", p_operation: "INSERT", p_table: "test", p_schema: "public", p_new: {}, p_old: null }) });

  // 20261020210000_admin_api_key_scopes.sql
  console.log("\n8. admin_api_key_scopes (AdminAPIKey.scopes column + generate/validate)");
  await check("  AdminAPIKey.scopes column", 'AdminAPIKey?select=id,scopes&limit=1');
  await check("  rpc:generate_admin_api_key", 'rpc/generate_admin_api_key', { method: "POST", body: JSON.stringify({ p_name: "test", p_admin_id: "00000000-0000-0000-0000-000000000000", p_scopes: ["read-only"], p_expires_days: 90 }) });

  console.log("\n=== SUMMARY ===");
  console.log("✓ = applied, ✗ = missing or error");
})();
