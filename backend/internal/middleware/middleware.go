package middleware

import (
	"context"
	"log/slog"
	"moneycircle/backend/internal/service"
	"net/http"
	"sync"
	"time"
)

type ContextKey string

const UserIDKey ContextKey = "userID"
const UserTierKey ContextKey = "userTier"

func Auth(authSvc *service.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "Unauthorized: missing token", http.StatusUnauthorized)
				return
			}

			parts := r.Header.Values("Authorization")
			if len(parts) == 0 {
				http.Error(w, "Unauthorized: missing token", http.StatusUnauthorized)
				return
			}

			// Format should be "Bearer <token>"
			tokenStr := ""
			for _, v := range parts {
				if len(v) > 7 && v[:7] == "Bearer " {
					tokenStr = v[7:]
					break
				}
			}

			if tokenStr == "" {
				// Try parsing raw auth header directly if not prefixed with Bearer
				if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
					tokenStr = authHeader[7:]
				} else {
					tokenStr = authHeader
				}
			}

			claims, err := authSvc.VerifyAccessToken(tokenStr)
			if err != nil {
				http.Error(w, "Unauthorized: "+err.Error(), http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, claims.Subject)
			ctx = context.WithValue(ctx, UserTierKey, claims.Tier)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	})
}

func GetUserID(ctx context.Context) string {
	val := ctx.Value(UserIDKey)
	if val == nil {
		return ""
	}
	return val.(string)
}

func GetUserTier(ctx context.Context) string {
	val := ctx.Value(UserTierKey)
	if val == nil {
		return ""
	}
	return val.(string)
}

// Logger middleware using slog
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		reqID := r.Header.Get("X-Request-ID")
		if reqID == "" {
			reqID = time.Now().Format("20060102150405.000") // simple request id fallback
		}

		wrapped := &responseWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(wrapped, r)

		slog.Info("HTTP Request",
			slog.String("request_id", reqID),
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.Int("status", wrapped.status),
			slog.Duration("latency", time.Since(start)),
		)
	})
}

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

// Panic recovery middleware
func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				slog.Error("Panic recovered", slog.Any("error", err))
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// CORS middleware
func CORS(allowedOrigin string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Key")
			w.Header().Set("Access-Control-Allow-Credentials", "true")

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	})
}

// Rate Limiter middleware
type RateLimiter struct {
	mu      sync.Mutex
	clients map[string][]time.Time
	rate    int           // limit count
	window  time.Duration // window size
}

func NewRateLimiter(rate int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		clients: make(map[string][]time.Time),
		rate:    rate,
		window:  window,
	}
}

func (rl *RateLimiter) Limit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Identify user by UserID or IP
		identifier := r.RemoteAddr
		uID := GetUserID(r.Context())
		if uID != "" {
			identifier = uID
		}

		rl.mu.Lock()
		now := time.Now()
		timestamps := rl.clients[identifier]

		// Filter timestamps within current window
		var active []time.Time
		for _, t := range timestamps {
			if now.Sub(t) < rl.window {
				active = append(active, t)
			}
		}

		if len(active) >= rl.rate {
			rl.mu.Unlock()
			http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
			return
		}

		// Record current timestamp
		active = append(active, now)
		rl.clients[identifier] = active
		rl.mu.Unlock()

		next.ServeHTTP(w, r)
	})
}
