# Deployment Guide

This guide covers deploying Sandarb for different environments: local development, GCP Cloud Run (managed SaaS), and enterprise/on-premises deployments.

---

## Deployment Options Overview

| Deployment Type | Use Case | Domain Configuration |
|-----------------|----------|---------------------|
| **Local Development** | Testing, development | `localhost:3000` / `localhost:8000` |
| **GCP Cloud Run** | Managed Sandarb SaaS | `ui.sandarb.ai`, `api.sandarb.ai`, `agent.sandarb.ai` |
| **Enterprise/On-Premises** | Internal company deployment | `ui.governance.company.com`, etc. |

---

## Architecture

Sandarb runs as three services:

| Service | Purpose | Default Port |
|---------|---------|--------------|
| **UI** (Next.js) | Dashboard, documentation, management interface | 3000 |
| **API** (FastAPI) | REST API, CRUD operations, dashboard data | 8000 |
| **Agent** (FastAPI) | A2A/MCP endpoints for agent-to-agent communication | 8000 |

In development, API and Agent run as a single service. In production, they can be separate for scaling and isolation.

---

## Local Development

### Quick Start

```bash
# Clone the repository
git clone https://github.com/sandarb-ai/sandarb.ai.git
cd sandarb.ai

# Install dependencies
npm install
pip install -r backend/requirements.txt

# Copy environment template
cp .env.example .env

# Start PostgreSQL (via Docker)
docker compose up -d postgres

# Start Sandarb
./scripts/start-sandarb.sh
```

### Default URLs

- **UI**: http://localhost:3000
- **API**: http://localhost:8000
- **Agent**: http://localhost:8000 (same as API in dev)

### Environment Variables (Development)

```bash
# .env for local development
DATABASE_URL=postgresql://postgres:sandarb@localhost:5432/sandarb
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_AGENT_URL=http://localhost:8000
BACKEND_URL=http://localhost:8000
```

---

## GCP Cloud Run Deployment

For deploying to GCP Cloud Run with the managed `sandarb.ai` domain:

### Deploy Script

```bash
./scripts/deploy-gcp.sh PROJECT_ID [REGION] [--seed]
```

### Services Created

| Service | URL | Purpose |
|---------|-----|---------|
| `sandarb-ui` | `https://ui.sandarb.ai` | Dashboard |
| `sandarb-api` | `https://api.sandarb.ai` | REST API |
| `sandarb-agent` | `https://agent.sandarb.ai` | A2A/MCP |

### Environment Variables (GCP)

```bash
SANDARB_ENV=production
SANDARB_DOMAIN=sandarb.ai
DATABASE_URL=postgresql://...@/sandarb?host=/cloudsql/project:region:instance
JWT_SECRET=<strong-secret>
```

See [deploy-gcp.md](deploy-gcp.md) for detailed GCP deployment instructions.

---

## Enterprise / On-Premises Deployment

For deploying Sandarb within your organization's infrastructure.

### Domain Configuration

Set `SANDARB_DOMAIN` to your company's domain. Sandarb will automatically configure:

```bash
# Example: SANDARB_DOMAIN=governance.company.com
# Creates:
#   UI:    https://ui.governance.company.com
#   API:   https://api.governance.company.com
#   Agent: https://agent.governance.company.com

SANDARB_DOMAIN=governance.company.com
```

### Alternative: Explicit URL Configuration

If you don't want to use subdomains, configure URLs explicitly:

```bash
# Frontend configuration
NEXT_PUBLIC_API_URL=https://sandarb-api.internal.company.com
NEXT_PUBLIC_AGENT_URL=https://sandarb-agent.internal.company.com
BACKEND_URL=https://sandarb-api.internal.company.com

# Backend configuration
AGENT_PUBLIC_URL=https://sandarb-agent.internal.company.com
AGENT_BASE_URL=https://sandarb-agent.internal.company.com
```

### Alternative: Custom Subdomain Pattern

```bash
# Custom subdomains
NEXT_PUBLIC_DOMAIN=governance.company.com
NEXT_PUBLIC_API_SUBDOMAIN=api        # -> api.governance.company.com
NEXT_PUBLIC_AGENT_SUBDOMAIN=agent    # -> agent.governance.company.com
```

### CORS Configuration

CORS is auto-configured from `SANDARB_DOMAIN`, but you can override:

```bash
# Explicit CORS origins (comma-separated)
CORS_ORIGINS=https://ui.governance.company.com,https://internal-tool.company.com
```

### Full Enterprise Environment Example

```bash
# .env for enterprise deployment
# See .env.enterprise.example for a complete template

# Database
DATABASE_URL=postgresql://sandarb:PASSWORD@your-postgres-server:5432/sandarb

# Security
SANDARB_ENV=production
JWT_SECRET=<generate-with-openssl-rand-hex-32>
WRITE_ALLOWED_EMAILS=admin@company.com,platform-team@company.com

# Domain
SANDARB_DOMAIN=governance.company.com

# Rate limiting
RATE_LIMIT_DEFAULT=200/minute

# Observability
OTEL_ENABLED=true
OTEL_SERVICE_NAME=sandarb-governance
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-otel-collector:4318
```

---

## Docker Deployment

### Docker Compose (Development)

```bash
docker compose up -d
```

### Production Docker Deployment

Build and run the containers:

