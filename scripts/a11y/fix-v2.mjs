#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// scripts/a11y/fix-v2.mjs — JSX-aware a11y fixer (brace-safe)
// ─────────────────────────────────────────────────────────────────────────────
// Unlike v1, this uses a character scanner that:
//   • Respects `{}` nesting (arrow functions, object literals)
//   • Respects quoted strings ("...", '...')
//   • Never injects inside an attribute expression
//
// Applies:
//   1. <input> with placeholder but no id/aria-label → add aria-label
//   2. <button> with only an icon child and no aria-label → add aria-label
//   3. h4 → h3 in flagged files
//   4. h3 → h2 in flagged files
// ═══════════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

const REPO = process.cwd();
const TS = new Date().toISOString().replace(/[:.]/g, "-");
const BK = resolve(REPO, `.zeal-backup/a11y-fix-v2-${TS}`);
mkdirSync(BK, { recursive: true });

let fixed = 0, skipped = 0, failed = 0;

function backup(file) {
  const full = resolve(REPO, file);
  const dst = resolve(BK, file.replace(/\//g, "_"));
  mkdirSync(dirname(dst), { recursive: true });
  try { copyFileSync(full, dst); } catch { /* ignore */ }
}

function writeFix(file, label, transform) {
  const full = resolve(REPO, file);
  if (!existsSync(full)) { console.log(`  ⚠ not found: ${file}`); failed++; return; }
  let src; try { src = readFileSync(full, "utf8"); } catch { console.log(`  ✗ read: ${file}`); failed++; return; }
  let out; try { out = transform(src); } catch (e) { console.log(`  ✗ transform: ${file}: ${e.message}`); failed++; return; }
  if (out === src) { console.log(`  ○ no change: ${file}`); skipped++; return; }
  backup(file);
  writeFileSync(full, out, "utf8");
  console.log(`  ✓ ${file} — ${label}`);
  fixed++;
}

// ─── Character scanner: find end of a JSX opening tag ──────────────────────
// Returns index of the closing `>` or -1 if not found.
function findTagEnd(src, startIdx) {
  let i = startIdx + 1;
  let braceDepth = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    if (quote) {
      if (c === quote && src[i - 1] !== "\\") quote = null;
    } else if (braceDepth > 0) {
      if (c === "{") braceDepth++;
      else if (c === "}") braceDepth--;
      else if (c === '"' || c === "'") quote = c;
    } else {
      if (c === '"' || c === "'") quote = c;
      else if (c === "{") braceDepth++;
      else if (c === ">") return i;
    }
    i++;
  }
  return -1;
}

// ─── Fix inputs ─────────────────────────────────────────────────────────────
function fixInputs(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const idx = src.indexOf("<input", i);
    if (idx === -1) { out += src.slice(i); break; }
    const next = src[idx + 6];
    // Guard against <inputSomething
    if (next && /[A-Za-z0-9_$]/.test(next)) {
      out += src.slice(i, idx + 6);
      i = idx + 6;
      continue;
    }
    out += src.slice(i, idx);
    const end = findTagEnd(src, idx);
    if (end === -1) { out += src.slice(idx); break; }
    let tag = src.slice(idx, end + 1);
    const pm = tag.match(/\bplaceholder="([^"]+)"/);
    const hasLabel = /\baria-label=/.test(tag);
    const hasId = /\bid=/.test(tag);
    if (pm && !hasLabel && !hasId) {
      const isSelfClose = /\/\s*>$/.test(tag);
      const trimmed = tag.replace(/\s*\/?\s*>$/, "");
      const label = pm[1].replace(/"/g, "&quot;");
      tag = trimmed + ` aria-label="${label}"` + (isSelfClose ? " />" : ">");
    }
    out += tag;
    i = end + 1;
  }
  return out;
}

// ─── Fix icon-only buttons ──────────────────────────────────────────────────
function deriveLabel(openTag) {
  const m = openTag.match(/onClick=\{([^}]*)\}/);
  if (!m) return "Button";
  const h = m[1];
  if (/close/i.test(h)) return "Close";
  if (/cancel/i.test(h)) return "Cancel";
  if (/edit/i.test(h) || /isEditing\(true\)/i.test(h)) return "Edit";
  if (/remove|delete/i.test(h)) return "Remove";
  if (/toggle/i.test(h)) return "Toggle";
  if (/copy/i.test(h)) return "Copy";
  if (/refresh|reload/i.test(h)) return "Refresh";
  if (/next|forward/i.test(h)) return "Next";
  if (/prev|back/i.test(h)) return "Previous";
  return "Button";
}

