# 1. Confirm repo files written
ls -la apps/web/lib/chat/fetch-conversations.ts
ls -la "apps/web/app/chat/[id]/page.tsx"
ls -la "apps/web/app/chat/[id]/error.tsx"
ls -la packages/ui/src/motion.tsx

# 2. Confirm motion.tsx uses domMax
grep "domMax" packages/ui/src/motion.tsx

# 3. Confirm fetch-conversations normalizes timestamps
grep "iso(" apps/web/lib/chat/fetch-conversations.ts

# 4. Confirm no direct partner User reads remain in chat pages
grep -n "from(\"User\")" "apps/web/app/chat/[id]/page.tsx" || echo "clean"

# 5. Type-check + build
npm run type-check --workspaces --if-present
npm run build