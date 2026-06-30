package main

import (
	"context"
	"errors"
	"log"
	"log/slog"
	"moneycircle/internal/config"
	"moneycircle/internal/handler"
	"moneycircle/internal/middleware"
	"moneycircle/internal/repository"
	"moneycircle/internal/service"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
)

func main() {
	// 1. Initialize Logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	slog.Info("Starting MoneyCircle Go API Server...")

	// 2. Load Config
	cfg := config.Load()

	// 3. Connect DB
	db, err := repository.Connect(cfg.DatabaseURL)
	if err != nil {
		slog.Error("Database connection failed", slog.Any("error", err))
		os.Exit(1)
	}
	defer db.Close()
	slog.Info("Database connection established and migrations run successfully")

	// 4. Initialize Repository and Services
	repo := repository.New(db)

	// Dependency chain
	gamifySvc := service.NewGamificationService(repo)
	scoreSvc := service.NewScoreService(repo, gamifySvc)
	authSvc := service.NewAuthService(cfg, repo, scoreSvc)
	groupSvc := service.NewGroupService(repo)
	txSvc := service.NewTransactionService(repo, scoreSvc, gamifySvc)
	budgetSvc := service.NewBudgetService(repo, scoreSvc)
	debtSvc := service.NewDebtService(repo, scoreSvc)
	billingSvc := service.NewBillingService(repo)
	llmSvc := service.NewLLMService(cfg, billingSvc)

	// 5. Initialize Handlers
	h := handler.New(cfg, authSvc, groupSvc, txSvc, budgetSvc, debtSvc, scoreSvc, gamifySvc, llmSvc, billingSvc)

	// 6. Router Setup
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.Recover)
	r.Use(middleware.Logger)
	r.Use(middleware.CORS(cfg.CORSOrigin))

	// General health check
	r.Get("/health", h.Health)

	// API v1 routes
	r.Route("/api/v1", func(r chi.Router) {
		// Public Auth routes
		r.Post("/auth/google", h.LoginGoogle)
		r.Post("/auth/guest", h.LoginGuest)
		r.Post("/auth/refresh", h.Refresh)
		r.Post("/auth/logout", h.Logout)

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth(authSvc))

			// General rate limiting: 100 req/min
			generalLimiter := middleware.NewRateLimiter(100, 1*time.Minute)
			r.Use(generalLimiter.Limit)

			// User profiles
			r.Get("/me", h.GetMe)
			r.Put("/me", h.UpdateMe)
			r.Post("/auth/onboarding", h.CompleteOnboarding)

			// Groups
			r.Post("/groups", h.CreateGroup)
			r.Post("/groups/join", h.JoinGroup)
			r.Post("/groups/leave", h.LeaveGroup)
			r.Get("/groups/me", h.GetMyGroup)
			r.Delete("/groups/{id}/members/{userId}", h.RemoveGroupMember)
			r.Post("/groups/{id}/regenerate-invite", h.RegenerateInvite)

			// Leaderboard & Social Feed
			r.Get("/groups/{id}/leaderboard", h.GetLeaderboard)
			r.Get("/groups/{id}/feed", h.GetFeed)
			r.Post("/groups/{id}/feed/{eventId}/react", h.ReactFeedEvent)

			// Transactions PFM
			r.Get("/transactions", h.GetTransactions)
			r.Post("/transactions", h.CreateTransaction)
			r.Put("/transactions/{id}", h.UpdateTransaction)
			r.Delete("/transactions/{id}", h.DeleteTransaction)

			// Budget PFM
			r.Get("/budgets/current", h.GetBudget)
			r.Put("/budgets/current", h.UpdateBudget)

			// Debts PFM
			r.Get("/debts", h.GetDebts)
			r.Post("/debts", h.CreateDebt)
			r.Put("/debts/{id}", h.UpdateDebt)
			r.Delete("/debts/{id}", h.DeleteDebt)
			r.Post("/debts/{id}/payments", h.LogDebtPayment)

			// Scores
			r.Get("/score", h.GetScore)
			r.Get("/score/public", h.GetScorePublic)

			// Usage details
			r.Get("/usage", h.GetUsage)

			// Rate limited LLM routes: 10 req/min
			r.Group(func(r chi.Router) {
				llmLimiter := middleware.NewRateLimiter(10, 1*time.Minute)
				r.Use(llmLimiter.Limit)

				r.Post("/llm/ocr", h.OCRReceipt)
				r.Post("/llm/coach", h.GetCoach)
				r.Post("/llm/analyze", h.GetAnalysis)
			})
		})

		// Admin routes (Authentication verified inside handler via X-Admin-Key)
		r.Post("/admin/users/{id}/premium", h.AdminSetPremium)
	})

	// Start daily background rollover scheduler
	stopScheduler := startRolloverScheduler(gamifySvc)
	defer stopScheduler()

	// 7. Start HTTP Server with Graceful Shutdown
	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}

	go func() {
		slog.Info("Server listening", slog.String("port", cfg.Port))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("ListenAndServe failed", slog.Any("error", err))
			os.Exit(1)
		}
	}()

	// Graceful shutdown wiring
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down server gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("Server forced to shutdown", slog.Any("error", err))
	} else {
		slog.Info("Server stopped cleanly")
	}
}

// Simple background scheduler for daily streak and challenge rollovers at Bangkok midnight
func startRolloverScheduler(gamifySvc *service.GamificationService) func() {
	ctx, cancel := context.WithCancel(context.Background())
	ticker := time.NewTicker(30 * time.Second)

	loc, _ := time.LoadLocation("Asia/Bangkok")
	lastRunDay := time.Now().In(loc).Format("2006-01-02")

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				currentDay := time.Now().In(loc).Format("2006-01-02")
				if currentDay != lastRunDay {
					slog.Info("Bangkok Midnight Roll-Over triggered", slog.String("day", currentDay))
					
					// Reset streaks for users who failed to log yesterday
					if err := gamifySvc.RolloverStreaks(); err != nil {
						slog.Error("Streak rollover failed", slog.Any("error", err))
					}
					
					// Conclude ended challenges
					if err := gamifySvc.RolloverChallenges(); err != nil {
						slog.Error("Challenge rollover failed", slog.Any("error", err))
					}

					lastRunDay = currentDay
				}
			}
		}
	}()

	return func() {
		ticker.Stop()
		cancel()
	}
}
