-- MoneyCircle D1 (SQLite) schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_id TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  emergency_fund_amount REAL DEFAULT 0,
  avg_monthly_expenses REAL DEFAULT 0,
  logging_streak_days INTEGER NOT NULL DEFAULT 0,
  last_log_date TEXT,
  onboarding_complete INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  max_members INTEGER NOT NULL DEFAULT 15,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hide_rank INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (group_id, user_id),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  merchant TEXT,
  note TEXT,
  date TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, month)
);

CREATE TABLE IF NOT EXISTS budget_categories (
  id TEXT PRIMARY KEY,
  budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  limit_amount REAL NOT NULL,
  UNIQUE (budget_id, category)
);

CREATE TABLE IF NOT EXISTS debts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  balance REAL NOT NULL,
  apr REAL NOT NULL,
  minimum_payment REAL NOT NULL,
  due_day INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS debt_payments (
  id TEXT PRIMARY KEY,
  debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  paid_at TEXT NOT NULL,
  on_time INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS score_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_score INTEGER NOT NULL,
  tier TEXT NOT NULL,
  tier_th TEXT NOT NULL,
  dimensions_json TEXT NOT NULL,
  calculated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_score_snapshots_user_calc ON score_snapshots(user_id, calculated_at DESC);

CREATE TABLE IF NOT EXISTS badges (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_th TEXT NOT NULL,
  description TEXT NOT NULL,
  description_th TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_code TEXT NOT NULL REFERENCES badges(code) ON DELETE CASCADE,
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, badge_code)
);

CREATE TABLE IF NOT EXISTS feed_events (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feed_events_group_time ON feed_events(group_id, created_at DESC);

CREATE TABLE IF NOT EXISTS feed_reactions (
  event_id TEXT NOT NULL REFERENCES feed_events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (event_id, user_id, reaction)
);

CREATE TABLE IF NOT EXISTS llm_usage_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_type TEXT NOT NULL,
  tokens_estimated INTEGER NOT NULL DEFAULT 0,
  request_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_user_time ON llm_usage_logs(user_id, created_at);

INSERT OR IGNORE INTO badges (code, name, name_th, description, description_th) VALUES
('First Log', 'First Log', 'บันทึกแรก', 'Log your first transaction', 'บันทึกรายการแรกสำเร็จ'),
('Week Warrior', 'Week Warrior', 'นักรบรายสัปดาห์', 'Maintain a 7-day logging streak', 'บันทึกรายรับ-รายจ่ายติดต่อกัน 7 วัน'),
('Month Master', 'Month Master', 'ผู้เชี่ยวชาญรายเดือน', 'Maintain a 30-day logging streak', 'บันทึกรายรับ-รายจ่ายติดต่อกัน 30 วัน'),
('Budget Boss', 'Budget Boss', 'เจ้าพ่อแห่งงบประมาณ', '100% budget adherence for a full month', 'คุมรายจ่ายอยู่ตามงบประมาณได้ครบถ้วนเป็นเวลา 1 เดือน'),
('Debt Destroyer', 'Debt Destroyer', 'ผู้ทำลายหนี้', '3 consecutive on-time debt payments', 'จ่ายหนี้ตรงเวลาติดต่อกัน 3 ครั้ง'),
('Saver Start', 'Saver Start', 'ผู้เริ่มต้นออม', 'Savings rate >= 10% for a month', 'มีอัตราการออมเงินตั้งแต่ 10% ขึ้นไปในหนึ่งเดือน'),
('Emergency Ready', 'Emergency Ready', 'เตรียมพร้อมยามฉุกเฉิน', 'Emergency fund tier >= 1 month expenses', 'มีเงินสำรองฉุกเฉินครอบคลุมค่าใช้จ่ายอย่างน้อย 1 เดือน'),
('Challenge Champ', 'Challenge Champ', 'ผู้ชนะการท้าทาย', 'Complete 3 group challenges', 'ทำภารกิจกลุ่มท้าทายสำเร็จ 3 ครั้ง'),
('Comeback Kid', 'Comeback Kid', 'เด็กฟื้นตัวเก่ง', 'Improve score by 10+ points in 30 days', 'พัฒนาคะแนนสุขภาพทางการเงินขึ้น 10+ คะแนนภายใน 30 วัน'),
('Circle MVP', 'Circle MVP', 'สุดยอดสมาชิกกลุ่ม', 'Top leaderboard rank at week end', 'คะแนนสูงสุดเป็นอันดับที่หนึ่งของกลุ่ม ณ สิ้นสัปดาห์');
