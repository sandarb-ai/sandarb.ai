#!/usr/bin/env bash
#
# Deploy Sandarb Data Platform to Google Kubernetes Engine (GKE)
#
# Deploys:
#   PostgreSQL     (CNPG Operator: 1 primary + 1 standby, databases: sandarb + superset)
#   Kafka          (StatefulSet, 3 KRaft brokers: all controller+broker)
#   ClickHouse     (StatefulSet, 1 shard × 2 replicas + 3 Keepers)
#   Consumer Bridge (Deployment ×1 replica, Kafka → ClickHouse)
#   Superset       (Deployment ×1 replica, BI dashboard)
#
# Total CPU request: ~3.85 vCPU (fits within 24 vCPU GCP quota)
#
# Usage: ./scripts/deploy-data-platform-gcp.sh [PROJECT_ID] [REGION] [--build-only] [--deploy-only]
#   PROJECT_ID default: sandarb-data (or GCP_PROJECT_ID or gcloud config)
#   REGION default: us-central1
#
# Prerequisites:
#   - gcloud installed and logged in (gcloud auth login)
#   - kubectl installed (gcloud components install kubectl)
#   - GCP project with billing enabled
#   - k8s/secrets.yaml created from k8s/secrets.yaml.example with real values
#
# Network: Uses private GKE nodes (no external IPs) with Cloud NAT for outbound.
# Satisfies org policy constraints/compute.vmExternalIpAccess.
#
# The core services (UI, API, Agent) are deployed separately via deploy-gcp.sh (Cloud Run).
# This script deploys the stateful data platform services to GKE.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load and export env vars from .env
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

if ! command -v kubectl &>/dev/null; then
  echo "Error: kubectl not found. Install with: gcloud components install kubectl"
  exit 1
fi

# Ensure gke-gcloud-auth-plugin is in PATH (required for kubectl with GKE)
export USE_GKE_GCLOUD_AUTH_PLUGIN=True
GCLOUD_SDK_DIR="$(dirname "$(dirname "$(readlink -f "$GCLOUD" 2>/dev/null || echo "$GCLOUD")")")"
for sdk_bin in "$GCLOUD_SDK_DIR/bin" "/opt/homebrew/share/google-cloud-sdk/bin" "$HOME/google-cloud-sdk/bin"; do
  if [[ -x "$sdk_bin/gke-gcloud-auth-plugin" ]]; then
    export PATH="$sdk_bin:$PATH"
    break
  fi
done

# Parse args
PROJECT_ID=""
REGION=""
BUILD_ONLY=""
DEPLOY_ONLY=""
for arg in "$@"; do
  if [[ "$arg" == "--help" || "$arg" == "-h" ]]; then
    echo "Usage: $0 [PROJECT_ID] [REGION] [--build-only] [--deploy-only]"
    echo "  --build-only   Build images to Artifact Registry only (no GKE deploy)"
    echo "  --deploy-only  Apply k8s manifests only (images must already exist)"
    exit 0
  fi
  if [[ "$arg" == "--build-only" ]]; then BUILD_ONLY=1
  elif [[ "$arg" == "--deploy-only" ]]; then DEPLOY_ONLY=1
  elif [[ "$arg" != -* && -z "$PROJECT_ID" ]]; then PROJECT_ID="$arg"
  elif [[ "$arg" != -* && -n "$PROJECT_ID" && -z "$REGION" ]]; then REGION="$arg"
  fi
done

REGION="${REGION:-us-central1}"
if [[ -z "$PROJECT_ID" ]]; then
  PROJECT_ID="${GCP_PROJECT_ID:-$( "$GCLOUD" config get-value project 2>/dev/null || true)}"
fi
PROJECT_ID="${PROJECT_ID:-sandarb-data}"

GKE_CLUSTER_NAME="${GKE_CLUSTER_NAME:-sandarb-data}"
GKE_MACHINE_TYPE="${GKE_NODE_POOL_MACHINE_TYPE:-e2-standard-4}"
GKE_NUM_NODES="${GKE_NUM_NODES:-3}"

ACTIVE_ACCOUNT=$("$GCLOUD" auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null || true)
if [[ -z "$ACTIVE_ACCOUNT" ]]; then
  echo "Error: No active gcloud account. Run: gcloud auth login"
  exit 1
