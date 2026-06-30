package service

import (
	"encoding/json"
	"fmt"
	"log"
	"moneycircle/internal/domain"
	"moneycircle/internal/domain/score"
	"moneycircle/internal/dto/private"
	"moneycircle/internal/repository"
	"time"

	"github.com/google/uuid"
)

type GamificationService struct {
	repo *repository.Repository
}

func NewGamificationService(repo *repository.Repository) *GamificationService {
	return &GamificationService{repo: repo}
}

// Award badges on state changes
func (s *GamificationService) CheckBadges(userID string) ([]string, error) {
	user, err := s.repo.GetUserByID(userID)
	if err != nil || user == nil {
		return nil, err
	}

	alreadyEarned, err := s.repo.GetUserBadges(userID)
	if err != nil {
		return nil, err
	}

	earnedMap := make(map[string]bool)
	for _, code := range alreadyEarned {
		earnedMap[code] = true
	}

	var newlyEarned []string

	// Helper to award a badge if not already earned
	awardIfEligible := func(badgeCode string, eligible bool) {
		if eligible && !earnedMap[badgeCode] {
			err := s.repo.AwardBadge(userID, badgeCode)
			if err == nil {
				newlyEarned = append(newlyEarned, badgeCode)
				// Emit feed event for earned badge
				s.EmitBadgeEarnedEvent(user, badgeCode)
			}
		}
	}

	// 1. First Log
	txs, err := s.repo.GetTransactionsByUserID(userID, nil, nil, nil)
	if err == nil && len(txs) >= 1 {
		awardIfEligible("First Log", true)
	}

	// 2. Week Warrior (7-day logging streak)
	awardIfEligible("Week Warrior", user.LoggingStreakDays >= 7)

	// 3. Month Master (30-day logging streak)
	awardIfEligible("Month Master", user.LoggingStreakDays >= 30)

	// Fetch latest score snapshot for other badges
	latestScore, err := s.repo.GetLatestScoreSnapshot(userID)
	if err == nil && latestScore != nil {
		var dims []private.ScoreDimensionDTO
		if err := json.Unmarshal([]byte(latestScore.DimensionsJSON), &dims); err == nil {
			dimMap := make(map[string]float64)
			for _, d := range dims {
				dimMap[d.Key] = d.Subscore
			}

			// 4. Budget Boss (100% budget adherence)
			// Ensure they actually have budget category limits set before awarding
			loc, _ := time.LoadLocation("Asia/Bangkok")
			currentMonth := time.Now().In(loc).Format("2006-01")
			budget, _ := s.repo.GetBudgetByUserIDAndMonth(userID, currentMonth)
			if budget != nil {
				cats, _ := s.repo.GetBudgetCategories(budget.ID)
				hasLimits := false
				for _, c := range cats {
					if c.LimitAmount > 0 {
						hasLimits = true
						break
					}
				}
				awardIfEligible("Budget Boss", hasLimits && dimMap["budgetAdherence"] == 100)
			}

			// 5. Saver Start (Savings rate >= 10%)
			// In score engine, savings rate subscore >= 70 corresponds to rate >= 10%
			awardIfEligible("Saver Start", dimMap["savingsRate"] >= 70)

			// 6. Emergency Ready (Emergency fund tier >= 1 month)
			// Emergency fund subscore >= 60 corresponds to months >= 1
			awardIfEligible("Emergency Ready", dimMap["emergencyFund"] >= 60)
		}
	}

	// 7. Debt Destroyer (3 consecutive on-time payments)
	debts, err := s.repo.GetDebtsByUserID(userID)
	if err == nil {
		hasDestroyer := false
		for _, d := range debts {
			payments, err := s.repo.GetDebtPayments(d.ID)
			if err == nil {
				streak := 0
				for _, p := range payments {
					if p.OnTime {
						streak++
					} else {
						break
					}
				}
				if streak >= 3 {
					hasDestroyer = true
					break
				}
			}
		}
		awardIfEligible("Debt Destroyer", hasDestroyer)
	}

	// 8. Challenge Champ (complete 3 group challenges)
	// Query challenges completed
	// We can scan challenge participations
	loc, _ := time.LoadLocation("Asia/Bangkok")
	nowStr := time.Now().In(loc).Format("2006-01-02")
	// For simplicity, count all status = 'completed' participations
	var completedCount int
	// We scan database or query
	// Let's check group to query challenges
	group, _ := s.repo.GetGroupByUserID(userID)
	if group != nil {
		activeChallenges, _ := s.repo.GetActiveChallenges(group.ID)
		for _, c := range activeChallenges {
			parts, _ := s.repo.GetChallengeParticipations(c.ID)
			for _, p := range parts {
				if p.UserID == userID && p.Status == "completed" {
					completedCount++
				}
			}
		}
		// Also look for past/ended challenges completed
		// Let's do a direct query in DB to count participations with status = 'completed'
		_ = s.repo.RawQueryRow(`
			SELECT COUNT(*) FROM challenge_participations 
			WHERE user_id = $1 AND status = 'completed'`, userID).Scan(&completedCount)

		awardIfEligible("Challenge Champ", completedCount >= 3)
	}

	// 9. Comeback Kid (improve score by 10+ points in 30 days)
	// Compare current score with score 30 days ago
	if latestScore != nil {
		var pastScore int
		thirtyDaysAgo := time.Now().Add(-30 * 24 * time.Hour)
		err := s.repo.RawQueryRow(`
			SELECT total_score FROM score_snapshots 
			WHERE user_id = $1 AND calculated_at <= $2 
			ORDER BY calculated_at DESC LIMIT 1`, userID, thirtyDaysAgo).Scan(&pastScore)
		if err == nil {
			diff := latestScore.TotalScore - pastScore
			awardIfEligible("Comeback Kid", diff >= 10)
		}
	}

	// 10. Circle MVP (first place at week end)
	// We can check if they are currently Rank 1 in their group leaderboard
	if group != nil {
		users, _, err := s.repo.GetGroupMembers(group.ID)
		if err == nil && len(users) > 1 {
			// Find if user has max score
			maxScore := -1
			var topUserID string
			for _, u := range users {
				snap, err := s.repo.GetLatestScoreSnapshot(u.ID)
				if err == nil && snap != nil {
					if snap.TotalScore > maxScore {
						maxScore = snap.TotalScore
						topUserID = u.ID
					}
				}
			}
			awardIfEligible("Circle MVP", topUserID == userID && maxScore >= 60) // Steady and above
		}
	}

	return newlyEarned, nil
}

