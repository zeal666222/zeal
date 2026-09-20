#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// scripts/a11y/fix.mjs — Auto-fix a11y violations
// ─────────────────────────────────────────────────────────────────────────────
// Pattern-based — no line-number dependency. Applies one fix per file:
//   • Icon-only buttons → add aria-label
//   • Inputs with placeholder but no id/aria-label → add aria-label
//   • Clickable overlays (div with onClick) → convert to button
//   • Heading order (h3→h2, h4→h3)
//
// Backs up every touched file. Reports fixes / skips / failures.
// ═══════════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

const REPO = process.cwd();
const TS = new Date().toISOString().replace(/[:.]/g, "-");
const BK = resolve(REPO, `.zeal-backup/a11y-fix-${TS}`);
mkdirSync(BK, { recursive: true });

let fixed = 0, skipped = 0, failed = 0;

function backup(file) {
  const full = resolve(REPO, file);
  const dst = resolve(BK, file.replace(/\//g, "_"));
  mkdirSync(dirname(dst), { recursive: true });
  try { copyFileSync(full, dst); } catch { /* ignore */ }
}

function applyFix(file, label, transform) {
  const full = resolve(REPO, file);
  if (!existsSync(full)) {
    console.log(`  ⚠ not found: ${file}`);
    failed++;
    return;
  }
  let src;
  try { src = readFileSync(full, "utf8"); }
  catch (e) { console.log(`  ✗ read failed: ${file}`); failed++; return; }

  let out;
  try { out = transform(src); }
  catch (e) { console.log(`  ✗ transform error in ${file}: ${e.message}`); failed++; return; }

  if (out === src) {
    console.log(`  ○ no change: ${file}`);
    skipped++;
    return;
  }
  backup(file);
  writeFileSync(full, out, "utf8");
  console.log(`  ✓ ${file} — ${label}`);
  fixed++;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// Add aria-label to a button when missing (idempotent).
// `anchor` matches text inside the onClick handler or a className fragment.
function addAriaLabelToButton(src, anchor, label) {
  const re = new RegExp(
    `(<button\\b(?=[^>]*${anchor})(?![^>]*\\baria-label=)[^>]*)(>)`,
    "g"
  );
  return src.replace(re, (m, before, close) => `${before} aria-label="${label}"${close}`);
}

// Add aria-label to every <input> with placeholder but no id/aria-label.
function addAriaLabelToPlaceholderInputs(src) {
  return src.replace(
    /<input\b([^>]*?)placeholder="([^"]+)"([^>]*?)(\/?>)/g,
    (m, pre, placeholder, post, close) => {
      if (/\baria-label=/.test(m) || /\bid=/.test(m)) return m;
      // Insert before the closing />> in a stable spot
      return `<input${pre}placeholder="${placeholder}"${post} aria-label="${placeholder}"${close}`;
    }
  );
}

// Convert overlay <div onClick ... /> to <button type="button" ... />
function overlayDivToButton(src, anchor) {
  const re = new RegExp(
    `<div\\s+onClick=\\{([^}]+)\\}\\s+className="([^"]*${anchor}[^"]*)"\\s*\\/>`,
    "g"
  );
  return src.replace(re, (m, onClick, className) => {
    return `<button type="button" aria-label="Close overlay" onClick={${onClick}} className="${className}" />`;
  });
}

// Promote all h3 → h2 (visual hierarchy already via className).
function promoteH3(src) {
  return src
    .replace(/<h3\b/g, "<h2")
    .replace(/<\/h3>/g, "</h2>");
}

// Promote all h4 → h3 (visual hierarchy already via className).
function promoteH4(src) {
  return src
    .replace(/<h4\b/g, "<h3")
    .replace(/<\/h4>/g, "</h3>");
}

// ─── Fix 1 — apps/admin/app/consultant/settings/page.tsx ───────────────────
// Copy button in subdomain block
applyFix(
  "apps/admin/app/consultant/settings/page.tsx",
  "copy button aria-label",
  (src) => addAriaLabelToButton(src, "onClick=\\{copySubdomain\\}", "Copy white-label URL"),
);

// ─── Fix 2 — apps/admin/components/chat/InboxList.tsx ──────────────────────
// Search input + heading order
applyFix(
  "apps/admin/components/chat/InboxList.tsx",
  "search input aria-label + heading order",
  (src) => promoteH3(addAriaLabelToPlaceholderInputs(src)),
);

// ─── Fix 3 — apps/admin/components/consultant/WithdrawalModal.tsx ──────────
// Close button (icon-only <X />) inside <button onClick={onClose}>
applyFix(
  "apps/admin/components/consultant/WithdrawalModal.tsx",
  "close button aria-label",
  (src) => addAriaLabelToButton(src, "onClick=\\{onClose\\}", "Close"),
);

// ─── Fix 4 — apps/admin/components/consultant/WorkspaceSidebar.tsx ─────────
// Mobile overlay dismissor <div onClick={() => setOpen(false)} className="... inset-0 ..." />
applyFix(
  "apps/admin/components/consultant/WorkspaceSidebar.tsx",
  "overlay div → button",
  (src) => overlayDivToButton(src, "inset-0"),
);

// ─── Fix 5 — apps/web/app/consultant/onboarding/page.tsx ───────────────────
// Specialties + languages inputs (placeholder-only)
applyFix(
  "apps/web/app/consultant/onboarding/page.tsx",
  "onboarding input aria-labels",
  addAriaLabelToPlaceholderInputs,
);

// ─── Fix 6 — apps/web/app/profile/page.tsx ─────────────────────────────────
// Edit button (icon-only) + heading order
applyFix(
  "apps/web/app/profile/page.tsx",
  "edit button aria-label + heading order",
  (src) => {
    let r = src.replace(
      /<button\s+onClick=\{\(\)\s*=>\s*setIsEditing\(true\)\}(?![^>]*aria-label)([^>]*)>/g,
      (m, attrs) => `<button onClick={() => setIsEditing(true)} aria-label="Edit profile"${attrs}>`,
    );
    // Also handle common icon-only close buttons in modals
    r = r.replace(
      /<button\s+onClick=\{onClose\}(?![^>]*aria-label)([^>]*)>/g,
      (m, attrs) => `<button onClick={onClose} aria-label="Close"${attrs}>`,
    );
    // h4 → h3 (page has h2 → h4 violations)
    r = promoteH4(r);
    return r;
  },
);

// ─── Fix 7 — apps/web/app/services/ZealHubClient.tsx ───────────────────────
// Category chips: <span onClick> → <button type="button">
applyFix(
  "apps/web/app/services/ZealHubClient.tsx",
  "category chips span → button",
  (src) => {
    // Only convert the specific chips span — match by the onClick to router.push
    return src.replace(
      /<span(\s+key=\{idx\}[^>]*?onClick=\{\(\)\s*=>\s*router\.push\([^)]+\)\}[^>]*?)>/g,
      (m, attrs) => `<button type="button"${attrs} aria-label="Browse category">`,
    ).replace(
      /<\/span>(\s*\)\)\})/g,
      "</button>$1",
    );
  },
);

