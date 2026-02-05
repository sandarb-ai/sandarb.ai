# Sandarb SDK Unified Interface

This document defines the **abstract interface** that all Sandarb SDKs (Python, TypeScript/Node, Go, Java/Kotlin, C#/.NET) must implement. Consistency across languages ensures predictable behavior and simplifies integration.

## Authentication

All SDKs authenticate via an **API Key** that maps to the `service_accounts` table in the Sandarb schema:

- **Header**: `Authorization: Bearer <api_key>` or `X-API-Key: <api_key>`
- The backend resolves the API key to a service account (`client_id` / secret) and associates the request with an `agent_id` for audit and linking checks.
- SDK constructors accept `api_key` (or `token`) and send it on every request.

## Required Methods

### 1. `get_context(context_name: string, agent_id: string) -> GetContextResult`

Fetches the current approved context by name for a given agent. Access is gated by `agent_contexts` (the context must be linked to the agent).

**Parameters:**

| Name           | Type   | Description                          |
|----------------|--------|--------------------------------------|
| `context_name` | string | Unique context name (e.g. `trading-limits`) |
| `agent_id`     | string | Calling agent identifier (must match a registered agent) |

**Returns:** `GetContextResult`

| Field                | Type   | Description                                      |
|----------------------|--------|--------------------------------------------------|
| `content`            | object | Context payload (from `context_versions.content`, JSONB) |
| `context_version_id` | string | UUID of the context version served (for lineage/audit) |

**Backend:** `GET /api/inject?name={context_name}` with headers `X-Sandarb-Agent-ID`, `X-Sandarb-Trace-ID`. Response may include `X-Context-Version-ID` for `context_version_id`.

**Errors:** 400 (missing params), 403 (agent not registered or context not linked), 404 (context not found).

---

### 2. `get_prompt(prompt_name: string, variables?: dict) -> GetPromptResult`

Fetches the current approved prompt by name with optional variable substitution. Access is gated by `agent_prompts`.

**Parameters:**

| Name          | Type   | Description                                |
|---------------|--------|--------------------------------------------|
| `prompt_name` | string | Unique prompt name (e.g. `customer-support-v1`) |
| `variables`   | dict   | Optional key-value map for `{{variable}}` substitution in prompt content |

**Returns:** `GetPromptResult`

| Field    | Type   | Description                                  |
|----------|--------|----------------------------------------------|
| `content`| string | Compiled prompt text (after variable substitution) |
| `version`| int    | Prompt version number (from `prompt_versions.version`) |
| `model`  | string \| null | Optional model hint from prompt_versions |
| `system_prompt` | string \| null | Optional system prompt field |

**Backend:** `GET /api/prompts/pull?name={prompt_name}` (and optional `vars` for variables). Headers: `X-Sandarb-Agent-ID`, `X-Sandarb-Trace-ID`.

**Errors:** 400 (missing params), 403 (agent not registered or prompt not linked), 404 (prompt not found or no approved version).

---

### 3. `log_activity(agent_id: string, trace_id: string, inputs: object, outputs: object) -> void`

Writes an access/activity record to `sandarb_access_logs` for audit and lineage. Stores `inputs` and `outputs` in the `metadata` JSONB column.

**Parameters:**

| Name       | Type   | Description                    |
|------------|--------|--------------------------------|
| `agent_id`| string | Calling agent identifier      |
| `trace_id`| string | Request/correlation ID         |
| `inputs`  | object | JSON-serializable request/input payload  |
| `outputs` | object | JSON-serializable response/output payload |

**Backend:** Either a dedicated `POST /api/audit/activity` (or similar) that inserts into `sandarb_access_logs` with `metadata = { "inputs": inputs, "outputs": outputs }`, or the SDK may use an existing audit endpoint. Schema: `sandarb_access_logs (agent_id, trace_id, metadata)`.

**Returns:** No return value; throws on HTTP error.

---

## Shared Conventions

1. **Trace ID**: If the client does not provide a trace ID, the SDK should generate one (e.g. UUID) per request for lineage.
2. **Strict typing**: Use schema-derived types for `contexts` / `context_versions` (content JSONB) and `prompts` / `prompt_versions` (content TEXT, variables JSONB) as defined in `schema/sandarb.sql`.
3. **Idempotency**: `get_context` and `get_prompt` are idempotent reads; `log_activity` is a write and should be clearly documented as such.
4. **Base URL**: Configurable (e.g. `base_url` or `SANDARB_URL` env). Default: `https://api.sandarb.ai`.

## Schema Reference

- **contexts**: `id`, `name`, `description`, `org_id`, `data_classification`, `owner_team`, …
- **context_versions**: `id`, `context_id`, `version`, `content` (JSONB), `status`, `is_active`, …
- **prompts**: `id`, `name`, `description`, `org_id`, `current_version_id`, …
- **prompt_versions**: `id`, `prompt_id`, `version`, `content` (TEXT), `variables` (JSONB), `model`, `temperature`, `max_tokens`, `system_prompt`, …
- **sandarb_access_logs**: `log_id`, `agent_id`, `trace_id`, `context_id`, `version_id`, `prompt_id`, `prompt_version_id`, `accessed_at`, `metadata` (JSONB).
- **service_accounts**: `id`, `client_id`, `secret_hash`, `agent_id`.
