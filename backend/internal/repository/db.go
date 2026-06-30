package repository

import (
	"database/sql"
	"fmt"
	"log"
	"moneycircle/migrations"
	"path/filepath"
	"sort"
	"strings"

	_ "github.com/lib/pq"
	_ "modernc.org/sqlite"
)

func Connect(dbURL string) (*sql.DB, error) {
	var driver, connStr string

	if strings.HasPrefix(dbURL, "postgres://") || strings.HasPrefix(dbURL, "postgresql://") {
		driver = "postgres"
		connStr = dbURL
	} else {
		driver = "sqlite"
		// Parse sqlite://path to path
		path := strings.TrimPrefix(dbURL, "sqlite://")
		if path == "" {
			path = "moneycircle.db"
		}
		connStr = path
	}

	db, err := sql.Open(driver, connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open db: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping db: %w", err)
	}

	if err := RunMigrations(db); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return db, nil
}

func RunMigrations(db *sql.DB) error {
	// Create migration tracking table if not exists
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY);`)
	if err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	// Read embedded migrations
	entries, err := migrations.FS.ReadDir(".")
	if err != nil {
		return fmt.Errorf("failed to read migrations directory: %w", err)
	}

	var files []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			files = append(files, entry.Name())
		}
	}
	sort.Strings(files)

	for _, file := range files {
		var exists bool
		err := db.QueryRow(`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)`, file).Scan(&exists)
		if err != nil {
			return fmt.Errorf("failed to check migration state for %s: %w", file, err)
		}

		if exists {
			continue
		}

		log.Printf("Applying database migration: %s", file)
		content, err := migrations.FS.ReadFile(file)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", file, err)
		}

		// Execute migration
		// Note: we can execute the whole script together.
		// For Postgres and SQLite, executing multiple queries separated by semicolons in one db.Exec usually works,
		// but standard practice is to run it. Let's run the whole string.
		sqlText := string(content)
		if _, err := db.Exec(sqlText); err != nil {
			return fmt.Errorf("migration %s failed: %w. SQL text: %s", file, err, sqlText)
		}

		_, err = db.Exec(`INSERT INTO schema_migrations (version) VALUES ($1)`, file)
		if err != nil {
			return fmt.Errorf("failed to record migration completion for %s: %w", file, err)
		}
	}

	return nil
}

// Transaction Helper
func WithTx(db *sql.DB, fn func(*sql.Tx) error) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p) // re-throw panic after rollback
		}
	}()

	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit()
}
