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

From the repo root:

```bash
./scripts/deploy-gcp.sh
```

Defaults: **project** `sandarb-ai` (or `GCP_PROJECT_ID` or gcloud config), **region** `us-central1`, **build** with Docker layer cache. The script loads `DATABASE_URL` from `.env` in the repo root if present.

Override project/region or disable cache:

```bash
./scripts/deploy-gcp.sh sandarb-ai us-central1
./scripts/deploy-gcp.sh my-project us-east1 --no-cache
```

The script enables APIs, creates an Artifact Registry repo if needed, builds the image with Cloud Build (unique tag per build), and deploys to Cloud Run. The service URL is printed at the end.

### API base URL (api.sandarb.ai)

When the UI is served at **sandarb.ai** (or a host containing `sandarb.ai`), the app uses **https://api.sandarb.ai** as the API base by default. On **localhost**, it uses **http://localhost:4001**. You can override with `NEXT_PUBLIC_API_URL`. To use api.sandarb.ai on GCP:

1. Point the subdomain **api.sandarb.ai** to your API service (e.g. the same Cloud Run service, or a separate one) via DNS and load balancer / Cloud Run custom domain.
2. Ensure the UI is served from a host that contains `sandarb.ai` (e.g. sandarb.ai or www.sandarb.ai) so the client picks https://api.sandarb.ai automatically.

**Deployment not showing latest code?** The script uses a unique image tag per build. To disable Docker layer cache, run with `--no-cache` (may fail if Kaniko is disabled in the project).

**GCP demo: use Postgres and drive all demo from the DB.**  
Put `DATABASE_URL` in `.env` (or export it) so the script passes it to Cloud Run and reseeds after deploy. The script will:

1. **Pass `DATABASE_URL` to Cloud Run** so the service uses Postgres (required).
2. **Attach the Cloud SQL instance** to the service when the URL uses the Unix socket (`host=/cloudsql/PROJECT:REGION:INSTANCE`).
3. **Reseed the DB** after deploy (full reset + seed) so the GCP DB has the same data as local.

Then on container start, the entrypoint runs a full reset and seed when `DATABASE_URL` is set, so all demo data is driven from the database (500+ agents, 3000+ contexts, 2000+ prompts). Sign in to see it on the dashboard, Agent Registry, and contexts pages.

### Post-deploy: clean and reseed GCP Postgres (real-world data like localhost)

After deployment, the GCP Postgres database may not have the same real-world sample data as localhost unless you run a full reset and seed. **When you reseed (Option 1 or 2 below), you get the same scale as local:**

- **30 orgs** (child orgs + root)
- **500+ agents** (Agent Registry)
- **3000+ contexts** (policies, products, risk rules, FAQs)
- **2000+ prompts** (real-world AI agent prompts)
- Templates, settings, scan targets, audit samples

**Option 1 – Use Postgres and reseed as part of deploy (recommended)**  
Set **`CLOUD_SQL_DATABASE_URL`** in `.env` to your Cloud SQL connection string (or export it). The deploy script uses it for **both** Cloud Run and post-deploy reseed, so the deployed app and the reseed target the **same** DB. If you only set `DATABASE_URL` to localhost (for local dev), Cloud Run would get that and show no data; use `CLOUD_SQL_DATABASE_URL` for GCP.

```bash
# In .env (recommended): keep DATABASE_URL for local, add CLOUD_SQL_DATABASE_URL for deploy
# CLOUD_SQL_DATABASE_URL=postgresql://USER:PASS@/DB?host=/cloudsql/PROJECT:REGION:INSTANCE
# Or public IP (ensure DB allows Cloud Run egress and your machine for reseed):
# CLOUD_SQL_DATABASE_URL=postgresql://USER:PASS@PUBLIC_IP:5432/DB

./scripts/deploy-gcp.sh PROJECT_ID [REGION]
```

If `CLOUD_SQL_DATABASE_URL` is unset, the script uses `DATABASE_URL`. The script will **fail** with a clear message if the chosen URL contains localhost (Cloud Run cannot reach it).

**Option 2 – Reseed only (no redeploy)**  
From your machine, seed Cloud SQL using the dedicated script (recommended) or npm:

```bash
# Recommended: uses CLOUD_SQL_DATABASE_URL from .env, or pass the URL
./scripts/seed-cloud-sql.sh
# Or with URL explicitly:
./scripts/seed-cloud-sql.sh 'postgresql://USER:PASS@HOST:5432/DB'

# Alternative: set DATABASE_URL and run full-reset
export DATABASE_URL="postgresql://..."   # your Cloud SQL URL
npm run db:full-reset-pg
```

The script `scripts/seed-cloud-sql.sh` loads `CLOUD_SQL_DATABASE_URL` (or `DATABASE_URL`) from `.env`, refuses localhost URLs, and runs a full reset + seed so the GCP DB gets the same sample data as local: 30 orgs, 500+ agents, 3000+ contexts, 2000+ prompts, templates, settings.

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

**For GCP demo we use Postgres (Cloud SQL) so all demo data is driven from the DB.** Use the one-command deploy with `DATABASE_URL` set (see “Post-deploy: clean and reseed” above), or deploy manually as below with Cloud SQL.

### With Cloud SQL (PostgreSQL) — required

1. Create a Cloud SQL instance and database (e.g. `sandarb`).
2. Set `DATABASE_URL` and run the deploy script (it will pass `DATABASE_URL` to Cloud Run and reseed), or deploy manually:
   - Set `DATABASE_URL` to your Cloud SQL connection (Unix socket for Cloud Run: `?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME`; see [Cloud SQL connection](https://cloud.google.com/sql/docs/postgres/connect-run)).
   - Run: `npm run db:init-pg` (and optionally `npm run db:full-reset-pg`) from your machine if you want to seed before first deploy.
3. Deploy with Cloud SQL connection (all demo data is then driven from the DB):

```bash
# Unix socket (attach Cloud SQL instance)
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
| `DATABASE_URL` | PostgreSQL URL (required). Set to your Cloud SQL URL for GCP; all demo data is driven from the DB. |
| `NODE_ENV` | Set to `production` in the image. |

## Health check

The app exposes `GET /api/health`. Use it for Cloud Run and GKE liveness/readiness probes.