// Update Logging Streak
func (s *GamificationService) UpdateStreak(userID string) error {
	user, err := s.repo.GetUserByID(userID)
	if err != nil {
		return err
	}
	if user == nil {
		return nil
	}

	loc, _ := time.LoadLocation("Asia/Bangkok")
	today := time.Now().In(loc).Format("2006-01-02")
	if user.LastLogDate == today {
		return nil // Already logged today, streak is safe and doesn't need incrementing
	}

	yesterday := time.Now().In(loc).AddDate(0, 0, -1).Format("2006-01-02")

	if user.LastLogDate == yesterday {
		user.LoggingStreakDays += 1
		// Check for streak milestones (e.g. 7, 30 days) and emit feed event
		if user.LoggingStreakDays%7 == 0 {
			s.EmitStreakMilestoneEvent(user, user.LoggingStreakDays)
		}
	} else {
		// Reset to 1 since they missed a day
		user.LoggingStreakDays = 1
	}

	user.LastLogDate = today
	return s.repo.UpdateUser(user)
}

// Run rollover at midnight Bangkok TZ to reset streaks if a user missed logging yesterday
func (s *GamificationService) RolloverStreaks() error {
	loc, _ := time.LoadLocation("Asia/Bangkok")
	yesterday := time.Now().In(loc).AddDate(0, 0, -1).Format("2006-01-02")
	today := time.Now().In(loc).Format("2006-01-02")

	// Find all users who haven't logged today and whose last log was NOT yesterday (or today)
	// This means they missed yesterday, so reset their streak to 0
	// We can execute a batch update:
	_, err := s.repo.RawExec(`
		UPDATE users 
		SET logging_streak_days = 0 
		WHERE last_log_date != $1 AND last_log_date != $2 AND logging_streak_days > 0`,
		yesterday, today)
	return err
}

