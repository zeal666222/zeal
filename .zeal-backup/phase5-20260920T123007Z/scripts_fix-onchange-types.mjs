#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — onChange generic parameter corrector
// ═══════════════════════════════════════════════════════════════════════════════
// Pure Node.js, no dependencies. Walks backward from each `onChange=` to find
// the enclosing opening tag, then rewrites the generic to match.
//
// Handles:
//   • Self-closing tags  <input ... />
//   • Paired tags        <select>...</select>
//   • Multi-line JSX
//   • Nested handlers inside .map()
//   • Component wrappers (<Input>, <Textarea>, <Select> from @zeal/ui)
//   • Already-correct types (no-op)
//
// Usage: node scripts/fix-onchange-types.mjs <file1.tsx> [file2.tsx ...]
// ═══════════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync } from "node:fs";

// ─── Map of tag names → element type ─────────────────────────────────────────
const TAG_TO_TYPE = {
  input: "HTMLInputElement",
  textarea: "HTMLTextAreaElement",
  select: "HTMLSelectElement",
  option: "HTMLOptionElement",
  // Custom @zeal/ui wrappers — infer from name
  Input: "HTMLInputElement",
  Textarea: "HTMLTextAreaElement",
  Select: "HTMLSelectElement",
};

// ─── Walk backward from `onChange=` to find the enclosing opening tag ───────
//
// Approach: scan characters backwards. Track depth of `>` and `<`. The first
// `<TAG` we hit while at depth 0 is our enclosing element.
//
// Example input (cursor ^ at start of `onChange`):
//
//   <select
//     value={filter}
//     onChange={(e) => setFilter(e.target.value)}
//   >
//
//   Scanning backward from `onChange`, we skip whitespace, then hit `\n    `,
//   then `}` (from a previous prop), ... eventually reach `<select`.
//
function findEnclosingTag(source, onChangeIndex) {
  let i = onChangeIndex - 1;
  let depth = 0; // depth of `>` we've crossed vs `<`

  while (i >= 0) {
    const ch = source[i];

    if (ch === ">") {
      // We're entering a nested expression or closing another tag
      depth++;
    } else if (ch === "<") {
      if (depth === 0) {
        // Found the opening bracket of our enclosing tag
        // Read the tag name: letters after `<`
        let j = i + 1;
        // Skip forward-slash (closing tags) — shouldn't happen but be safe
        if (source[j] === "/") return null;
        let name = "";
        while (j < source.length && /[A-Za-z0-9_.]/.test(source[j])) {
          name += source[j];
          j++;
        }
        return name || null;
      }
      depth--;
    }

    // Cap the backward scan at 2000 chars to prevent pathological cost
    if (onChangeIndex - i > 2000) return null;
    i--;
  }
  return null;
}

// ─── Rewrite the generic on the handler ────────────────────────────────────
//
// We look for the pattern:
//   onChange={(e: React.ChangeEvent<HTMLXElement>) =>
// or
//   onChange={(e: ChangeEvent<HTMLXElement>) =>
// and swap the element type.
//
function correctGeneric(handlerText, correctType) {
  // Match `ChangeEvent<...>` inside the handler
  const re = /(React\.)?ChangeEvent<\s*HTML[A-Za-z]+\s*>/;
  const m = handlerText.match(re);
  if (!m) return null; // no generic present — leave alone

  const currentType = m[0].match(/HTML[A-Za-z]+/)?.[0];
  if (currentType === correctType) return null; // already correct — no-op

  const replacement = m[1]
    ? `React.ChangeEvent<${correctType}>`
    : `ChangeEvent<${correctType}>`;

  return handlerText.replace(re, replacement);
}

// ─── Process a single file ─────────────────────────────────────────────────
function processFile(filePath) {
  const original = readFileSync(filePath, "utf8");
  let source = original;
  let changes = 0;
  const editLog = [];

  // Find every `onChange={` occurrence
  const onChangeRe = /\bonChange=\{/g;
  let match;

  // We iterate forward but edit with stable offsets by collecting all edits
  // first, then applying them from END to START (so earlier offsets stay valid).
  const edits = [];

  while ((match = onChangeRe.exec(source)) !== null) {
    const onChangeIdx = match.index;

    // Find the enclosing tag
    const tag = findEnclosingTag(source, onChangeIdx);
    if (!tag) continue;

    const correctType = TAG_TO_TYPE[tag];
    if (!correctType) continue;

    // Extract the handler — from `onChange={` to the matching `}`.
    // Simple brace counter to find the end of the handler expression.
    const braceStart = onChangeIdx + "onChange={".length - 1; // points to `{`
    let braceDepth = 0;
    let braceEnd = -1;
    for (let i = braceStart; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{") braceDepth++;
      else if (ch === "}") {
        braceDepth--;
        if (braceDepth === 0) {
          braceEnd = i;
          break;
        }
      }
    }
    if (braceEnd < 0) continue;

    const handler = source.slice(braceStart + 1, braceEnd);
    const corrected = correctGeneric(handler, correctType);
    if (!corrected) continue;

    edits.push({
      start: braceStart + 1,
      end: braceEnd,
      replacement: corrected,
      tag,
      from: handler.match(/HTML[A-Za-z]+/)?.[0] ?? "?",
      to: correctType,
    });
  }

  // Apply edits from end → start so earlier indices stay valid
  edits.sort((a, b) => b.start - a.start);
  for (const e of edits) {
    source = source.slice(0, e.start) + e.replacement + source.slice(e.end);
    changes++;
    editLog.push(`    ${e.tag}: ${e.from} → ${e.to}`);
  }

  if (changes > 0) {
    writeFileSync(filePath, source, "utf8");
  }

  return { changes, editLog };
}

// ─── Main ──────────────────────────────────────────────────────────────────
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node fix-onchange-types.mjs <file.tsx> [...]");
  process.exit(2);
}

let totalChanges = 0;
let totalFiles = 0;
for (const file of files) {
  try {
    const { changes, editLog } = processFile(file);
    if (changes > 0) {
      console.log(`✓ ${file} — ${changes} fix${changes === 1 ? "" : "es"}`);
      for (const line of editLog) console.log(line);
      totalChanges += changes;
      totalFiles++;
    }
  } catch (err) {
    console.error(`✗ ${file} — ${err.message}`);
    process.exitCode = 1;
  }
}

if (totalChanges === 0) {
  console.log("(no incorrect generics found — all onChange types already correct)");
} else {
  console.log(`\nFixed ${totalChanges} handler${totalChanges === 1 ? "" : "s"} across ${totalFiles} file${totalFiles === 1 ? "" : "s"}`);
}
