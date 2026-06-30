package repository

import (
	"database/sql"
	"encoding/json"
	"errors"
	"moneycircle/internal/domain"
	"time"
)

type Repository struct {
	db *sql.DB
}

func New(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) RawQueryRow(query string, args ...interface{}) *sql.Row {
	return r.db.QueryRow(query, args...)
}

func (r *Repository) RawExec(query string, args ...interface{}) (sql.Result, error) {
	return r.db.Exec(query, args...)
}

func (r *Repository) RawQuery(query string, args ...interface{}) (*sql.Rows, error) {
	return r.db.Query(query, args...)
}

// --- USER REPO ---

func (r *Repository) GetUserByID(id string) (*domain.User, error) {
	u := &domain.User{}
	var lastLog sql.NullString
	var avatar sql.NullString
	err := r.db.QueryRow(`
		SELECT id, google_id, display_name, avatar_url, subscription_tier, 
		       emergency_fund_amount, avg_monthly_expenses, logging_streak_days, 
		       last_log_date, onboarding_complete, created_at 
		FROM users WHERE id = $1`, id).
		Scan(&u.ID, &u.GoogleID, &u.DisplayName, &avatar, &u.SubscriptionTier,
			&u.EmergencyFundAmount, &u.AvgMonthlyExpenses, &u.LoggingStreakDays,
			&lastLog, &u.OnboardingComplete, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	u.AvatarURL = avatar.String
	u.LastLogDate = lastLog.String
	return u, nil
}

func (r *Repository) GetUserByGoogleID(googleID string) (*domain.User, error) {
	u := &domain.User{}
	var lastLog sql.NullString
	var avatar sql.NullString
	err := r.db.QueryRow(`
		SELECT id, google_id, display_name, avatar_url, subscription_tier, 
		       emergency_fund_amount, avg_monthly_expenses, logging_streak_days, 
		       last_log_date, onboarding_complete, created_at 
		FROM users WHERE google_id = $1`, googleID).
		Scan(&u.ID, &u.GoogleID, &u.DisplayName, &avatar, &u.SubscriptionTier,
			&u.EmergencyFundAmount, &u.AvgMonthlyExpenses, &u.LoggingStreakDays,
			&lastLog, &u.OnboardingComplete, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	u.AvatarURL = avatar.String
	u.LastLogDate = lastLog.String
	return u, nil
}

func (r *Repository) CreateUser(u *domain.User) error {
	_, err := r.db.Exec(`
		INSERT INTO users (id, google_id, display_name, avatar_url, subscription_tier, 
		                   emergency_fund_amount, avg_monthly_expenses, logging_streak_days, 
		                   last_log_date, onboarding_complete, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		u.ID, u.GoogleID, u.DisplayName, u.AvatarURL, u.SubscriptionTier,
		u.EmergencyFundAmount, u.AvgMonthlyExpenses, u.LoggingStreakDays,
		sql.NullString{String: u.LastLogDate, Valid: u.LastLogDate != ""},
		u.OnboardingComplete, u.CreatedAt)
	return err
}

func (r *Repository) UpdateUser(u *domain.User) error {
	_, err := r.db.Exec(`
		UPDATE users 
		SET display_name = $1, avatar_url = $2, subscription_tier = $3, 
		    emergency_fund_amount = $4, avg_monthly_expenses = $5, 
		    logging_streak_days = $6, last_log_date = $7, onboarding_complete = $8
		WHERE id = $9`,
		u.DisplayName, u.AvatarURL, u.SubscriptionTier,
		u.EmergencyFundAmount, u.AvgMonthlyExpenses,
		u.LoggingStreakDays, sql.NullString{String: u.LastLogDate, Valid: u.LastLogDate != ""},
		u.OnboardingComplete, u.ID)
	return err
}

func (r *Repository) SaveRefreshToken(token *domain.RefreshToken) error {
	// First delete existing refresh tokens for the user
	_, _ = r.db.Exec(`DELETE FROM refresh_tokens WHERE user_id = $1`, token.UserID)

	_, err := r.db.Exec(`
		INSERT INTO refresh_tokens (token, user_id, expires_at, created_at)
		VALUES ($1, $2, $3, $4)`,
		token.Token, token.UserID, token.ExpiresAt, token.CreatedAt)
	return err
}

func (r *Repository) GetRefreshToken(tokenStr string) (*domain.RefreshToken, error) {
	t := &domain.RefreshToken{}
	err := r.db.QueryRow(`
		SELECT token, user_id, expires_at, created_at 
		FROM refresh_tokens WHERE token = $1`, tokenStr).
		Scan(&t.Token, &t.UserID, &t.ExpiresAt, &t.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *Repository) DeleteRefreshToken(tokenStr string) error {
	_, err := r.db.Exec(`DELETE FROM refresh_tokens WHERE token = $1`, tokenStr)
	return err
}

// --- GROUP REPO ---

func (r *Repository) GetGroupByID(id string) (*domain.Group, error) {
	g := &domain.Group{}
	err := r.db.QueryRow(`
		SELECT id, name, invite_code, owner_id, max_members, created_at 
		FROM groups WHERE id = $1`, id).
		Scan(&g.ID, &g.Name, &g.InviteCode, &g.OwnerID, &g.MaxMembers, &g.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return g, nil
}

func (r *Repository) GetGroupByInviteCode(code string) (*domain.Group, error) {
	g := &domain.Group{}
	err := r.db.QueryRow(`
		SELECT id, name, invite_code, owner_id, max_members, created_at 
		FROM groups WHERE invite_code = $1`, code).
		Scan(&g.ID, &g.Name, &g.InviteCode, &g.OwnerID, &g.MaxMembers, &g.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return g, nil
}

func (r *Repository) GetGroupByUserID(userID string) (*domain.Group, error) {
	g := &domain.Group{}
	err := r.db.QueryRow(`
		SELECT g.id, g.name, g.invite_code, g.owner_id, g.max_members, g.created_at 
		FROM groups g
		JOIN group_members gm ON gm.group_id = g.id
		WHERE gm.user_id = $1`, userID).
		Scan(&g.ID, &g.Name, &g.InviteCode, &g.OwnerID, &g.MaxMembers, &g.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return g, nil
}

func (r *Repository) CreateGroup(g *domain.Group) error {
	return WithTx(r.db, func(tx *sql.Tx) error {
		_, err := tx.Exec(`
			INSERT INTO groups (id, name, invite_code, owner_id, max_members, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)`,
			g.ID, g.Name, g.InviteCode, g.OwnerID, g.MaxMembers, g.CreatedAt)
		if err != nil {
			return err
		}

		_, err = tx.Exec(`
			INSERT INTO group_members (group_id, user_id, hide_rank, joined_at)
			VALUES ($1, $2, $3, $4)`,
			g.ID, g.OwnerID, false, g.CreatedAt)
		return err
	})
}

func (r *Repository) GetGroupMembersCount(groupID string) (int, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM group_members WHERE group_id = $1`, groupID).Scan(&count)
	return count, err
}

func (r *Repository) AddGroupMember(groupID, userID string) error {
	_, err := r.db.Exec(`
		INSERT INTO group_members (group_id, user_id, hide_rank, joined_at)
		VALUES ($1, $2, $3, $4)`,
		groupID, userID, false, time.Now())
	return err
}

func (r *Repository) RemoveGroupMember(groupID, userID string) error {
	_, err := r.db.Exec(`DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`, groupID, userID)
	return err
}

func (r *Repository) UpdateMemberHideRank(groupID, userID string, hideRank bool) error {
	_, err := r.db.Exec(`
		UPDATE group_members 
		SET hide_rank = $1 
		WHERE group_id = $2 AND user_id = $3`,
		hideRank, groupID, userID)
	return err
}

func (r *Repository) UpdateGroupInviteCode(groupID, code string) error {
	_, err := r.db.Exec(`UPDATE groups SET invite_code = $1 WHERE id = $2`, code, groupID)
	return err
}

func (r *Repository) GetGroupMembers(groupID string) ([]*domain.User, []*domain.GroupMember, error) {
	rows, err := r.db.Query(`
		SELECT u.id, u.google_id, u.display_name, u.avatar_url, u.subscription_tier, 
		       u.emergency_fund_amount, u.avg_monthly_expenses, u.logging_streak_days, 
		       u.last_log_date, u.onboarding_complete, u.created_at,
		       gm.group_id, gm.user_id, gm.hide_rank, gm.joined_at
		FROM group_members gm
		JOIN users u ON u.id = gm.user_id
		WHERE gm.group_id = $1`, groupID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var users []*domain.User
	var members []*domain.GroupMember

	for rows.Next() {
		u := &domain.User{}
		gm := &domain.GroupMember{}
		var avatar sql.NullString
		var lastLog sql.NullString

		err := rows.Scan(
			&u.ID, &u.GoogleID, &u.DisplayName, &avatar, &u.SubscriptionTier,
			&u.EmergencyFundAmount, &u.AvgMonthlyExpenses, &u.LoggingStreakDays,
			&lastLog, &u.OnboardingComplete, &u.CreatedAt,
			&gm.GroupID, &gm.UserID, &gm.HideRank, &gm.JoinedAt,
		)
		if err != nil {
			return nil, nil, err
		}
		u.AvatarURL = avatar.String
		u.LastLogDate = lastLog.String

		users = append(users, u)
		members = append(members, gm)
	}

	return users, members, nil
}

func (r *Repository) IsGroupMember(groupID, userID string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2)`,
		groupID, userID).Scan(&exists)
	return exists, err
}

// --- TRANSACTION REPO ---

func (r *Repository) GetTransactionByID(id string) (*domain.Transaction, error) {
	tx := &domain.Transaction{}
	var merchant, note sql.NullString
	err := r.db.QueryRow(`
		SELECT id, user_id, type, amount, category, merchant, note, date, source, created_at 
		FROM transactions WHERE id = $1`, id).
		Scan(&tx.ID, &tx.UserID, &tx.Type, &tx.Amount, &tx.Category, &merchant, &note, &tx.Date, &tx.Source, &tx.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	tx.Merchant = merchant.String
	tx.Note = note.String
	return tx, nil
}

func (r *Repository) GetTransactionsByUserID(userID string, category *string, startDate, endDate *string) ([]*domain.Transaction, error) {
	query := `
		SELECT id, user_id, type, amount, category, merchant, note, date, source, created_at 
		FROM transactions 
		WHERE user_id = $1`
	args := []interface{}{userID}

	placeholderIndex := 2
	if category != nil {
		query += ` AND category = $` + jsonNumber(placeholderIndex)
		args = append(args, *category)
		placeholderIndex++
	}
	if startDate != nil {
		query += ` AND date >= $` + jsonNumber(placeholderIndex)
		args = append(args, *startDate)
		placeholderIndex++
	}
	if endDate != nil {
		query += ` AND date <= $` + jsonNumber(placeholderIndex)
		args = append(args, *endDate)
		placeholderIndex++
	}

	query += ` ORDER BY date DESC, created_at DESC`

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.Transaction
	for rows.Next() {
		tx := &domain.Transaction{}
		var merchant, note sql.NullString
		err := rows.Scan(&tx.ID, &tx.UserID, &tx.Type, &tx.Amount, &tx.Category, &merchant, &note, &tx.Date, &tx.Source, &tx.CreatedAt)
		if err != nil {
			return nil, err
		}
		tx.Merchant = merchant.String
		tx.Note = note.String
		list = append(list, tx)
	}
	return list, nil
}

func (r *Repository) CreateTransaction(tx *domain.Transaction) error {
	_, err := r.db.Exec(`
		INSERT INTO transactions (id, user_id, type, amount, category, merchant, note, date, source, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		tx.ID, tx.UserID, tx.Type, tx.Amount, tx.Category,
		sql.NullString{String: tx.Merchant, Valid: tx.Merchant != ""},
		sql.NullString{String: tx.Note, Valid: tx.Note != ""},
		tx.Date, tx.Source, tx.CreatedAt)
	return err
}

func (r *Repository) UpdateTransaction(tx *domain.Transaction) error {
	_, err := r.db.Exec(`
		UPDATE transactions 
		SET type = $1, amount = $2, category = $3, merchant = $4, note = $5, date = $6, source = $7
		WHERE id = $8 AND user_id = $9`,
		tx.Type, tx.Amount, tx.Category,
		sql.NullString{String: tx.Merchant, Valid: tx.Merchant != ""},
		sql.NullString{String: tx.Note, Valid: tx.Note != ""},
		tx.Date, tx.Source, tx.ID, tx.UserID)
	return err
}

func (r *Repository) DeleteTransaction(id, userID string) error {
	_, err := r.db.Exec(`DELETE FROM transactions WHERE id = $1 AND user_id = $2`, id, userID)
	return err
}

// --- BUDGET REPO ---

func (r *Repository) GetBudgetByUserIDAndMonth(userID, month string) (*domain.Budget, error) {
	b := &domain.Budget{}
	err := r.db.QueryRow(`
		SELECT id, user_id, month, created_at 
		FROM budgets WHERE user_id = $1 AND month = $2`, userID, month).
		Scan(&b.ID, &b.UserID, &b.Month, &b.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return b, nil
}

func (r *Repository) CreateBudget(b *domain.Budget) error {
	_, err := r.db.Exec(`
		INSERT INTO budgets (id, user_id, month, created_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT(user_id, month) DO UPDATE SET month=excluded.month`,
		b.ID, b.UserID, b.Month, b.CreatedAt)
	return err
}

func (r *Repository) GetBudgetCategories(budgetID string) ([]*domain.BudgetCategory, error) {
	rows, err := r.db.Query(`
		SELECT id, budget_id, category, limit_amount 
		FROM budget_categories WHERE budget_id = $1`, budgetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.BudgetCategory
	for rows.Next() {
		c := &domain.BudgetCategory{}
		err := rows.Scan(&c.ID, &c.BudgetID, &c.Category, &c.LimitAmount)
		if err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, nil
}

func (r *Repository) ClearBudgetCategories(budgetID string) error {
	_, err := r.db.Exec(`DELETE FROM budget_categories WHERE budget_id = $1`, budgetID)
	return err
}

func (r *Repository) AddBudgetCategory(bc *domain.BudgetCategory) error {
	_, err := r.db.Exec(`
		INSERT INTO budget_categories (id, budget_id, category, limit_amount)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT(budget_id, category) DO UPDATE SET limit_amount = excluded.limit_amount`,
		bc.ID, bc.BudgetID, bc.Category, bc.LimitAmount)
	return err
}

func (r *Repository) UpdateBudgetCategories(budgetID string, categories []*domain.BudgetCategory) error {
	return WithTx(r.db, func(tx *sql.Tx) error {
		_, err := tx.Exec(`DELETE FROM budget_categories WHERE budget_id = $1`, budgetID)
		if err != nil {
			return err
		}

		for _, bc := range categories {
			_, err = tx.Exec(`
				INSERT INTO budget_categories (id, budget_id, category, limit_amount)
				VALUES ($1, $2, $3, $4)`,
				bc.ID, bc.BudgetID, bc.Category, bc.LimitAmount)
			if err != nil {
				return err
			}
		}
		return nil
	})
}

// --- DEBT REPO ---

func (r *Repository) GetDebtByID(id string) (*domain.Debt, error) {
	d := &domain.Debt{}
	err := r.db.QueryRow(`
		SELECT id, user_id, name, balance, apr, minimum_payment, due_day, created_at 
		FROM debts WHERE id = $1`, id).
		Scan(&d.ID, &d.UserID, &d.Name, &d.Balance, &d.APR, &d.MinimumPayment, &d.DueDay, &d.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return d, nil
}

func (r *Repository) GetDebtsByUserID(userID string) ([]*domain.Debt, error) {
	rows, err := r.db.Query(`
		SELECT id, user_id, name, balance, apr, minimum_payment, due_day, created_at 
		FROM debts WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.Debt
	for rows.Next() {
		d := &domain.Debt{}
		err := rows.Scan(&d.ID, &d.UserID, &d.Name, &d.Balance, &d.APR, &d.MinimumPayment, &d.DueDay, &d.CreatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, d)
	}
	return list, nil
}

func (r *Repository) CreateDebt(d *domain.Debt) error {
	_, err := r.db.Exec(`
		INSERT INTO debts (id, user_id, name, balance, apr, minimum_payment, due_day, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		d.ID, d.UserID, d.Name, d.Balance, d.APR, d.MinimumPayment, d.DueDay, d.CreatedAt)
	return err
}

func (r *Repository) UpdateDebt(d *domain.Debt) error {
	_, err := r.db.Exec(`
		UPDATE debts 
		SET name = $1, balance = $2, apr = $3, minimum_payment = $4, due_day = $5
		WHERE id = $6 AND user_id = $7`,
		d.Name, d.Balance, d.APR, d.MinimumPayment, d.DueDay, d.ID, d.UserID)
	return err
}

func (r *Repository) DeleteDebt(id, userID string) error {
	_, err := r.db.Exec(`DELETE FROM debts WHERE id = $1 AND user_id = $2`, id, userID)
	return err
}

func (r *Repository) AddDebtPayment(dp *domain.DebtPayment) error {
	return WithTx(r.db, func(tx *sql.Tx) error {
		_, err := tx.Exec(`
			INSERT INTO debt_payments (id, debt_id, amount, paid_at, on_time, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)`,
			dp.ID, dp.DebtID, dp.Amount, dp.PaidAt, dp.OnTime, dp.CreatedAt)
		if err != nil {
			return err
		}

		// Reduce debt balance
		_, err = tx.Exec(`
			UPDATE debts 
			SET balance = balance - $1 
			WHERE id = $2`,
			dp.Amount, dp.DebtID)
		return err
	})
}

func (r *Repository) GetDebtPayments(debtID string) ([]*domain.DebtPayment, error) {
	rows, err := r.db.Query(`
		SELECT id, debt_id, amount, paid_at, on_time, created_at 
		FROM debt_payments WHERE debt_id = $1 ORDER BY paid_at DESC`, debtID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.DebtPayment
	for rows.Next() {
		dp := &domain.DebtPayment{}
		err := rows.Scan(&dp.ID, &dp.DebtID, &dp.Amount, &dp.PaidAt, &dp.OnTime, &dp.CreatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, dp)
	}
	return list, nil
}

// --- SCORE SNAPSHOT REPO ---

func (r *Repository) GetLatestScoreSnapshot(userID string) (*domain.ScoreSnapshot, error) {
	ss := &domain.ScoreSnapshot{}
	err := r.db.QueryRow(`
		SELECT id, user_id, total_score, tier, tier_th, dimensions_json, calculated_at 
		FROM score_snapshots 
		WHERE user_id = $1 
		ORDER BY calculated_at DESC LIMIT 1`, userID).
		Scan(&ss.ID, &ss.UserID, &ss.TotalScore, &ss.Tier, &ss.TierTh, &ss.DimensionsJSON, &ss.CalculatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return ss, nil
}

func (r *Repository) SaveScoreSnapshot(ss *domain.ScoreSnapshot) error {
	_, err := r.db.Exec(`
		INSERT INTO score_snapshots (id, user_id, total_score, tier, tier_th, dimensions_json, calculated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		ss.ID, ss.UserID, ss.TotalScore, ss.Tier, ss.TierTh, ss.DimensionsJSON, ss.CalculatedAt)
	return err
}

// --- GAMIFICATION REPO ---

func (r *Repository) GetBadges() ([]*domain.Badge, error) {
	rows, err := r.db.Query(`SELECT code, name, name_th, description, description_th FROM badges`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.Badge
	for rows.Next() {
		b := &domain.Badge{}
		err := rows.Scan(&b.Code, &b.Name, &b.NameTh, &b.Description, &b.DescriptionTh)
		if err != nil {
			return nil, err
		}
		list = append(list, b)
	}
	return list, nil
}

func (r *Repository) GetUserBadges(userID string) ([]string, error) {
	rows, err := r.db.Query(`SELECT badge_code FROM user_badges WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []string
	for rows.Next() {
		var code string
		err := rows.Scan(&code)
		if err != nil {
			return nil, err
		}
		list = append(list, code)
	}
	return list, nil
}

func (r *Repository) AwardBadge(userID, badgeCode string) error {
	_, err := r.db.Exec(`
		INSERT INTO user_badges (user_id, badge_code, earned_at)
		VALUES ($1, $2, $3)
		ON CONFLICT(user_id, badge_code) DO NOTHING`,
		userID, badgeCode, time.Now())
	return err
}

func (r *Repository) CreateChallenge(c *domain.Challenge) error {
	_, err := r.db.Exec(`
		INSERT INTO challenges (id, group_id, name, template_code, start_date, end_date, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		c.ID, c.GroupID, c.Name, c.TemplateCode, c.StartDate, c.EndDate, c.CreatedAt)
	return err
}

func (r *Repository) GetChallengeByID(id string) (*domain.Challenge, error) {
	c := &domain.Challenge{}
	err := r.db.QueryRow(`
		SELECT id, group_id, name, template_code, start_date, end_date, created_at 
		FROM challenges WHERE id = $1`, id).
		Scan(&c.ID, &c.GroupID, &c.Name, &c.TemplateCode, &c.StartDate, &c.EndDate, &c.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (r *Repository) GetActiveChallenges(groupID string) ([]*domain.Challenge, error) {
	rows, err := r.db.Query(`
		SELECT id, group_id, name, template_code, start_date, end_date, created_at 
		FROM challenges 
		WHERE group_id = $1 AND end_date >= $2`, groupID, time.Now().Format("2006-01-02"))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.Challenge
	for rows.Next() {
		c := &domain.Challenge{}
		err := rows.Scan(&c.ID, &c.GroupID, &c.Name, &c.TemplateCode, &c.StartDate, &c.EndDate, &c.CreatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, nil
}

func (r *Repository) JoinChallenge(challengeID, userID string) error {
	_, err := r.db.Exec(`
		INSERT INTO challenge_participations (challenge_id, user_id, status, progress_json, joined_at)
		VALUES ($1, $2, 'joined', '{}', $3)
		ON CONFLICT(challenge_id, user_id) DO NOTHING`,
		challengeID, userID, time.Now())
	return err
}

func (r *Repository) GetChallengeParticipations(challengeID string) ([]*domain.ChallengeParticipation, error) {
	rows, err := r.db.Query(`
		SELECT challenge_id, user_id, status, progress_json, joined_at 
		FROM challenge_participations WHERE challenge_id = $1`, challengeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.ChallengeParticipation
	for rows.Next() {
		cp := &domain.ChallengeParticipation{}
		err := rows.Scan(&cp.ChallengeID, &cp.UserID, &cp.Status, &cp.ProgressJSON, &cp.JoinedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, cp)
	}
	return list, nil
}

func (r *Repository) UpdateChallengeParticipation(challengeID, userID, status, progressJSON string) error {
	_, err := r.db.Exec(`
		UPDATE challenge_participations 
		SET status = $1, progress_json = $2 
		WHERE challenge_id = $3 AND user_id = $4`,
		status, progressJSON, challengeID, userID)
	return err
}

func (r *Repository) GetFeed(groupID string, limit int) ([]*domain.FeedEvent, error) {
	rows, err := r.db.Query(`
		SELECT id, group_id, user_id, display_name, event_type, payload_json, created_at 
		FROM feed_events 
		WHERE group_id = $1 
		ORDER BY created_at DESC LIMIT $2`, groupID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.FeedEvent
	for rows.Next() {
		fe := &domain.FeedEvent{}
		err := rows.Scan(&fe.ID, &fe.GroupID, &fe.UserID, &fe.DisplayName, &fe.EventType, &fe.PayloadJSON, &fe.CreatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, fe)
	}
	return list, nil
}

func (r *Repository) CreateFeedEvent(fe *domain.FeedEvent) error {
	_, err := r.db.Exec(`
		INSERT INTO feed_events (id, group_id, user_id, display_name, event_type, payload_json, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		fe.ID, fe.GroupID, fe.UserID, fe.DisplayName, fe.EventType, fe.PayloadJSON, fe.CreatedAt)
	return err
}

func (r *Repository) AddFeedReaction(eventID, userID, reaction string) error {
	_, err := r.db.Exec(`
		INSERT INTO feed_reactions (event_id, user_id, reaction, created_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT(event_id, user_id, reaction) DO NOTHING`,
		eventID, userID, reaction, time.Now())
	return err
}

func (r *Repository) GetFeedReactionsForEvent(eventID string) ([]*domain.FeedReaction, error) {
	rows, err := r.db.Query(`
		SELECT event_id, user_id, reaction, created_at 
		FROM feed_reactions WHERE event_id = $1`, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.FeedReaction
	for rows.Next() {
		fr := &domain.FeedReaction{}
		err := rows.Scan(&fr.EventID, &fr.UserID, &fr.Reaction, &fr.CreatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, fr)
	}
	return list, nil
}

func (r *Repository) GetFeedReactionsForGroup(groupID string) (map[string][]*domain.FeedReaction, error) {
	rows, err := r.db.Query(`
		SELECT fr.event_id, fr.user_id, fr.reaction, fr.created_at 
		FROM feed_reactions fr
		JOIN feed_events fe ON fe.id = fr.event_id
		WHERE fe.group_id = $1`, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make(map[string][]*domain.FeedReaction)
	for rows.Next() {
		fr := &domain.FeedReaction{}
		err := rows.Scan(&fr.EventID, &fr.UserID, &fr.Reaction, &fr.CreatedAt)
		if err != nil {
			return nil, err
		}
		res[fr.EventID] = append(res[fr.EventID], fr)
	}
	return res, nil
}

// --- LLM USAGE REPO ---

func (r *Repository) CountDailyOCR(userID string, startUTC time.Time) (int, error) {
	var count int
	err := r.db.QueryRow(`
		SELECT COUNT(*) FROM llm_usage_logs 
		WHERE user_id = $1 AND feature_type = 'ocr' AND created_at >= $2`,
		userID, startUTC).Scan(&count)
	return count, err
}

func (r *Repository) LogLLMUsage(log *domain.LLMUsageLog) error {
	_, err := r.db.Exec(`
		INSERT INTO llm_usage_logs (id, user_id, feature_type, tokens_estimated, request_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		log.ID, log.UserID, log.FeatureType, log.TokensEstimated,
		sql.NullString{String: log.RequestID, Valid: log.RequestID != ""}, log.CreatedAt)
	return err
}

// --- UTILITY ---
func jsonNumber(i int) string {
	var val [16]byte
	pos := len(val)
	for i > 0 {
		pos--
		val[pos] = byte('0' + i%10)
		i /= 10
	}
	return string(val[pos:])
}

// Helper checking for error types
func IsNoRowsError(err error) bool {
	return errors.Is(err, sql.ErrNoRows)
}
