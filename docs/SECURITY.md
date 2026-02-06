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

## 2. API Key Expiration

Service account API keys support an optional **`expires_at`** timestamp. When set, the key is automatically rejected after expiry.

### How It Works

- The `service_accounts` table has an `expires_at` column (`TIMESTAMP WITH TIME ZONE`, nullable).
- After bcrypt verification succeeds, the backend checks `expires_at`. If the current time exceeds `expires_at`, an `ApiKeyExpiredError` is raised.
- **REST API:** Returns `401 Unauthorized` with `"API key has expired."`.
- **A2A endpoint:** Returns a JSON-RPC error with code `-32001` and message `"API key has expired."`.
- **MCP endpoint:** Returns an MCP tool error with `"API key has expired."`.
- Keys with `expires_at = NULL` never expire (backward compatible).

### Migration

```sql
ALTER TABLE service_accounts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_service_accounts_expires_at ON service_accounts(expires_at) WHERE expires_at IS NOT NULL;
```

### Best Practices

- Set expiration dates on all production service accounts (e.g., 90 days).
- Rotate keys before expiration using a new service account.
- Monitor for `401` responses with "API key has expired" in your agent logs.

---

## 3. Rate Limiting

Sandarb implements rate limiting at two levels to protect against abuse and denial-of-service attacks.

### REST API Rate Limits

| Endpoint Category | Default Limit | Environment Variable |
|-------------------|---------------|---------------------|
| General API endpoints | 100/minute | `RATE_LIMIT_DEFAULT` |
| Seed endpoint | 5/hour | `RATE_LIMIT_SEED` |
| Authentication endpoints | 20/minute | `RATE_LIMIT_AUTH` |

REST rate limiting is implemented using **slowapi** (based on Flask-Limiter). Limits are applied **per API key** (first 16 characters) or **per IP address** (if no API key). When rate limit is exceeded, the API returns **429 Too Many Requests** with a `retry_after` hint.

### A2A Per-Skill Rate Limits

A2A skills are rate-limited by tier using a **sliding window** algorithm, applied per API key:

| Tier | Skills | Default Limit | Environment Variable |
|------|--------|---------------|---------------------|
| Discovery | `agent/info`, `skills/list`, `validate_context` | Unlimited | — |
| List | `list_agents`, `list_organizations`, `list_contexts`, `list_prompts` | 30/min | `RATE_LIMIT_A2A_LIST` |
| Get | `get_agent`, `get_context`, `get_prompt`, etc. | 60/min | `RATE_LIMIT_A2A_GET` |
| Audit | `get_lineage`, `get_blocked_injections`, `get_audit_log` | 10/min | `RATE_LIMIT_A2A_AUDIT` |
| Reports | `get_dashboard`, `get_reports` | 10/min | `RATE_LIMIT_A2A_REPORTS` |
| Register | `register` | 5/min | `RATE_LIMIT_A2A_REGISTER` |

The sliding window rate limiter (`SlidingWindowRateLimiter`) is thread-safe and operates in-process. Each rate key combines the API key prefix and skill name (e.g., `sk-abc123...:list_agents`).

### Configuration

Set rate limits via environment variables:

```bash
# REST API
RATE_LIMIT_DEFAULT=200/minute   # Increase for high-traffic deployments
RATE_LIMIT_SEED=5/hour          # Keep low - seed is admin-only
RATE_LIMIT_AUTH=30/minute       # Adjust based on legitimate auth traffic

# A2A per-skill (requests per minute)
RATE_LIMIT_A2A_LIST=30
RATE_LIMIT_A2A_GET=60
RATE_LIMIT_A2A_AUDIT=10
RATE_LIMIT_A2A_REPORTS=10
RATE_LIMIT_A2A_REGISTER=5
```

Format for REST limits: `count/period` where period is `second`, `minute`, `hour`, or `day`.
Format for A2A limits: integer (requests per minute).

---

## 4. Database Connection Pooling

The backend uses **`psycopg2.ThreadedConnectionPool`** for concurrent request handling. This replaces a single shared connection with a managed pool, preventing connection contention under load.

### Configuration

| Setting | Default | Environment Variable |
|---------|---------|---------------------|
| Minimum connections | 2 | `DB_POOL_MIN` |
| Maximum connections | 10 | `DB_POOL_MAX` |
| Connection timeout | 10 seconds | `DB_CONNECT_TIMEOUT` |

### How It Works

- On first use, a pool is created with `minconn` idle connections.
- Each request acquires a connection from the pool and returns it after the query completes.
- If all connections are in use, new requests block until a connection is returned (up to `connect_timeout`).
- The pool is gracefully closed during application shutdown (via FastAPI lifespan).
- All queries use parameterized statements via the pool's connections.

### Best Practices

- Set `DB_POOL_MAX` to match your expected concurrent request volume.
- Monitor pool exhaustion in production (all connections in use = requests queuing).
- Use `DB_CONNECT_TIMEOUT` to fail fast rather than queue indefinitely.

---

## 5. Pagination

All list endpoints enforce pagination to prevent large result sets from consuming excessive memory or bandwidth.

### Limits

- **Default page size:** 50 items
- **Maximum page size:** 500 items (enforced by FastAPI `Query(le=500)`)
- **Offset:** 0-based, no upper limit

### Response Shape

Paginated endpoints return a wrapper object with metadata:

```json
{
  "success": true,
  "data": {
    "agents": [...],
    "total": 951,
    "limit": 50,
    "offset": 0
  }
}
```

The `total` field reflects the true count in the database, not the number of items returned. This allows clients to implement proper pagination controls.

