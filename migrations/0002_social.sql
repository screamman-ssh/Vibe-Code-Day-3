-- 0002_social.sql
-- Global social: follows, posts (safe to re-run)

CREATE TABLE IF NOT EXISTS user_follows (
  follower_id  TEXT NOT NULL REFERENCES users(id),
  following_id TEXT NOT NULL REFERENCES users(id),
  created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE TABLE IF NOT EXISTS social_posts (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  post_type  TEXT NOT NULL DEFAULT 'text',
  content    TEXT,
  payload    TEXT NOT NULL DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_user_created ON social_posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_created ON social_posts(created_at DESC);
