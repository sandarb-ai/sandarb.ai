# Sandarb.ai — Quick Start (Local Development)

Get Sandarb.ai running locally in a few steps. For full API and integration details, see [developer-guide.md](./developer-guide.md).

---

## Prerequisites

| Requirement | Version / Notes |
|-------------|-----------------|
| **Node.js** | 18+ ([nodejs.org](https://nodejs.org)) |
| **PostgreSQL** | Required. Easiest: Docker (see below). |
| **Git** | To clone the repo |

---

## 1. Clone and install

```bash
git clone https://github.com/openint-ai/sandarb.ai.git
cd sandarb.ai
npm install
```

---

## 2. Start Postgres

Sandarb requires Postgres. Easiest with Docker:

```bash
docker compose up -d postgres
```

Default URL (used if you don’t set `DATABASE_URL`):

- `postgresql://postgres:sandarb@localhost:5432/sandarb`

To use another Postgres instance, set `DATABASE_URL` in `.env` (see step 3).

---

## 3. Environment

```bash
# Optional: copy example env (creates .env if missing)
cp .env.example .env
```

Important variables:

| Variable | Purpose |
|----------|--------|
| `DATABASE_URL` | Postgres URL. Default: `postgresql://postgres:sandarb@localhost:5432/sandarb` |
| `NEXT_PUBLIC_API_URL` | Backend URL. Default: `http://localhost:8000` (see `.env.example`) |

You can leave `.env` as-is for local dev; `start-sandarb.sh` uses the default Postgres URL if `DATABASE_URL` is unset.

---

## 4. Start Sandarb

One command brings up the app with sample data:

```bash
./scripts/start-sandarb.sh
```

This script:

- Checks Node 18+
- Creates `.env` from `.env.example` if missing
- **Checks Postgres** (exits with a clear message if not running)
- Frees ports 3000 and 8000 if in use
- Starts UI and backend with `npm run dev`

When it’s up:

| What | URL |
|------|-----|
| **UI** | http://localhost:3000 |
| **Backend** | http://localhost:8000 |

Use the UI for dashboard, prompts, contexts, agents, and Agent Pulse (`/agent-pulse`).

**Stop:** `Ctrl+C` in the terminal.

---

## Quick reference

| Goal | Command |
|------|--------|
| Start platform (UI + backend) | `./scripts/start-sandarb.sh` or `./scripts/dev.sh` |
| Start Postgres only | `docker compose up -d postgres` |
| Check Postgres | `./scripts/check_postgres.sh` or `python scripts/check_postgres.py` |
| Reset DB + seed | `./scripts/full_reset_pg_db.sh local` or `npm run db:full-reset-pg` |
| Load DB (local) | `./scripts/load_db.sh local` or `npm run db:load:local` |
| Load DB (GCP) | `./scripts/load_db.sh gcp` (set `CLOUD_SQL_DATABASE_URL` in .env) |
| Dev (manual) | `npm run dev` (UI on 3000, backend on 8000) |

**Driver scripts** (from repo root): `./scripts/dev.sh`, `./scripts/load_db.sh [local\|gcp]`, `./scripts/check_postgres.sh`, `./scripts/full_reset_pg_db.sh [local\|gcp]`.

---

## Troubleshooting

### "Postgres is not running or unreachable"

- Start Postgres: `docker compose up -d postgres`
- If using another host/port, set `DATABASE_URL` in `.env` and run `python scripts/check_postgres.py` to verify.

### "Ports 3000/8000 in use"

- `start-sandarb.sh` tries to free them. If it can’t, stop the process using the port, e.g. `lsof -i :3000` then `kill <PID>`.

### Need a clean database

```bash
npm run db:full-reset-pg
```

Then restart the app if it’s already running.

---

## Next steps

- **In-app docs:** http://localhost:3000/docs (when the app is running)
- **Developer guide:** [developer-guide.md](./developer-guide.md) — API, A2A, inject, templates, env vars
