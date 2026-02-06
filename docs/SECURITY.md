# Security

Sandarb is designed for serious adoption by enterprises and regulated industries. This document describes the security features implemented in the platform and how to operate it securely.

---

## 1. API Key Authentication (SDK Endpoints)

All SDK-facing endpoints that serve governance data or write audit records **require a valid API key**. There is no "header trust": the server does **not** accept `X-Sandarb-Agent-ID` (or similar) as proof of identity by itself.

### Protected Endpoints

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `GET /api/inject` | Serve approved context by name | API key required |
| `GET /api/prompts/pull` | Serve approved prompt by name | API key required |
| `POST /api/audit/activity` | Log agent activity to `sandarb_access_logs` | API key required |
| `POST /api/seed` | Load sample data (restricted in production) | Write auth + production disabled |

### How It Works

- **API key** is sent via `Authorization: Bearer <api_key>` or `X-API-Key: <api_key>`.
- The backend resolves the key against the **service_accounts** table using **bcrypt** comparison (secrets are stored as `secret_hash`, never plaintext).
- Each service account is linked to a single **agent_id**. The server enforces that the **agent identity used in the request** (e.g. `X-Sandarb-Agent-ID`) **matches** the agent linked to that API key. An attacker cannot impersonate another agent by simply setting a header.
- Invalid or missing API key -> **401 Unauthorized**. Valid key but mismatched agent ID -> **403 Forbidden**.

### Service Accounts

- Stored in `service_accounts` with `client_id`, `secret_hash` (bcrypt), and `agent_id`.
- Typical clients: `sandarb-ui` (docs / Try API), `sandarb-api`, `sandarb-a2a`. You can add more for each agent or team.
- Secrets are generated at seed time and written to `.env.seed.generated` (file only, not stdout) so they are not exposed in logs. Add them to `.env` and never commit `.env.seed.generated`.

---

## 2. Rate Limiting

Sandarb implements rate limiting to protect against abuse and denial-of-service attacks.

### Default Rate Limits

| Endpoint Category | Default Limit | Environment Variable |
|-------------------|---------------|---------------------|
| General API endpoints | 100/minute | `RATE_LIMIT_DEFAULT` |
| Seed endpoint | 5/hour | `RATE_LIMIT_SEED` |
| Authentication endpoints | 20/minute | `RATE_LIMIT_AUTH` |

### How It Works

- Rate limiting is implemented using **slowapi** (based on Flask-Limiter).
- Limits are applied **per API key** (if provided) or **per IP address** (if no API key).
- When rate limit is exceeded, the API returns **429 Too Many Requests** with a `retry_after` hint.

### Configuration

Set rate limits via environment variables:

```bash
RATE_LIMIT_DEFAULT=200/minute   # Increase for high-traffic deployments
RATE_LIMIT_SEED=5/hour          # Keep low - seed is admin-only
RATE_LIMIT_AUTH=30/minute       # Adjust based on legitimate auth traffic
```

Format: `count/period` where period is `second`, `minute`, `hour`, or `day`.

---

## 3. Security Headers

All API responses include security headers to prevent common attacks:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `X-XSS-Protection` | `1; mode=block` | XSS protection (legacy browsers) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer information leakage |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` | Restricts browser features |
| `Content-Security-Policy` | `default-src 'self'; frame-ancestors 'none'` | Prevents embedding and restricts resources |

---

## 4. Error Handling & Information Disclosure Prevention

Sandarb sanitizes error responses to prevent information leakage:

### What's Protected

- **Database errors**: Connection strings, table names, and SQL errors are logged server-side only.
- **Stack traces**: Never exposed to clients; logged server-side for debugging.
- **File paths**: Internal paths are never included in error responses.
- **Configuration details**: Environment variables and settings are not exposed.

### Error Response Format

All errors return a consistent, sanitized format:

```json
{
  "success": false,
  "error": "A descriptive but safe error message"
}
```

Full error details are logged server-side with proper context for debugging.

---

## 5. Seed Endpoint Protection

The `/api/seed` endpoint is restricted in production:

### Security Controls

1. **Write authorization required**: Only users in `WRITE_ALLOWED_EMAILS` can call the endpoint.
2. **Production disabled by default**: In `SANDARB_ENV=production`, the endpoint returns 403 unless `ALLOW_SEED_IN_PRODUCTION=true`.
3. **Rate limited**: Only 5 calls per hour allowed.
4. **Error sanitization**: Database and script errors are logged server-side, not returned to clients.

### Configuration

```bash
# Enable seed in production (use with caution)
ALLOW_SEED_IN_PRODUCTION=true