```bash
# Build UI
docker build -t sandarb-ui -f Dockerfile .

# Build Backend (API + Agent)
docker build -t sandarb-backend -f Dockerfile.backend .

# Run UI
docker run -d -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=https://api.governance.company.com \
  -e NEXT_PUBLIC_AGENT_URL=https://agent.governance.company.com \
  sandarb-ui

# Run API
docker run -d -p 8000:8000 \
  -e DATABASE_URL=postgresql://... \
  -e SANDARB_ENV=production \
  -e JWT_SECRET=<secret> \
  -e SANDARB_DOMAIN=governance.company.com \
  sandarb-backend

# Run Agent (separate service)
docker run -d -p 8001:8000 \
  -e DATABASE_URL=postgresql://... \
  -e SANDARB_ENV=production \
  -e JWT_SECRET=<secret> \
  -e SANDARB_AGENT_SERVICE=true \
  -e AGENT_BASE_URL=https://agent.governance.company.com \
  sandarb-backend
```

---

## Kubernetes Deployment

Example Kubernetes manifests for enterprise deployment:

### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: sandarb-config
data:
  SANDARB_ENV: "production"
  SANDARB_DOMAIN: "governance.company.com"
  RATE_LIMIT_DEFAULT: "200/minute"
```

### Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: sandarb-secrets
type: Opaque
stringData:
  DATABASE_URL: "postgresql://sandarb:PASSWORD@postgres:5432/sandarb"
  JWT_SECRET: "<your-jwt-secret>"
  SANDARB_UI_SECRET: "<your-ui-secret>"
  SANDARB_API_SECRET: "<your-api-secret>"
  SANDARB_A2A_SECRET: "<your-a2a-secret>"
```

### Deployment (API)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sandarb-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: sandarb-api
  template:
    metadata:
      labels:
        app: sandarb-api
    spec:
      containers:
      - name: api
        image: your-registry/sandarb-backend:latest
        ports:
        - containerPort: 8000
        envFrom:
        - configMapRef:
            name: sandarb-config
        - secretRef:
            name: sandarb-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

---

## Security Checklist

Before deploying to production, ensure:

- [ ] `SANDARB_ENV=production` is set
- [ ] `JWT_SECRET` is a strong random string (64+ chars)
- [ ] `DATABASE_URL` uses TLS and restricted credentials
- [ ] `CORS_ORIGINS` is explicitly configured (no localhost)
- [ ] `SANDARB_DEV` is NOT set
- [ ] `ALLOW_SEED_IN_PRODUCTION` is NOT set (or explicitly `false`)
- [ ] Rate limiting is configured appropriately
- [ ] Services are behind a load balancer with TLS
- [ ] Network access is restricted (VPC, IAP, VPN)
- [ ] Service account secrets are stored securely (not in code)

See [SECURITY.md](SECURITY.md) for detailed security documentation.

---

## Environment Variable Reference

### Required Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Strong secret for JWT signing (required in production) |

### Domain Configuration

| Variable | Description |
|----------|-------------|
| `SANDARB_DOMAIN` | Base domain for auto-configuration |
| `NEXT_PUBLIC_API_URL` | Explicit API URL override |
| `NEXT_PUBLIC_AGENT_URL` | Explicit Agent URL override |
| `NEXT_PUBLIC_DOMAIN` | Frontend domain for subdomain detection |
| `NEXT_PUBLIC_API_SUBDOMAIN` | API subdomain (default: `api`) |
| `NEXT_PUBLIC_AGENT_SUBDOMAIN` | Agent subdomain (default: `agent`) |
| `BACKEND_URL` | Server-side rendering URL |
| `AGENT_PUBLIC_URL` | Public URL for agent service |
| `AGENT_BASE_URL` | Base URL for A2A/MCP endpoints |

### Security

| Variable | Description |
|----------|-------------|
| `SANDARB_ENV` | Set to `production` for production mode |
| `SANDARB_DEV` | Enable development mode (do NOT set in prod) |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `WRITE_ALLOWED_EMAILS` | Emails allowed for write operations |
| `ALLOW_SEED_IN_PRODUCTION` | Enable /api/seed in production |

### Rate Limiting

| Variable | Description |
|----------|-------------|
| `RATE_LIMIT_DEFAULT` | Default rate limit (e.g., `100/minute`) |
| `RATE_LIMIT_SEED` | Seed endpoint limit (e.g., `5/hour`) |
| `RATE_LIMIT_AUTH` | Auth endpoint limit (e.g., `20/minute`) |

### Service Accounts

| Variable | Description |
|----------|-------------|
| `SANDARB_UI_SECRET` | UI service account secret |
| `SANDARB_API_SECRET` | API service account secret |
| `SANDARB_A2A_SECRET` | A2A service account secret |

### Observability

| Variable | Description |
|----------|-------------|
| `OTEL_ENABLED` | Enable OpenTelemetry (`true`/`false`) |
| `OTEL_SERVICE_NAME` | Service name for traces |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector endpoint |

---

## Troubleshooting

### CORS Errors

If you see CORS errors in the browser:

1. Check `CORS_ORIGINS` includes your UI domain
2. Verify `SANDARB_DOMAIN` is set correctly
3. Ensure the API is accessible from the UI's domain

### Rate Limit Errors (429)

If you see "Rate limit exceeded":

1. Increase `RATE_LIMIT_DEFAULT` for high-traffic deployments
2. Ensure legitimate traffic isn't being blocked
3. Check if a single client is making too many requests

### Database Connection Issues

If the API can't connect to PostgreSQL:

1. Verify `DATABASE_URL` is correct
2. Check network connectivity to the database
3. Ensure the database user has proper permissions
4. For Cloud SQL, verify the Cloud SQL Proxy is running

### JWT Errors

If you see JWT-related errors:

1. Ensure `JWT_SECRET` is set in both frontend and backend
2. Verify the secret is the same across all services
3. Check that tokens haven't expired

---

## Support

- **Documentation**: [docs/](.)
- **Issues**: [GitHub Issues](https://github.com/sandarb-ai/sandarb.ai/issues)
- **Security**: See [SECURITY.md](SECURITY.md)
