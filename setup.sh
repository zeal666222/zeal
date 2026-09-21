#!/usr/bin/env bash
# ==============================================================================
# PROJECT ZEAL — REPOSITORY TREE & FULL SOURCE CODE DUMPER
# ==============================================================================
set -euo pipefail

OUTPUT_FILE="zeal_full_repository_dump.txt"

INFO="\033[1;34m[INFO]\033[0m"
SUCCESS="\033[1;32m[SUCCESS]\033[0m"

echo -e "${INFO} Generating repository file tree and bundling source codes into ${OUTPUT_FILE}..."

# 1. Initialize output file with header
cat << 'EOF' > "$OUTPUT_FILE"
================================================================================
PROJECT ZEAL — COMPLETE REPOSITORY STRUCTURE & SOURCE DUMP
Generated automatically via Bash script.
================================================================================

--------------------------------------------------------------------------------
1. REPOSITORY FILE TREE
--------------------------------------------------------------------------------
EOF

# 2. Append directory tree structure (ignoring heavy caches and build folders)
if command -v tree &> /dev/null; then
    tree -I 'node_modules|.next|.git|dist|build|coverage' >> "$OUTPUT_FILE"
else
    # Fallback using find if 'tree' utility is not installed
    find . -maxdepth 4 \
        -not -path '*/.*' \
        -not -path './node_modules*' \
        -not -path '*/node_modules*' \
        -not -path './.next*' \
        -not -path '*/.next*' \
        -not -path './dist*' \
        -not -path './build*' >> "$OUTPUT_FILE"
fi

# 3. Append file contents section header
cat << 'EOF' >> "$OUTPUT_FILE"


--------------------------------------------------------------------------------
2. FULL SOURCE CODE FILES
--------------------------------------------------------------------------------
EOF

# 4. Find all relevant code files and append their paths and contents
find . -type f \
    -not -path '*/.*' \
    -not -path './node_modules*' \
    -not -path '*/node_modules*' \
    -not -path './.next*' \
    -not -path '*/.next*' \
    -not -path './package-lock.json' \
    -not -path './yarn.lock' \
    -not -path './pnpm-lock.yaml' \
    -not -path '*.log' \
    -not -path '*.ico' \
    -not -path '*.png' \
    -not -path '*.jpg' \
    -not -path '*.jpeg' \
    -not -path '*.svg' \
    -not -path '*.webp' \
    -not -path '*.exe' \
    -not -path "$OUTPUT_FILE" \
    | sort | while read -r file; do
    
    echo -e "\n================================================================================" >> "$OUTPUT_FILE"
    echo "FILE PATH: $file" >> "$OUTPUT_FILE"
    echo "================================================================================" >> "$OUTPUT_FILE"
    cat "$file" >> "$OUTPUT_FILE"
    echo -e "\n" >> "$OUTPUT_FILE"
done

echo -e "${SUCCESS} ====================================================================="
echo -e "${SUCCESS} REPO DUMP COMPLETE! Saved successfully to: ${OUTPUT_FILE}"
echo -e "${SUCCESS} ====================================================================="