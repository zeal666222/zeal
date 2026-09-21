# ── 1. Imports are correctly separated ─────────────────────────────────────
echo "=== AdminSidebar.tsx (should have separate next/navigation + lucide imports) ==="
head -15 apps/admin/components/layout/AdminSidebar.tsx

echo
echo "=== theme-toggle.tsx (should have separate react + lucide imports) ==="
head -10 packages/ui/src/theme-toggle.tsx

# ── 2. No file should have lucide names in non-lucide imports ──────────────
echo
echo "=== Checking for stranded lucide icons ==="
grep -rEn 'from "(next/navigation|react|framer-motion)"' apps packages \
  --include="*.ts" --include="*.tsx" \
  | grep -iE '\b(Sparkles|BellDot|Megaphone|UserCog|IndianRupee|Flame|Monitor|Moon|Sun|Flag|Shield)\b' \
  && echo "❌ Found stranded icons — fix needed" \
  || echo "✓ No stranded icons"

# ── 3. Every file has at most one lucide-react import ──────────────────────
echo
echo "=== Files with multiple lucide-react imports (should be zero) ==="
while IFS= read -r f; do
  count=$(grep -cE 'from "lucide-react"' "$f" 2>/dev/null || echo 0)
  if [[ "$count" -gt 1 ]]; then
    echo "  ✗ $f ($count imports)"
  fi
done < <(find apps packages -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" -not -path "*/.next/*")
echo "  (scan complete)"