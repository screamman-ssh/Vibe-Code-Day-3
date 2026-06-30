CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  google_id TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  emergency_fund_amount NUMERIC(14,2) DEFAULT 0,
  avg_monthly_expenses NUMERIC(14,2) DEFAULT 0,
  logging_streak_days INT NOT NULL DEFAULT 0,
  last_log_date TEXT,
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE refresh_tokens (
  token TEXT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
