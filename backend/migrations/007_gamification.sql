CREATE TABLE badges (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_th TEXT NOT NULL,
  description TEXT NOT NULL,
  description_th TEXT NOT NULL
);

CREATE TABLE user_badges (
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_code TEXT NOT NULL REFERENCES badges(code) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, badge_code)
);

CREATE TABLE challenges (
  id VARCHAR(36) PRIMARY KEY,
  group_id VARCHAR(36) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_code TEXT NOT NULL, -- e.g., log_5_expenses, no_spend_weekend, on_time_debt
  start_date TEXT NOT NULL, -- YYYY-MM-DD
  end_date TEXT NOT NULL, -- YYYY-MM-DD
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE challenge_participations (
  challenge_id VARCHAR(36) NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'joined', -- joined, completed, failed
  progress_json TEXT NOT NULL DEFAULT '{}',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (challenge_id, user_id)
);

CREATE TABLE feed_events (
  id VARCHAR(36) PRIMARY KEY,
  group_id VARCHAR(36) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  event_type TEXT NOT NULL, -- score_changed, badge_earned, streak_milestone, challenge_completed, rank_changed
  payload_json TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_feed_events_group_time ON feed_events(group_id, created_at DESC);

CREATE TABLE feed_reactions (
  event_id VARCHAR(36) NOT NULL REFERENCES feed_events(id) ON DELETE CASCADE,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL, -- emoji string like "👍"
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, user_id, reaction)
);

-- Seed badges
INSERT INTO badges (code, name, name_th, description, description_th) VALUES
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
