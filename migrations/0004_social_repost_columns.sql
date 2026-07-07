-- 0004_social_repost_columns.sql
-- ONE-TIME migration: add repost columns to existing databases.
-- Safe to skip if you already see "duplicate column name: repost_of_id".
-- Do NOT include in the repeatable db:migrate:local chain.

ALTER TABLE social_posts ADD COLUMN repost_of_id TEXT REFERENCES social_posts(id);
ALTER TABLE social_posts ADD COLUMN quote_text TEXT;

CREATE INDEX IF NOT EXISTS idx_social_posts_repost_of ON social_posts(repost_of_id);
