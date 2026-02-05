#!/usr/bin/env bash
#
# Check that Postgres is reachable (uses DATABASE_URL from .env or default local).
#
# Usage: ./scripts/check_postgres.sh
#
# Requires: Python 3, .env optional (DATABASE_URL).
#
set -e
cd "$(dirname "$0")/.."
exec python scripts/check_postgres.py "$@"
