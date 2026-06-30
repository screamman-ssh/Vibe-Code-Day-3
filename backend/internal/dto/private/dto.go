package private

type UserDTO struct {
	ID                  string  `json:"id"`
	DisplayName         string  `json:"displayName"`
	AvatarURL           string  `json:"avatarUrl,omitempty"`
	SubscriptionTier    string  `json:"subscriptionTier"`
	EmergencyFundAmount float64 `json:"emergencyFundAmount"`
	LoggingStreakDays   int     `json:"loggingStreakDays"`
	OnboardingComplete  bool    `json:"onboardingComplete"`
}

type TransactionDTO struct {
	ID        string  `json:"id"`
	UserID    string  `json:"userId"`
	Type      string  `json:"type"` // income, expense
	Amount    float64 `json:"amount"`
	Category  string  `json:"category"`
	Merchant  string  `json:"merchant,omitempty"`
	Note      string  `json:"note,omitempty"`
	Date      string  `json:"date"` // YYYY-MM-DD
	Source    string  `json:"source"`
}

type BudgetCategoryDTO struct {
	Category    string  `json:"category"`
	LimitAmount float64 `json:"limitAmount"`
	SpentAmount float64 `json:"spentAmount"`
}

type DebtDTO struct {
	ID             string  `json:"id"`
	UserID         string  `json:"userId"`
	Name           string  `json:"name"`
	Balance        float64 `json:"balance"`
	APR            float64 `json:"apr"`
	MinimumPayment float64 `json:"minimumPayment"`
	DueDay         int     `json:"dueDay"`
	CreatedAt      string  `json:"createdAt"`
}

type DebtPaymentDTO struct {
	ID        string  `json:"id"`
	DebtID    string  `json:"debtId"`
	Amount    float64 `json:"amount"`
	PaidAt    string  `json:"paidAt"`
	OnTime    bool    `json:"onTime"`
	CreatedAt string  `json:"createdAt"`
}

type ScoreDimensionDTO struct {
	Key      string  `json:"key"`
	Label    string  `json:"label"`
	Weight   float64 `json:"weight"`
	Subscore float64 `json:"subscore"`
}

type PrivateScoreDTO struct {
	TotalScore int                  `json:"totalScore"`
	Tier       string               `json:"tier"`
	TierTh     string               `json:"tierTh"`
	Dimensions []ScoreDimensionDTO `json:"dimensions"`
}

type UsageDTO struct {
	OCRUsedToday          int    `json:"ocrUsedToday"`
	OCRLimit              int    `json:"ocrLimit"`
	Tier                  string `json:"tier"`
	PremiumFeaturesLocked bool   `json:"premiumFeaturesLocked"`
}
