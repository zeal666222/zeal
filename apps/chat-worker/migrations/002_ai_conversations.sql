-- 002_ai_conversations.sql — the worker owns AI chat end to end
--
-- AI conversations, their transcripts and the seeker's intake answers live in
-- D1, keyed by the authenticated user id from the JWT. Nothing about an AI
-- turn reads or writes Supabase, so a Supabase outage can no longer take the
-- chat down (the production 500s on POST /api/chat/conversations).

-- 1. Conversation ownership. `conversation` existed with no owner column, so
--    an AI room could not be found again for the same (user, consultant) pair.
ALTER TABLE conversation ADD COLUMN user_id TEXT;
ALTER TABLE conversation ADD COLUMN ai_consultant_id TEXT;

-- One AI room per seeker per consultant, enforced by the database rather than
-- by a read-then-insert race in the request path.
CREATE UNIQUE INDEX IF NOT EXISTS conv_ai_unique
  ON conversation(user_id, ai_consultant_id)
  WHERE ai_consultant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS conv_ai_user ON conversation(user_id);

-- 2. The seeker profile: the intake form's answers, plus the ephemeris block
--    the web computed for them. `chart_key` is the (dob|tob|pob|lat|lng)
--    signature the summary was built from, so a change to any birth field makes
--    the stored summary provably stale instead of silently reused.
CREATE TABLE IF NOT EXISTS seeker_profile (
  user_id TEXT PRIMARY KEY,
  name TEXT,
  dob TEXT,
  tob TEXT,
  pob TEXT,
  latitude REAL,
  longitude REAL,
  gender TEXT,
  concern TEXT,
  chart_summary TEXT,
  chart_key TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Transcript reads are covered by idx_message_conv_created from 001_schema.sql,
-- so no new index on `message` is needed here.
