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

type DebtService struct {
	repo     *repository.Repository
	scoreSvc *ScoreService
}

func NewDebtService(repo *repository.Repository, scoreSvc *ScoreService) *DebtService {
	return &DebtService{
		repo:     repo,
		scoreSvc: scoreSvc,
	}
}

func (s *DebtService) GetDebts(userID string) ([]private.DebtDTO, error) {
	debts, err := s.repo.GetDebtsByUserID(userID)
	if err != nil {
		return nil, err
	}

	var list []private.DebtDTO
	for _, d := range debts {
		list = append(list, s.mapToDTO(d))
	}
	return list, nil
}

func (s *DebtService) CreateDebt(userID string, in private.DebtDTO) (*private.DebtDTO, *score.ScoreResult, error) {
	if in.Name == "" {
		return nil, nil, errors.New("INVALID_NAME")
	}
	if in.Balance < 0 {
		return nil, nil, errors.New("INVALID_BALANCE")
	}
	if in.DueDay < 1 || in.DueDay > 31 {
		return nil, nil, errors.New("INVALID_DUE_DAY")
	}

	d := &domain.Debt{
		ID:             uuid.New().String(),
		UserID:         userID,
		Name:           in.Name,
		Balance:        in.Balance,
		APR:            in.APR,
		MinimumPayment: in.MinimumPayment,
		DueDay:         in.DueDay,
		CreatedAt:      time.Now(),
	}

	if err := s.repo.CreateDebt(d); err != nil {
		return nil, nil, err
	}

	scoreRes, err := s.scoreSvc.Recalculate(userID)
	if err != nil {
		return nil, nil, err
	}

	dto := s.mapToDTO(d)
	return &dto, scoreRes, nil
}

func (s *DebtService) UpdateDebt(userID, id string, in private.DebtDTO) (*private.DebtDTO, *score.ScoreResult, error) {
	existing, err := s.repo.GetDebtByID(id)
	if err != nil {
		return nil, nil, err
	}
	if existing == nil {
		return nil, nil, errors.New("NOT_FOUND")
	}
	if existing.UserID != userID {
		return nil, nil, errors.New("UNAUTHORIZED_NOT_OWNER")
	}

	existing.Name = in.Name
	existing.Balance = in.Balance
	existing.APR = in.APR
	existing.MinimumPayment = in.MinimumPayment
	existing.DueDay = in.DueDay

	if err := s.repo.UpdateDebt(existing); err != nil {
		return nil, nil, err
	}

	scoreRes, err := s.scoreSvc.Recalculate(userID)
	if err != nil {
		return nil, nil, err
	}

	dto := s.mapToDTO(existing)
	return &dto, scoreRes, nil
}

func (s *DebtService) DeleteDebt(userID, id string) (*score.ScoreResult, error) {
	existing, err := s.repo.GetDebtByID(id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, errors.New("NOT_FOUND")
	}
	if existing.UserID != userID {
		return nil, errors.New("UNAUTHORIZED_NOT_OWNER")
	}

	if err := s.repo.DeleteDebt(id, userID); err != nil {
		return nil, err
	}

	scoreRes, err := s.scoreSvc.Recalculate(userID)
	if err != nil {
		return nil, err
	}

	return scoreRes, nil
}

func (s *DebtService) LogPayment(userID, debtID string, amount float64, paidAt time.Time) (*private.DebtDTO, *score.ScoreResult, error) {
	debt, err := s.repo.GetDebtByID(debtID)
	if err != nil {
		return nil, nil, err
	}
	if debt == nil {
		return nil, nil, errors.New("DEBT_NOT_FOUND")
	}
	if debt.UserID != userID {
		return nil, nil, errors.New("UNAUTHORIZED_NOT_OWNER")
	}

	// Calculate if payment is on time
	loc, _ := time.LoadLocation("Asia/Bangkok")
	paidLocal := paidAt.In(loc)
	onTime := paidLocal.Day() <= debt.DueDay

	dp := &domain.DebtPayment{
		ID:        uuid.New().String(),
		DebtID:    debtID,
		Amount:    amount,
		PaidAt:    paidAt,
		OnTime:    onTime,
		CreatedAt: time.Now(),
	}

	if err := s.repo.AddDebtPayment(dp); err != nil {
		return nil, nil, err
	}

	// Fetch updated debt balance
	debt, err = s.repo.GetDebtByID(debtID)
	if err != nil {
		return nil, nil, err
	}

	scoreRes, err := s.scoreSvc.Recalculate(userID)
	if err != nil {
		return nil, nil, err
	}

	dto := s.mapToDTO(debt)
	return &dto, scoreRes, nil
}

func (s *DebtService) mapToDTO(d *domain.Debt) private.DebtDTO {
	return private.DebtDTO{
		ID:             d.ID,
		UserID:         d.UserID,
		Name:           d.Name,
		Balance:        d.Balance,
		APR:            d.APR,
		MinimumPayment: d.MinimumPayment,
		DueDay:         d.DueDay,
		CreatedAt:      d.CreatedAt.Format(time.RFC3339),
	}
}
