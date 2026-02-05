#!/usr/bin/env bash
#
# Load demo data once: init Postgres schema (if needed) and load data/sandarb.sql.
# Generate data first with: ./scripts/generate_sandarb_data.sh
# If you see "column lob_tag does not exist", regenerate: the schema uses org_id now.
#
# Usage:
#   ./scripts/load_sandarb_data.sh [local|gcp]
#   local = DATABASE_URL from .env; gcp = CLOUD_SQL_DATABASE_URL from .env.
#
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_SQL="$REPO_ROOT/data/sandarb.sql"
cd "$REPO_ROOT"

if [[ ! -f "$DATA_SQL" ]]; then
  echo "Error: $DATA_SQL not found."
  echo "  Generate it first: ./scripts/generate_sandarb_data.sh"
  exit 1
fi

TARGET="${1:-local}"
exec python scripts/load_db.py "$TARGET"
