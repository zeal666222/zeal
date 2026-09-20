// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/types/completeness — Client-safe consultant completeness types
// ═══════════════════════════════════════════════════════════════════════════════
// These types describe the consultant profile completeness report. They are
// imported by both server routes (which compute the report) and client
// components (which render it). Keeping them in @zeal/types (client-safe)
// avoids leaking the server-only @zeal/database/server module into bundles.
// ═══════════════════════════════════════════════════════════════════════════════

export interface CompletenessCheck {
  id: string;
  label: string;
  weight: number;
  passed: boolean;
  actionHref: string;
}

export interface CompletenessReport {
  score: number;
  isLive: boolean;
  checks: CompletenessCheck[];
}