### Affected Endpoints

| Endpoint | Collection Key |
|----------|---------------|
| `GET /api/agents` | `agents` |
| `GET /api/organizations` (flat list) | `organizations` |
| `GET /api/prompts` | `prompts` |
| `GET /api/contexts` | `contexts` |
| A2A `list_agents`, `list_organizations`, etc. | Same structure in A2A result |

Tree and root modes for organizations are **not** paginated (they return the full hierarchy).

---

## 6. Security Headers

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

## 7. Error Handling & Information Disclosure Prevention

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

## 8. Seed Endpoint Protection

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

## 9. Settings Validation

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

## 10. MCP & A2A Authentication

Both the MCP server (`/mcp`) and A2A endpoint (`/a2a`) expose 22 tools / 24 skills respectively. All tools/skills that access governed data require:

- **API key** via `Authorization: Bearer <api_key>` (same service_accounts table as REST API)
- **Agent identity** (`source_agent` / `sourceAgent`) — must match a registered agent
- **Trace ID** for audit logging

Three skills (`agent/info`, `skills/list`, `validate_context`) do **not** require authentication for discovery purposes.

---

## 11. Agent Registration Validation

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

## 12. No Default or Weak Secrets in Production

### Backend (Python)

- **JWT_SECRET**: In production (`SANDARB_ENV=production`), the backend **refuses to start** if `JWT_SECRET` is unset or set to the dev placeholder `dev-secret-do-not-use-in-prod`.
- **CORS**: When `SANDARB_ENV=production` and not in dev mode, CORS origins default to the value of `CORS_ORIGINS` (comma-separated). Localhost is **not** included by default, reducing risk from malicious local pages.

### Frontend (Next.js / Node)

- **JWT_SECRET**: When `NODE_ENV=production`, the app **throws at load time** if `JWT_SECRET` is missing or equals the dev placeholder. This prevents accidental deployment with a known weak secret.

---

## 13. Preview / Bypass Restrictions

The "preview" agent IDs (`sandarb-context-preview`, `sandarb-prompt-preview`) allow the docs "Try API" to work without registering a real agent. To prevent abuse:

- Preview is **only** allowed when **one** of:
  - **SANDARB_DEV=true** (explicit dev mode), or
  - The request is authenticated with the **sandarb-ui** API key (intended for the docs UI only).
- Any other API key (e.g. a normal agent key) **cannot** use the preview agent ID to bypass agent registration or context/prompt linking.

---

## 14. Secrets Not Exposed in Logs

- **Seed script** (`scripts/seed_postgres.py`): When generating new service account secrets, they are written **only** to `.env.seed.generated` (mode `0600`). Nothing is printed to stdout, so Cloud Logging (or similar) does not capture plaintext secrets.
- **`.env.seed.generated`** is listed in `.gitignore` and must not be committed.
- **Error logging**: Sensitive information is never included in error messages returned to clients.

---

## 15. SQL Safety

- All user- or client-controlled input is bound via **parameterized queries** (e.g. `%s` with tuple params). There are no string-concatenated SQL fragments built from user input.
- Where dynamic SQL is used (e.g. optional columns in updates), only **allowlisted** column names are used (e.g. `update_organization`), so keys are never user-controlled.

---

## 16. Deployment and Network Security

- The reference GCP deploy script (`scripts/deploy-gcp.sh`) documents that **`--allow-unauthenticated`** exposes the control plane to the public internet. For production, the doc recommends:
  - **Identity-Aware Proxy (IAP)** or **Cloud Identity** for access control, and/or
  - **VPC / private ingress** and removing `--allow-unauthenticated` so only authorized networks or users can reach the services.
- Sandarb is intended to run in **your** control plane, behind your load balancer and network policies, not as a public SaaS by default.

---

## 17. Environment Variables (Production Checklist)

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
| **DB_POOL_MIN** | Minimum pool connections | Default `2`; increase for high-concurrency |
| **DB_POOL_MAX** | Maximum pool connections | Default `10`; match expected concurrent load |
| **DB_CONNECT_TIMEOUT** | Connection timeout (seconds) | Default `10`; lower for fail-fast behavior |
| **RATE_LIMIT_A2A_LIST** | A2A list skill limit (req/min) | Default `30`; adjust per deployment |
| **RATE_LIMIT_A2A_GET** | A2A get skill limit (req/min) | Default `60` |
| **RATE_LIMIT_A2A_AUDIT** | A2A audit skill limit (req/min) | Default `10` |
| **RATE_LIMIT_A2A_REPORTS** | A2A reports skill limit (req/min) | Default `10` |
| **RATE_LIMIT_A2A_REGISTER** | A2A register skill limit (req/min) | Default `5` |

---

## 18. Summary Table

| Area | Control | Effect |
|------|---------|--------|
| **SDK endpoints** | API key + agent-id binding | No impersonation; only the key's linked agent can act as that agent |
| **API key expiration** | `expires_at` column on service_accounts | Keys automatically rejected after expiry; 401/JSON-RPC error |
| **MCP & A2A** | API key + agent identity per tool/skill | Same auth as SDK; governed data requires registered agent + linked resources |
| **REST rate limiting** | slowapi with configurable limits | Prevents abuse and DoS attacks on REST API |
| **A2A rate limiting** | Per-skill sliding window limiter (6 tiers) | Fine-grained protection per skill category |
| **Connection pooling** | ThreadedConnectionPool (min=2, max=10) | Concurrent request handling without contention |
| **Pagination** | limit/offset with max 500 per page | Prevents large result sets from exhausting memory |
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