fi

# Build tag
BUILD_TAG="$(date +%Y%m%d-%H%M%S)"
if (cd "$REPO_ROOT" && git rev-parse --short HEAD &>/dev/null); then
  BUILD_TAG="${BUILD_TAG}-$(cd "$REPO_ROOT" && git rev-parse --short HEAD)"
fi

# Artifact Registry
AR_REPO_NAME="cloud-run"
AR_HOST="${REGION}-docker.pkg.dev"
AR_IMAGE_PREFIX="${AR_HOST}/${PROJECT_ID}/${AR_REPO_NAME}"

# CNPG Operator version
CNPG_VERSION="${CNPG_VERSION:-1.28.0}"

echo "=============================================="
echo " sandarb-data → GKE"
echo "=============================================="
echo "  Project:  $PROJECT_ID"
echo "  Region:   $REGION"
echo "  Account:  $ACTIVE_ACCOUNT"
echo "  Cluster:  $GKE_CLUSTER_NAME"
echo "  Tag:      $BUILD_TAG"
echo "  CNPG:     $CNPG_VERSION"
echo "=============================================="
echo ""

# ---------------------------------------------------------------------------
# Step 1: Enable APIs
# ---------------------------------------------------------------------------
echo "[1/7] Enabling APIs..."
"$GCLOUD" services enable \
  container.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --project="$PROJECT_ID"

# Artifact Registry setup (reuse the cloud-run repo)
"$GCLOUD" auth configure-docker "$AR_HOST" --quiet
if ! "$GCLOUD" artifacts repositories describe "$AR_REPO_NAME" --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
  echo "Creating Artifact Registry repository ${AR_REPO_NAME}..."
  "$GCLOUD" artifacts repositories create "$AR_REPO_NAME" \
    --repository-format=docker --location="$REGION" --project="$PROJECT_ID" \
    --description="Sandarb container images"
fi

# ---------------------------------------------------------------------------
# Step 2: Build custom images (Superset + Consumer Bridge)
# ---------------------------------------------------------------------------
if [[ -z "$DEPLOY_ONLY" ]]; then
  echo ""
  echo "[2/7] Building custom images..."

  SUPERSET_IMAGE="${AR_IMAGE_PREFIX}/sandarb-superset:${BUILD_TAG}"
  CONSUMER_IMAGE="${AR_IMAGE_PREFIX}/sandarb-kafka-clickhouse-consumer:${BUILD_TAG}"

  echo "  Building sandarb-superset..."
  "$GCLOUD" builds submit \
    --config=config/cloudbuild-superset.yaml \
    --substitutions="_IMAGE=${SUPERSET_IMAGE}" \
    --project="$PROJECT_ID" \
    "$REPO_ROOT/superset/"

  echo "  Building sandarb-kafka-clickhouse-consumer..."
  "$GCLOUD" builds submit \
    --config=config/cloudbuild-consumer.yaml \
    --substitutions="_IMAGE=${CONSUMER_IMAGE}" \
    --project="$PROJECT_ID" \
    "$REPO_ROOT/kafka-clickhouse-consumer/"

  echo "  Images:"
  echo "    Superset:  $SUPERSET_IMAGE"
  echo "    Consumer:  $CONSUMER_IMAGE"

  if [[ -n "$BUILD_ONLY" ]]; then
    echo ""
    echo "Build complete (--build-only). Images pushed to Artifact Registry."
    echo "Deploy with: $0 $PROJECT_ID $REGION --deploy-only"
    exit 0
  fi
else
  # Find latest images in Artifact Registry
  SUPERSET_IMAGE="${AR_IMAGE_PREFIX}/sandarb-superset:${BUILD_TAG}"
  CONSUMER_IMAGE="${AR_IMAGE_PREFIX}/sandarb-kafka-clickhouse-consumer:${BUILD_TAG}"
  echo "[2/7] Skipping build (--deploy-only). Using tag: $BUILD_TAG"
fi

# ---------------------------------------------------------------------------
# Step 3: Create or get GKE cluster (private nodes — no external IPs)
# ---------------------------------------------------------------------------
echo ""
echo "[3/7] Setting up GKE cluster '${GKE_CLUSTER_NAME}'..."

