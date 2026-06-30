package service

import (
	"moneycircle/internal/domain"
	"moneycircle/internal/domain/score"
	"moneycircle/internal/dto/private"
	"moneycircle/internal/repository"
	"strings"
	"time"

	"github.com/google/uuid"
)

type BudgetService struct {
	repo     *repository.Repository
	scoreSvc *ScoreService
}

func NewBudgetService(repo *repository.Repository, scoreSvc *ScoreService) *BudgetService {
	return &BudgetService{
		repo:     repo,
		scoreSvc: scoreSvc,
	}
}

func (s *BudgetService) GetBudget(userID string) ([]private.BudgetCategoryDTO, error) {
	loc, _ := time.LoadLocation("Asia/Bangkok")
	currentMonth := time.Now().In(loc).Format("2006-01")

	// Get or create budget
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

	// Fetch budget limits
	limits, err := s.repo.GetBudgetCategories(budget.ID)
	if err != nil {
		return nil, err
	}
	limitMap := make(map[string]float64)
	for _, l := range limits {
		limitMap[l.Category] = l.LimitAmount
	}

	// Fetch expenses in current month
	txs, err := s.repo.GetTransactionsByUserID(userID, nil, nil, nil)
	if err != nil {
		return nil, err
	}

	spentMap := make(map[string]float64)
	for _, t := range txs {
		if t.Type == "expense" && strings.HasPrefix(t.Date, currentMonth) {
			spentMap[t.Category] += t.Amount
		}
	}

	// Default list of PFM categories from types.js
	defaultCategories := []string{
		"Food", "Transport", "Housing", "Utilities", "Entertainment",
		"Health", "Education", "Debt Payment", "Savings", "Other",
	}

	var list []private.BudgetCategoryDTO
	for _, cat := range defaultCategories {
		list = append(list, private.BudgetCategoryDTO{
			Category:    cat,
			LimitAmount: limitMap[cat],
			SpentAmount: spentMap[cat],
		})
	}

	return list, nil
}

func (s *BudgetService) UpdateBudget(userID string, items []private.BudgetCategoryDTO) ([]private.BudgetCategoryDTO, *score.ScoreResult, error) {
	loc, _ := time.LoadLocation("Asia/Bangkok")
	currentMonth := time.Now().In(loc).Format("2006-01")

	// Get or create budget
	budget, err := s.repo.GetBudgetByUserIDAndMonth(userID, currentMonth)
	if err != nil {
		return nil, nil, err
	}
	if budget == nil {
		budget = &domain.Budget{
			ID:        uuid.New().String(),
			UserID:    userID,
			Month:     currentMonth,
			CreatedAt: time.Now(),
		}
		if err := s.repo.CreateBudget(budget); err != nil {
			return nil, nil, err
		}
	}

	var dbCats []*domain.BudgetCategory
	for _, item := range items {
		dbCats = append(dbCats, &domain.BudgetCategory{
			ID:          uuid.New().String(),
			BudgetID:    budget.ID,
			Category:    item.Category,
			LimitAmount: item.LimitAmount,
		})
	}

	if err := s.repo.UpdateBudgetCategories(budget.ID, dbCats); err != nil {
		return nil, nil, err
	}

	// Recalculate score
	scoreRes, err := s.scoreSvc.Recalculate(userID)
	if err != nil {
		return nil, nil, err
	}

	// Fetch updated budget category status
	updatedBudget, err := s.GetBudget(userID)
	if err != nil {
		return nil, nil, err
	}

	return updatedBudget, scoreRes, nil
}
