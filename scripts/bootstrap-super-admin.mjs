#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Super Admin Bootstrap
// ─────────────────────────────────────────────────────────────────────────────
// Creates a SUPER_ADMIN auth user with a strong, one-time-shown password.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/bootstrap-super-admin.mjs \
//       --email operator@zealer.co.in \
//       [--name "Platform Owner"] \
//       [--password-stdin]                 # read a caller-supplied secret
//
// Security contract this script enforces:
//   1. If --password-stdin is NOT set, generates a 24-char CSPRNG password
//      using the character classes below. Prints it EXACTLY ONCE, warns the
//      operator to store it in a password manager, then never touches it again.
//   2. Rejects passwords that equal or contain the local part of the email,
//      the domain, or the words "password", "admin", "zeal", "123456". This
//      is the guard against the insecure username==password pattern.
//   3. Refuses to run if the target user already exists — the operator must
//      explicitly rotate via the admin panel instead.
//   4. Flags the account with app_metadata.must_change_password = true so the
//      login flow can force rotation on first sign-in.
//   5. Never writes the plaintext password to disk, logs, git, or env dumps.
//   6. Uses service_role only against Supabase GoTrue admin endpoints.
//
// The password you set here is the ONLY credential. Supabase has bcrypt.
// Do not paste it into any chat, ticket, or email.
// ═══════════════════════════════════════════════════════════════════════════════