# Ensure Cloud Router + NAT exist for private node outbound internet (image pulls, etc.)
ROUTER_NAME="${GKE_CLUSTER_NAME}-router"
NAT_NAME="${GKE_CLUSTER_NAME}-nat"
if ! "$GCLOUD" compute routers describe "$ROUTER_NAME" --region="$REGION" --project="$PROJECT_ID" &>/dev/null; then
  echo "  Creating Cloud Router '${ROUTER_NAME}'..."
  "$GCLOUD" compute routers create "$ROUTER_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --network=default
fi
if ! "$GCLOUD" compute routers nats describe "$NAT_NAME" --router="$ROUTER_NAME" --region="$REGION" --project="$PROJECT_ID" &>/dev/null; then
  echo "  Creating Cloud NAT '${NAT_NAME}'..."
  "$GCLOUD" compute routers nats create "$NAT_NAME" \
    --router="$ROUTER_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --auto-allocate-nat-external-ips \
    --nat-all-subnet-ip-ranges
fi

# Delete errored cluster if it exists (from previous failed attempt)
CLUSTER_STATUS=$("$GCLOUD" container clusters describe "$GKE_CLUSTER_NAME" \
    --region="$REGION" --project="$PROJECT_ID" --format="value(status)" 2>/dev/null || echo "NOT_FOUND")
if [[ "$CLUSTER_STATUS" == "ERROR" || "$CLUSTER_STATUS" == "DEGRADED" ]]; then
  echo "  Cluster in $CLUSTER_STATUS state — deleting and recreating..."
  "$GCLOUD" container clusters delete "$GKE_CLUSTER_NAME" \
    --region="$REGION" --project="$PROJECT_ID" --quiet
fi

if [[ "$CLUSTER_STATUS" == "RUNNING" || "$CLUSTER_STATUS" == "RECONCILING" ]]; then
  echo "  Cluster exists (status: $CLUSTER_STATUS), getting credentials..."
else
  echo "  Creating GKE Autopilot cluster with private nodes (this takes 5-10 minutes)..."
  "$GCLOUD" container clusters create-auto "$GKE_CLUSTER_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --release-channel="regular" \
    --enable-private-nodes
fi

"$GCLOUD" container clusters get-credentials "$GKE_CLUSTER_NAME" \
  --region="$REGION" --project="$PROJECT_ID"

echo "  kubectl context: $(kubectl config current-context)"

# ---------------------------------------------------------------------------
# Step 4: Install CloudNativePG Operator
# ---------------------------------------------------------------------------
echo ""
echo "[4/7] Installing CloudNativePG operator v${CNPG_VERSION}..."

if kubectl get deployment cnpg-controller-manager -n cnpg-system &>/dev/null; then
  echo "  CNPG operator already installed."
else
  # Branch name is release-MAJOR.MINOR (e.g. release-1.28), not release-MAJOR.MINOR.PATCH
  CNPG_BRANCH="release-${CNPG_VERSION%.*}"
  CNPG_YAML_URL="https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/${CNPG_BRANCH}/releases/cnpg-${CNPG_VERSION}.yaml"
  echo "  Applying CNPG manifest from: $CNPG_YAML_URL"
  kubectl apply --server-side -f "$CNPG_YAML_URL"
  echo "  Waiting for CNPG operator to be ready..."
  kubectl rollout status deployment/cnpg-controller-manager -n cnpg-system --timeout=120s || true
fi

# ---------------------------------------------------------------------------
# Step 5: Apply namespace, secrets, and PostgreSQL cluster
# ---------------------------------------------------------------------------
echo ""
echo "[5/7] Applying namespace, secrets, and PostgreSQL cluster..."

kubectl apply -f "$REPO_ROOT/k8s/namespace.yaml"

if [[ -f "$REPO_ROOT/k8s/secrets.yaml" ]]; then
  kubectl apply -f "$REPO_ROOT/k8s/secrets.yaml"
else
  echo "  WARNING: k8s/secrets.yaml not found."
  echo "  Copy k8s/secrets.yaml.example → k8s/secrets.yaml and fill in real values."
  echo "  Then run: kubectl apply -f k8s/secrets.yaml"
fi

echo "  Applying CNPG PostgreSQL cluster (1 primary + 1 standby)..."
kubectl apply -f "$REPO_ROOT/k8s/postgres-cnpg.yaml"

