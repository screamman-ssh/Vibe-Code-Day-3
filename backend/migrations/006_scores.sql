CREATE TABLE score_snapshots (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_score INT NOT NULL,
  tier TEXT NOT NULL,
  tier_th TEXT NOT NULL,
  dimensions_json TEXT NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_score_snapshots_user_calc ON score_snapshots(user_id, calculated_at DESC);
