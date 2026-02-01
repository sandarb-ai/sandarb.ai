# Deploying Sandarb on Google Cloud Platform (GCP)

Sandarb is containerized and can run on **Cloud Run** (serverless) or **GKE** (Kubernetes). The same Docker image works for both.

## Prerequisites

- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (`gcloud`) installed
- Log in with your Google account (e.g. `sudhir@openint.ai`):  
  `gcloud auth login`
- A GCP project with billing enabled

### Required IAM permissions

If `gcloud builds submit` fails with **PERMISSION_DENIED**, your user needs these roles on the project. A project owner can grant them:

```bash
# Replace PROJECT_ID (e.g. sandarb-ai) and USER (e.g. sudhir@openint.ai)
export PROJECT_ID=sandarb-ai
export USER=sudhir@openint.ai

# Allow submitting Cloud Build jobs and uploading source
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:$USER" \
  --role="roles/cloudbuild.builds.editor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:$USER" \
  --role="roles/storage.objectAdmin"
```

Then run `./scripts/deploy-gcp.sh $PROJECT_ID` again.

### Cloud Build service account (403 on storage)

If the build fails with **Error 403: ...-compute@developer.gserviceaccount.com does not have storage.objects.get access**, the **default Compute Engine service account** (used by Cloud Build) needs read access to the Cloud Build bucket. A project owner can fix it:

```bash
# Replace PROJECT_ID (e.g. sandarb-ai)
export PROJECT_ID=sandarb-ai

# Get project number (e.g. 729735304329)
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

# Allow Cloud Build to read the uploaded source from the bucket
gcloud storage buckets add-iam-policy-binding gs://${PROJECT_ID}_cloudbuild \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/storage.objectViewer"
```

Then run `./scripts/deploy-gcp.sh $PROJECT_ID` again.

### Cloud Run: "One or more users do not belong to a permitted customer"

If deploy succeeds but you see **Setting IAM policy failed** or running:

```bash
gcloud run services add-iam-policy-binding sandarb \
  --member="allUsers" --role="roles/run.invoker" \
  --region=us-central1 --project=sandarb-ai
```

fails with **FAILED_PRECONDITION: One or more users named in the policy do not belong to a permitted customer**, the project (or its organization) has a policy that **disallows public access** (e.g. Domain Restricted Sharing). The service is still deployed; it is just not publicly invokable.

**Options:**

1. **Allow public access (needs org admin):** An organization admin must relax the policy so `allUsers` can be granted `roles/run.invoker` for this project or service (e.g. change Domain Restricted Sharing or add an exception). Then run the `add-iam-policy-binding` command above again.

2. **Keep the service private (no org change):** Use the service with **authenticated** calls only. Get an identity token and call the service with it:
   ```bash
   TOKEN=$(gcloud auth print-identity-token)
   curl -H "Authorization: Bearer $TOKEN" https://YOUR_SERVICE_URL/api/health
   ```
   Only principals allowed by your org policy (e.g. same Workspace domain) can get such a token and invoke the service.

Your live URL is still the one printed by the script (e.g. `https://sandarb-729735304329.us-central1.run.app`); use it with the token for authenticated access.

## One-command deploy (Cloud Run)

From the repo root, with your GCP project ID:

```bash
./scripts/deploy-gcp.sh 191433138534
# Optional: specify region (default us-central1)
./scripts/deploy-gcp.sh 191433138534 us-east1
```

Or set `GCP_PROJECT_ID` and run:

```bash
export GCP_PROJECT_ID=191433138534
./scripts/deploy-gcp.sh
```

The script enables APIs, creates an Artifact Registry repo if needed, builds the image with Cloud Build, and deploys to Cloud Run. The service URL is printed at the end.

**Demo data:** When `DATABASE_URL` is set, the container seeds sample data (orgs, agents, contexts, templates) on start. Sign in to see it on the dashboard, agents, and contexts pages.

## Build and push the image

### Option A: Artifact Registry (recommended)

```bash
# Create a Docker repo (one-time)
gcloud artifacts repositories create sandarb --repository-format=docker --location=REGION

# Configure Docker for Artifact Registry
gcloud auth configure-docker REGION-docker.pkg.dev

# Build and push (replace REGION and PROJECT_ID)
export REGION=us-central1
export PROJECT_ID=your-gcp-project-id
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/sandarb/sandarb:latest .
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/sandarb/sandarb:latest
```

### Option B: Container Registry (legacy)

```bash
docker build -t gcr.io/PROJECT_ID/sandarb:latest .
docker push gcr.io/PROJECT_ID/sandarb:latest
```

## Deploy to Cloud Run

Cloud Run sets `PORT` (usually 8080) automatically; the app uses it.

### With SQLite (ephemeral storage)

Good for trials; data is lost when the revision is replaced.

```bash
gcloud run deploy sandarb \
  --image REGION-docker.pkg.dev/PROJECT_ID/sandarb/sandarb:latest \
  --platform managed \
  --region REGION \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production"
```

### With Cloud SQL (PostgreSQL)

1. Create a Cloud SQL instance and database (e.g. `sandarb`).
2. Run schema init once (from your machine or a one-off job):
   - Set `DATABASE_URL` to your Cloud SQL connection (use [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/mysql/connect-auth-proxy) for local, or the instance connection name for Cloud Run).
   - Run: `npm run db:init-pg` (and optionally `npm run db:seed-pg`).
3. Deploy with Cloud SQL connection:

```bash
# If using the Cloud SQL connector (same VPC / connector)
gcloud run deploy sandarb \
  --image REGION-docker.pkg.dev/PROJECT_ID/sandarb/sandarb:latest \
  --platform managed \
  --region REGION \
  --add-cloudsql-instances PROJECT_ID:REGION:INSTANCE_NAME \
  --set-env-vars "NODE_ENV=production,DATABASE_URL=postgresql://USER:PASSWORD@/sandarb?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME"
```

Replace `USER`, `PASSWORD`, `INSTANCE_NAME`, `PROJECT_ID`, `REGION` with your values. For private IP, use the instance private IP in `DATABASE_URL` and ensure the Cloud Run service has VPC access.

## Deploy to GKE

1. Build and push the image (see above).
2. Create a Deployment and Service (and optional Ingress). Example snippet:

```yaml
# deployment.yaml (minimal)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sandarb
spec:
  replicas: 1
  selector:
    matchLabels:
      app: sandarb
  template:
    metadata:
      labels:
        app: sandarb
    spec:
      containers:
        - name: sandarb
          image: REGION-docker.pkg.dev/PROJECT_ID/sandarb/sandarb:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: production
            - name: PORT
              value: "3000"
            # - name: DATABASE_URL
            #   valueFrom:
            #     secretKeyRef:
            #       name: sandarb-db
            #       key: url
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
```

3. Use a `Secret` for `DATABASE_URL` when connecting to Cloud SQL or any external Postgres.

## Environment variables

| Variable | Description |
|----------|-------------|
| `PORT` | Set by Cloud Run (e.g. 8080). Default in image: 3000. |
| `DATABASE_URL` | PostgreSQL URL. When set, Sandarb uses Postgres; otherwise SQLite under `/app/data`. |
| `DATABASE_PATH` | Used only when `DATABASE_URL` is not set (SQLite path). |
| `NODE_ENV` | Set to `production` in the image. |

## Health check

The app exposes `GET /api/health`. Use it for Cloud Run and GKE liveness/readiness probes.
