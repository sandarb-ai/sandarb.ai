#!/usr/bin/env bash
# Deploy Sandarb to GCP Cloud Run.
# Usage: ./scripts/deploy-gcp.sh [PROJECT_ID] [REGION] [--cache]
#   PROJECT_ID default: sandarb-ai (or GCP_PROJECT_ID or gcloud config)
#   REGION default: us-central1
#   Build uses Docker layer cache by default; pass --no-cache to disable (may fail if Kaniko is off).
# Prerequisites: gcloud installed, logged in (e.g. gcloud auth login with sudhir@openint.ai)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE_NAME="sandarb"
SERVICE_NAME="sandarb"

# Load DATABASE_URL from .env (read-only, no sourcing) so deploy and post-deploy reseed see it
if [[ -f "$REPO_ROOT/.env" ]]; then
  while IFS= read -r line; do
    [[ "$line" =~ ^#.*$ || -z "${line// /}" ]] && continue
    if [[ "$line" == DATABASE_URL=* ]]; then
      export DATABASE_URL="${line#DATABASE_URL=}"
      break
    fi
  done < "$REPO_ROOT/.env"
fi

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

# Parse args (only positional; ignore flags like --help/--cache for PROJECT_ID/REGION)
PROJECT_ID=""
REGION=""
# Build with layer cache by default; pass --no-cache to disable (requires Kaniko in some projects)
NO_CACHE=""
for arg in "$@"; do
  if [[ "$arg" == "--help" || "$arg" == "-h" ]]; then
    echo "Usage: $0 [PROJECT_ID] [REGION] [--no-cache]"
    echo "  PROJECT_ID default: sandarb-ai (or GCP_PROJECT_ID or gcloud config)"
    echo "  REGION default: us-central1"
    echo "  Build uses Docker layer cache by default; pass --no-cache to disable (may fail if Kaniko is off)."
    echo "  DATABASE_URL is loaded from REPO_ROOT/.env if present."
    echo "Example: $0 sandarb-ai us-central1"
    exit 0
  fi
  if [[ "$arg" == "--no-cache" ]]; then
    NO_CACHE="--no-cache"
    continue
  fi
  # Only use non-flag args as PROJECT_ID / REGION (so --no-cache can appear anywhere)
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

# Unique image tag so Cloud Run always deploys the image we just built (avoids :latest cache issues).
BUILD_TAG="$(date +%Y%m%d-%H%M%S)"
if (cd "$REPO_ROOT" && git rev-parse --short HEAD &>/dev/null); then
  BUILD_TAG="${BUILD_TAG}-$(cd "$REPO_ROOT" && git rev-parse --short HEAD)"
fi

# Build and push using Cloud Build (no local Docker required)
echo "Building and pushing image (tag: ${BUILD_TAG})..."
cd "$REPO_ROOT"
BUILD_CMD=("$GCLOUD" builds submit --tag "${REPO}/${IMAGE_NAME}:${BUILD_TAG}" --project="$PROJECT_ID")
[[ -n "$NO_CACHE" ]] && BUILD_CMD+=(--no-cache)
if ! "${BUILD_CMD[@]}" . ; then
  echo ""
  echo "Build failed."
  echo "  - PERMISSION_DENIED: see docs/deploy-gcp.md (grant your user cloudbuild.builds.editor + storage.objectAdmin)."
  echo "  - 403 ...-compute@developer.gserviceaccount.com storage.objects.get: grant the default Compute SA access to the bucket:"
  echo "    PROJECT_NUMBER=\$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')"
  echo "    gcloud storage buckets add-iam-policy-binding gs://${PROJECT_ID}_cloudbuild --member=\"serviceAccount:\${PROJECT_NUMBER}-compute@developer.gserviceaccount.com\" --role=\"roles/storage.objectViewer\""
  echo "  - If build fails with 'Invalid value for [no-cache]', omit --no-cache (Kaniko may be disabled)."
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
if [ -n "$DATABASE_URL" ]; then
  echo "Using Postgres (DATABASE_URL set). All demo data will be driven from the DB."
  DEPLOY_ARGS+=(--set-env-vars "NODE_ENV=production,DATABASE_URL=$DATABASE_URL")
  # If URL uses Cloud SQL Unix socket, attach the instance so the container can connect.
  if [[ "$DATABASE_URL" == *"/cloudsql/"* ]]; then
    CLOUDSQL_INSTANCE=$(echo "$DATABASE_URL" | sed -n 's|.*/cloudsql/\([^/?]*\).*|\1|p')
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
# Set DATABASE_URL to your Cloud SQL connection string (e.g. via Cloud SQL Proxy or public IP).
if [ -n "$DATABASE_URL" ]; then
  echo ""
  echo "Post-deploy: cleaning and reseeding Postgres (DATABASE_URL is set)..."
  if (cd "$REPO_ROOT" && node scripts/full-reset-postgres.js); then
    echo "Postgres cleaned and reseeded. GCP DB now has: 30 orgs, 500+ agents, 3000+ contexts, 2000+ prompts (same as local)."
  else
    echo "Warning: post-deploy reseed failed. Run manually: DATABASE_URL=<your-gcp-pg-url> npm run db:full-reset-pg"
    exit 1
  fi
else
  echo "Tip: To reseed GCP Postgres with real-world data (500+ agents, 3000+ contexts, 2000+ prompts), run:"
  echo "  DATABASE_URL=<your-cloud-sql-url> ./scripts/deploy-gcp.sh $PROJECT_ID ${REGION}"
  echo "  or: DATABASE_URL=<your-cloud-sql-url> npm run db:full-reset-pg"
fi
