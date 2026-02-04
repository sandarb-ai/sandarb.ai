#!/usr/bin/env bash
# Seed Cloud SQL from your machine (full reset + init + seed).
# Usage: ./scripts/seed-cloud-sql.sh [DATABASE_URL]
#   If DATABASE_URL is omitted, uses CLOUD_SQL_DATABASE_URL or DATABASE_URL from .env.
# Prerequisites: Node, .env with CLOUD_SQL_DATABASE_URL (or pass URL as first arg).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load .env (read-only)
if [[ -f "$REPO_ROOT/.env" ]]; then
  while IFS= read -r line; do
    [[ "$line" =~ ^#.*$ || -z "${line// /}" ]] && continue
    if [[ "$line" == DATABASE_URL=* ]]; then
      v="${line#DATABASE_URL=}"; export DATABASE_URL="${v%\"}"; export DATABASE_URL="${DATABASE_URL#\"}"
    fi
    if [[ "$line" == CLOUD_SQL_DATABASE_URL=* ]]; then
      v="${line#CLOUD_SQL_DATABASE_URL=}"; export CLOUD_SQL_DATABASE_URL="${v%\"}"; export CLOUD_SQL_DATABASE_URL="${CLOUD_SQL_DATABASE_URL#\"}"
    fi
  done < "$REPO_ROOT/.env"
fi

# URL to use: explicit arg > CLOUD_SQL_DATABASE_URL > DATABASE_URL
if [[ -n "${1:-}" ]]; then
  SEED_URL="$1"
else
  SEED_URL="${CLOUD_SQL_DATABASE_URL:-$DATABASE_URL}"
fi

if [[ -z "$SEED_URL" ]]; then
  echo "Error: No database URL for Cloud SQL."
  echo "  Set CLOUD_SQL_DATABASE_URL (or DATABASE_URL) in .env, or pass the URL as the first argument:"
  echo "  ./scripts/seed-cloud-sql.sh 'postgresql://USER:PASS@HOST:5432/DB'"
  exit 1
fi

if [[ "$SEED_URL" == *"localhost"* || "$SEED_URL" == *"127.0.0.1"* ]]; then
  echo "Error: URL looks like localhost. This script is for seeding Cloud SQL from your machine."
  echo "  Use CLOUD_SQL_DATABASE_URL in .env (or pass the Cloud SQL URL as the first argument)."
  exit 1
fi

echo "Seeding Cloud SQL (full reset + init + seed)..."
(cd "$REPO_ROOT" && DATABASE_URL="$SEED_URL" node scripts/full-reset-postgres.js)
echo "Done."
