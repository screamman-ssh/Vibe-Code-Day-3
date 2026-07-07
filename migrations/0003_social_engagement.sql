-- 0003_social_engagement.sql
-- X-style engagement: likes, threaded replies, reposts (safe to re-run)

CREATE TABLE IF NOT EXISTS post_likes (
  user_id TEXT NOT NULL REFERENCES users(id),
  post_id TEXT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS social_replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  parent_reply_id TEXT REFERENCES social_replies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reply_likes (
  user_id TEXT NOT NULL REFERENCES users(id),
  reply_id TEXT NOT NULL REFERENCES social_replies(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, reply_id)
);

CREATE INDEX IF NOT EXISTS idx_social_replies_post ON social_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_social_replies_parent ON social_replies(parent_reply_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_reply_likes_reply ON reply_likes(reply_id);

CREATE INDEX IF NOT EXISTS idx_social_posts_repost_of ON social_posts(repost_of_id);
