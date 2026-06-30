package config

import (
	"os"
)

type Config struct {
	DatabaseURL    string
	JWTSecret      string
	GoogleClientID string
	CORSOrigin     string
	LLMBaseURL     string
	LLMAPIKey      string
	LLMModel       string
	AdminAPIKey    string
	Port           string
}

func Load() *Config {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "sqlite://moneycircle.db"
	}

	jwtSec := os.Getenv("JWT_SECRET")
	if jwtSec == "" {
		jwtSec = "dev_secret_key_1234567890_change_me_please"
	}

	googleClientID := os.Getenv("GOOGLE_CLIENT_ID")
	// If empty, we can mock in local envs

	corsOrig := os.Getenv("CORS_ORIGIN")
	if corsOrig == "" {
		corsOrig = "http://localhost:5173" // Default Vue dev port
	}

	llmBase := os.Getenv("LLM_BASE_URL")
	if llmBase == "" {
		llmBase = "https://api.openai.com/v1" // Fallback placeholder
	}

	llmKey := os.Getenv("LLM_API_KEY")
	// LLM API Key can be empty for mock LLM flow

	llmModel := os.Getenv("LLM_MODEL")
	if llmModel == "" {
		llmModel = "google/gemma-4-31b-it"
	}

	adminKey := os.Getenv("ADMIN_API_KEY")
	if adminKey == "" {
		adminKey = "admin_secret_key_12345"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	return &Config{
		DatabaseURL:    dbURL,
		JWTSecret:      jwtSec,
		GoogleClientID: googleClientID,
		CORSOrigin:     corsOrig,
		LLMBaseURL:     llmBase,
		LLMAPIKey:      llmKey,
		LLMModel:       llmModel,
		AdminAPIKey:    adminKey,
		Port:           port,
	}
}
