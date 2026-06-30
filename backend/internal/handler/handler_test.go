package handler

import (
	"bytes"
	"encoding/json"
	"moneycircle/internal/config"
	"moneycircle/internal/dto/private"
	"moneycircle/internal/repository"
	"moneycircle/internal/service"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestIntegrationFlow(t *testing.T) {
	// 1. Setup in-memory sqlite db
	db, err := repository.Connect("sqlite://:memory:")
	if err != nil {
		t.Fatalf("failed to open memory db: %v", err)
	}
	defer db.Close()

	cfg := &config.Config{
		JWTSecret:   "test_secret_1234567890",
		AdminAPIKey: "admin_secret",
		LLMModel:    "google/gemma-4-31b-it",
	}

	repo := repository.New(db)
	gamifySvc := service.NewGamificationService(repo)
	scoreSvc := service.NewScoreService(repo, gamifySvc)
	authSvc := service.NewAuthService(cfg, repo, scoreSvc)
	groupSvc := service.NewGroupService(repo)
	txSvc := service.NewTransactionService(repo, scoreSvc, gamifySvc)
	budgetSvc := service.NewBudgetService(repo, scoreSvc)
	debtSvc := service.NewDebtService(repo, scoreSvc)
	billingSvc := service.NewBillingService(repo)
	llmSvc := service.NewLLMService(cfg, billingSvc)

	h := New(cfg, authSvc, groupSvc, txSvc, budgetSvc, debtSvc, scoreSvc, gamifySvc, llmSvc, billingSvc)

	// 2. Test Guest Login Handler
	loginBody := map[string]string{"displayName": "Test User"}
	bodyBytes, _ := json.Marshal(loginBody)
	req := httptest.NewRequest("POST", "/api/v1/auth/guest", bytes.NewBuffer(bodyBytes))
	rec := httptest.NewRecorder()

	h.LoginGuest(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var authRes service.AuthResult
	if err := json.Unmarshal(rec.Body.Bytes(), &authRes); err != nil {
		t.Fatalf("failed to decode login result: %v", err)
	}

	if authRes.User.DisplayName != "Test User" {
		t.Errorf("expected display name 'Test User', got '%s'", authRes.User.DisplayName)
	}

	// 3. Test profile retrieval
	reqMe := httptest.NewRequest("GET", "/api/v1/me", nil)
	recMe := httptest.NewRecorder()

	// Authenticate the request manually via context
	ctx := reqMe.Context()
	ctx = middlewareWithContext(ctx, authRes.User.ID, authRes.User.SubscriptionTier)
	reqMe = reqMe.WithContext(ctx)

	h.GetMe(recMe, reqMe)

	if recMe.Code != http.StatusOK {
		t.Errorf("expected status 200 on /me, got %d", recMe.Code)
	}

	var profile private.UserDTO
	_ = json.Unmarshal(recMe.Body.Bytes(), &profile)
	if profile.ID != authRes.User.ID {
		t.Errorf("profile ID mismatch: expected %s, got %s", authRes.User.ID, profile.ID)
	}

	// 4. Test group creation
	groupBody := map[string]string{"groupName": "Test Group"}
	gBytes, _ := json.Marshal(groupBody)
	reqGroup := httptest.NewRequest("POST", "/api/v1/groups", bytes.NewBuffer(gBytes))
	reqGroup = reqGroup.WithContext(ctx)
	recGroup := httptest.NewRecorder()

	h.CreateGroup(recGroup, reqGroup)

	if recGroup.Code != http.StatusOK {
		t.Errorf("expected status 200 on create group, got %d. Body: %s", recGroup.Code, recGroup.Body.String())
	}

	// 5. Test one-group-per-user constraint: try to join or create again
	recGroup2 := httptest.NewRecorder()
	reqGroup2 := httptest.NewRequest("POST", "/api/v1/groups", bytes.NewBuffer(gBytes))
	reqGroup2 = reqGroup2.WithContext(ctx)

	h.CreateGroup(recGroup2, reqGroup2)

	if recGroup2.Code != http.StatusConflict {
		t.Errorf("expected conflict (409) on second group join/creation, got %d", recGroup2.Code)
	}
}

// Inline helper for context auth mimicking token verification
func middlewareWithContext(ctx context.Context, userID, tier string) context.Context {
	ctx = context.WithValue(ctx, middleware.UserIDKey, userID)
	ctx = context.WithValue(ctx, middleware.UserTierKey, tier)
	return ctx
}
