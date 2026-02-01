#!/usr/bin/env bash
# Deploy Sandarb to GCP Cloud Run.
# Usage: ./scripts/deploy-gcp.sh [PROJECT_ID] [REGION]
#   PROJECT_ID default: from gcloud config or set GCP_PROJECT_ID
#   REGION default: us-central1
# Prerequisites: gcloud installed, logged in (e.g. gcloud auth login with sudhir@openint.ai)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE_NAME="sandarb"
SERVICE_NAME="sandarb"

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

# Parse args (only positional; ignore flags like --help for PROJECT_ID/REGION)
PROJECT_ID=""
REGION=""
for arg in "$@"; do
  if [[ "$arg" == "--help" || "$arg" == "-h" ]]; then
    echo "Usage: $0 PROJECT_ID [REGION]"
    echo "  or set GCP_PROJECT_ID and run: $0 [REGION]"
    echo "Example: $0 191433138534 us-central1"
    exit 0
  fi
  if [[ -z "$PROJECT_ID" ]]; then
    PROJECT_ID="$arg"
  elif [[ -z "$REGION" ]]; then
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
  echo "Usage: $0 PROJECT_ID [REGION]"
  echo "  or set GCP_PROJECT_ID and run: $0 [REGION]"
  echo "Example: $0 191433138534 us-central1"
  exit 1
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

# Build and push using Cloud Build (no local Docker required)
echo "Building and pushing image..."
cd "$REPO_ROOT"
if ! "$GCLOUD" builds submit --tag "${REPO}/${IMAGE_NAME}:latest" --project="$PROJECT_ID" . ; then
  echo ""
  echo "Build failed."
  echo "  - PERMISSION_DENIED: see docs/deploy-gcp.md (grant your user cloudbuild.builds.editor + storage.objectAdmin)."
  echo "  - 403 ...-compute@developer.gserviceaccount.com storage.objects.get: grant the default Compute SA access to the bucket:"
  echo "    PROJECT_NUMBER=\$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')"
  echo "    gcloud storage buckets add-iam-policy-binding gs://${PROJECT_ID}_cloudbuild --member=\"serviceAccount:\${PROJECT_NUMBER}-compute@developer.gserviceaccount.com\" --role=\"roles/storage.objectViewer\""
  exit 1
fi

# Deploy to Cloud Run (ephemeral SQLite; set DATABASE_URL for Cloud SQL later)
echo "Deploying to Cloud Run..."
"$GCLOUD" run deploy "$SERVICE_NAME" \
  --image "${REPO}/${IMAGE_NAME}:latest" \
  --platform managed \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production" \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 10

# Output URL
URL=$("$GCLOUD" run services describe "$SERVICE_NAME" --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
echo ""
echo "Deployed. Sandarb is available at: $URL"
echo "Health: $URL/api/health"
