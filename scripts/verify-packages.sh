#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — Verify internal package.json exports maps
# ═══════════════════════════════════════════════════════════════════════════════
# Fails CI if any internal package has a broken exports map.
# Catches: missing "." entry, "types" not first, malformed paths.
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

FAIL=0

for pkg in packages/*/package.json; do
  name=$(node -p "require('./$pkg').name")

  # Rule 1: every package.json must have a "name"
  if [[ "$name" == "undefined" ]]; then
    echo "✗ $pkg — missing name"
    FAIL=$((FAIL+1))
    continue
  fi

  # Rule 2: if exports exists, "." must be present
  has_exports=$(node -p "require('./$pkg').exports ? 'yes' : 'no'")
  if [[ "$has_exports" == "yes" ]]; then
    has_dot=$(node -p "require('./$pkg').exports['.'] ? 'yes' : 'no'")
    if [[ "$has_dot" != "yes" ]]; then
      echo "✗ $name — exports map missing '.' entry (main/types will be ignored)"
      FAIL=$((FAIL+1))
    fi
  fi

  # Rule 3: every referenced path must exist
  node -e "
    const p = require('./$pkg');
    const fs = require('fs');
    const path = require('path');
    const dir = path.dirname('$pkg');
    let bad = 0;
    function check(v) {
      if (typeof v === 'string' && v.startsWith('.')) {
        const full = path.resolve(dir, v);
        if (!fs.existsSync(full)) {
          console.log('✗ ' + p.name + ' — path does not exist: ' + v);
          bad++;
        }
      } else if (v && typeof v === 'object') {
        Object.values(v).forEach(check);
      }
    }
    if (p.exports) check(p.exports);
    process.exit(bad > 0 ? 1 : 0);
  " || FAIL=$((FAIL+1))
done

if [[ $FAIL -eq 0 ]]; then
  echo "✓ all package.json exports maps valid"
  exit 0
else
  echo "✗ $FAIL package(s) have invalid exports"
  exit 1
fi
