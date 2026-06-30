package domain

import "time"

type User struct {
	ID                  string    `db:"id"`
	GoogleID            string    `db:"google_id"`
	DisplayName         string    `db:"display_name"`
	AvatarURL           string    `db:"avatar_url"`
	SubscriptionTier    string    `db:"subscription_tier"`
	EmergencyFundAmount float64   `db:"emergency_fund_amount"`
	AvgMonthlyExpenses  float64   `db:"avg_monthly_expenses"`
	LoggingStreakDays   int       `db:"logging_streak_days"`
	LastLogDate         string    `db:"last_log_date"`
	OnboardingComplete  bool      `db:"onboarding_complete"`
	CreatedAt           time.Time `db:"created_at"`
}

type RefreshToken struct {
	Token     string    `db:"token"`
	UserID    string    `db:"user_id"`
	ExpiresAt time.Time `db:"expires_at"`
	CreatedAt time.Time `db:"created_at"`
}

type Group struct {
	ID         string    `db:"id"`
	Name       string    `db:"name"`
	InviteCode string    `db:"invite_code"`
	OwnerID    string    `db:"owner_id"`
	MaxMembers int       `db:"max_members"`
	CreatedAt  time.Time `db:"created_at"`
}

type GroupMember struct {
	GroupID  string    `db:"group_id"`
	UserID   string    `db:"user_id"`
	HideRank bool      `db:"hide_rank"`
	JoinedAt time.Time `db:"joined_at"`
}

type Transaction struct {
	ID        string    `db:"id"`
	UserID    string    `db:"user_id"`
	Type      string    `db:"type"` // income, expense
	Amount    float64   `db:"amount"`
	Category  string    `db:"category"`
	Merchant  string    `db:"merchant"`
	Note      string    `db:"note"`
	Date      string    `db:"date"` // YYYY-MM-DD
	Source    string    `db:"source"` // manual, ocr
	CreatedAt time.Time `db:"created_at"`
}

type Budget struct {
	ID        string    `db:"id"`
	UserID    string    `db:"user_id"`
	Month     string    `db:"month"` // YYYY-MM
	CreatedAt time.Time `db:"created_at"`
}

type BudgetCategory struct {
	ID          string  `db:"id"`
	BudgetID    string  `db:"budget_id"`
	Category    string  `db:"category"`
	LimitAmount float64 `db:"limit_amount"`
}

type Debt struct {
	ID             string    `db:"id"`
	UserID         string    `db:"user_id"`
	Name           string    `db:"name"`
	Balance        float64   `db:"balance"`
	APR            float64   `db:"apr"`
	MinimumPayment float64   `db:"minimum_payment"`
	DueDay         int       `db:"due_day"`
	CreatedAt      time.Time `db:"created_at"`
}

type DebtPayment struct {
	ID        string    `db:"id"`
	DebtID    string    `db:"debt_id"`
	Amount    float64   `db:"amount"`
	PaidAt    time.Time `db:"paid_at"`
	OnTime    bool      `db:"on_time"`
	CreatedAt time.Time `db:"created_at"`
}

type ScoreSnapshot struct {
	ID             string    `db:"id"`
	UserID         string    `db:"user_id"`
	TotalScore     int       `db:"total_score"`
	Tier           string    `db:"tier"`
	TierTh         string    `db:"tier_th"`
	DimensionsJSON string    `db:"dimensions_json"`
	CalculatedAt   time.Time `db:"calculated_at"`
}

type Badge struct {
	Code          string `db:"code"`
	Name          string `db:"name"`
	NameTh        string `db:"name_th"`
	Description   string `db:"description"`
	DescriptionTh string `db:"description_th"`
}

type UserBadge struct {
	UserID    string    `db:"user_id"`
	BadgeCode string    `db:"badge_code"`
	EarnedAt  time.Time `db:"earned_at"`
}

type Challenge struct {
	ID           string    `db:"id"`
	GroupID      string    `db:"group_id"`
	Name         string    `db:"name"`
	TemplateCode string    `db:"template_code"`
	StartDate    string    `db:"start_date"` // YYYY-MM-DD
	EndDate      string    `db:"end_date"`   // YYYY-MM-DD
	CreatedAt    time.Time `db:"created_at"`
}

type ChallengeParticipation struct {
	ChallengeID  string    `db:"challenge_id"`
	UserID       string    `db:"user_id"`
	Status       string    `db:"status"` // joined, completed, failed
	ProgressJSON string    `db:"progress_json"`
	JoinedAt     time.Time `db:"joined_at"`
}

type FeedEvent struct {
	ID          string    `db:"id"`
	GroupID     string    `db:"group_id"`
	UserID      string    `db:"user_id"`
	DisplayName string    `db:"display_name"`
	EventType   string    `db:"event_type"`
	PayloadJSON string    `db:"payload_json"`
	CreatedAt   time.Time `db:"created_at"`
}

type FeedReaction struct {
	EventID   string    `db:"event_id"`
	UserID    string    `db:"user_id"`
	Reaction  string    `db:"reaction"`
	CreatedAt time.Time `db:"created_at"`
}

type LLMUsageLog struct {
	ID              string    `db:"id"`
	UserID          string    `db:"user_id"`
	FeatureType     string    `db:"feature_type"`
	TokensEstimated int       `db:"tokens_estimated"`
	RequestID       string    `db:"request_id"`
	CreatedAt       time.Time `db:"created_at"`
}
