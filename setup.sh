rm -rf packages/database/src/services packages/database/src/admin.ts packages/database/src/helpers packages/database/src/queries 2>/dev/null

# Strip stale imports in server.ts that point at deleted modules
if [[ -f packages/database/src/server.ts ]]; then
  sed -i '/from "\.\/services/d; /from "\.\/helpers/d; /from "\.\/queries/d; /from "\.\/admin/d' packages/database/src/server.ts
fi

# Regenerate types.ts (Role + enums missing)
cat > packages/database/src/types.ts << 'EOF'
import type { Database, Json } from "@zeal/types";
export type { Database, Json };

export type Role = "USER" | "CLIENT_ADMIN" | "SUPPORT" | "ADMIN" | "SUPER_ADMIN" | "VIEWER" | "AI";
export type ConsultantStatus = "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED";
export type ConsultantCategory =
  | "ASTROLOGER" | "PSYCHOLOGIST" | "TAROT" | "NUMEROLOGIST"
  | "PALMIST" | "VASTU" | "REIKI" | "LIFE_COACH"
  | "MOTIVATIONAL_SPEAKER" | "SPIRITUAL_GUIDE"
  | "YOGA_INSTRUCTOR" | "HEALER";
export type Faith = "HINDU" | "ISLAM" | "CHRISTIAN" | "BUDDHIST" | "JEWISH" | "SIKH" | "OTHER";
export type BookingStatus = "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "MISSED" | "DISPUTED";
export type CallStatus = "INITIATED" | "CONNECTED" | "ENDED" | "RECORDING_READY";
export type TransactionType = "TOPUP" | "PAYMENT" | "REFUND" | "PAYOUT" | "FEE" | "COMMISSION";
EOF

# Verify packages/database compiles
pushd packages/database >/dev/null
if npx --no-install tsc --noEmit --pretty false 2>/tmp/db-tc.log; then
  echo "OK packages/database"
  DB_OK=1
else
  echo "FAIL packages/database"
  grep 'error TS' /tmp/db-tc.log | head -15 | sed 's/^/  /'
  DB_OK=0
fi
popd >/dev/null

# Verify apps/web
pushd apps/web >/dev/null
if npx --no-install tsc --noEmit --pretty false 2>/tmp/web-tc.log; then
  echo "OK apps/web"
  WEB_OK=1
else
  echo "FAIL apps/web"
  grep 'error TS' /tmp/web-tc.log | head -20 | sed 's/^/  /'
  WEB_OK=0
fi
popd >/dev/null

# Verify apps/admin
pushd apps/admin >/dev/null
if npx --no-install tsc --noEmit --pretty false 2>/tmp/adm-tc.log; then
  echo "OK apps/admin"
  ADM_OK=1
else
  echo "FAIL apps/admin"
  grep 'error TS' /tmp/adm-tc.log | head -15 | sed 's/^/  /'
  ADM_OK=0
fi
popd >/dev/null

# Commit only if all three pass
if [[ "${DB_OK:-0}" == "1" && "${WEB_OK:-0}" == "1" && "${ADM_OK:-0}" == "1" ]]; then
  git add -A 2>/dev/null
  git reset -- _archive/ .zeal/ 2>/dev/null
  git commit -m "Fix auth core: remove dead services/, restore type exports" >/dev/null 2>&1 \
    && echo "COMMITTED $(git rev-parse --short HEAD)" \
    && git push origin main >/dev/null 2>&1 \
    && echo "PUSHED"
else
  echo "NOT COMMITTED — errors remain above"
fi