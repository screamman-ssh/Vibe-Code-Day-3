-- 0006_chat_drafts.sql
-- Per-user chat composer draft + R2-backed image attachments

CREATE TABLE IF NOT EXISTS chat_drafts (
  user_id             TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  text                TEXT NOT NULL DEFAULT '',
  attachment_ids_json TEXT NOT NULL DEFAULT '[]',
  updated_at          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_attachments (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  r2_key      TEXT,
  mime_type   TEXT NOT NULL,
  file_name   TEXT,
  file_size   INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'ready', 'orphan')),
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_attachments_user ON chat_attachments(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_status ON chat_attachments(user_id, status);
