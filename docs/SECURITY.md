# Security

Sandarb is designed for serious adoption by enterprises and regulated industries. This document describes the security features implemented in the platform and how to operate it securely.

---

## 1. API Key Authentication (SDK Endpoints)

All SDK-facing endpoints that serve governance data or write audit records **require a valid API key**. There is no “header trust”: the server does **not** accept `X-Sandarb-Agent-ID` (or similar) as proof of identity by itself.

### Protected Endpoints

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `GET /api/inject` | Serve approved context by name | API key required |
| `GET /api/prompts/pull` | Serve approved prompt by name | API key required |
| `POST /api/audit/activity` | Log agent activity to `sandarb_access_logs` | API key required |

### How It Works

- **API key** is sent via `Authorization: Bearer <api_key>` or `X-API-Key: <api_key>`.
- The backend resolves the key against the **service_accounts** table using **bcrypt** comparison (secrets are stored as `secret_hash`, never plaintext).
- Each service account is linked to a single **agent_id**. The server enforces that the **agent identity used in the request** (e.g. `X-Sandarb-Agent-ID`) **matches** the agent linked to that API key. An attacker cannot impersonate another agent by simply setting a header.
- Invalid or missing API key → **401 Unauthorized**. Valid key but mismatched agent ID → **403 Forbidden**.

### Service Accounts

- Stored in `service_accounts` with `client_id`, `secret_hash` (bcrypt), and `agent_id`.
- Typical clients: `sandarb-ui` (docs / Try API), `sandarb-api`, `sandarb-a2a`. You can add more for each agent or team.
- Secrets are generated at seed time and written to `.env.seed.generated` (file only, not stdout) so they are not exposed in logs. Add them to `.env` and never commit `.env.seed.generated`.

---

## 2. No Default or Weak Secrets in Production

### Backend (Python)

- **JWT_SECRET**: In production (`SANDARB_ENV=production`), the backend **refuses to start** if `JWT_SECRET` is unset or set to the dev placeholder `dev-secret-do-not-use-in-prod`.
- **CORS**: When `SANDARB_ENV=production` and not in dev mode, CORS origins default to the value of `CORS_ORIGINS` (comma-separated). Localhost is **not** included by default, reducing risk from malicious local pages.

### Frontend (Next.js / Node)

- **JWT_SECRET**: When `NODE_ENV=production`, the app **throws at load time** if `JWT_SECRET` is missing or equals the dev placeholder. This prevents accidental deployment with a known weak secret.

---

## 3. Preview / Bypass Restrictions

The “preview” agent IDs (`sandarb-context-preview`, `sandarb-prompt-preview`) allow the docs “Try API” to work without registering a real agent. To prevent abuse:

- Preview is **only** allowed when **one** of:
  - **SANDARB_DEV=true** (explicit dev mode), or
  - The request is authenticated with the **sandarb-ui** API key (intended for the docs UI only).
- Any other API key (e.g. a normal agent key) **cannot** use the preview agent ID to bypass agent registration or context/prompt linking.

---

## 4. Secrets Not Exposed in Logs

- **Seed script** (`scripts/seed_postgres.py`): When generating new service account secrets, they are written **only** to `.env.seed.generated` (mode `0600`). Nothing is printed to stdout, so Cloud Logging (or similar) does not capture plaintext secrets.
- **`.env.seed.generated`** is listed in `.gitignore` and must not be committed.

---

## 5. SQL Safety

- All user- or client-controlled input is bound via **parameterized queries** (e.g. `%s` with tuple params). There are no string-concatenated SQL fragments built from user input.
- Where dynamic SQL is used (e.g. optional columns in updates), only **allowlisted** column names are used (e.g. `update_organization`), so keys are never user-controlled.

---

## 6. Deployment and Network Security

- The reference GCP deploy script (`scripts/deploy-gcp.sh`) documents that **`--allow-unauthenticated`** exposes the control plane to the public internet. For production, the doc recommends:
  - **Identity-Aware Proxy (IAP)** or **Cloud Identity** for access control, and/or
  - **VPC / private ingress** and removing `--allow-unauthenticated` so only authorized networks or users can reach the services.
- Sandarb is intended to run in **your** control plane, behind your load balancer and network policies, not as a public SaaS by default.

---

## 7. Environment Variables (Production Checklist)

| Variable | Purpose | Production |
|----------|---------|------------|
| **JWT_SECRET** | Signing/verifying session tokens (UI) | **Required**; must be a strong secret, not the dev placeholder. |
| **SANDARB_ENV** | Set to `production` to enforce strict secrets and CORS. | Set to `production`. |
| **CORS_ORIGINS** | Allowed origins for API (comma-separated). | Set explicitly; no localhost unless needed. |
| **SANDARB_DEV** | Enables preview agent and relaxed CORS. | **Do not** set in production. |
| **SANDARB_UI_SECRET** / **SANDARB_API_SECRET** / **SANDARB_A2A_SECRET** | Service account secrets for UI, API, A2A. | Set from a secure secret store; do not commit. |
| **DATABASE_URL** / **CLOUD_SQL_DATABASE_URL** | Postgres connection. | Use restricted credentials and TLS. |

---

## 8. Summary Table

| Area | Control | Effect |
|------|---------|--------|
| **SDK endpoints** | API key + agent-id binding | No impersonation; only the key’s linked agent can act as that agent. |
| **Secrets** | No default/weak secrets in prod | Backend and frontend fail fast if JWT_SECRET is weak or missing in production. |
| **Preview** | Restricted to dev or sandarb-ui key | Prevents use of “preview” to bypass access checks. |
| **Secrets in logs** | Seed writes to file only | Avoids plaintext secrets in stdout/log aggregation. |
| **CORS** | Explicit origins in production | Reduces risk from arbitrary origins (e.g. localhost). |
| **SQL** | Parameterized + allowlisted columns | Mitigates SQL injection. |
| **Deployment** | Documented use of IAP / private ingress | Encourages locking down the control plane in production. |

For deployment and hardening steps, see **[deploy-gcp.md](deploy-gcp.md)** and **[developer-guide.md](developer-guide.md)**.
