package service

import (
	"errors"
	"moneycircle/internal/domain"
	"moneycircle/internal/domain/score"
	"moneycircle/internal/dto/private"
	"moneycircle/internal/repository"
	"time"

	"github.com/google/uuid"
)

type TransactionService struct {
	repo      *repository.Repository
	scoreSvc  *ScoreService
	gamifySvc *GamificationService
}

func NewTransactionService(repo *repository.Repository, scoreSvc *ScoreService, gamifySvc *GamificationService) *TransactionService {
	return &TransactionService{
		repo:      repo,
		scoreSvc:  scoreSvc,
		gamifySvc: gamifySvc,
	}
}

var ValidCategories = map[string]bool{
	"Food":          true,
	"Transport":     true,
	"Housing":       true,
	"Utilities":     true,
	"Entertainment": true,
	"Health":        true,
	"Education":     true,
	"Debt Payment":  true,
	"Savings":       true,
	"Income":        true,
	"Other":         true,
}

func (s *TransactionService) Validate(typeVal string, amount float64, category string, date string) error {
	if typeVal != "income" && typeVal != "expense" {
		return errors.New("INVALID_TYPE")
	}
	if amount <= 0 {
		return errors.New("INVALID_AMOUNT")
	}
	if !ValidCategories[category] {
		return errors.New("INVALID_CATEGORY")
	}
	if _, err := time.Parse("2006-01-02", date); err != nil {
		return errors.New("INVALID_DATE")
	}
	return nil
}

func (s *TransactionService) GetTransactions(userID string, category *string, startDate, endDate *string) ([]private.TransactionDTO, error) {
	txs, err := s.repo.GetTransactionsByUserID(userID, category, startDate, endDate)
	if err != nil {
		return nil, err
	}

	var list []private.TransactionDTO
	for _, t := range txs {
		list = append(list, s.mapToDTO(t))
	}
	return list, nil
}

type CreateTxInput struct {
	Type     string  `json:"type"`
	Amount   float64 `json:"amount"`
	Category string  `json:"category"`
	Merchant string  `json:"merchant"`
	Note     string  `json:"note"`
	Date     string  `json:"date"`
	Source   string  `json:"source"`
}

func (s *TransactionService) CreateTransaction(userID string, in CreateTxInput) (*private.TransactionDTO, *score.ScoreResult, error) {
	if in.Source == "" {
		in.Source = "manual"
	}
	if err := s.Validate(in.Type, in.Amount, in.Category, in.Date); err != nil {
		return nil, nil, err
	}

	// Anti-gaming check: T-304
	// Flag user if > 50 transactions in one day (in Bangkok timezone)
	loc, _ := time.LoadLocation("Asia/Bangkok")
	today := time.Now().In(loc).Format("2006-01-02")
	todayTxs, err := s.repo.GetTransactionsByUserID(userID, nil, &today, &today)
	if err == nil && len(todayTxs) >= 50 {
		// Enforce flagging
		user, err := s.repo.GetUserByID(userID)
		if err == nil && user != nil {
			// We can set subscription_tier = 'flagged' or a separate column.
			// Let's check: "Respect hide_rank flag / Exclude flagged users from leaderboard query".
			// We can flag by updating displayName or streak or adding a flag.
			// Let's set subscription_tier = "flagged" or prefix displayName with [FLAGGED] or just set a column.
			// Wait, the ARCH §14 specifies: "Flag user; exclude from leaderboard".
			// To keep it simple, we can store flagged state by appending [FLAGGED] to their subscription_tier or displayName,
			// or we can add a column, but wait, the database schema doesn't have a flagged column in `001_users.sql`.
			// Wait, we can set `subscription_tier = 'flagged'` or append to `subscription_tier`.
			// Let's set `subscription_tier = 'flagged'`! This is simple, matches type string, and easily blocks leaderboard.
			user.SubscriptionTier = "flagged"
			_ = s.repo.UpdateUser(user)
		}
	}

	tx := &domain.Transaction{
		ID:        uuid.New().String(),
		UserID:    userID,
		Type:      in.Type,
		Amount:    in.Amount,
		Category:  in.Category,
		Merchant:  in.Merchant,
		Note:      in.Note,
		Date:      in.Date,
		Source:    in.Source,
		CreatedAt: time.Now(),
	}

	if err := s.repo.CreateTransaction(tx); err != nil {
		return nil, nil, err
	}

	// Update logging streak: today is logged, so increment or preserve
	_ = s.gamifySvc.UpdateStreak(userID)

	// Recalculate score
	scoreRes, err := s.scoreSvc.Recalculate(userID)
	if err != nil {
		return nil, nil, err
	}

	dto := s.mapToDTO(tx)
	return &dto, scoreRes, nil
}

func (s *TransactionService) UpdateTransaction(userID, id string, in CreateTxInput) (*private.TransactionDTO, *score.ScoreResult, error) {
	if err := s.Validate(in.Type, in.Amount, in.Category, in.Date); err != nil {
		return nil, nil, err
	}

	existing, err := s.repo.GetTransactionByID(id)
	if err != nil {
		return nil, nil, err
	}
	if existing == nil {
		return nil, nil, errors.New("NOT_FOUND")
	}
	if existing.UserID != userID {
		return nil, nil, errors.New("UNAUTHORIZED_NOT_OWNER")
	}

	existing.Type = in.Type
	existing.Amount = in.Amount
	existing.Category = in.Category
	existing.Merchant = in.Merchant
	existing.Note = in.Note
	existing.Date = in.Date
	if in.Source != "" {
		existing.Source = in.Source
	}

	if err := s.repo.UpdateTransaction(existing); err != nil {
		return nil, nil, err
	}

	// Recalculate score
	scoreRes, err := s.scoreSvc.Recalculate(userID)
	if err != nil {
		return nil, nil, err
	}

	dto := s.mapToDTO(existing)
	return &dto, scoreRes, nil
}

func (s *TransactionService) DeleteTransaction(userID, id string) (*score.ScoreResult, error) {
	existing, err := s.repo.GetTransactionByID(id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, errors.New("NOT_FOUND")
	}
	if existing.UserID != userID {
		return nil, errors.New("UNAUTHORIZED_NOT_OWNER")
	}

	if err := s.repo.DeleteTransaction(id, userID); err != nil {
		return nil, err
	}

	// Recalculate score
	scoreRes, err := s.scoreSvc.Recalculate(userID)
	if err != nil {
		return nil, err
	}

	return scoreRes, nil
}

func (s *TransactionService) mapToDTO(t *domain.Transaction) private.TransactionDTO {
	return private.TransactionDTO{
		ID:       t.ID,
		UserID:   t.UserID,
		Type:     t.Type,
		Amount:   t.Amount,
		Category: t.Category,
		Merchant: t.Merchant,
		Note:     t.Note,
		Date:     t.Date,
		Source:   t.Source,
	}
}