// Challenges Evaluator
func (s *GamificationService) EvaluateChallengesOnWrite(userID string) error {
	group, err := s.repo.GetGroupByUserID(userID)
	if err != nil || group == nil {
		return err
	}

	activeChallenges, err := s.repo.GetActiveChallenges(group.ID)
	if err != nil {
		return err
	}

	loc, _ := time.LoadLocation("Asia/Bangkok")
	today := time.Now().In(loc).Format("2006-01-02")

	for _, c := range activeChallenges {
		// Skip if today is before start date or after end date
		if today < c.StartDate || today > c.EndDate {
			continue
		}

		parts, err := s.repo.GetChallengeParticipations(c.ID)
		if err != nil {
			continue
		}

		// Find user participation
		var part *domain.ChallengeParticipation
		for _, p := range parts {
			if p.UserID == userID {
				part = p
				break
			}
		}

		if part == nil || part.Status == "completed" || part.Status == "failed" {
			continue
		}

		// Run evaluation based on template
		completed := false
		var progress map[string]interface{}
		_ = json.Unmarshal([]byte(part.ProgressJSON), &progress)
		if progress == nil {
			progress = make(map[string]interface{})
		}

		switch c.TemplateCode {
		case "log_5_expenses":
			// Count number of expense transactions logged during challenge
			txs, err := s.repo.GetTransactionsByUserID(userID, nil, &c.StartDate, &c.EndDate)
			if err == nil {
				expensesCount := 0
				for _, t := range txs {
					if t.Type == "expense" {
						expensesCount++
					}
				}
				progress["logged_count"] = expensesCount
				if expensesCount >= 5 {
					completed = true
				}
			}

		case "no_spend_weekend":
			// Check if we hit weekend and if they spent anything
			// Evaluates on daily cron or write.
			// Write: if they log an expense on a Saturday or Sunday, they fail
			txs, err := s.repo.GetTransactionsByUserID(userID, nil, &c.StartDate, &c.EndDate)
			if err == nil {
				failed := false
				for _, t := range txs {
					if t.Type == "expense" {
						txDate, err := time.Parse("2006-01-02", t.Date)
						if err == nil {
							wd := txDate.Weekday()
							if wd == time.Saturday || wd == time.Sunday {
								failed = true
								break
							}
						}
					}
				}
				if failed {
					part.Status = "failed"
				}
				progress["failed"] = failed
			}

		case "on_time_debt":
			// Check all payments in window
			// If they made any debt payment in window, verify it was on_time
			// (Checked on payment write path)
			// Let's check payments
			debts, err := s.repo.GetDebtsByUserID(userID)
			if err == nil {
				allOnTime := true
				hasPayments := false
				for _, d := range debts {
					payments, err := s.repo.GetDebtPayments(d.ID)
					if err == nil {
						for _, p := range payments {
							pDate := p.PaidAt.In(loc).Format("2006-01-02")
							if pDate >= c.StartDate && pDate <= c.EndDate {
								hasPayments = true
								if !p.OnTime {
									allOnTime = false
								}
							}
						}
					}
				}
				progress["has_payments"] = hasPayments
				progress["all_on_time"] = allOnTime
				if hasPayments && allOnTime {
					completed = true
				}
			}
		}

		progressBytes, _ := json.Marshal(progress)
		part.ProgressJSON = string(progressBytes)

		if completed {
			part.Status = "completed"
			s.EmitChallengeCompletedEvent(userID, group.ID, c.Name)
		}

		_ = s.repo.UpdateChallengeParticipation(part.ChallengeID, part.UserID, part.Status, part.ProgressJSON)
	}

	return nil
}

