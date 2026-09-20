cd /d/zeal   # or wherever your repo lives

# See what's changed
git status

# Stage everything from Phase 1 + Phase 2
git add -A

# Commit with a clear message
git commit -m "feat(phase1+2): consultant visibility, categorization, presence, wizard

Phase 1:
- Unblock /api/consultant/online (allow incomplete profiles)
- Rewrite /api/explore/consultants with directory view + fallback
- Fix StudioClient CTA links to point at admin portal
- Middleware: prefetch-safe cross-domain redirects
- Add admin /terms + /privacy stubs
- Gate /debug behind admin role

Phase 2:
- Service + Category + ConsultantService catalog
- Materialized view mv_consultant_directory
- Full-text search via generated tsvector
- search_consultants() faceted RPC
- Refresh + cleanup RPCs (advisory-lock debounced)
- Presence heartbeat hook + Live badge
- Resumable onboarding draft API"

# Push
git push origin main