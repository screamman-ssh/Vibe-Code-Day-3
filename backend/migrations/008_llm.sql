CREATE TABLE llm_usage_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_type TEXT NOT NULL, -- ocr, coach, analyze
  tokens_estimated INT NOT NULL DEFAULT 0,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_llm_usage_user_time ON llm_usage_logs(user_id, created_at);
