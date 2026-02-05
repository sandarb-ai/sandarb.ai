# Sandarb FastAPI Backend

Backend for the Sandarb AI Governance Platform. Runs alongside the Next.js frontend and shares the same Postgres database.

## Setup

```bash
# From repo root
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Set `DATABASE_URL` in the repo root `.env` (same as Next.js). The backend loads it from there.

## Run

```bash
# From repo root (so .env is found)
cd /path/to/sandarb.ai
uvicorn backend.main:app --reload --port 8000
```

- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/health
- Agents: http://localhost:8000/api/agents

## Routes (migrated from Next.js)

| Path | Methods | Description |
|------|---------|-------------|
| `/api/health` | GET | Health check (DB + counts) |
| `/api/agents` | GET, POST | List/create agents |
| `/api/agents/{id}` | GET, PATCH, DELETE | Get/update/delete agent |
| `/api/agents/{id}/approve` | POST | Approve agent |
| `/api/agents/{id}/reject` | POST | Reject agent |

More routes (contexts, prompts, MCP, A2A, etc.) can be added incrementally; see `docs/HYBRID_ARCHITECTURE_ANALYSIS.md`.

## Hybrid mode (Next.js + FastAPI)

1. Start Postgres (e.g. `docker compose up -d postgres`).
2. Start FastAPI: `uvicorn backend.main:app --reload --port 8000`.
3. In `.env` set `BACKEND_URL=http://localhost:8000`.
4. Start Next.js: `npm run dev`. Next.js will proxy `/api/health` and `/api/agents/*` to the backend when `BACKEND_URL` is set; other routes still use the Next.js API.
