package social

type LeaderboardMemberDTO struct {
	Rank        *int     `json:"rank"` // Nullable if hideRank is true
	DisplayName string   `json:"displayName"`
	AvatarURL   string   `json:"avatarUrl,omitempty"`
	Score       int      `json:"score"`
	Tier        string   `json:"tier"`
	TierTh      string   `json:"tierTh"`
	Badges      []string `json:"badges"`
	StreakDays  int      `json:"streakDays"`
	HideRank    bool     `json:"hideRank"`
}

type FeedEventDTO struct {
	ID          string                 `json:"id"`
	UserID      string                 `json:"userId"`
	DisplayName string                 `json:"displayName"`
	EventType   string                 `json:"eventType"` // score_changed, badge_earned, etc.
	Payload     map[string]interface{} `json:"payload"`
	CreatedAt   string                 `json:"createdAt"`
}

type PublicScoreDTO struct {
	Score      int      `json:"score"`
	Tier       string   `json:"tier"`
	TierTh     string   `json:"tierTh"`
	Badges     []string `json:"badges"`
	StreakDays int      `json:"streakDays"`
}
