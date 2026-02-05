#!/usr/bin/env bash
#
# Load schema + seed to local Postgres or GCP (Cloud SQL). Full reset then init + seed.
#
# Usage:
#   ./scripts/load_db.sh local
#   ./scripts/load_db.sh gcp
#   ./scripts/load_db.sh 'postgresql://user:pass@host:5432/db'
#
# Requires: Python 3, .env with DATABASE_URL (local) and/or CLOUD_SQL_DATABASE_URL (GCP).
#
set -e
cd "$(dirname "$0")/.."
exec python scripts/load_db.py "$@"
