CREATE TABLE budgets (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL, -- YYYY-MM
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, month)
);

CREATE TABLE budget_categories (
  id VARCHAR(36) PRIMARY KEY,
  budget_id VARCHAR(36) NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  limit_amount NUMERIC(14,2) NOT NULL,
  UNIQUE (budget_id, category)
);