// ─── Fix 8 — apps/web/components/admin/AISpawnerClient.tsx ─────────────────
// Name + avatar URL inputs
applyFix(
  "apps/web/components/admin/AISpawnerClient.tsx",
  "spawner input aria-labels",
  addAriaLabelToPlaceholderInputs,
);

// ─── Fix 9 — apps/web/components/consultant/WorkspaceSidebar.tsx ───────────
// Mobile overlay dismissor
applyFix(
  "apps/web/components/consultant/WorkspaceSidebar.tsx",
  "overlay div → button",
  (src) => overlayDivToButton(src, "inset-0"),
);

// ─── Heading order fixes (Minor) ────────────────────────────────────────────
// h3 → h2 for these files (page has h1 and h3 with no h2 in between)
const H3_TO_H2 = [
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
];

for (const file of H3_TO_H2) {
  applyFix(file, "heading order h3 → h2", promoteH3);
}

// h4 → h3 for these files (page has h2 and h4 with no h3 in between)
const H4_TO_H3 = [
  "apps/web/app/explore/page.tsx",
];

for (const file of H4_TO_H3) {
  applyFix(file, "heading order h4 → h3", promoteH4);
}

// ─── Summary ────────────────────────────────────────────────────────────────
console.log();
console.log(`  ${fixed} fixed · ${skipped} skipped · ${failed} failed`);
console.log(`  Backup: ${BK}`);
process.exit(failed > 0 ? 1 : 0);
