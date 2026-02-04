#!/usr/bin/env bash
# Deploy Sandarb to GCP Cloud Run.
# Usage: ./scripts/deploy-gcp.sh [PROJECT_ID] [REGION]
#   PROJECT_ID default: sandarb-ai (or GCP_PROJECT_ID or gcloud config)
#   REGION default: us-central1
# Prerequisites: gcloud installed, logged in (e.g. gcloud auth login with sudhir@openint.ai)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE_NAME="sandarb"
SERVICE_NAME="sandarb"

# Load DATABASE_URL and optional CLOUD_SQL_DATABASE_URL from .env (read-only, no sourcing)
# For GCP deploy: set CLOUD_SQL_DATABASE_URL to your Cloud SQL URL so Cloud Run and post-deploy reseed
# both use the same DB. If unset, DATABASE_URL is used (must not be localhost for Cloud Run).
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
# DB URL used for Cloud Run and post-deploy reseed (prefer Cloud SQL URL when deploying to GCP)
DEPLOY_DATABASE_URL="${CLOUD_SQL_DATABASE_URL:-$DATABASE_URL}"
# Optional: SANDARB_UI_SECRET, SANDARB_API_SECRET, SANDARB_A2A_SECRET in .env so post-deploy seed uses them for service_accounts

# Find gcloud (PATH or common install locations)
find_gcloud() {
  if command -v gcloud &>/dev/null; then
    echo "gcloud"
    return
  fi
  for path in \
    "$HOME/google-cloud-sdk/bin/gcloud" \
    "/usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/bin/gcloud"; do
    if [[ -x "$path" ]]; then
      echo "$path"
      return
    fi
  done
  return 1
}

GCLOUD=$(find_gcloud || true)
if [[ -z "$GCLOUD" ]]; then
  echo "Error: gcloud CLI not found."
  echo "Install it from: https://cloud.google.com/sdk/docs/install"
  echo "  macOS (Homebrew): brew install --cask google-cloud-sdk"
  echo "  Then run: gcloud auth login"
  exit 1
fi

# Parse args (only positional)
PROJECT_ID=""
REGION=""
for arg in "$@"; do
  if [[ "$arg" == "--help" || "$arg" == "-h" ]]; then
    echo "Usage: $0 [PROJECT_ID] [REGION]"
    echo "  PROJECT_ID default: sandarb-ai (or GCP_PROJECT_ID or gcloud config)"
    echo "  REGION default: us-central1"
    echo "  DATABASE_URL is loaded from REPO_ROOT/.env if present."
    echo "Example: $0 sandarb-ai us-central1"
    exit 0
  fi
  if [[ "$arg" != -* && -z "$PROJECT_ID" ]]; then
    PROJECT_ID="$arg"
  elif [[ "$arg" != -* && -n "$PROJECT_ID" && -z "$REGION" ]]; then
    REGION="$arg"
  fi
done
REGION="${REGION:-us-central1}"

if [[ -z "$PROJECT_ID" ]]; then
  PROJECT_ID="${GCP_PROJECT_ID:-}"
fi
if [[ -z "$PROJECT_ID" ]]; then
  PROJECT_ID=$("$GCLOUD" config get-value project 2>/dev/null || true)
fi
if [[ -z "$PROJECT_ID" ]]; then
  PROJECT_ID="sandarb-ai"
fi

# Require an active gcloud account before running any commands
ACTIVE_ACCOUNT=$("$GCLOUD" auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null || true)
if [[ -z "$ACTIVE_ACCOUNT" ]]; then
  echo "Error: No active gcloud account selected."
  echo "Run: gcloud auth login"
  echo "  (e.g. sign in with sudhir@openint.ai)"
  exit 1
fi

echo "Deploying Sandarb to GCP"
echo "  Project: $PROJECT_ID"
echo "  Region:  $REGION"
echo "  Account: $ACTIVE_ACCOUNT"
if [ -n "$DEPLOY_DATABASE_URL" ]; then
  echo "  DB for deploy: using CLOUD_SQL_DATABASE_URL (Cloud Run + post-deploy reseed)."
  if [[ "$DEPLOY_DATABASE_URL" == *"localhost"* || "$DEPLOY_DATABASE_URL" == *"127.0.0.1"* ]]; then
    echo ""
    echo "  WARNING: DATABASE_URL/CLOUD_SQL_DATABASE_URL contains localhost. Cloud Run cannot reach it."
    echo "  Set CLOUD_SQL_DATABASE_URL in .env to your Cloud SQL URL (e.g. postgresql://user:pass@/db?host=/cloudsql/PROJECT:REGION:INSTANCE or public IP)."
    echo ""
    exit 1
  fi
else
  echo "  DATABASE_URL / CLOUD_SQL_DATABASE_URL: not set (add CLOUD_SQL_DATABASE_URL to .env for Postgres + post-deploy reseed)."
fi
echo ""

# Enable APIs
echo "Enabling required APIs..."
"$GCLOUD" services enable artifactregistry.googleapis.com run.googleapis.com cloudbuild.googleapis.com --project="$PROJECT_ID"

