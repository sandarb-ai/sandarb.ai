#!/usr/bin/env bash
#
# Start Sandarb: Next.js UI (port 3000) + FastAPI backend (port 8000).
# Postgres must be running (backend uses it). UI fetches from backend via NEXT_PUBLIC_API_URL.
#
# Usage: ./scripts/start-sandarb.sh
# Or:    npm run sandarb   (runs start_sandarb.py which runs npm run dev)
#
# Requires: Node 18+, Postgres (e.g. docker compose up -d postgres), Python 3 + uvicorn for backend.
#

set -e
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

# Node 18+
if ! command -v node &>/dev/null; then
  echo "Node.js is required. Install from https://nodejs.org (18+)."
  exit 1
fi
NODE_VER=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_VER" -lt 18 ]; then
  echo "Sandarb requires Node.js 18+. Current: $(node -v)"
  exit 1
fi

# Optional: create .env from .env.example
if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

# Require Postgres (backend uses it)
echo "Checking Postgres..."
if ! python scripts/check_postgres.py; then
  echo ""
  echo "Sandarb backend requires Postgres. Start it (e.g. docker compose up -d postgres) and run this script again."
  exit 1
fi

# Install dependencies if needed
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

# Free ports 3000 and 8000 if something is already listening
LISTEN_PIDS=$(lsof -i :3000 -i :8000 2>/dev/null | awk '/LISTEN/ {print $2}' | sort -u)
if [ -n "$LISTEN_PIDS" ]; then
  echo "Ports 3000/8000 in use. Stopping existing process(es): $LISTEN_PIDS"
  kill $LISTEN_PIDS 2>/dev/null || true
  sleep 2
  STILL=$(lsof -i :3000 -i :8000 2>/dev/null | awk '/LISTEN/ {print $2}' | sort -u)
  if [ -n "$STILL" ]; then
    echo "Could not free ports 3000/8000 (PIDs: $STILL). Stop them manually: kill $STILL"
    exit 1
  fi
  echo "Ports freed."
  echo ""
fi

# Optional: ensure Python + uvicorn for backend
if ! python -c "import uvicorn" 2>/dev/null; then
  echo "Backend requires Python with uvicorn. Install: pip install -r backend/requirements.txt"
  exit 1
fi

echo ""
echo "  Sandarb.ai — Governance for AI Agents"
echo "  --------------------------------------"
echo "  UI:      http://localhost:3000"
echo "  Backend: http://localhost:8000"
echo "  --------------------------------------"
echo "  Press Ctrl+C to stop."
echo ""

# Start both UI (Next.js) and backend API (FastAPI) via concurrently
exec npx concurrently -n ui,backend -c blue,green "npm run dev:ui" "npm run dev:backend"


