# MoneyCircle

**Accountability with friends — score your habits, not your wealth.**

UI-first prototype (mock data, no backend). See [prd.md](prd.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [TASK.md](TASK.md) for full product specs.

## Quick start

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in a mobile browser or DevTools device mode.

## Demo script (5 minutes)

1. **Login** — Choose **Nune** (or Boss / guest name).
2. **Onboarding** — Read privacy explainer; check acknowledge; join group with code `DEMO01`.
3. **Dashboard** — See Financial Health Score, tier, monthly summary. Add a quick expense (e.g. ฿150 Food) and watch score update.
4. **Transactions** — Browse seed data; add or edit entries.
5. **Budget** — View category adherence bars; edit limits.
6. **Scan** — Pick any image; mock OCR returns 7-Eleven ฿89; confirm save. Try 6 scans on free tier to hit quota.
7. **Circle** — Leaderboard shows friends ranked by **score only** (no balances). Feed shows badge/score events.
8. **Settings** — Toggle Premium for unlimited OCR; reset demo to start over.

## Architecture (prototype)

- **Frontend only:** Vue 3 + Pinia + Vue Router + Tailwind 4
- **Mock API:** `frontend/src/api/mock/` with localStorage persistence
- **Score engine:** `frontend/src/services/scoreEngine.js` (mirrors PRD §6)
- **Privacy:** Circle/leaderboard uses social-safe DTOs — no monetary fields

## Privacy QA

Leaderboard members expose only: `rank`, `displayName`, `score`, `tier`, `tierTh`, `badges`, `streakDays`.  
No `amount`, `balance`, `income`, or transaction data appears in social views.

## Go REST API Backend

A fully-featured backend built in Go with standard routing, SQLite/PostgreSQL support, automatic migrations, rate limiting, and JWT session handling.

### Quick Start (Local Development)

Ensure Go 1.21+ is installed.

1. **Configure Environment Variables**:
   Create a local configuration file or set environment variables:
   ```powershell
   $env:DATABASE_URL="sqlite://moneycircle.db"
   $env:JWT_SECRET="super-secret-key-change-in-production"
   $env:PORT="8080"
   $env:CORS_ORIGIN="http://localhost:5173"
   ```

2. **Run the Server**:
   ```bash
   cd backend
   go run cmd/server/main.go
   ```

3. **Run Backend Tests**:
   ```bash
   cd backend
   go test ./...
   ```

### Configuration Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | SQLite (`sqlite://file.db` or `sqlite://:memory:`) or PostgreSQL (`postgres://user:pass@host:port/db?sslmode=disable`) | `sqlite://moneycircle.db` |
| `PORT` | Listening port for Go REST API | `8080` |
| `JWT_SECRET` | Secret key for signing session tokens | `moneycircle-secret-key-must-be-long-and-secure` |
| `ADMIN_API_KEY` | Header authorization key (`X-Admin-Key`) to promote users to premium | `admin-key-temp-change-me` |
| `CORS_ORIGIN` | Allowed origin for frontend app connections | `http://localhost:5173` |
| `OPENAI_API_KEY` | API Key for OpenAI-compatible OCR and Coach reports | *(Empty fallback)* |
| `OPENAI_API_URL` | Endpoint url for OpenAI-compatible completions | `https://api.openai.com/v1` |
| `LLM_MODEL` | Large Language Model descriptor for prompt completions | `google/gemma-4-31b-it` |

### Production Docker Build

Build the optimized multi-stage release image (< 50MB):

```bash
docker build -t moneycircle-backend ./backend
docker run -p 8080:8080 -e DATABASE_URL="sqlite://moneycircle.db" moneycircle-backend
```
