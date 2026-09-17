#!/usr/bin/env bash
# ==============================================================================
# PROJECT ZEAL — MONOREPO CONFIGURATION AUDIT & PURGE
# ==============================================================================
set -euo pipefail

INFO="\033[1;34m[INFO]\033[0m"
SUCCESS="\033[1;32m[SUCCESS]\033[0m"

echo -e "${INFO} Auditing monorepo for hidden netlify.toml files..."

# Find and display all instances of netlify.toml
find . -name "netlify.toml"

echo -e "${INFO} Purging all local netlify.toml files..."

# Delete all found instances safely
find . -name "netlify.toml" -type f -delete

echo -e "${SUCCESS} ====================================================================="
echo -e "${SUCCESS} AUDIT AND PURGE COMPLETE."
echo -e "${SUCCESS} All nested configuration files have been destroyed."
echo -e "${SUCCESS} Your monorepo is now clean."
echo -e "${SUCCESS} ====================================================================="