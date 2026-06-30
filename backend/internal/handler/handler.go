package handler

import (
	"encoding/json"
	"io"
	"moneycircle/internal/config"
	"moneycircle/internal/dto/private"
	"moneycircle/internal/middleware"
	"moneycircle/internal/service"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	cfg        *config.Config
	authSvc    *service.AuthService
	groupSvc   *service.GroupService
	txSvc      *service.TransactionService
	budgetSvc  *service.BudgetService
	debtSvc    *service.DebtService
	scoreSvc   *service.ScoreService
	gamifySvc  *service.GamificationService
	llmSvc     *service.LLMService
	billingSvc *service.BillingService
}

func New(
	cfg *config.Config,
	authSvc *service.AuthService,
	groupSvc *service.GroupService,
	txSvc *service.TransactionService,
	budgetSvc *service.BudgetService,
	debtSvc *service.DebtService,
	scoreSvc *service.ScoreService,
	gamifySvc *service.GamificationService,
	llmSvc *service.LLMService,
	billingSvc *service.BillingService,
) *Handler {
	return &Handler{
		cfg:        cfg,
		authSvc:    authSvc,
		groupSvc:   groupSvc,
		txSvc:      txSvc,
		budgetSvc:  budgetSvc,
		debtSvc:    debtSvc,
		scoreSvc:   scoreSvc,
		gamifySvc:  gamifySvc,
		llmSvc:     llmSvc,
		billingSvc: billingSvc,
	}
}

// Help method to send JSON responses
func (h *Handler) JSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func (h *Handler) Error(w http.ResponseWriter, status int, msg string) {
	h.JSON(w, status, map[string]string{"error": msg})
}

// Health Check
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	h.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// --- AUTH HANDLERS ---

func (h *Handler) LoginGoogle(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDToken string `json:"id_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		h.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	res, err := h.authSvc.LoginWithGoogle(body.IDToken)
	if err != nil {
		h.Error(w, http.StatusUnauthorized, err.Error())
		return
	}
	h.JSON(w, http.StatusOK, res)
}

func (h *Handler) LoginGuest(w http.ResponseWriter, r *http.Request) {
	var body struct {
		DisplayName string `json:"displayName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		h.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	res, err := h.authSvc.LoginGuest(body.DisplayName)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.JSON(w, http.StatusOK, res)
}

func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refreshToken"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		h.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	res, err := h.authSvc.RefreshSession(body.RefreshToken)
	if err != nil {
		h.Error(w, http.StatusUnauthorized, err.Error())
		return
	}
	h.JSON(w, http.StatusOK, res)
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refreshToken"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	if body.RefreshToken != "" {
		_ = h.authSvc.repo.DeleteRefreshToken(body.RefreshToken)
	}
	h.JSON(w, http.StatusOK, map[string]string{"message": "Logged out"})
}

