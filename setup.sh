#!/bin/bash
W=${1:-https://zeal-web-red.vercel.app}
A=${2:-https://zeal-admin-rose.vercel.app}
P=0;F=0
t(){ c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$2");[ "$c" = "$3" ]&&{ P=$((P+1));echo "  ✓ $1 ($c)";}||{ echo "  ✗ $1 ($c≠$3)";F=$((F+1));};}
h(){ curl -sI --max-time 15 "$1"|grep -qi "$2"&&{ P=$((P+1));echo "  ✓ $1 has $2";}||{ echo "  ✗ $1 missing $2";F=$((F+1));};}
j(){ curl -s --max-time 15 "$1"|python -c "import sys,json;d=json.load(sys.stdin);print('  '+('✓' if d.get('$2') else '✗')+' $1 $2='+str(d.get('$2')))" 2>/dev/null||{ echo "  ✗ $1 invalid JSON";F=$((F+1));};}

echo "── Web pages ──"
t "GET /"                  "$W/"                  200
t "GET /login"             "$W/login"             200
t "GET /services"          "$W/services"          200
t "GET /explore"           "$W/explore"           200

echo "── Web APIs ──"
t "GET /api/health"        "$W/api/health"        200
t "GET /api/admin/stats"   "$W/api/admin/stats"   401
t "GET /api/wallet/balance" "$W/api/wallet/balance" 401

echo "── Admin ──"
t "GET /login"             "$A/login"             200
t "GET /api/health"        "$A/api/health"        200

echo "── Health body ──"
curl -s --max-time 15 "$W/api/health"|python -m json.tool 2>/dev/null|head -20

echo "── Security headers ──"
h "$W/" "content-security-policy"
h "$A/login" "content-security-policy"
h "$W/" "strict-transport-security"
h "$A/login" "x-frame-options"

echo "── Realtime consumers (local code) ──"
cd "$(git rev-parse --show-toplevel)"
c(){ grep -q "channels\.$1" "$2" 2>/dev/null&&{ P=$((P+1));echo "  ✓ $1 ← $2";}||{ echo "  ✗ $1 not in $2";F=$((F+1));};}
c userInbox        apps/web/hooks/useConversations.ts
c roomMessages     apps/web/hooks/useChat.ts
c userWallet       apps/web/hooks/useWallet.ts
c userNotifications apps/web/components/providers/RealtimeProvider.tsx
c consultantBookings apps/admin/app/consultant/bookings/page.tsx
c consultantSparks apps/web/hooks/useSparks.ts
c adminBookings    "apps/admin/app/(dashboard)/dashboard/page.tsx"
c adminVerification "apps/admin/app/(dashboard)/verification/page.tsx"
c consultantsLive  apps/web/hooks/useConsultants.ts
c consultantAiUpdates apps/web/hooks/useAiConsultants.ts

echo ""
echo "════════════════════════════════════════"
echo " PASS=$P  FAIL=$F"
[ $F -eq 0 ]&&echo " ✓ DEPLOYED HEALTHY"||echo " ✗ REVIEW ABOVE"
echo "════════════════════════════════════════"