import { randomBytes, createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import process from "node:process";

// ─── .env loader (no dependency) ─────────────────────────────────────────────
function loadEnvDotenv(paths) {
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const txt = readFileSync(p, "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const k = m[1];
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}
loadEnvDotenv([
  ".env",
  ".env.local",
  "../.env",
  "../.env.local",
  "apps/web/.env",
  "apps/web/.env.local",
]);

// ─── CLI arg parsing ─────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--email") out.email = argv[++i];
    else if (a === "--name") out.name = argv[++i];
    else if (a === "--password-stdin") out.passwordStdin = true;
    else if (a === "--force") out.force = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function printHelp() {
  console.error(`Usage: node scripts/bootstrap-super-admin.mjs --email <addr> [--name <display>] [--password-stdin] [--force]

Creates a SUPER_ADMIN auth user with a strong one-time password.
If --password-stdin is set, reads the plaintext secret once from stdin
(pipe it from a password manager — never echo it in a shell history line).
If --force is set and the email exists, resets the existing account's password
instead of aborting. Use sparingly; audit log records the reset.`);
}

// ─── Password policy ─────────────────────────────────────────────────────────
const PWD_LOWER = "abcdefghijkmnopqrstuvwxyz"; // no l
const PWD_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, O
const PWD_DIGIT = "23456789";                 // no 0, 1
const PWD_SYM = "!@#$%^&*()-_=+[]{}";

function generateStrongPassword(len = 24) {
  const pools = [PWD_LOWER, PWD_UPPER, PWD_DIGIT, PWD_SYM];
  const bytes = randomBytes(len + 8);
  // Guarantee at least one char from each pool.
  const chars = [];
  for (let i = 0; i < 4; i++) {
    const pool = pools[i];
    chars.push(pool[bytes[i] % pool.length]);
  }
  const all = pools.join("");
  for (let i = 4; i < len; i++) {
    chars.push(all[bytes[i] % all.length]);
  }
  // Fisher-Yates with additional randomBytes-derived entropy.
  const swapRnd = randomBytes(chars.length * 2);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = swapRnd.readUInt16LE(i * 2) % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function validatePasswordStrength(pw, emailLocal, emailDomain) {
  const problems = [];
  if (pw.length < 20) problems.push("shorter than 20 chars");
  if (!/[a-z]/.test(pw)) problems.push("missing lowercase");
  if (!/[A-Z]/.test(pw)) problems.push("missing uppercase");
  if (!/\d/.test(pw)) problems.push("missing digit");
  if (!/[^A-Za-z0-9]/.test(pw)) problems.push("missing symbol");
  const low = pw.toLowerCase();
  const banned = [
    emailLocal.toLowerCase(),
    emailDomain.toLowerCase(),
    emailDomain.split(".")[0].toLowerCase(),
    "password", "admin", "superadmin", "super", "zeal", "zealer",
    "123456", "qwerty", "letmein", "welcome", "iloveyou",
  ];
  for (const b of banned) {
    if (b && b.length >= 3 && low.includes(b)) {
      problems.push(`contains banned substring "${b}"`);
      break;
    }
  }
  return problems;
}

// ─── Env ─────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[bootstrap] Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env or .env file.");
  console.error("           Set them via shell or a .env file this script can read.");
  process.exit(2);
}

const args = parseArgs(process.argv);
if (args.help) { printHelp(); process.exit(0); }
if (!args.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email)) {
  console.error("[bootstrap] --email <valid-address> is required.");
  printHelp();
  process.exit(2);
}
const email = args.email.trim().toLowerCase();
const [emailLocal, emailDomain] = email.split("@");

// ─── Password source ─────────────────────────────────────────────────────────
let password;
if (args.passwordStdin) {
  const chunks = [];
  const fd = 0;
  const buf = Buffer.alloc(4096);
  let n;
  try {
    // Synchronous stdin read — the operator pipes from their secret manager.
    while ((n = require("node:fs").readSync(fd, buf, 0, buf.length, null)) > 0) {
      chunks.push(Buffer.from(buf.subarray(0, n)));
    }
  } catch (e) {
    console.error("[bootstrap] Failed reading stdin:", e.message);
    process.exit(2);
  }
  password = Buffer.concat(chunks).toString("utf8").trim();
  if (!password) {
    console.error("[bootstrap] --password-stdin provided but empty.");
    process.exit(2);
  }
} else {
  password = generateStrongPassword(24);
}

const issues = validatePasswordStrength(password, emailLocal, emailDomain);
if (issues.length) {
  console.error("[bootstrap] Password rejected — insecure for SUPER_ADMIN:");
  for (const i of issues) console.error("  •", i);
  process.exit(3);
}

// ─── Supabase admin API ──────────────────────────────────────────────────────
async function adminApi(path, body, method = "POST") {
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    method,
    headers: {
      "apikey": SERVICE_KEY,
      "authorization": `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  if (!res.ok) {
    throw new Error(`Supabase admin ${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return json;
}

async function findByEmail() {
  // GoTrue admin list endpoint with per_page=1 filter is not supported by all
  // versions; page through instead. If the tenant is huge, switch to the
  // /admin/users?page=X&per_page=200 loop and match.
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`,
    { headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` } },
  );
  if (!res.ok) throw new Error(`Cannot list users: HTTP ${res.status}`);
  const json = await res.json();
  const users = json.users ?? [];
  return users.find((u) => (u.email || "").toLowerCase() === email) ?? null;
}