func (h *Handler) GetMe(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	user, err := h.authSvc.repo.GetUserByID(uID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if user == nil {
		h.Error(w, http.StatusNotFound, "User not found")
		return
	}
	h.JSON(w, http.StatusOK, h.authSvc.MapUserToDTO(user))
}

func (h *Handler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	var in private.UserDTO
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		h.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user, err := h.authSvc.repo.GetUserByID(uID)
	if err != nil || user == nil {
		h.Error(w, http.StatusNotFound, "User not found")
		return
	}

	if in.DisplayName != "" {
		user.DisplayName = in.DisplayName
	}
	if in.AvatarURL != "" {
		user.AvatarURL = in.AvatarURL
	}
	if in.EmergencyFundAmount >= 0 {
		user.EmergencyFundAmount = in.EmergencyFundAmount
	}
	if in.SubscriptionTier != "" {
		user.SubscriptionTier = in.SubscriptionTier
	}
	// Note: onboardingComplete is set on group creation/joining, or can be set manually
	if in.OnboardingComplete {
		user.OnboardingComplete = true
	}

	if err := h.authSvc.repo.UpdateUser(user); err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Recalculate score on emergency fund change
	_, _ = h.scoreSvc.Recalculate(uID)

	h.JSON(w, http.StatusOK, h.authSvc.MapUserToDTO(user))
}

// --- GROUP HANDLERS ---

func (h *Handler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	var body struct {
		Name string `json:"groupName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		h.Error(w, http.StatusBadRequest, "Invalid body")
		return
	}

	g, err := h.groupSvc.CreateGroup(uID, body.Name)
	if err != nil {
		if err.Error() == "ALREADY_IN_GROUP" {
			h.Error(w, http.StatusConflict, "User is already member of a group")
			return
		}
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.JSON(w, http.StatusOK, g)
}

func (h *Handler) JoinGroup(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	var body struct {
		InviteCode string `json:"inviteCode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		h.Error(w, http.StatusBadRequest, "Invalid body")
		return
	}

	g, err := h.groupSvc.JoinGroup(uID, body.InviteCode)
	if err != nil {
		if err.Error() == "ALREADY_IN_GROUP" {
			h.Error(w, http.StatusConflict, "User is already member of a group")
			return
		}
		if err.Error() == "INVALID_INVITE_CODE" {
			h.Error(w, http.StatusNotFound, "Invite code not found")
			return
		}
		if err.Error() == "GROUP_FULL" {
			h.Error(w, http.StatusBadRequest, "Group limit reached")
			return
		}
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.JSON(w, http.StatusOK, g)
}

func (h *Handler) LeaveGroup(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	err := h.groupSvc.LeaveGroup(uID)
	if err != nil {
		h.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	h.JSON(w, http.StatusOK, map[string]string{"message": "Left group"})
}

func (h *Handler) GetMyGroup(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	g, err := h.authSvc.repo.GetGroupByUserID(uID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if g == nil {
		h.JSON(w, http.StatusOK, nil)
		return
	}
	h.JSON(w, http.StatusOK, g)
}

func (h *Handler) CompleteOnboarding(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	var body struct {
		Action     string `json:"action"` // create or join
		GroupName  string `json:"groupName"`
		InviteCode string `json:"inviteCode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		h.Error(w, http.StatusBadRequest, "Invalid request")
		return
	}

	var g *domain.Group
	var err error

	if body.Action == "create" {
		g, err = h.groupSvc.CreateGroup(uID, body.GroupName)
	} else if body.Action == "join" {
		g, err = h.groupSvc.JoinGroup(uID, body.InviteCode)
	} else {
		// Just acknowledge without joining
		user, _ := h.authSvc.repo.GetUserByID(uID)
		if user != nil {
			user.OnboardingComplete = true
			_ = h.authSvc.repo.UpdateUser(user)
			h.JSON(w, http.StatusOK, h.authSvc.MapUserToDTO(user))
			return
		}
	}

	if err != nil {
		h.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	user, err := h.authSvc.repo.GetUserByID(uID)
	if err != nil || user == nil {
		h.Error(w, http.StatusNotFound, "User not found")
		return
	}

	user.OnboardingComplete = true
	_ = h.authSvc.repo.UpdateUser(user)

	h.JSON(w, http.StatusOK, h.authSvc.MapUserToDTO(user))
	_ = g // prevent unused var warning
}

func (h *Handler) RemoveGroupMember(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	groupID := chi.URLParam(r, "id")
	userIDToRemove := chi.URLParam(r, "userId")

	err := h.groupSvc.RemoveMember(ownerID, groupID, userIDToRemove)
	if err != nil {
		h.Error(w, http.StatusForbidden, err.Error())
		return
	}
	h.JSON(w, http.StatusOK, map[string]string{"message": "Member removed"})
}

func (h *Handler) RegenerateInvite(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	groupID := chi.URLParam(r, "id")

	code, err := h.groupSvc.RegenerateInviteCode(ownerID, groupID)
	if err != nil {
		h.Error(w, http.StatusForbidden, err.Error())
		return
	}
	h.JSON(w, http.StatusOK, map[string]string{"inviteCode": code})
}

// --- TRANSACTION HANDLERS ---

func (h *Handler) GetTransactions(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	cat := r.URL.Query().Get("category")
	var categoryPtr *string
	if cat != "" {
		categoryPtr = &cat
	}

	start := r.URL.Query().Get("startDate")
	var startPtr *string
	if start != "" {
		startPtr = &start
	}

	end := r.URL.Query().Get("endDate")
	var endPtr *string
	if end != "" {
		endPtr = &end
	}

	list, err := h.txSvc.GetTransactions(uID, categoryPtr, startPtr, endPtr)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.JSON(w, http.StatusOK, list)
}

func (h *Handler) CreateTransaction(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	var in service.CreateTxInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		h.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	tx, score, err := h.txSvc.CreateTransaction(uID, in)
	if err != nil {
		h.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	h.JSON(w, http.StatusOK, map[string]interface{}{
		"transaction": tx,
		"score":       score,
	})
}

func (h *Handler) UpdateTransaction(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	txID := chi.URLParam(r, "id")
	var in service.CreateTxInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		h.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	tx, score, err := h.txSvc.UpdateTransaction(uID, txID, in)
	if err != nil {
		h.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	h.JSON(w, http.StatusOK, map[string]interface{}{
		"transaction": tx,
		"score":       score,
	})
}

func (h *Handler) DeleteTransaction(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	txID := chi.URLParam(r, "id")

	score, err := h.txSvc.DeleteTransaction(uID, txID)
	if err != nil {
		h.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	h.JSON(w, http.StatusOK, map[string]interface{}{
		"score": score,
	})
}

// --- BUDGET HANDLERS ---

func (h *Handler) GetBudget(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	list, err := h.budgetSvc.GetBudget(uID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.JSON(w, http.StatusOK, list)
}

func (h *Handler) UpdateBudget(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	var in []private.BudgetCategoryDTO
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		h.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	budget, score, err := h.budgetSvc.UpdateBudget(uID, in)
	if err != nil {
		h.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	h.JSON(w, http.StatusOK, map[string]interface{}{
		"budget": budget,
		"score":  score,
	})
}

// --- DEBT HANDLERS ---

func (h *Handler) GetDebts(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	list, err := h.debtSvc.GetDebts(uID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.JSON(w, http.StatusOK, list)
}

func (h *Handler) CreateDebt(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	var in private.DebtDTO
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		h.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	d, score, err := h.debtSvc.CreateDebt(uID, in)
	if err != nil {
		h.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	h.JSON(w, http.StatusOK, map[string]interface{}{
		"debt":  d,
		"score": score,
	})
}

func (h *Handler) UpdateDebt(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	debtID := chi.URLParam(r, "id")
	var in private.DebtDTO
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		h.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	d, score, err := h.debtSvc.UpdateDebt(uID, debtID, in)
	if err != nil {
		h.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	h.JSON(w, http.StatusOK, map[string]interface{}{
		"debt":  d,
		"score": score,
	})
}

func (h *Handler) DeleteDebt(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	debtID := chi.URLParam(r, "id")

	score, err := h.debtSvc.DeleteDebt(uID, debtID)
	if err != nil {
		h.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	h.JSON(w, http.StatusOK, map[string]interface{}{
		"score": score,
	})
}

func (h *Handler) LogDebtPayment(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	debtID := chi.URLParam(r, "id")
	var in struct {
		Amount float64 `json:"amount"`
		PaidAt string  `json:"paidAt"` // YYYY-MM-DD
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		h.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	paidTime := time.Now()
	if in.PaidAt != "" {
		if t, err := time.Parse("2006-01-02", in.PaidAt); err == nil {
			paidTime = t
		}
	}

	d, score, err := h.debtSvc.LogPayment(uID, debtID, in.Amount, paidTime)
	if err != nil {
		h.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	h.JSON(w, http.StatusOK, map[string]interface{}{
		"debt":  d,
		"score": score,
	})
}

// --- SCORE HANDLERS ---

func (h *Handler) GetScore(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	scoreVal, err := h.scoreSvc.Recalculate(uID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if scoreVal == nil {
		h.Error(w, http.StatusNotFound, "No score")
		return
	}

	// Map ScoreResult to PrivateScoreDTO
	h.JSON(w, http.StatusOK, private.PrivateScoreDTO{
		TotalScore: scoreVal.TotalScore,
		Tier:       scoreVal.Tier,
		TierTh:     scoreVal.TierTh,
		Dimensions: scoreVal.Dimensions,
	})
}

func (h *Handler) GetScorePublic(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	scoreVal, err := h.scoreSvc.Recalculate(uID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	badges, _ := h.authSvc.repo.GetUserBadges(uID)
	user, _ := h.authSvc.repo.GetUserByID(uID)
	streak := 0
	if user != nil {
		streak = user.LoggingStreakDays
	}

	h.JSON(w, http.StatusOK, map[string]interface{}{
		"score":      scoreVal.TotalScore,
		"tier":       scoreVal.Tier,
		"tierTh":     scoreVal.TierTh,
		"badges":     badges,
		"streakDays": streak,
	})
}

// --- SOCIAL / LEADERBOARD & FEED HANDLERS ---

func (h *Handler) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	groupID := chi.URLParam(r, "id")

	list, err := h.groupSvc.GetLeaderboard(uID, groupID)
	if err != nil {
		h.Error(w, http.StatusForbidden, err.Error())
		return
	}
	h.JSON(w, http.StatusOK, list)
}

func (h *Handler) GetFeed(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	groupID := chi.URLParam(r, "id")

	// Membership check
	isMember, err := h.authSvc.repo.IsGroupMember(groupID, uID)
	if err != nil || !isMember {
		h.Error(w, http.StatusForbidden, "Unauthorized: not group member")
		return
	}

	feed, err := h.authSvc.repo.GetFeed(groupID, 50)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Fetch reactions for group
	reactions, _ := h.authSvc.repo.GetFeedReactionsForGroup(groupID)

	type FeedItem struct {
		ID          string                 `json:"id"`
		UserID      string                 `json:"userId"`
		DisplayName string                 `json:"displayName"`
		EventType   string                 `json:"eventType"`
		Payload     map[string]interface{} `json:"payload"`
		CreatedAt   string                 `json:"createdAt"`
		Reactions   map[string]int         `json:"reactions"`
	}

	var list []FeedItem
	for _, f := range feed {
		var payload map[string]interface{}
		_ = json.Unmarshal([]byte(f.PayloadJSON), &payload)

		// Aggregate reactions counts
		reactsCount := make(map[string]int)
		for _, rx := range reactions[f.ID] {
			reactsCount[rx.Reaction]++
		}

		list = append(list, FeedItem{
			ID:          f.ID,
			UserID:      f.UserID,
			DisplayName: f.DisplayName,
			EventType:   f.EventType,
			Payload:     payload,
			CreatedAt:   f.CreatedAt.Format(time.RFC3339),
			Reactions:   reactsCount,
		})
	}

	h.JSON(w, http.StatusOK, list)
}

func (h *Handler) ReactFeedEvent(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	groupID := chi.URLParam(r, "id")
	eventID := chi.URLParam(r, "eventId")

	// Membership check
	isMember, err := h.authSvc.repo.IsGroupMember(groupID, uID)
	if err != nil || !isMember {
		h.Error(w, http.StatusForbidden, "Unauthorized: not group member")
		return
	}

	var body struct {
		Reaction string `json:"reaction"` // emoji
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Reaction == "" {
		h.Error(w, http.StatusBadRequest, "Invalid reaction payload")
		return
	}

	if err := h.authSvc.repo.AddFeedReaction(eventID, uID, body.Reaction); err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.JSON(w, http.StatusOK, map[string]string{"message": "Reaction added"})
}

// --- LLM AI HANDLERS ---

func (h *Handler) OCRReceipt(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())

	// Read file from multipart
	file, fileHeader, err := r.FormFile("image")
	if err != nil {
		h.Error(w, http.StatusBadRequest, "Missing image file")
		return
	}
	defer file.Close()

	imgBytes, err := io.ReadAll(file)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "Failed to read image bytes")
		return
	}

	mimeType := fileHeader.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "image/jpeg"
	}

	res, err := h.llmSvc.OCRReceipt(uID, imgBytes, mimeType)
	if err != nil {
		if err.Error() == "QUOTA_EXCEEDED" {
			h.JSON(w, http.StatusPaymentRequired, map[string]string{
				"error": "OCR quota exceeded",
				"code":  "QUOTA_EXCEEDED",
			})
			return
		}
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.JSON(w, http.StatusOK, res)
}

func (h *Handler) GetCoach(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())

	// Need score details to feed to coach prompt
	scoreVal, err := h.scoreSvc.Recalculate(uID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	response, err := h.llmSvc.GenerateCoach(uID, scoreVal.TotalScore, scoreVal.Tier, scoreVal.TierTh, scoreVal.Dimensions)
	if err != nil {
		if err.Error() == "PREMIUM_REQUIRED" {
			h.Error(w, http.StatusForbidden, "Premium subscription required")
			return
		}
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.JSON(w, http.StatusOK, map[string]string{"response": response})
}

func (h *Handler) GetAnalysis(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())

	scoreVal, err := h.scoreSvc.Recalculate(uID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	txs, err := h.authSvc.repo.GetTransactionsByUserID(uID, nil, nil, nil)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	debts, err := h.authSvc.repo.GetDebtsByUserID(uID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	response, err := h.llmSvc.GenerateAnalysis(uID, scoreVal.TotalScore, scoreVal.Tier, txs, debts)
	if err != nil {
		if err.Error() == "PREMIUM_REQUIRED" {
			h.Error(w, http.StatusForbidden, "Premium subscription required")
			return
		}
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.JSON(w, http.StatusOK, map[string]string{"response": response})
}

// --- BILLING USAGE HANDLERS ---

func (h *Handler) GetUsage(w http.ResponseWriter, r *http.Request) {
	uID := middleware.GetUserID(r.Context())
	usage, err := h.billingSvc.GetUsage(uID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.JSON(w, http.StatusOK, usage)
}

// --- ADMIN HANDLERS ---

func (h *Handler) AdminSetPremium(w http.ResponseWriter, r *http.Request) {
	key := r.Header.Get("X-Admin-Key")
	if key != h.cfg.AdminAPIKey {
		h.Error(w, http.StatusUnauthorized, "Invalid X-Admin-Key")
		return
	}

	targetUserID := chi.URLParam(r, "id")
	var body struct {
		Premium bool `json:"premium"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		body.Premium = true // default to promoting to premium
	}

	err := h.billingSvc.SetUserPremium(targetUserID, body.Premium)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.JSON(w, http.StatusOK, map[string]interface{}{
		"userId":  targetUserID,
		"premium": body.Premium,
		"message": "User tier updated successfully",
	})
}
