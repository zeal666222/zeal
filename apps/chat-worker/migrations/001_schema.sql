-- 001_schema.sql — D1 schema for zeal-chat worker
-- D1 uses SQLite: no BOOLEAN (use 0/1), no TEXT[] (store as JSON), no TIMESTAMPTZ (use TEXT ISO)

CREATE TABLE IF NOT EXISTS ai_consultant (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT,
  avatar TEXT,
  category TEXT NOT NULL,
  per_minute_rate REAL DEFAULT 0,
  is_paid INTEGER DEFAULT 0,
  rating REAL DEFAULT 5,
  sparks INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  specialties TEXT DEFAULT '[]',
  languages TEXT DEFAULT '[]',
  bio TEXT,
  total_consultations INTEGER DEFAULT 0,
  safety_level TEXT DEFAULT 'STANDARD',
  banned_patterns TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  location TEXT,
  country TEXT,
  experience INTEGER,
  model TEXT,
  response_time INTEGER,
  accuracy REAL,
  gender TEXT,
  persona TEXT,
  system_prompt TEXT,
  is_featured INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ai_consultant_active ON ai_consultant(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_consultant_category ON ai_consultant(category);

CREATE TABLE IF NOT EXISTS conversation (
  id TEXT PRIMARY KEY,
  created_at TEXT DEFAULT (datetime('now')),
  last_message_at TEXT DEFAULT (datetime('now')),
  last_message_text TEXT
);

CREATE TABLE IF NOT EXISTS conversation_participant (
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT DEFAULT (datetime('now')),
  role TEXT DEFAULT 'member',
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cp_user ON conversation_participant(user_id);

CREATE TABLE IF NOT EXISTS message (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_message_conv_created ON message(conversation_id, created_at DESC);
