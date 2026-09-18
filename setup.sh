#!/bin/bash
cd "$(git rev-parse --show-toplevel)"||exit 1
P=0;F=0
ok(){ echo "  ✓ $1";P=$((P+1));}
no(){ echo "  ✗ $1";F=$((F+1));}

echo "── Cleaning build caches ──"
for d in apps/web/.next apps/admin/.next .next; do
  [ -d "$d" ] && { rm -rf "$d"; ok "removed $d"; } || echo "  ○ no $d"
done

find . -name tsconfig.tsbuildinfo -not -path './node_modules/*' -delete 2>/dev/null
ok "removed all tsbuildinfo"

echo ""
echo "── Verify source (excludes .next, node_modules, _archive) ──"
n=$(grep -rl "@upstash" \
    apps/web/app apps/web/lib apps/web/components apps/web/actions apps/web/hooks \
    apps/admin/app apps/admin/lib apps/admin/components apps/admin/actions apps/admin/hooks \
    packages/database/src packages/realtime/src packages/types/src packages/ui/src packages/utils/src \
    2>/dev/null | wc -l)
[ "$n" -eq 0 ] && ok "zero @upstash in source" || { no "$n source files reference @upstash"; grep -rl "@upstash" apps/web/app apps/web/lib apps/admin/app apps/admin/lib packages/*/src 2>/dev/null; }

n=$(grep -rl "UPSTASH_REDIS" \
    apps/web/app apps/web/lib apps/web/components apps/web/actions apps/web/hooks \
    apps/admin/app apps/admin/lib apps/admin/components apps/admin/actions apps/admin/hooks \
    packages/database/src packages/realtime/src packages/types/src packages/ui/src packages/utils/src \
    2>/dev/null | wc -l)
[ "$n" -eq 0 ] && ok "zero UPSTASH_REDIS env refs in source" || { no "$n source files reference UPSTASH_REDIS"; grep -rl "UPSTASH_REDIS" apps/web/app apps/web/lib apps/admin/app apps/admin/lib packages/*/src 2>/dev/null; }

n=$(grep -rl "@upstash" package.json apps/*/package.json packages/*/package.json 2>/dev/null | wc -l)
[ "$n" -eq 0 ] && ok "zero @upstash in package.json" || { no "$n package.json files still list @upstash"; grep -l "@upstash" package.json apps/*/package.json packages/*/package.json 2>/dev/null; }

echo ""
echo "── Type-check (fresh, no cache) ──"
(cd apps/web && npx tsc --noEmit --pretty false) >/tmp/tcw.log 2>&1 \
  && ok "web type-check" \
  || { no "web type-check"; head -8 /tmp/tcw.log; }
(cd apps/admin && npx tsc --noEmit --pretty false) >/tmp/tca.log 2>&1 \
  && ok "admin type-check" \
  || { no "admin type-check"; head -8 /tmp/tca.log; }

echo ""
echo "════ PASS=$P  FAIL=$F ════"
[ $F -eq 0 ] && echo "✓ ALL CLEAN" || echo "✗ REVIEW ABOVE"