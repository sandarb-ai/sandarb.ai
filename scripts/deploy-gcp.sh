#!/usr/bin/env bash
#
# Deploy Sandarb 3-Service Architecture to Google Cloud Run
#
# Deploys:
#   ui.sandarb.ai    -> sandarb-ui   (Next.js frontend)
#   api.sandarb.ai   -> sandarb-api  (FastAPI backend, Dashboard UI)
#   agent.sandarb.ai -> sandarb-agent (FastAPI backend, A2A traffic)
#
# Usage: ./scripts/deploy-gcp.sh [PROJECT_ID] [REGION]
#   PROJECT_ID default: sandarb-ai (or GCP_PROJECT_ID or gcloud config)
#   REGION default: us-central1
#
# Prerequisites: gcloud installed and logged in (gcloud auth login)
# .env: all variables are loaded and exported (for --seed and scripts). Set at least:
#   CLOUD_SQL_DATABASE_URL or DATABASE_URL  (backend DB; required for api + agent)
#   SANDARB_UI_SECRET, SANDARB_API_SECRET, SANDARB_A2A_SECRET  (optional; seed_postgres uses these if set)
#   JWT_SECRET  (required in production for UI auth)
# To allow public invoker (allUsers) on Cloud Run, set org policy first, e.g.:
#   gcloud resource-manager org-policies set-policy config/policy.yaml --project=PROJECT_ID
#
# SECURITY: This script deploys with --allow-unauthenticated, exposing the UI and API to the
# public internet. For production, consider using Identity-Aware Proxy (IAP), Cloud Identity,
# or VPC/private ingress and remove --allow-unauthenticated so only authenticated users
# can reach the services.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load and export all env vars from .env (for GCP PG seeding and deploy; required for seed_postgres.py secrets, JWT, etc.)
if [[ -f "$REPO_ROOT/.env" ]]; then
  echo "Loading .env into environment..."
  while IFS= read -r line; do
    [[ "$line" =~ ^#.*$ || -z "${line// /}" ]] && continue
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      val="${BASH_REMATCH[2]}"
      val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
      export "$key=$val"
    fi
  done < "$REPO_ROOT/.env"
fi

DEPLOY_DATABASE_URL="${CLOUD_SQL_DATABASE_URL:-$DATABASE_URL}"

# Find gcloud
find_gcloud() {
  if command -v gcloud &>/dev/null; then echo "gcloud"; return; fi
  for path in "$HOME/google-cloud-sdk/bin/gcloud" "/usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/bin/gcloud"; do
    if [[ -x "$path" ]]; then echo "$path"; return; fi
  done
  return 1
}

GCLOUD=$(find_gcloud || true)
if [[ -z "$GCLOUD" ]]; then
  echo "Error: gcloud CLI not found. Install from https://cloud.google.com/sdk/docs/install"
  exit 1
fi

# Parse args
PROJECT_ID=""
REGION=""
DO_SEED=""
DO_SEED_ONLY=""
for arg in "$@"; do
  if [[ "$arg" == "--help" || "$arg" == "-h" ]]; then
    echo "Usage: $0 [PROJECT_ID] [REGION] [--seed] [--seed-only]"
    echo "  PROJECT_ID default: sandarb-ai (or GCP_PROJECT_ID or gcloud config)"
    echo "  REGION default: us-central1"
    echo "  --seed       After deploy, seed GCP Postgres (schema + sample data) so the UI shows data."
    echo "  --seed-only  Run only the seed step (no build/deploy). Uses CLOUD_SQL_DATABASE_URL from .env."
    echo "               Uses your gcloud auth; for Cloud SQL socket URLs the script starts Cloud SQL Proxy automatically."
    echo "  Run 'gcloud auth application-default login' once if you get an auth error during seed."
    echo "  Set CLOUD_SQL_DATABASE_URL or DATABASE_URL in .env for backend services."
    exit 0
  fi
  if [[ "$arg" == "--seed" ]]; then
    DO_SEED=1
  elif [[ "$arg" == "--seed-only" ]]; then
    DO_SEED_ONLY=1
  elif [[ "$arg" != -* && -z "$PROJECT_ID" ]]; then
    PROJECT_ID="$arg"
  elif [[ "$arg" != -* && -n "$PROJECT_ID" && -z "$REGION" ]]; then
    REGION="$arg"
  fi
done

REGION="${REGION:-us-central1}"
if [[ -z "$PROJECT_ID" ]]; then
  PROJECT_ID="${GCP_PROJECT_ID:-$( "$GCLOUD" config get-value project 2>/dev/null || true)}"
fi
PROJECT_ID="${PROJECT_ID:-sandarb-ai}"

ACTIVE_ACCOUNT=$("$GCLOUD" auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null || true)
if [[ -z "$ACTIVE_ACCOUNT" ]]; then
  echo "Error: No active gcloud account. Run: gcloud auth login"
  exit 1
fi

if [[ -z "$DEPLOY_DATABASE_URL" ]]; then
  echo "Error: DATABASE_URL / CLOUD_SQL_DATABASE_URL not set. Backend services (api + agent) require a Postgres URL."
  echo "  Set CLOUD_SQL_DATABASE_URL in .env (e.g. postgresql://user:pass@/db?host=/cloudsql/PROJECT:REGION:INSTANCE)."
  exit 1
fi

if [[ -z "$DO_SEED_ONLY" ]] && { [[ "$DEPLOY_DATABASE_URL" == *"localhost"* ]] || [[ "$DEPLOY_DATABASE_URL" == *"127.0.0.1"* ]]; }; then
  echo "Error: DATABASE_URL must not be localhost for Cloud Run. Use Cloud SQL URL or public IP."
  exit 1
fi

# --seed-only: run only the seed step, then exit
if [[ -n "$DO_SEED_ONLY" ]]; then
  DO_SEED=1
fi

# Cloud SQL instance for --add-cloudsql-instances (when URL uses Unix socket)
CLOUDSQL_INSTANCE=""
if [[ "$DEPLOY_DATABASE_URL" == *"/cloudsql/"* ]]; then
  CLOUDSQL_INSTANCE=$(echo "$DEPLOY_DATABASE_URL" | sed -n 's|.*/cloudsql/\([^/?]*\).*|\1|p')
fi

if [[ -z "$DO_SEED_ONLY" ]]; then
BUILD_TAG="$(date +%Y%m%d-%H%M%S)"
if (cd "$REPO_ROOT" && git rev-parse --short HEAD &>/dev/null); then
  BUILD_TAG="${BUILD_TAG}-$(cd "$REPO_ROOT" && git rev-parse --short HEAD)"
fi

echo "=============================================="
echo " Deploying Sandarb to Google Cloud Run"
echo "=============================================="
echo "  Project ID: $PROJECT_ID"
echo "  Region:     $REGION"
echo "  Account:    $ACTIVE_ACCOUNT"
echo "  Tag:        $BUILD_TAG"
echo "  DB:         set (backend services will use it)"
echo "=============================================="
echo ""

# ---------------------------------------------------------------------------
# Step 0: Enable APIs, Artifact Registry repo, and IAM for Cloud Build
# ---------------------------------------------------------------------------
echo "[0/5] Enabling APIs..."
"$GCLOUD" services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project="$PROJECT_ID"

# Project number and Cloud Build service account
PROJECT_NUMBER=$("$GCLOUD" projects describe "$PROJECT_ID" --format='value(projectNumber)')
CLOUDBUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

# Artifact Registry: use regional Docker repo (avoids gcr.io "createOnPush" permission issues)
AR_REPO_NAME="cloud-run"
AR_HOST="${REGION}-docker.pkg.dev"
AR_IMAGE_PREFIX="${AR_HOST}/${PROJECT_ID}/${AR_REPO_NAME}"
echo "Configuring Artifact Registry (${AR_IMAGE_PREFIX})..."
"$GCLOUD" auth configure-docker "$AR_HOST" --quiet

# Create Docker repository if it does not exist (so Cloud Build can push without createOnPush)
if ! "$GCLOUD" artifacts repositories describe "$AR_REPO_NAME" --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
  echo "Creating Artifact Registry repository ${AR_REPO_NAME} in ${REGION}..."
  "$GCLOUD" artifacts repositories create "$AR_REPO_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --project="$PROJECT_ID" \
    --description="Cloud Run container images"
fi

# Cloud Build bucket IAM (avoid 403 storage.objects.get)
"$GCLOUD" storage buckets add-iam-policy-binding "gs://${PROJECT_ID}_cloudbuild" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/storage.objectViewer" \
  --project="$PROJECT_ID" 2>/dev/null || true

# Allow Cloud Build to push images to Artifact Registry
echo "Granting Cloud Build permission to push images..."
"$GCLOUD" projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CLOUDBUILD_SA}" \
  --role="roles/artifactregistry.writer" \
  --quiet

# ---------------------------------------------------------------------------
# Step 1: Build Phase (frontend + backend; backend image used twice in deploy)
# ---------------------------------------------------------------------------
echo ""
echo "[1/5] Building images..."

echo "  Building sandarb-ui (Next.js frontend)..."
cd "$REPO_ROOT"
if ! "$GCLOUD" builds submit --tag "${AR_IMAGE_PREFIX}/sandarb-ui:${BUILD_TAG}" --project="$PROJECT_ID" . ; then
  echo "Frontend build failed. Check Dockerfile and Cloud Build logs."
  exit 1
fi

echo "  Building sandarb-backend (FastAPI; same image for api + agent)..."
if ! "$GCLOUD" builds submit --config=config/cloudbuild-backend.yaml \
  --substitutions="_IMAGE=${AR_IMAGE_PREFIX}/sandarb-backend:${BUILD_TAG}" \
  --project="$PROJECT_ID" . ; then
  echo "Backend build failed. Check Dockerfile.backend and Cloud Build logs."
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 2: Deploy sandarb-ui (Frontend)
# ---------------------------------------------------------------------------
echo ""
echo "[2/5] Deploying sandarb-ui (ui.sandarb.ai) (--allow-unauthenticated; see script header for production security options)..."

UI_ENV="NEXT_PUBLIC_API_URL=https://api.sandarb.ai,NEXT_PUBLIC_AGENT_URL=https://agent.sandarb.ai"
"$GCLOUD" run deploy sandarb-ui \
  --image "${AR_IMAGE_PREFIX}/sandarb-ui:${BUILD_TAG}" \
  --platform managed \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --allow-unauthenticated \
  --set-env-vars "$UI_ENV" \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 10

# ---------------------------------------------------------------------------
# Step 3: Deploy sandarb-api (Backend for Dashboard)
# ---------------------------------------------------------------------------
echo ""
echo "[3/5] Deploying sandarb-api (api.sandarb.ai)..."

API_ENV="AGENT_PUBLIC_URL=https://agent.sandarb.ai,SERVICE_MODE=api,DATABASE_URL=${DEPLOY_DATABASE_URL}"
DEPLOY_API_ARGS=(
  --image "${AR_IMAGE_PREFIX}/sandarb-backend:${BUILD_TAG}"
  --platform managed
  --region "$REGION"
  --project "$PROJECT_ID"
  --allow-unauthenticated
  --set-env-vars "$API_ENV"
  --memory 512Mi
  --min-instances 0
  --max-instances 10
)
if [[ -n "$CLOUDSQL_INSTANCE" ]]; then
  DEPLOY_API_ARGS+=(--add-cloudsql-instances "$CLOUDSQL_INSTANCE")
fi
"$GCLOUD" run deploy sandarb-api "${DEPLOY_API_ARGS[@]}"

# ---------------------------------------------------------------------------
# Step 4: Deploy sandarb-agent (Backend for A2A; same image as api)
# ---------------------------------------------------------------------------
echo ""
echo "[4/5] Deploying sandarb-agent (agent.sandarb.ai)..."

AGENT_ENV="AGENT_PUBLIC_URL=https://agent.sandarb.ai,SERVICE_MODE=agent,DATABASE_URL=${DEPLOY_DATABASE_URL}"
DEPLOY_AGENT_ARGS=(
  --image "${AR_IMAGE_PREFIX}/sandarb-backend:${BUILD_TAG}"
  --platform managed
  --region "$REGION"
  --project "$PROJECT_ID"
  --allow-unauthenticated
  --set-env-vars "$AGENT_ENV"
  --memory 512Mi
  --min-instances 0
  --max-instances 10
)
if [[ -n "$CLOUDSQL_INSTANCE" ]]; then
  DEPLOY_AGENT_ARGS+=(--add-cloudsql-instances "$CLOUDSQL_INSTANCE")
fi
"$GCLOUD" run deploy sandarb-agent "${DEPLOY_AGENT_ARGS[@]}"

# Make UI, API, and Agent publicly invokable (requires org policy to allow allUsers; see config/policy.yaml)
echo ""
echo "Adding public invoker access for UI, API, and Agent..."
"$GCLOUD" run services add-iam-policy-binding sandarb-ui \
  --member="allUsers" \
  --role="roles/run.invoker" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  || echo "  sandarb-ui: add-iam-policy-binding failed (org policy may block allUsers)."
"$GCLOUD" run services add-iam-policy-binding sandarb-api \
  --member="allUsers" \
  --role="roles/run.invoker" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  || echo "  sandarb-api: add-iam-policy-binding failed (org policy may block allUsers)."
"$GCLOUD" run services add-iam-policy-binding sandarb-agent \
  --member="allUsers" \
  --role="roles/run.invoker" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  || echo "  sandarb-agent: add-iam-policy-binding failed (org policy may block allUsers)."

# ---------------------------------------------------------------------------
# Step 5: Domain mapping instructions (manual; gcloud domain-mappings can be flaky)
# ---------------------------------------------------------------------------
echo ""
echo "[5/5] Domain mapping"
echo ""
echo "Deployments are live. Map domains manually with these commands:"
echo ""
echo "  $GCLOUD beta run domain-mappings create --service sandarb-ui   --domain ui.sandarb.ai    --region $REGION --project $PROJECT_ID"
echo "  $GCLOUD beta run domain-mappings create --service sandarb-api  --domain api.sandarb.ai   --region $REGION --project $PROJECT_ID"
echo "  $GCLOUD beta run domain-mappings create --service sandarb-agent --domain agent.sandarb.ai --region $REGION --project $PROJECT_ID"
echo ""
echo "Before running the above, ensure DNS for ui.sandarb.ai, api.sandarb.ai, and agent.sandarb.ai"
echo "points to the Cloud Run mapping target (see Cloud Run console > Domain mappings)."
echo ""

UI_URL=$("$GCLOUD" run services describe sandarb-ui   --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
API_URL=$("$GCLOUD" run services describe sandarb-api  --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
AGENT_URL=$("$GCLOUD" run services describe sandarb-agent --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)

echo "Service URLs (until custom domains are mapped):"
echo "  Project ID: $PROJECT_ID"
echo "  UI:         $UI_URL"
echo "  API:        $API_URL"
echo "  Agent:      $AGENT_URL"
echo ""
fi

# Optional: seed GCP Postgres so the UI shows data (schema + sample data)
# Uses your gcloud login; for Cloud SQL Unix socket URLs we start Cloud SQL Proxy so seed runs locally.
if [[ -n "$DO_SEED" ]]; then
  echo "[Seed] Seeding GCP Postgres (schema + sample data)..."
  cd "$REPO_ROOT"
  SEED_URL="$DEPLOY_DATABASE_URL"
  PROXY_PID=""
  NEED_PROXY=""
  if [[ "$DEPLOY_DATABASE_URL" == *"/cloudsql/"* ]]; then
    NEED_PROXY=1
    echo "  Cloud SQL socket URL detected; starting Cloud SQL Proxy (uses your gcloud auth)..."
    # Parse URL: get connection name and build TCP URL (Python)
    SEED_PARSE=$(python3 - "$DEPLOY_DATABASE_URL" << 'PYSEED'
import sys
from urllib.parse import urlparse, parse_qs, unquote
url = sys.argv[2] if len(sys.argv) > 2 else sys.argv[1]
u = urlparse(url)
q = parse_qs(u.query)
host = (q.get("host") or [None])[0]
if host:
    host = unquote(host)
if host and "/cloudsql/" in host:
    conn = host.replace("/cloudsql/", "").strip()
    from urllib.parse import quote
    safe_pass = quote(u.password, safe="") if u.password else ""
    tcp = f"{u.scheme}://{u.username}:{safe_pass}@127.0.0.1:5433{u.path}"
    print(conn)
    print(tcp)
else:
    sys.exit(1)
PYSEED
) || true
    if [[ -z "$SEED_PARSE" ]]; then
      echo "Seed: could not parse CLOUD_SQL_DATABASE_URL (expected ?host=/cloudsql/PROJECT:REGION:INSTANCE)." >&2
      exit 1
    fi
    CONNECTION_NAME=$(echo "$SEED_PARSE" | head -1)
    SEED_URL=$(echo "$SEED_PARSE" | tail -1)
    # Find or download Cloud SQL Proxy
    PROXY_BIN=$(command -v cloud_sql_proxy 2>/dev/null || command -v cloud-sql-proxy 2>/dev/null || true)
    if [[ -z "$PROXY_BIN" ]]; then
      PROXY_DIR="$REPO_ROOT/.tmp"
      mkdir -p "$PROXY_DIR"
      ARCH=$(uname -m)
      OS=$(uname -s)
      case "$OS" in
        Darwin) OS=darwin ;;
        Linux)  OS=linux ;;
        *) echo "Seed: unsupported OS for Cloud SQL Proxy auto-download." >&2; exit 1 ;;
      esac
      case "$ARCH" in
        x86_64|amd64) ARCH=amd64 ;;
        arm64|aarch64) ARCH=arm64 ;;
        *) echo "Seed: unsupported arch for Cloud SQL Proxy auto-download." >&2; exit 1 ;;
      esac
      PROXY_BIN="$PROXY_DIR/cloud-sql-proxy"
      if [[ ! -x "$PROXY_BIN" ]]; then
        echo "  Downloading Cloud SQL Proxy..."
        VER="v2.14.0"
        URL="https://github.com/GoogleCloudPlatform/cloud-sql-proxy/releases/download/${VER}/cloud-sql-proxy.${OS}.${ARCH}"
        if ! curl -sLf -o "$PROXY_BIN" "$URL"; then
          echo "Seed: download failed. Install manually: https://cloud.google.com/sql/docs/postgres/connect-auth-proxy#install" >&2
          exit 1
        fi
        chmod +x "$PROXY_BIN"
      fi
    fi
    "$PROXY_BIN" --port 5433 "$CONNECTION_NAME" &
    PROXY_PID=$!
    # Wait for proxy to listen
    for i in 1 2 3 4 5 6 7 8 9 10; do
      if (python3 -c "import socket; s=socket.socket(); s.settimeout(1); s.connect(('127.0.0.1', 5433)); s.close()" 2>/dev/null); then
        break
      fi
      sleep 1
    done
    if ! (python3 -c "import socket; s=socket.socket(); s.settimeout(1); s.connect(('127.0.0.1', 5433)); s.close()" 2>/dev/null); then
      kill "$PROXY_PID" 2>/dev/null || true
      echo "Seed: Cloud SQL Proxy failed to start. Run: gcloud auth application-default login" >&2
      exit 1
    fi
  fi
  export DATABASE_URL="$SEED_URL"
  if ! python3 scripts/init_postgres.py; then
    [[ -n "$PROXY_PID" ]] && kill "$PROXY_PID" 2>/dev/null || true
    echo "Seed: init_postgres.py failed." >&2
    exit 1
  fi
  if ! python3 scripts/seed_postgres.py; then
    [[ -n "$PROXY_PID" ]] && kill "$PROXY_PID" 2>/dev/null || true
    echo "Seed: seed_postgres.py failed." >&2
    exit 1
  fi
  [[ -n "$PROXY_PID" ]] && kill "$PROXY_PID" 2>/dev/null || true
  echo "Seed done. Refresh the UI to see data."
  echo ""
fi

echo "Done."