// Daily check for challenges completion (e.g. no_spend_weekend at the end of the challenge)
func (s *GamificationService) RolloverChallenges() error {
	loc, _ := time.LoadLocation("Asia/Bangkok")
	today := time.Now().In(loc).Format("2006-01-02")

	// Get all challenges that ended yesterday
	yesterday := time.Now().In(loc).AddDate(0, 0, -1).Format("2006-01-02")
	// Since we query ended challenges, let's select challenges where end_date = yesterday
	// We can execute a direct query:
	rows, err := s.repo.RawQuery(`SELECT id, group_id, name, template_code, start_date, end_date FROM challenges WHERE end_date = $1`, yesterday)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var c domain.Challenge
		err := rows.Scan(&c.ID, &c.GroupID, &c.Name, &c.TemplateCode, &c.StartDate, &c.EndDate)
		if err != nil {
			continue
		}

		parts, err := s.repo.GetChallengeParticipations(c.ID)
		if err != nil {
			continue
		}

		for _, part := range parts {
			if part.Status == "joined" {
				// Evaluate final status
				completed := false
				var progress map[string]interface{}
				_ = json.Unmarshal([]byte(part.ProgressJSON), &progress)
				if progress == nil {
					progress = make(map[string]interface{})
				}

				if c.TemplateCode == "no_spend_weekend" {
					// If they didn't fail (i.e. logged zero weekend expenses) they completed it!
					isFailed, _ := progress["failed"].(bool)
					if !isFailed {
						completed = true
					}
				}

				if completed {
					part.Status = "completed"
					s.EmitChallengeCompletedEvent(part.UserID, c.GroupID, c.Name)
				} else {
					part.Status = "failed"
				}

				_ = s.repo.UpdateChallengeParticipation(part.ChallengeID, part.UserID, part.Status, part.ProgressJSON)
			}
		}
	}

	return nil
}

// Feed event emitters

func (s *GamificationService) EmitScoreChangedEvent(user *domain.User, groupID string, prevScore, newScore int, tier string) {
	payload := map[string]interface{}{
		"previous_score": prevScore,
		"new_score":      newScore,
		"tier":           tier,
	}
	payloadBytes, _ := json.Marshal(payload)

	fe := &domain.FeedEvent{
		ID:          uuid.New().String(),
		GroupID:     groupID,
		UserID:      user.ID,
		DisplayName: user.DisplayName,
		EventType:   "score_changed",
		PayloadJSON: string(payloadBytes),
		CreatedAt:   time.Now(),
	}

	_ = s.repo.CreateFeedEvent(fe)
}

func (s *GamificationService) EmitBadgeEarnedEvent(user *domain.User, badgeCode string) {
	// Find user group
	group, err := s.repo.GetGroupByUserID(user.ID)
	if err != nil || group == nil {
		return
	}

	payload := map[string]interface{}{
		"badge_code": badgeCode,
		"badge_name": badgeCode,
	}
	payloadBytes, _ := json.Marshal(payload)

	fe := &domain.FeedEvent{
		ID:          uuid.New().String(),
		GroupID:     group.ID,
		UserID:      user.ID,
		DisplayName: user.DisplayName,
		EventType:   "badge_earned",
		PayloadJSON: string(payloadBytes),
		CreatedAt:   time.Now(),
	}

	_ = s.repo.CreateFeedEvent(fe)
}

func (s *GamificationService) EmitStreakMilestoneEvent(user *domain.User, streakDays int) {
	group, err := s.repo.GetGroupByUserID(user.ID)
	if err != nil || group == nil {
		return
	}

	payload := map[string]interface{}{
		"streak_days": streakDays,
	}
	payloadBytes, _ := json.Marshal(payload)

	fe := &domain.FeedEvent{
		ID:          uuid.New().String(),
		GroupID:     group.ID,
		UserID:      user.ID,
		DisplayName: user.DisplayName,
		EventType:   "streak_milestone",
		PayloadJSON: string(payloadBytes),
		CreatedAt:   time.Now(),
	}

	_ = s.repo.CreateFeedEvent(fe)
}

func (s *GamificationService) EmitChallengeCompletedEvent(userID, groupID, challengeName string) {
	user, err := s.repo.GetUserByID(userID)
	if err != nil || user == nil {
		return
	}

	payload := map[string]interface{}{
		"challenge_name": challengeName,
	}
	payloadBytes, _ := json.Marshal(payload)

	fe := &domain.FeedEvent{
		ID:          uuid.New().String(),
		GroupID:     groupID,
		UserID:      user.ID,
		DisplayName: user.DisplayName,
		EventType:   "challenge_completed",
		PayloadJSON: string(payloadBytes),
		CreatedAt:   time.Now(),
	}

	_ = s.repo.CreateFeedEvent(fe)
}
