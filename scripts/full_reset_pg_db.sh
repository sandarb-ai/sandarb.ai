#!/usr/bin/env bash
#
# Reset and reseed Postgres only (cleans up data in PG, then loads seed).
# Wrapper around load_db.sh.
#
# Usage:
#   ./scripts/full_reset_pg_db.sh local   # reset DB at DATABASE_URL
#   ./scripts/full_reset_pg_db.sh gcp     # reset DB at CLOUD_SQL_DATABASE_URL
#
set -e
cd "$(dirname "$0")/.."
exec ./scripts/load_db.sh "${1:-local}"
