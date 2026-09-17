#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — PHASE 1 VERIFICATION (remote state check)
# Run:  ./verify-phase1.sh
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

echo "→ Checking migrations..."
supabase migration list --linked

echo ""
echo "→ Verify schema in SQL Editor (paste this query):"
cat << 'SQL'
SELECT '1. role enum' AS check, udt_name AS value,
       CASE WHEN udt_name='AppRole' THEN '✓' ELSE '✗' END AS pass
FROM information_schema.columns
WHERE table_schema='public' AND table_name='User' AND column_name='role'
UNION ALL
SELECT '2. hook', proname, '✓' FROM pg_proc WHERE proname='custom_access_token_hook'
UNION ALL
SELECT '3. profile trigger', tgname, '✓' FROM pg_trigger WHERE tgname='on_auth_user_created'
UNION ALL
SELECT '4. broadcast triggers', COUNT(*)::text || ' of 5',
       CASE WHEN COUNT(*)>=5 THEN '✓' ELSE '✗' END
FROM pg_trigger WHERE tgname LIKE 'trg_broadcast_%'
UNION ALL
SELECT '5. RLS policies', COUNT(*)::text || ' policies',
       CASE WHEN COUNT(*)>=25 THEN '✓' ELSE '✗' END
FROM pg_policies WHERE schemaname='public';
SQL
