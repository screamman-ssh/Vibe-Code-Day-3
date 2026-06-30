package service

import (
	"errors"
	"moneycircle/internal/domain"
	"moneycircle/internal/dto/private"
	"moneycircle/internal/repository"
	"time"

	"github.com/google/uuid"
)

type BillingService struct {
	repo *repository.Repository
}

func NewBillingService(repo *repository.Repository) *BillingService {
	return &BillingService{repo: repo}
}

// Enforce daily quota in Asia/Bangkok
func (s *BillingService) CheckOCRQuota(userID string) (bool, error) {
	user, err := s.repo.GetUserByID(userID)
	if err != nil {
		return false, err
	}
	if user == nil {
		return false, errors.New("USER_NOT_FOUND")
	}

	if user.SubscriptionTier == "premium" {
		return true, nil // Premium has unlimited OCR
	}

	// Calculate start of today in Asia/Bangkok
	loc, _ := time.LoadLocation("Asia/Bangkok")
	nowLocal := time.Now().In(loc)
	todayStartLocal := time.Date(nowLocal.Year(), nowLocal.Month(), nowLocal.Day(), 0, 0, 0, 0, loc)
	todayStartUTC := todayStartLocal.UTC()

	count, err := s.repo.CountDailyOCR(userID, todayStartUTC)
	if err != nil {
		return false, err
	}

	return count < 5, nil
}

func (s *BillingService) RequirePremium(userID string) error {
	user, err := s.repo.GetUserByID(userID)
	if err != nil {
		return err
	}
	if user == nil {
		return errors.New("USER_NOT_FOUND")
	}

	if user.SubscriptionTier != "premium" {
		return errors.New("PREMIUM_REQUIRED")
	}

	return nil
}

func (s *BillingService) LogUsage(userID, featureType string, tokensEstimated int, requestID string) error {
	log := &domain.LLMUsageLog{
		ID:              uuid.New().String(),
		UserID:          userID,
		FeatureType:     featureType,
		TokensEstimated: tokensEstimated,
		RequestID:       requestID,
		CreatedAt:       time.Now(),
	}
	return s.repo.LogLLMUsage(log)
}

func (s *BillingService) GetUsage(userID string) (*private.UsageDTO, error) {
	user, err := s.repo.GetUserByID(userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("USER_NOT_FOUND")
	}

	loc, _ := time.LoadLocation("Asia/Bangkok")
	nowLocal := time.Now().In(loc)
	todayStartLocal := time.Date(nowLocal.Year(), nowLocal.Month(), nowLocal.Day(), 0, 0, 0, 0, loc)
	todayStartUTC := todayStartLocal.UTC()

	count, err := s.repo.CountDailyOCR(userID, todayStartUTC)
	if err != nil {
		return nil, err
	}

	limit := 5
	if user.SubscriptionTier == "premium" {
		limit = 999
	}

	return &private.UsageDTO{
		OCRUsedToday:          count,
		OCRLimit:              limit,
		Tier:                  user.SubscriptionTier,
		PremiumFeaturesLocked: user.SubscriptionTier != "premium",
	}, nil
}

func (s *BillingService) SetUserPremium(userID string, premium bool) error {
	user, err := s.repo.GetUserByID(userID)
	if err != nil {
		return err
	}
	if user == nil {
		return errors.New("USER_NOT_FOUND")
	}

	if premium {
		user.SubscriptionTier = "premium"
	} else {
		user.SubscriptionTier = "free"
	}

	return s.repo.UpdateUser(user)
}
