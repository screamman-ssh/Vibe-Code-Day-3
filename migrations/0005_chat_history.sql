-- 0005_chat_history.sql
-- Per-user AI coach chat history for cross-device sync

CREATE TABLE IF NOT EXISTS chat_sessions (
  user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  messages_json TEXT NOT NULL DEFAULT '[]',
  updated_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at DESC);
