#!/usr/bin/env node
// Probe live Supabase: verify columns + RPC existence (read-only)
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
    if (r.ok) verdict = "OK";
    else if (body.includes("PGRST204") || body.includes("Could not find the table column")) verdict = "MISSING-COLUMN";
    else if (body.includes("PGRST202") || body.includes("Could not find the function")) verdict = "MISSING-FUNCTION";
    else verdict = `ERR(${r.status})`;
    console.log(`${verdict.padEnd(16)} ${name}`);
    if (verdict.startsWith("ERR")) console.log(`   ${body.slice(0, 300)}`);
    return { verdict, body };
  } catch (e) {
    console.log(`FETCH-FAIL       ${name}: ${e.message}`);
    return { verdict: "FETCH-FAIL", body: "" };
  }
}

(async () => {
  console.log("--- columns ---");
  await check("User.avatar,bio,website,location,post_count", 'User?select=id,avatar,bio,website,location,post_count&limit=1');
  await check("User.avatar_url,full_name,username", 'User?select=id,avatar_url,full_name,username&limit=1');
  await check('Post."createdAt",isArchived,mediaUrls', 'Post?select=id,"createdAt",isArchived,mediaUrls&limit=1');
  await check("Consultant.chatRate,searchVector-cols", 'Consultant?select=id,category,"chatRate","perMinuteRate",status&limit=1');
  await check("AIConsultant", 'AIConsultant?select=id,name,"perMinuteRate","isPaid"&limit=1');
  await check("CallSession", 'CallSession?select=id,status,amount&limit=1');
  await check("BillingHeartbeat", 'BillingHeartbeat?select=id&limit=1');
  await check("PricingChangeRequest", 'PricingChangeRequest?select=id&limit=1');

  console.log("--- rpcs (GET-style probes) ---");
  const rpcs = [
    ["can_create_post", {}],
    ["get_profile_stats", { p_user_id: "00000000-0000-0000-0000-000000000000" }],
    ["search_consultants", { p_filters: { limit: 3 } }],
    ["auto_start_chat_billing", {}], // will fail on args but 404 vs other tells existence
    ["chat_partner_view", { p_conversation_id: "00000000-0000-0000-0000-000000000000", p_user_id: "00000000-0000-0000-0000-000000000000" }],
    ["update_profile", {}],
    ["delete_post", { p_post_id: "00000000-0000-0000-0000-000000000000" }],
    ["get_or_create_conversation", {}],
    ["credit_funds_safe", {}],
    ["process_per_minute_deduction", {}],
    ["release_session_escrow", {}],
    ["toggle_cheer", {}],
    ["sync_post_count", {}],
  ];
  for (const [fn, args] of rpcs) {
    const { verdict, body } = await check(`rpc:${fn}`, `rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
    if (fn === "search_consultants" && verdict === "OK") {
      console.log(`   result: ${body.slice(0, 400)}`);
    }
  }

  console.log("--- counts ---");
  for (const t of ["User", "Consultant", "AIConsultant", "Post", "Category", "Service", "ConsultantService", "CallSession", "Wallet"]) {
    const r = await fetch(`${URL}/rest/v1/${t}?select=id&limit=1`, { headers: { ...H, Prefer: "count=exact", Range: "0-0" } });
    console.log(`${t}: total=${r.headers.get("content-range")} status=${r.status}`);
  }
})();