# Must also be in write-allowed list
WRITE_ALLOWED_EMAILS=admin@company.com
```

---

## 6. Settings Validation

The `/api/settings` endpoint validates all setting keys against a whitelist:

### Allowed Settings Keys

```
theme, sidebar_collapsed, default_org, items_per_page,
approval_required, auto_archive_days, retention_days,
date_format, timezone, enable_a2a, enable_mcp, enable_audit_log
```

Custom settings are allowed with the `custom_` prefix (e.g., `custom_my_setting`).

### Key Format Requirements

- Must start with a letter
- Only alphanumeric characters, underscores, and hyphens
- Maximum 64 characters

Invalid keys are rejected with a 400 error listing allowed keys.

---

## 7. MCP & A2A Authentication

Both the MCP server (`/mcp`) and A2A endpoint (`/a2a`) expose 22 tools / 24 skills respectively. All tools/skills that access governed data require:

- **API key** via `Authorization: Bearer <api_key>` (same service_accounts table as REST API)
- **Agent identity** (`source_agent` / `sourceAgent`) — must match a registered agent
- **Trace ID** for audit logging

Three skills (`agent/info`, `skills/list`, `validate_context`) do **not** require authentication for discovery purposes.

---

## 8. Agent Registration Validation

A2A agent registration (`register` skill) and MCP `register_agent` tool include validation:

### URL Validation

- Only valid HTTP/HTTPS URLs are accepted
- Malformed or potentially malicious URLs are rejected

### Duplicate Prevention

- Agent IDs must be unique
- Attempting to register an existing agent ID returns an error

### Error Sanitization

- Registration errors are logged server-side
- Clients receive generic error messages without internal details

---

## 9. No Default or Weak Secrets in Production

### Backend (Python)

- **JWT_SECRET**: In production (`SANDARB_ENV=production`), the backend **refuses to start** if `JWT_SECRET` is unset or set to the dev placeholder `dev-secret-do-not-use-in-prod`.
- **CORS**: When `SANDARB_ENV=production` and not in dev mode, CORS origins default to the value of `CORS_ORIGINS` (comma-separated). Localhost is **not** included by default, reducing risk from malicious local pages.

### Frontend (Next.js / Node)

- **JWT_SECRET**: When `NODE_ENV=production`, the app **throws at load time** if `JWT_SECRET` is missing or equals the dev placeholder. This prevents accidental deployment with a known weak secret.

---

## 10. Preview / Bypass Restrictions

The "preview" agent IDs (`sandarb-context-preview`, `sandarb-prompt-preview`) allow the docs "Try API" to work without registering a real agent. To prevent abuse:

- Preview is **only** allowed when **one** of:
  - **SANDARB_DEV=true** (explicit dev mode), or
  - The request is authenticated with the **sandarb-ui** API key (intended for the docs UI only).
- Any other API key (e.g. a normal agent key) **cannot** use the preview agent ID to bypass agent registration or context/prompt linking.

---

## 11. Secrets Not Exposed in Logs

- **Seed script** (`scripts/seed_postgres.py`): When generating new service account secrets, they are written **only** to `.env.seed.generated` (mode `0600`). Nothing is printed to stdout, so Cloud Logging (or similar) does not capture plaintext secrets.
- **`.env.seed.generated`** is listed in `.gitignore` and must not be committed.
- **Error logging**: Sensitive information is never included in error messages returned to clients.

---

## 12. SQL Safety

- All user- or client-controlled input is bound via **parameterized queries** (e.g. `%s` with tuple params). There are no string-concatenated SQL fragments built from user input.
- Where dynamic SQL is used (e.g. optional columns in updates), only **allowlisted** column names are used (e.g. `update_organization`), so keys are never user-controlled.

---

## 13. Deployment and Network Security

- The reference GCP deploy script (`scripts/deploy-gcp.sh`) documents that **`--allow-unauthenticated`** exposes the control plane to the public internet. For production, the doc recommends:
  - **Identity-Aware Proxy (IAP)** or **Cloud Identity** for access control, and/or
  - **VPC / private ingress** and removing `--allow-unauthenticated` so only authorized networks or users can reach the services.
- Sandarb is intended to run in **your** control plane, behind your load balancer and network policies, not as a public SaaS by default.

---

## 14. Environment Variables (Production Checklist)

| Variable | Purpose | Production Recommendation |
|----------|---------|--------------------------|
| **JWT_SECRET** | Signing/verifying session tokens | **Required**; generate with `openssl rand -hex 32` |
| **SANDARB_ENV** | Enable production security checks | Set to `production` |
| **CORS_ORIGINS** | Allowed origins for API | Set explicitly; no localhost |
| **SANDARB_DEV** | Enables preview agent and relaxed CORS | **Do not** set in production |
| **ALLOW_SEED_IN_PRODUCTION** | Enable /api/seed endpoint | Leave unset (defaults to false) |
| **RATE_LIMIT_DEFAULT** | API rate limiting | Adjust based on expected traffic |
| **SANDARB_UI_SECRET** / **SANDARB_API_SECRET** / **SANDARB_A2A_SECRET** | Service account secrets | Use secure secret store; never commit |
| **DATABASE_URL** | Postgres connection | Use restricted credentials and TLS |

---

## 15. Summary Table

| Area | Control | Effect |
|------|---------|--------|
| **SDK endpoints** | API key + agent-id binding | No impersonation; only the key's linked agent can act as that agent |
| **MCP & A2A** | API key + agent identity per tool/skill | Same auth as SDK; governed data requires registered agent + linked resources |
| **Rate limiting** | slowapi with configurable limits | Prevents abuse and DoS attacks |
| **Security headers** | X-Frame-Options, CSP, etc. | Mitigates clickjacking, XSS, MIME sniffing |
| **Error handling** | Sanitized responses, server-side logging | No information disclosure to attackers |
| **Seed endpoint** | Write auth + production disabled | Prevents unauthorized data manipulation |
| **Settings validation** | Key whitelist + format validation | Prevents configuration injection |
| **Agent registration** | URL validation + duplicate check | Prevents malicious agent registration |
| **Secrets** | No default/weak secrets in prod | Backend and frontend fail fast if JWT_SECRET is weak |
| **Preview** | Restricted to dev or sandarb-ui key | Prevents bypass of access checks |
| **Secrets in logs** | Seed writes to file only | Avoids plaintext secrets in log aggregation |
| **CORS** | Explicit origins in production | Reduces risk from arbitrary origins |
| **SQL** | Parameterized + allowlisted columns | Mitigates SQL injection |
| **Deployment** | Documented use of IAP / private ingress | Encourages locking down the control plane |

For deployment and hardening steps, see **[deploy-gcp.md](deploy-gcp.md)** and **[developer-guide.md](developer-guide.md)**.
