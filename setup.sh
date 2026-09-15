#!/usr/bin/env bash
# ==============================================================================
# PROJECT ZEAL — TYPE CHECK & REPOSITORY SYNC
# ==============================================================================
set -euo pipefail

INFO="\033[1;34m[INFO]\033[0m"
SUCCESS="\033[1;32m[SUCCESS]\033[0m"
ERROR="\033[1;31m[ERROR]\033[0m"

echo -e "${INFO} 1. Running strict enterprise type check..."
if npx tsc --noEmit --project apps/web/tsconfig.json; then
    echo -e "${SUCCESS} Workspace compiled successfully. No type errors!"
else
    echo -e "${ERROR} Type check failed! Please review the terminal output above before pushing."
    exit 1
fi

echo -e "${INFO} 2. Staging unified dashboard and wallet updates..."
git add -A

echo -e "${INFO} 3. Committing high-end profile architecture..."
git commit -m "feat(zeal): implement enterprise unified profile dashboard, ledger, and atomic wallet" || echo "No changes to commit..."

echo -e "${INFO} 4. Pushing repository securely to GitHub main branch..."
git push -u origin main

echo -e "${SUCCESS} ====================================================================="
echo -e "${SUCCESS} CODEBASE VERIFIED AND PUSHED TO GITHUB!"
echo -e "${SUCCESS} ====================================================================="