echo "  Waiting for PostgreSQL cluster to be ready..."
kubectl wait --for=condition=Ready cluster/sandarb-postgres -n sandarb-data --timeout=300s || true

# ---------------------------------------------------------------------------
# Step 6: Deploy stateful services (Kafka, ClickHouse)
# ---------------------------------------------------------------------------
echo ""
echo "[6/7] Deploying stateful services..."

echo "  Applying Kafka StatefulSet (3 KRaft brokers, all controller+broker)..."
kubectl apply -f "$REPO_ROOT/k8s/kafka-statefulset.yaml"

echo "  Applying ClickHouse ConfigMap..."
kubectl apply -f "$REPO_ROOT/k8s/clickhouse-configmap.yaml"

echo "  Applying ClickHouse StatefulSet (1 shard × 2 replicas + 3 Keepers)..."
kubectl apply -f "$REPO_ROOT/k8s/clickhouse-statefulset.yaml"

echo "  Waiting for Kafka brokers to be ready..."
kubectl rollout status statefulset/sandarb-kafka -n sandarb-data --timeout=300s || true

echo "  Waiting for Kafka topic initialization job to complete..."
kubectl wait --for=condition=complete job/sandarb-kafka-topic-init -n sandarb-data --timeout=120s || true

echo "  Waiting for ClickHouse Keeper ensemble (3 nodes) to be ready..."
kubectl rollout status statefulset/sandarb-clickhouse-keeper -n sandarb-data --timeout=180s || true

echo "  Waiting for ClickHouse nodes (2) to be ready..."
kubectl rollout status statefulset/sandarb-clickhouse -n sandarb-data --timeout=600s || true

# ---------------------------------------------------------------------------
# Step 7: Deploy application services (Consumer, Superset)
# ---------------------------------------------------------------------------
echo ""
echo "[7/7] Deploying application services..."

# Substitute image references in manifests
echo "  Deploying Consumer Bridge (1 replica)..."
sed "s|REGION-docker.pkg.dev/PROJECT_ID/cloud-run/sandarb-kafka-clickhouse-consumer:TAG|${CONSUMER_IMAGE}|g" \
  "$REPO_ROOT/k8s/consumer-deployment.yaml" | kubectl apply -f -

echo "  Deploying Superset (1 replica)..."
sed "s|REGION-docker.pkg.dev/PROJECT_ID/cloud-run/sandarb-superset:TAG|${SUPERSET_IMAGE}|g" \
  "$REPO_ROOT/k8s/superset-deployment.yaml" | kubectl apply -f -

echo "  Waiting for Consumer to be ready..."
kubectl rollout status deployment/sandarb-consumer -n sandarb-data --timeout=120s || true

echo "  Waiting for Superset to be ready..."
kubectl rollout status deployment/sandarb-superset -n sandarb-data --timeout=300s || true

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=============================================="
echo " Deployment Complete"
echo "=============================================="
echo ""
echo "Cluster: $GKE_CLUSTER_NAME ($REGION)"
echo ""
echo "Pod status:"
kubectl get pods -n sandarb-data -o wide
echo ""
echo "Services:"
kubectl get svc -n sandarb-data
echo ""
echo "PostgreSQL (CNPG):"
echo "  kubectl cnpg status sandarb-postgres -n sandarb-data"
echo "  Primary:   sandarb-postgres-rw.sandarb-data.svc.cluster.local:5432"
echo "  Read-only: sandarb-postgres-ro.sandarb-data.svc.cluster.local:5432"
echo ""
echo "Access Superset (port-forward):"
echo "  kubectl port-forward svc/superset -n sandarb-data 8088:8088"
echo "  Open http://localhost:8088"
echo ""
echo "Consumer health:"
echo "  kubectl port-forward svc/sandarb-consumer -n sandarb-data 8079:8079"
echo "  curl http://localhost:8079/health"
echo ""
echo "ClickHouse query:"
echo "  kubectl exec -it clickhouse-0 -n sandarb-data -- clickhouse-client -q 'SELECT count() FROM sandarb.events'"
echo ""
echo "Kafka topics:"
echo "  kubectl exec -it kafka-0 -n sandarb-data -- /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9092"
echo ""
echo "Done."
