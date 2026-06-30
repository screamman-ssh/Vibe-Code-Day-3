package service

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"moneycircle/internal/config"
	"moneycircle/internal/domain"
	"moneycircle/internal/dto/private"
	"moneycircle/internal/repository"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type AuthService struct {
	cfg      *config.Config
	repo     *repository.Repository
	scoreSvc *ScoreService
}

func NewAuthService(cfg *config.Config, repo *repository.Repository, scoreSvc *ScoreService) *AuthService {
	return &AuthService{
		cfg:      cfg,
		repo:     repo,
		scoreSvc: scoreSvc,
	}
}

type JWTClaims struct {
	jwt.RegisteredClaims
	Tier string `json:"tier"`
}

type GoogleTokenInfo struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	EmailVerified string `json:"email_verified"`
	Aud           string `json:"aud"`
}

func (s *AuthService) VerifyGoogleToken(idToken string) (*GoogleTokenInfo, error) {
	// 1. Check for mock token bypass (useful for local development and testing)
	if strings.HasPrefix(idToken, "mock_token_") {
		persona := strings.TrimPrefix(idToken, "mock_token_")
		switch persona {
		case "nune":
			return &GoogleTokenInfo{
				Sub:     "google-user-nune",
				Email:   "nune@moneycircle.co",
				Name:    "Nune",
				Picture: "https://api.dicebear.com/7.x/avataaars/svg?seed=nune",
			}, nil
		case "boss":
			return &GoogleTokenInfo{
				Sub:     "google-user-boss",
				Email:   "boss@moneycircle.co",
				Name:    "Boss",
				Picture: "https://api.dicebear.com/7.x/avataaars/svg?seed=boss",
			}, nil
		default:
			return &GoogleTokenInfo{
				Sub:     "google-user-" + persona,
				Email:   persona + "@example.com",
				Name:    persona,
				Picture: "https://api.dicebear.com/7.x/avataaars/svg?seed=" + persona,
			}, nil
		}
	}

	// 2. Real Google OAuth ID Token verification using tokeninfo endpoint
	resp, err := http.Get("https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken)
	if err != nil {
		return nil, fmt.Errorf("failed to call google tokeninfo: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("google tokeninfo returned status %d: %s", resp.StatusCode, string(body))
	}

	var info GoogleTokenInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, fmt.Errorf("failed to decode google tokeninfo: %w", err)
	}

	// Verify audience matches our Client ID if configured
	if s.cfg.GoogleClientID != "" && info.Aud != s.cfg.GoogleClientID {
		return nil, errors.New("google token audience mismatch")
	}

	return &info, nil
}

type AuthResult struct {
	AccessToken  string             `json:"accessToken"`
	RefreshToken string             `json:"refreshToken"`
	User         private.UserDTO    `json:"user"`
}

func (s *AuthService) LoginWithGoogle(idToken string) (*AuthResult, error) {
	info, err := s.VerifyGoogleToken(idToken)
	if err != nil {
		return nil, err
	}

	user, err := s.repo.GetUserByGoogleID(info.Sub)
	if err != nil {
		return nil, err
	}

	isNewUser := false
	if user == nil {
		isNewUser = true
		user = &domain.User{
			ID:                  uuid.New().String(),
			GoogleID:            info.Sub,
			DisplayName:         info.Name,
			AvatarURL:           info.Picture,
			SubscriptionTier:    "free",
			EmergencyFundAmount: 0,
			AvgMonthlyExpenses:  0,
			LoggingStreakDays:   0,
			LastLogDate:         "",
			OnboardingComplete:  false,
			CreatedAt:           time.Now(),
		}
		if err := s.repo.CreateUser(user); err != nil {
			return nil, err
		}
	}

	// Generate tokens
	accessToken, refreshToken, err := s.GenerateTokenPair(user.ID, user.SubscriptionTier)
	if err != nil {
		return nil, err
	}

	// If new user, recalculate score to get cold start score (50) persisted
	if isNewUser {
		_, _ = s.scoreSvc.Recalculate(user.ID)
	}

	return &AuthResult{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         s.MapUserToDTO(user),
	}, nil
}

func (s *AuthService) LoginGuest(displayName string) (*AuthResult, error) {
	uID := uuid.New().String()
	user := &domain.User{
		ID:                  uID,
		GoogleID:            "guest-" + uID,
		DisplayName:         displayName,
		AvatarURL:           "https://api.dicebear.com/7.x/avataaars/svg?seed=" + uID,
		SubscriptionTier:    "free",
		EmergencyFundAmount: 0,
		AvgMonthlyExpenses:  0,
		LoggingStreakDays:   0,
		LastLogDate:         "",
		OnboardingComplete:  false,
		CreatedAt:           time.Now(),
	}

	if err := s.repo.CreateUser(user); err != nil {
		return nil, err
	}

	// Recalculate score for guest cold start
	_, _ = s.scoreSvc.Recalculate(user.ID)

	accessToken, refreshToken, err := s.GenerateTokenPair(user.ID, user.SubscriptionTier)
	if err != nil {
		return nil, err
	}

	return &AuthResult{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         s.MapUserToDTO(user),
	}, nil
}

func (s *AuthService) RefreshSession(refreshTokenStr string) (*AuthResult, error) {
	rt, err := s.repo.GetRefreshToken(refreshTokenStr)
	if err != nil {
		return nil, err
	}
	if rt == nil {
		return nil, errors.New("invalid or expired refresh token")
	}

	if time.Now().After(rt.ExpiresAt) {
		_ = s.repo.DeleteRefreshToken(refreshTokenStr)
		return nil, errors.New("refresh token expired")
	}

	user, err := s.repo.GetUserByID(rt.UserID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	// Generate new token pair
	accessToken, newRefreshToken, err := s.GenerateTokenPair(user.ID, user.SubscriptionTier)
	if err != nil {
		return nil, err
	}

	return &AuthResult{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		User:         s.MapUserToDTO(user),
	}, nil
}

func (s *AuthService) GenerateTokenPair(userID, tier string) (string, string, error) {
	// Access Token (15 mins)
	acClaims := JWTClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
		Tier: tier,
	}
	acToken := jwt.NewWithClaims(jwt.SigningMethodHS256, acClaims)
	accessToken, err := acToken.SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return "", "", fmt.Errorf("failed to sign access token: %w", err)
	}

	// Refresh Token (30 days)
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", "", err
	}
	refreshTokenStr := hex.EncodeToString(bytes)

	rt := &domain.RefreshToken{
		Token:     refreshTokenStr,
		UserID:    userID,
		ExpiresAt: time.Now().Add(30 * 24 * time.Hour),
		CreatedAt: time.Now(),
	}

	if err := s.repo.SaveRefreshToken(rt); err != nil {
		return "", "", fmt.Errorf("failed to save refresh token: %w", err)
	}

	return accessToken, refreshTokenStr, nil
}

func (s *AuthService) VerifyAccessToken(tokenStr string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(s.cfg.JWTSecret), nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}

func (s *AuthService) MapUserToDTO(u *domain.User) private.UserDTO {
	return private.UserDTO{
		ID:                  u.ID,
		DisplayName:         u.DisplayName,
		AvatarURL:           u.AvatarURL,
		SubscriptionTier:    u.SubscriptionTier,
		EmergencyFundAmount: u.EmergencyFundAmount,
		LoggingStreakDays:   u.LoggingStreakDays,
		OnboardingComplete:  u.OnboardingComplete,
	}
}
