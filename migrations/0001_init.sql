-- 0001_init.sql
-- MoneyCircle D1 SQL Schema Initialization

-- users
CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY,
  google_id           TEXT UNIQUE,
  display_name        TEXT NOT NULL,
  avatar_url          TEXT,
  bio                 TEXT,
  subscription_tier   TEXT NOT NULL DEFAULT 'free',
  emergency_fund_amount REAL DEFAULT 0.00,
  avg_monthly_expenses REAL DEFAULT 0.00,
  logging_streak_days INTEGER NOT NULL DEFAULT 0,
  last_log_date       TEXT,
  onboarding_complete INTEGER DEFAULT 0,
  created_at          TEXT DEFAULT CURRENT_TIMESTAMP
);

-- groups
CREATE TABLE IF NOT EXISTS groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  owner_id    TEXT NOT NULL REFERENCES users(id),
  max_members INTEGER NOT NULL DEFAULT 15,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

-- group_members
CREATE TABLE IF NOT EXISTS group_members (
  group_id  TEXT NOT NULL REFERENCES groups(id),
  user_id   TEXT NOT NULL REFERENCES users(id),
  hide_rank INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id),
  UNIQUE (user_id)
);

-- transactions
CREATE TABLE IF NOT EXISTS transactions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  type       TEXT CHECK (type IN ('income','expense')),
  amount     REAL NOT NULL,
  category   TEXT NOT NULL,
  merchant   TEXT,
  note       TEXT,
  date       TEXT NOT NULL,
  source     TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- budgets
CREATE TABLE IF NOT EXISTS budgets (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  category     TEXT NOT NULL,
  limit_amount REAL NOT NULL,
  year_month   TEXT NOT NULL, -- e.g., '2026-07'
  UNIQUE (user_id, category, year_month)
);

-- debts
CREATE TABLE IF NOT EXISTS debts (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  name            TEXT NOT NULL,
  balance         REAL NOT NULL,
  apr             REAL NOT NULL DEFAULT 0.0,
  minimum_payment REAL NOT NULL DEFAULT 0.0,
  due_day         INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  on_time_streak  INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

-- debt_payments
CREATE TABLE IF NOT EXISTS debt_payments (
  id         TEXT PRIMARY KEY,
  debt_id    TEXT NOT NULL REFERENCES debts(id),
  amount     REAL NOT NULL,
  paid_date  TEXT NOT NULL,
  on_time    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- score_snapshots
CREATE TABLE IF NOT EXISTS score_snapshots (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  total_score   INTEGER NOT NULL,
  tier          TEXT NOT NULL,
  tier_th       TEXT NOT NULL,
  details       TEXT NOT NULL, -- JSON text of subscores
  calculated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- badges
CREATE TABLE IF NOT EXISTS badges (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_url    TEXT
);

-- user_badges
CREATE TABLE IF NOT EXISTS user_badges (
  user_id    TEXT NOT NULL REFERENCES users(id),
  badge_code TEXT NOT NULL REFERENCES badges(code),
  earned_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, badge_code)
);

-- challenges
CREATE TABLE IF NOT EXISTS challenges (
  id           TEXT PRIMARY KEY,
  group_id     TEXT REFERENCES groups(id),
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  type         TEXT NOT NULL, -- e.g. 'logging', 'saving'
  target_value REAL NOT NULL,
  start_date   TEXT NOT NULL,
  end_date     TEXT NOT NULL
);

-- challenge_participations
CREATE TABLE IF NOT EXISTS challenge_participations (
  challenge_id TEXT NOT NULL REFERENCES challenges(id),
  user_id      TEXT NOT NULL REFERENCES users(id),
  progress     REAL NOT NULL DEFAULT 0.0,
  completed    INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  PRIMARY KEY (challenge_id, user_id)
);

-- feed_events
CREATE TABLE IF NOT EXISTS feed_events (
  id          TEXT PRIMARY KEY,
  group_id    TEXT NOT NULL REFERENCES groups(id),
  user_id     TEXT NOT NULL REFERENCES users(id),
  event_type  TEXT NOT NULL,
  payload     TEXT NOT NULL, -- JSON text
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

-- llm_usage_logs
CREATE TABLE IF NOT EXISTS llm_usage_logs (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  feature_type TEXT NOT NULL, -- 'ocr', 'coach', 'analyze'
  created_at   TEXT DEFAULT CURRENT_TIMESTAMP
);

-- refresh_tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  revoked    INTEGER NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_score_snapshots_user_calc ON score_snapshots(user_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_events_group_created ON feed_events(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_user_feature ON llm_usage_logs(user_id, feature_type, created_at);

-- Insert Default Badges
INSERT OR IGNORE INTO badges (code, name, description) VALUES 
('FIRST_LOG', 'First Log', 'เริ่มจดบันทึกครั้งแรกในระบบ'),
('WEEK_WARRIOR', 'Week Warrior', 'จดบันทึกติดต่อกัน 7 วัน'),
('BUDGET_BOSS', 'Budget Boss', 'ควบคุมงบประมาณได้อย่างมีประสิทธิภาพ'),
('EMERGENCY_READY', 'Emergency Ready', 'ออมเงินสำรองฉุกเฉินสำเร็จครบ 3 เท่าของรายจ่าย');
