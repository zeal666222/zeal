#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Accurate onChange type verifier
// ═══════════════════════════════════════════════════════════════════════════════
// Reuses the AST-aware walker to detect real mismatches (not co-occurrence).
// Exit code 0 = all correct, 1 = at least one file needs fixing.
// ═══════════════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";

const TAG_TO_TYPE = {
  input: "HTMLInputElement",
  textarea: "HTMLTextAreaElement",
  select: "HTMLSelectElement",
  Input: "HTMLInputElement",
  Textarea: "HTMLTextAreaElement",
  Select: "HTMLSelectElement",
};

function findEnclosingTag(source, onChangeIndex) {
  let i = onChangeIndex - 1;
  let depth = 0;
  while (i >= 0) {
    const ch = source[i];
    if (ch === ">") depth++;
    else if (ch === "<") {
      if (depth === 0) {
        let j = i + 1;
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
    if (onChangeIndex - i > 2000) return null;
    i--;
  }
  return null;
}

function extractGenericType(handlerText) {
  const m = handlerText.match(/ChangeEvent<\s*(HTML[A-Za-z]+)\s*>/);
  return m ? m[1] : null;
}

let totalMismatches = 0;
const files = process.argv.slice(2);

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const re = /\bonChange=\{/g;
  let match;
  while ((match = re.exec(src)) !== null) {
    const onChangeIdx = match.index;
    const tag = findEnclosingTag(src, onChangeIdx);
    if (!tag) continue;
    const correct = TAG_TO_TYPE[tag];
    if (!correct) continue;

    // Extract handler
    const braceStart = onChangeIdx + "onChange={".length - 1;
    let depth = 0, end = -1;
    for (let i = braceStart; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) continue;

    const handler = src.slice(braceStart + 1, end);
    const current = extractGenericType(handler);
    if (current && current !== correct) {
      console.log(`✗ ${file}: <${tag}> expected ${correct}, found ${current}`);
      totalMismatches++;
    }
  }
}

if (totalMismatches === 0) {
  console.log("✓ all onChange generics match their element");
  process.exit(0);
} else {
  console.log(`\n✗ ${totalMismatches} mismatch${totalMismatches === 1 ? "" : "es"} detected`);
  process.exit(1);
}
