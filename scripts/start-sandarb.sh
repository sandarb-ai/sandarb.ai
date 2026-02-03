#!/usr/bin/env bash
#
# 1. BRING UP SANDARB — Platform only (no agents). Always uses Postgres.
#
# Sandarb.ai = the product/platform. This script starts the app so you can use
# the UI, API, and docs. Goals, mission, and features are in README.md and AGENTS.md.
#
# Usage: ./scripts/start-sandarb.sh
#
# Requires: Postgres running (e.g. docker compose up -d postgres). If not running, script exits with a message.
# To start the Sandarb.ai team of Apsaras after the platform is up: ./scripts/start-apsara-team.sh
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

# Require Postgres: check connectivity (uses .env DATABASE_URL or default local docker-compose URL)
echo "Checking Postgres..."
if ! node scripts/check-postgres.js; then
  echo ""
  echo "Sandarb.ai requires Postgres. Start it (e.g. docker compose up -d postgres) and run this script again."
  exit 1
fi

# Install dependencies if needed (required for db:full-reset-pg)
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

# Full reset + seed so sample data is present on boot
echo "Running full reset and seed (sample data)..."
npm run db:full-reset-pg
echo ""

# Optional: setup Ollama + Qwen 2.5 for Apsara team (local LLM)
if command -v ollama &>/dev/null; then
  OLLAMA_OK=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:11434/api/tags" 2>/dev/null || true)
  if [ "$OLLAMA_OK" = "200" ]; then
    echo "Setting up Ollama (for Apsara team)..."
    if "$ROOT/scripts/setup-ollama.sh"; then
      echo ""
    else
      echo "  (Ollama setup had warnings; Sandarb will still start. Run ./scripts/setup-ollama.sh manually if needed.)"
      echo ""
    fi
  else
    echo "Ollama installed but not running. Start with: ollama serve. Then run ./scripts/setup-ollama.sh for Apsara team."
    echo ""
  fi
else
  echo "Ollama not found. For Apsara team later: install from https://ollama.com then ./scripts/setup-ollama.sh"
  echo ""
fi

# Free ports 4000 and 4001 if something is already listening (e.g. previous dev server)
LISTEN_PIDS=$(lsof -i :4000 -i :4001 2>/dev/null | awk '/LISTEN/ {print $2}' | sort -u)
if [ -n "$LISTEN_PIDS" ]; then
  echo "Ports 4000/4001 in use. Stopping existing process(es): $LISTEN_PIDS"
  kill $LISTEN_PIDS 2>/dev/null || true
  sleep 2
  # Recheck; if still in use, exit with message
  STILL=$(lsof -i :4000 -i :4001 2>/dev/null | awk '/LISTEN/ {print $2}' | sort -u)
  if [ -n "$STILL" ]; then
    echo "Could not free ports 4000/4001 (PIDs: $STILL). Stop them manually: kill $STILL"
    exit 1
  fi
  echo "Ports freed."
  echo ""
fi

echo ""
echo "  Sandarb.ai — Governance for AI Agents"
echo "  --------------------------------------"
echo "  UI:  http://localhost:4000"
echo "  API: http://localhost:4001"
echo "  --------------------------------------"
echo "  To start the Apsara team: ./scripts/start-apsara-team.sh"
echo "  Press Ctrl+C to stop."
echo ""

exec npm run dev


