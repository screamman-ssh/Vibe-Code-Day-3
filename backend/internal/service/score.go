package service

import (
	"encoding/json"
	"moneycircle/internal/domain"
	"moneycircle/internal/domain/score"
	"moneycircle/internal/repository"
	"time"

	"github.com/google/uuid"
)

type ScoreService struct {
	repo       *repository.Repository
	gamifySvc  *GamificationService
}

func NewScoreService(repo *repository.Repository, gamifySvc *GamificationService) *ScoreService {
	return &ScoreService{
		repo:      repo,
		gamifySvc: gamifySvc,
	}
}

func (s *ScoreService) Recalculate(userID string) (*score.ScoreResult, error) {
	user, err := s.repo.GetUserByID(userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, nil
	}

	loc, _ := time.LoadLocation("Asia/Bangkok")
	currentMonth := time.Now().In(loc).Format("2006-01")

	// Get or auto-create budget
	budget, err := s.repo.GetBudgetByUserIDAndMonth(userID, currentMonth)
	if err != nil {
		return nil, err
	}
	if budget == nil {
		budget = &domain.Budget{
			ID:        uuid.New().String(),
			UserID:    userID,
			Month:     currentMonth,
			CreatedAt: time.Now(),
		}
		if err := s.repo.CreateBudget(budget); err != nil {
			return nil, err
		}
	}

	// Fetch budget categories
	budgetCats, err := s.repo.GetBudgetCategories(budget.ID)
	if err != nil {
		return nil, err
	}

	// Fetch transactions
	txs, err := s.repo.GetTransactionsByUserID(userID, nil, nil, nil)
	if err != nil {
		return nil, err
	}

	// Fetch debts
	debts, err := s.repo.GetDebtsByUserID(userID)
	if err != nil {
		return nil, err
	}

	// Fetch debt payments
	debtPayments := make(map[string][]*domain.DebtPayment)
	for _, d := range debts {
		payments, err := s.repo.GetDebtPayments(d.ID)
		if err == nil {
			debtPayments[d.ID] = payments
		}
	}

	// Run pure calculation
	res := score.CalculateScore(txs, budgetCats, debts, debtPayments, user.EmergencyFundAmount, user.LoggingStreakDays, currentMonth)

	// Fetch previous latest snapshot to detect changes
	prevSnapshot, err := s.repo.GetLatestScoreSnapshot(userID)
	if err != nil {
		return nil, err
	}

	// Save snapshot
	dimsBytes, err := json.Marshal(res.Dimensions)
	if err != nil {
		return nil, err
	}

	ss := &domain.ScoreSnapshot{
		ID:             uuid.New().String(),
		UserID:         userID,
		TotalScore:     res.TotalScore,
		Tier:           res.Tier,
		TierTh:         res.TierTh,
		DimensionsJSON: string(dimsBytes),
		CalculatedAt:   time.Now(),
	}

	if err := s.repo.SaveScoreSnapshot(ss); err != nil {
		return nil, err
	}

	// Trigger feed events if delta is >= 1 point
	prevScore := 50
	if prevSnapshot != nil {
		prevScore = prevSnapshot.TotalScore
	}

	if prevSnapshot == nil || abs(res.TotalScore-prevScore) >= 1 {
		group, err := s.repo.GetGroupByUserID(userID)
		if err == nil && group != nil {
			s.gamifySvc.EmitScoreChangedEvent(user, group.ID, prevScore, res.TotalScore, res.Tier)
		}
	}

	// Run badge and challenge check
	_, _ = s.gamifySvc.CheckBadges(userID)
	_ = s.gamifySvc.EvaluateChallengesOnWrite(userID)

	return res, nil
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
