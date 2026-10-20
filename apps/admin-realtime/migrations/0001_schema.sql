-- zeal-admin-metrics: the Cloudflare realtime datastore backing the live
-- admin / super-admin dashboards. Supabase stays authoritative for business
-- truth; this DB holds the real-time event feed and per-minute timeseries so
-- dashboards repaint instantly after a reload or an isolate cold-start.

CREATE TABLE IF NOT EXISTS admin_events (
  id     TEXT PRIMARY KEY,
  kind   TEXT NOT NULL,
  label  TEXT NOT NULL,
  actor  TEXT,
  amount REAL,
  meta   TEXT,
  ts     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_events_ts   ON admin_events (ts DESC);
CREATE INDEX IF NOT EXISTS idx_admin_events_kind ON admin_events (kind);

CREATE TABLE IF NOT EXISTS metric_timeseries (
  bucket_ts   INTEGER PRIMARY KEY,
  bookings    INTEGER NOT NULL DEFAULT 0,
  payments    INTEGER NOT NULL DEFAULT 0,
  revenue     REAL    NOT NULL DEFAULT 0,
  withdrawals INTEGER NOT NULL DEFAULT 0,
  chats       INTEGER NOT NULL DEFAULT 0,
  operators   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_metric_timeseries_ts ON metric_timeseries (bucket_ts DESC);