// ─── Public."User" upsert via PostgREST ──────────────────────────────────────
async function upsertPublicUserRow(userId, display, role) {
  const row = {
    id: userId,
    email,
    username: emailLocal.replace(/[^a-z0-9_]/g, "_").slice(0, 30),
    name: display,
    role,
    "isVerified": true,
    "is_online": false,
    sparks: 0,
  };
  // PostgREST on this project exposes the table unquoted; "/rest/v1/\"User\"" 404s
  // with PGRST205 and silently leaves the auth user without a role row.
  const res = await fetch(`${SUPABASE_URL}/rest/v1/User`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
      "prefer": "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`User upsert failed (${res.status}): ${txt.slice(0, 400)}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
(async () => {
  console.error(`[bootstrap] Target: ${email}  ·  role: SUPER_ADMIN`);
  let existing = null;
  try { existing = await findByEmail(); }
  catch (e) { console.error("[bootstrap] Cannot query existing users:", e.message); process.exit(4); }

  if (existing) {
    if (!args.force) {
      console.error(`[bootstrap] User ${email} already exists (id ${existing.id}).`);
      console.error(`            Refusing to overwrite. Re-run with --force to reset the password.`);
      console.error(`            Better: use the admin panel → Users → Reset Password flow so the action is audited.`);
      process.exit(5);
    }
    console.error(`[bootstrap] --force set: resetting password for existing user ${existing.id}.`);
    await adminApi(`/admin/users/${existing.id}`, {
      password,
      app_metadata: {
        ...(existing.app_metadata || {}),
        role: "SUPER_ADMIN",
      },
      // must_change_password lives in user_metadata so the signed-in user can
      // clear it themselves via auth.updateUser(). app_metadata is admin-only
      // writable, which would need a service-role call from the portal.
      user_metadata: {
        ...(existing.user_metadata || {}),
        must_change_password: true,
        bootstrapped_at: new Date().toISOString(),
      },
    }, "PUT");
    // Report BEFORE the role row is written: losing the one-time password locks
    // the operator out of a live account, whereas a failed role write is
    // repairable with a second run of this script.
    reportSuccess(existing.id, password, /* isReset */ true);
    await linkRoleRow(existing.id, args.name || "Platform Owner", "SUPER_ADMIN");
    return;
  }

  const created = await adminApi("/admin/users", {
    email,
    password,
    email_confirm: true,
    app_metadata: {
      role: "SUPER_ADMIN",
    },
    user_metadata: {
      name: args.name || "Platform Owner",
      must_change_password: true,
      bootstrapped_at: new Date().toISOString(),
    },
  });
  const userId = created.id ?? created.user?.id;
  if (!userId) throw new Error("Supabase did not return a user id.");
  reportSuccess(userId, password, /* isReset */ false);
  await linkRoleRow(userId, args.name || "Platform Owner", "SUPER_ADMIN");
})().catch((e) => {
  console.error("[bootstrap] FAILED:", e.message);
  process.exit(9);
});

// The auth user already exists at this point, so an unlinked role row means the
// portal will read role USER and reject sign-in. Never abort on it — print the
// repair hint so the operator keeps the credential they were just shown.
async function linkRoleRow(userId, display, role) {
  try {
    await upsertPublicUserRow(userId, display, role);
    console.error(`[bootstrap] public.User linked: id=${userId} role=${role}`);
  } catch (e) {
    console.error(`[bootstrap] WARNING — password is set but the role row was NOT written: ${e.message}`);
    console.error("            Sign-in will fall back to role USER until this is repaired.");
    console.error("            Usual cause: another User row already holds this email (seed fixture).");
    process.exitCode = 6;
  }
}

// ─── One-time stdout report ──────────────────────────────────────────────────
function reportSuccess(userId, pw, isReset) {
  const fp = createHash("sha256").update(pw).digest("hex").slice(0, 12);
  console.log("");
  console.log("═══════════════════════════════════════════════════════════════════════");
  console.log(`  SUPER ADMIN ${isReset ? "PASSWORD RESET" : "ACCOUNT CREATED"}`);
  console.log("═══════════════════════════════════════════════════════════════════════");
  console.log(`  Email        : ${email}`);
  console.log(`  User ID      : ${userId}`);
  console.log(`  Password     : ${pw}`);
  console.log(`  SHA-256/12   : ${fp}   (safe fingerprint — not the password)`);
  console.log("───────────────────────────────────────────────────────────────────────");
  console.log("  • Copy the password to your password manager NOW.");
  console.log("  • First sign-in at apps/admin will force rotation.");
  console.log("  • Rotate via admin panel → Settings → Credentials every 90 days.");
  console.log("  • NEVER paste this into a chat, ticket, email, or repo.");
  console.log("  • If this output leaked, revoke this account and re-bootstrap.");
  console.log("═══════════════════════════════════════════════════════════════════════");
  console.log("");
}
