#!/bin/sh
# Sandarb UI only. This container runs the Next.js frontend.
# Backend (FastAPI) runs separately; set NEXT_PUBLIC_API_URL in the image or at deploy to point to it.
# Schema and seed: use npm run db:gcp-import-file then import to Cloud SQL; backend uses the same DB.

set -e
PORT="${PORT:-3000}"

exec node server.js
