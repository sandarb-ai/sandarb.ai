#!/usr/bin/env bash
# Driver script to bring up Sandarb (UI on 4000, API on 4001).
# Usage: ./scripts/start-sandarb.sh   OR   bash scripts/start-sandarb.sh

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

# If DATABASE_URL is set, full reset + seed so sample data is present on boot
if [ -n "$DATABASE_URL" ]; then
  echo "Postgres detected: running full reset and seed (sample data)..."
  npm run db:full-reset-pg || true
  echo ""
fi

# Install dependencies if needed
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

echo ""
echo "  Sandarb - Governance for AI agents"
echo "  ---------------------------------"
echo "  UI:  http://localhost:4000"
echo "  API: http://localhost:4001"
echo "  ---------------------------------"
echo "  Press Ctrl+C to stop."
echo ""

exec npm run dev