function isIconOnlyContent(content) {
  const t = content.trim();
  if (t.length === 0 || t.length > 200) return false;
  // Must look like a single JSX element
  //   Self-closing: <X ... />  or  <X ...></X>  or  <X ...>...</X>
  //   Multiple siblings allowed if all are JSX (no bare text)
  const hasText = /(?<![<>=])\s*[A-Za-z][^<]*/.test(t.replace(/<[^>]+>/g, ""));
  if (hasText) return false;
  // Must contain at least one opening tag
  return /<[A-Z]/.test(t);
}

function fixIconOnlyButtons(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const idx = src.indexOf("<button", i);
    if (idx === -1) { out += src.slice(i); break; }
    const next = src[idx + 7];
    if (next && /[A-Za-z0-9_$]/.test(next)) {
      out += src.slice(i, idx + 7);
      i = idx + 7;
      continue;
    }
    out += src.slice(i, idx);
    const openEnd = findTagEnd(src, idx);
    if (openEnd === -1) { out += src.slice(idx); break; }
    let openTag = src.slice(idx, openEnd + 1);

    // Find the matching </button>. Assume no nested buttons (best-effort).
    const closeIdx = src.indexOf("</button>", openEnd + 1);
    if (closeIdx === -1) { out += openTag; i = openEnd + 1; continue; }

    const content = src.slice(openEnd + 1, closeIdx);
    const hasLabel = /\baria-label=/.test(openTag);
    const hasSrOnly = /\bsr-only\b/.test(content);

    if (!hasLabel && !hasSrOnly && isIconOnlyContent(content)) {
      const label = deriveLabel(openTag);
      const trimmed = openTag.replace(/\s*>$/, "");
      openTag = trimmed + ` aria-label="${label}">`;
    }

    out += openTag + content + "</button>";
    i = closeIdx + "</button>".length;
  }
  return out;
}

// ─── Heading order fixes ────────────────────────────────────────────────────
function promoteH3toH2(src) {
  return src.replace(/<h3\b/g, "<h2").replace(/<\/h3>/g, "</h2>");
}
function promoteH4toH3(src) {
  return src.replace(/<h4\b/g, "<h3").replace(/<\/h4>/g, "</h3>");
}

// ─── Files to fix ───────────────────────────────────────────────────────────
// All files that were reported by the scanner as having violations.

// Inputs (placeholder-only)
const INPUT_FILES = [
  "apps/web/app/consultant/onboarding/page.tsx",
  "apps/web/components/admin/AISpawnerClient.tsx",
  "apps/admin/components/chat/InboxList.tsx",
];

// Icon-only buttons
const BUTTON_FILES = [
  "apps/web/app/profile/page.tsx",
  "apps/admin/components/consultant/WithdrawalModal.tsx",
  "apps/admin/app/consultant/settings/page.tsx",
];

// Heading order h3 → h2
const H3_TO_H2_FILES = [
  "apps/admin/app/(dashboard)/ai-consultants/page.tsx",
  "apps/admin/app/consultant/dashboard/page.tsx",
  "apps/admin/components/consultant/StudioClient.tsx",
  "apps/web/app/ai-astrologers/[id]/page.tsx",
  "apps/web/app/notifications/page.tsx",
  "apps/web/app/services/horoscope/page.tsx",
  "apps/web/app/services/numerology/page.tsx",
  "apps/web/app/services/tarot/page.tsx",
  "apps/web/app/wallet/page.tsx",
  "apps/web/app/white-label/[subdomain]/page.tsx",
  "apps/web/app/white-label/[subdomain]/services/page.tsx",
  "apps/web/components/chat/InstagramInboxList.tsx",
  "apps/web/components/consultant/StudioClient.tsx",
  "apps/web/components/public/ConsultantProfileClient.tsx",
  "apps/admin/components/chat/InboxList.tsx",
];

// Heading order h4 → h3
const H4_TO_H3_FILES = [
  "apps/web/app/explore/page.tsx",
  "apps/admin/app/consultant/dashboard/page.tsx",
  "apps/admin/components/consultant/StudioClient.tsx",
  "apps/web/components/consultant/StudioClient.tsx",
];

// ─── Apply ──────────────────────────────────────────────────────────────────
for (const file of INPUT_FILES) {
  writeFix(file, "input aria-labels", fixInputs);
}

for (const file of BUTTON_FILES) {
  writeFix(file, "icon-only button aria-labels", fixIconOnlyButtons);
}

for (const file of H3_TO_H2_FILES) {
  writeFix(file, "heading h3 → h2", promoteH3toH2);
}

for (const file of H4_TO_H3_FILES) {
  writeFix(file, "heading h4 → h3", promoteH4toH3);
}

// Also run both fixers on profile (it has both button + heading issues)
writeFix("apps/web/app/profile/page.tsx", "icon-only buttons (2nd pass)", fixIconOnlyButtons);

console.log();
console.log(`  ${fixed} fixed · ${skipped} skipped · ${failed} failed`);
console.log(`  Backup: ${BK}`);
process.exit(failed > 0 ? 1 : 0);
