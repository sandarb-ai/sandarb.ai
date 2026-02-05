#!/usr/bin/env bash
#
# Generate seed data into data/ (data/sandarb.sql). Run once to create or refresh the file;
# then use load_sandarb_data.sh or load_db.sh to load it to local or GCP Postgres.
#
# Usage:
#   ./scripts/generate_sandarb_data.sh
#   ./scripts/generate_sandarb_data.sh --output data/sandarb.sql
#   ./scripts/generate_sandarb_data.sh --orgs 50 --agents 1000 --prompts 5000 --contexts 10000
#
# Output: data/sandarb.sql (default). Requires: Python 3.
#
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Ensure data dir exists
mkdir -p "$REPO_ROOT/data"

exec python scripts/generate_seed_sql.py --output "$REPO_ROOT/data/sandarb.sql" "$@"