# Artifact Registry repo (create if not exists)
REPO="${REGION}-docker.pkg.dev/${PROJECT_ID}/sandarb"
if ! "$GCLOUD" artifacts repositories describe sandarb --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
  echo "Creating Artifact Registry repository sandarb in $REGION..."
  "$GCLOUD" artifacts repositories create sandarb \
    --repository-format=docker \
    --location="$REGION" \
    --project="$PROJECT_ID"
fi

# Configure Docker for Artifact Registry
"$GCLOUD" auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# Ensure Cloud Build default Compute SA can read the Cloud Build bucket (avoids 403 storage.objects.get)
echo "Ensuring Cloud Build bucket IAM (objectViewer for default Compute SA)..."
PROJECT_NUMBER=$("$GCLOUD" projects describe "$PROJECT_ID" --format='value(projectNumber)')
"$GCLOUD" storage buckets add-iam-policy-binding "gs://${PROJECT_ID}_cloudbuild" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/storage.objectViewer" \
  --project="$PROJECT_ID" 2>/dev/null || true

# Unique image tag so Cloud Run always deploys the image we just built (avoids :latest cache issues).
BUILD_TAG="$(date +%Y%m%d-%H%M%S)"
if (cd "$REPO_ROOT" && git rev-parse --short HEAD &>/dev/null); then
  BUILD_TAG="${BUILD_TAG}-$(cd "$REPO_ROOT" && git rev-parse --short HEAD)"
fi

# Build and push using Cloud Build (no local Docker required)
echo "Building and pushing image (tag: ${BUILD_TAG})..."
cd "$REPO_ROOT"
if ! "$GCLOUD" builds submit --tag "${REPO}/${IMAGE_NAME}:${BUILD_TAG}" --project="$PROJECT_ID" . ; then
  echo ""
  echo "Build failed."
  echo "  - PERMISSION_DENIED: see docs/deploy-gcp.md (grant your user cloudbuild.builds.editor + storage.objectAdmin)."
  echo "  - 403 ...-compute@developer.gserviceaccount.com storage.objects.get: run the IAM step above manually (script already ran it)."
  exit 1
fi

# Deploy to Cloud Run using the image we just built (by tag, not :latest), so the latest code is always used.
echo "Deploying to Cloud Run (image: ${BUILD_TAG})..."
DEPLOY_ARGS=(
  --image "${REPO}/${IMAGE_NAME}:${BUILD_TAG}"
  --platform managed
  --region "$REGION"
  --project "$PROJECT_ID"
  --allow-unauthenticated
  --memory 512Mi
  --min-instances 0
  --max-instances 10
)
if [ -n "$DEPLOY_DATABASE_URL" ]; then
  echo "Using Postgres (CLOUD_SQL_DATABASE_URL / DATABASE_URL). All demo data will be driven from the DB."
  DEPLOY_ARGS+=(--set-env-vars "NODE_ENV=production,DATABASE_URL=$DEPLOY_DATABASE_URL")
  # If URL uses Cloud SQL Unix socket, attach the instance so the container can connect.
  if [[ "$DEPLOY_DATABASE_URL" == *"/cloudsql/"* ]]; then
    CLOUDSQL_INSTANCE=$(echo "$DEPLOY_DATABASE_URL" | sed -n 's|.*/cloudsql/\([^/?]*\).*|\1|p')
    if [ -n "$CLOUDSQL_INSTANCE" ]; then
      DEPLOY_ARGS+=(--add-cloudsql-instances "$CLOUDSQL_INSTANCE")
    fi
  fi
else
  DEPLOY_ARGS+=(--set-env-vars "NODE_ENV=production")
fi
"$GCLOUD" run deploy "$SERVICE_NAME" "${DEPLOY_ARGS[@]}"

# Output URL
URL=$("$GCLOUD" run services describe "$SERVICE_NAME" --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
echo ""
echo "Deployed. Sandarb is available at: $URL"
echo "Health: $URL/api/health"

# Post-deploy: clean and reseed GCP Postgres so it has the same real-world data as localhost.
# Seed scale: 30 orgs, 500+ agents, 3000+ contexts, 2000+ prompts (see docs/deploy-gcp.md).
# Use the same DB URL as Cloud Run (DEPLOY_DATABASE_URL) so reseed writes to the DB the app reads from.
if [ -n "$DEPLOY_DATABASE_URL" ]; then
  echo ""
  echo "Post-deploy: cleaning and reseeding Postgres (same DB as Cloud Run)..."
  if (cd "$REPO_ROOT" && DATABASE_URL="$DEPLOY_DATABASE_URL" node scripts/full-reset-postgres.js); then
    echo "Postgres cleaned and reseeded. GCP DB now has: 30 orgs, 500+ agents, 3000+ contexts, 2000+ prompts (same as local)."
  else
    echo "Warning: post-deploy reseed failed. Run manually: DATABASE_URL=<your-cloud-sql-url> npm run db:full-reset-pg"
    exit 1
  fi
else
  echo "Tip: To reseed GCP Postgres with real-world data (500+ agents, 3000+ contexts, 2000+ prompts), set CLOUD_SQL_DATABASE_URL in .env and re-run deploy, or:"
  echo "  DATABASE_URL=<your-cloud-sql-url> npm run db:full-reset-pg"
fi
