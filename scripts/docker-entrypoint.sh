#!/bin/sh
# When DATABASE_URL is set: clean and reseed Postgres (same real-world data as localhost).
# Sandarb requires DATABASE_URL (Postgres). Demo data is visible only after login.

set -e
PORT="${PORT:-3000}"

# When DATABASE_URL is set, clean and reseed Postgres so GCP has the same data as local.
if [ -n "$DATABASE_URL" ]; then
  echo "DATABASE_URL set: cleaning and reseeding Postgres..."
  if node /app/scripts/full-reset-postgres.js 2>/dev/null; then
    echo "Postgres cleaned and reseeded (real-world sample data)."
  else
    echo "Warning: full-reset-postgres failed; continuing. Check DATABASE_URL and connectivity."
  fi
fi

# Start the server (DATABASE_URL required at runtime)
exec node server.js
