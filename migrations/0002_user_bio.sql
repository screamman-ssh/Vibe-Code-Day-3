-- 0002_user_bio.sql
-- ONE-TIME migration: add bio column to existing databases created before social feature.
-- Safe to skip if you already see "duplicate column name: bio".
-- Do NOT include in the repeatable db:migrate:local chain.

ALTER TABLE users ADD COLUMN bio TEXT;
