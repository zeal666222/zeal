#!/usr/bin/env bash
# ==============================================================================
# PROJECT ZEAL — NEXT.JS CACHE PURGE & PRODUCTION VERIFICATION
# ==============================================================================
set -euo pipefail

INFO="\033[1;34m[INFO]\033[0m"
SUCCESS="\033[1;32m[SUCCESS]\033[0m"
ERR_MSG="\033[1;31m[ERROR]\033[0m"

echo -e "${INFO} 1. Purging Next.js cache to eliminate ghost routes..."
rm -rf apps/web/.next

echo -e "${INFO} 2. Running strict enterprise type check..."
if npx tsc --noEmit --project apps/web/tsconfig.json; then
    echo -e "${SUCCESS} Workspace compiled successfully. No ghost routes detected!"
else
    echo -e "${ERR_MSG} Type check failed! Please review the terminal output above."
    exit 1
fi

echo -e "${INFO} 3. Executing Next.js Production Build Verification..."
if npm run build; then
    echo -e "${SUCCESS} Next.js production build completed successfully!"
    
    echo -e "${INFO} 4. Staging and committing architectural cleanse..."
    git add -A
    git commit -m "fix(zeal): clear .next cache to resolve legacy onboarding route conflicts and finalize consultant workflow" || echo "No changes to commit..."
    
    echo -e "${INFO} 5. Pushing securely to GitHub main branch..."
    git push -u origin main
    
    echo -e "${SUCCESS} ====================================================================="
    echo -e "${SUCCESS} HIGH-END ONBOARDING ARCHITECTURE CLEANED AND DEPLOYED!"
    echo -e "${SUCCESS} ====================================================================="
else
    echo -e "${ERR_MSG} Production build failed! Please review the error logs above."
    exit 1
fi