# Sandarb Hybrid Architecture Analysis

**Objective:** Refactor from monolithic Next.js to **Next.js (frontend) + FastAPI (backend)**.  
**Scope:** Types, API routes, and business logic to migrate; frontend (UI, pages, client logic) remains in Next.js.

**Implementation status:** A FastAPI backend is scaffolded under `backend/` with health and agents (CRUD + approve/reject). When `BACKEND_URL` is set in `.env`, Next.js proxies `/api/health` and `/api/agents/*` to the backend. See `backend/README.md` for run instructions.

---

## 1. Types (`types/index.ts`) — Source of Truth

Single file (~430 lines). All models are TypeScript interfaces/enums. **Migration:** Replicate as Pydantic models in FastAPI; keep TypeScript types in frontend (generated from OpenAPI or hand-synced).

### 1.1 Type Groups (by domain)

| Group | Key Types | Notes |
|-------|-----------|--------|
| **Prompt Management** | `Prompt`, `PromptVersion`, `PromptVariable`, `PromptVersionCreateInput`, `PromptVersionStatus` | Governance workflow (draft → proposed → approved/rejected). |
| **Context Management** | `Context`, `ContextCreateInput`, `ContextUpdateInput`, `ContextRevision`, `ContextRevisionCreateInput`, `RevisionStatus`, `LineOfBusiness`, `DataClassification`, `RegulatoryHook` | Compliance tags, revision workflow. |
| **Templates** | `Template`, `TemplateSchema`, `TemplateField`, `TemplateCreateInput`, `TemplateUpdateInput` | Schema-driven defaults. |
| **API/Injection** | `InjectionParams`, `InjectionResponse`, `InjectionFormat`, `ApiResponse<T>`, `PaginatedResponse<T>` | Shared API response shapes. |
| **MCP** | `MCPResource`, `MCPTool`, `MCPPrompt`, `MCPPromptMessage` | Model Context Protocol. |
| **A2A** | `AgentCard`, `AgentSkill`, `AgentCapabilities`, `SandarbManifest`, `A2ATaskSpec`, `A2ATask`, `TaskStatus`, `TaskState`, `A2AMessage`, `A2AMessagePart`, `A2AArtifact` | Agent-to-Agent protocol (Google A2A spec). |
| **Organizations & Agents** | `Organization`, `OrganizationCreateInput`, `OrganizationUpdateInput`, `OrgMember`, `OrgRole`, `RegisteredAgent`, `RegisteredAgentCreateInput`, `RegisteredAgentUpdateInput`, `AgentStatus`, `AgentApprovalStatus` | Registry + approval workflow. |
| **Observability** | `RequestLog`, `UsageMetrics` | Optional for v1. |
| **Settings** | `AppSettings` | Key-value settings. |
| **Dashboard** | `DashboardStats`, `ActivityItem` | Aggregations. |
| **Experiments** | `Experiment`, `ExperimentVariant`, `ExperimentResult` | A/B testing (optional for v1). |

### 1.2 FastAPI Mapping

- **Pydantic v2:** One module per domain (e.g. `schemas/prompts.py`, `schemas/contexts.py`, `schemas/a2a.py`) or a single `schemas/` package.
- **Enums:** `PromptVersionStatus`, `RevisionStatus`, `LineOfBusiness`, `DataClassification`, `RegulatoryHook`, `TaskState`, `OrgRole`, `AgentStatus`, `AgentApprovalStatus` → `Enum` in Python.
- **Generics:** `ApiResponse[T]`, `PaginatedResponse[T]` → Pydantic `GenericModel` or wrapper classes.
- **OpenAPI:** FastAPI will expose these as OpenAPI schema; frontend can use `openapi-typescript` or similar to regenerate TS types.

---

## 2. API Routes (`app/api/**`) — Route Inventory

All handlers use **Next.js App Router** (`route.ts`). Pattern: parse request → call `lib/*` → return `NextResponse.json()`.

### 2.1 Route → Lib Mapping

| Route | Methods | Lib Dependencies | Purpose |
|-------|---------|-------------------|---------|
| `/api/health` | GET | `contexts`, `templates`, `otel` | Health check (DB + counts). |
| `/api/agents` | GET, POST | `agents`, `organizations`, `otel` | List/create agents. |
| `/api/agents/[id]` | GET, PATCH, DELETE | `agents`, `otel` | Get/update/delete agent. |
| `/api/agents/[id]/approve` | POST | `agents`, `otel` | Approve agent. |
| `/api/agents/[id]/reject` | POST | `agents`, `otel` | Reject agent. |
| `/api/agents/[id]/mcp-poll` | GET | `agents`, `mcp-client`, `otel` | Poll agent MCP. |
| `/api/agents/ping` | POST | `agents`, `otel` | Manifest-based ping/upsert. |
| `/api/agents/register` | POST | `agents`, `otel` | Register by URL. |
| `/api/organizations` | GET, POST | `organizations`, `otel` | List/create orgs. |
| `/api/organizations/[id]` | GET, PATCH, DELETE | `organizations`, `otel` | Get/update/delete org. |
| `/api/contexts` | GET, POST | `contexts`, `otel` | List/create contexts. |
| `/api/contexts/[id]` | GET, PATCH, DELETE | `contexts`, `otel` | Get/update/delete context. |
| `/api/contexts/[id]/revisions` | GET, POST | `revisions`, `contexts`, `otel` | List/create revisions. |
| `/api/contexts/[id]/revisions/[revId]/approve` | POST | `revisions`, `otel` | Approve revision. |
| `/api/contexts/[id]/revisions/[revId]/reject` | POST | `revisions`, `otel` | Reject revision. |
| `/api/prompts` | GET, POST | `prompts`, `otel` | List/create prompts. |
| `/api/prompts/[id]` | GET, PATCH, DELETE | `prompts`, `otel` | Get/update/delete prompt. |
| `/api/prompts/[id]/versions` | GET, POST | `prompts`, `otel` | List/create versions. |
| `/api/prompts/[id]/versions/[versionId]/approve` | POST | `prompts`, `otel` | Approve version. |
| `/api/prompts/[id]/versions/[versionId]/reject` | POST | `prompts`, `otel` | Reject version. |
| `/api/prompts/pending` | GET | `prompts`, `otel` | Proposed versions. |
| `/api/prompts/pull` | GET | `prompts`, `audit`, `otel` | Get prompt by name + interpolate + audit. |
| `/api/templates` | GET, POST | `templates`, `otel` | List/create templates. |
| `/api/inject` | GET, POST | `contexts`, `audit`, `agents`, `policy`, `utils`, `otel` | Context injection (governance). |
| `/api/dashboard` | GET | `contexts`, `templates`, `otel` | Dashboard stats. |
| `/api/settings` | GET, PATCH | `settings`, `otel` | Key-value settings. |
| `/api/lineage` | GET | `audit`, `otel` | Lineage/audit. |
| `/api/seed` | POST | `organizations`, `agents`, `contexts`, `revisions`, `templates`, `prompts`, `pg`, `otel` | Seed data (dev). |
| `/api/auth/token` | POST | `auth/jwt`, `service-accounts-pg`, `otel` | JWT for service accounts. |
| `/a2a` | GET, POST | `a2a-server`, `audit`, `auth/jwt`, `otel` | A2A Agent Card + JSON-RPC 2.0. |
| `/mcp` | GET, POST | `mcp-server`, `otel` | MCP JSON-RPC 2.0. |
| `/api/governance/scan` | POST | `governance`, `otel` | Discovery scan. |
| `/api/governance/blocked-injections` | GET | `audit`, `otel` | Blocked injections. |
| `/api/governance/intersection` | GET | `audit`, `otel` | Governance intersection log. |
| `/api/governance/unauthenticated-agents` | GET | `governance`, `otel` | Unauthenticated detections. |
| `/api/agent-pulse/log` | GET | `audit`, `otel` | A2A call log. |

### 2.2 FastAPI Endpoint Mapping

- **Path params:** `[id]`, `[revId]`, `[versionId]` → FastAPI path params, e.g. `/agents/{id}`, `/contexts/{id}/revisions/{rev_id}`.
- **Query params:** Preserve (e.g. `orgId`, `approvalStatus`, `page`, `pageSize`).
- **Body:** Use Pydantic request models aligned with `types/index.ts` (e.g. `RegisteredAgentCreateInput`).
- **Response:** Use Pydantic response models; standardize `ApiResponse[T]` / `PaginatedResponse[T]`.
- **Auth:** `/api/auth/token` stays in backend; JWT validation middleware in FastAPI (same secret/alg).

---

## 3. Lib (`lib/**`) — Business Logic & Data Access

### 3.1 Layering

| Layer | Modules | Role |
|-------|----------|------|
| **API-facing (service)** | `agents`, `contexts`, `prompts`, `revisions`, `organizations`, `templates`, `settings`, `dashboard`, `audit`, `policy`, `governance` | Business logic; call *-pg or pg; use `@/types`. |
| **Data access (*-pg)** | `agents-pg`, `contexts-pg`, `organizations-pg`, `revisions-pg`, `templates-pg`, `settings-pg`, `audit-pg`, `service-accounts-pg` | Postgres queries; use `pg` (pool/query). |
| **Infrastructure** | `pg`, `auth/jwt`, `otel`, `utils`, `api` | DB pool, JWT, tracing, helpers. |
| **Protocols** | `a2a-server`, `mcp-server`, `mcp-client` | A2A + MCP implementation; depend on service layer + types. |

### 3.2 Dependency Graph (simplified)

```
app/api/*.ts
    → lib/agents, contexts, prompts, revisions, organizations, templates, settings, audit, policy, governance
    → lib/a2a-server, mcp-server
    → lib/auth/jwt, otel

lib/agents.ts       → agents-pg, organizations
lib/contexts.ts     → contexts-pg
lib/prompts.ts     → pg (direct)
lib/revisions.ts   → revisions-pg
lib/organizations.ts → organizations-pg
lib/templates.ts   → templates-pg
lib/settings.ts    → settings-pg
lib/audit.ts       → audit-pg
lib/governance.ts  → pg, agents
lib/policy.ts      → (types only)
lib/dashboard.ts   → organizations, agents, contexts

lib/a2a-server.ts  → prompts, contexts, agents, revisions, audit, policy, mcp-client, utils + types
lib/mcp-server.ts  → prompts, contexts, utils + types
lib/mcp-client.ts  → (HTTP client to external MCP)

*-pg.ts            → pg, types
lib/pg.ts          → pg (npm), otel, SCHEMA_SQL
```

### 3.3 FastAPI / Python Module Mapping

| Current (lib) | Python (suggested) | Notes |
|---------------|---------------------|--------|
| `pg` | `db.session`, `db.models` (or SQLAlchemy async) | Pool, schema, migrations (e.g. Alembic). |
| `agents-pg` + `agents` | `services.agents` or `repositories.agents` + `services.agents` | Same DB surface; optional repo layer. |
| `contexts-pg` + `contexts` | `services.contexts` | |
| `prompts` (no separate -pg) | `services.prompts` | Prompts use `pg` directly. |
| `revisions-pg` + `revisions` | `services.revisions` | |
| `organizations-pg` + `organizations` | `services.organizations` | |
| `templates-pg` + `templates` | `services.templates` | |
| `settings-pg` + `settings` | `services.settings` | |
| `audit-pg` + `audit` | `services.audit` | |
| `service-accounts-pg` | `services.auth` or `repositories.service_accounts` | Used by JWT issuance. |
| `governance` | `services.governance` | Scan, unauthenticated detections. |
| `policy` | `services.policy` | Inject policy checks. |
| `dashboard` | `services.dashboard` | Aggregations. |
| `a2a-server` | `routers.a2a` or `services.a2a` | A2A JSON-RPC + Agent Card. |
| `mcp-server` | `routers.mcp` or `services.mcp` | MCP JSON-RPC. |
| `mcp-client` | `clients.mcp` | HTTP client to external MCP. |
| `auth/jwt` | `auth.jwt` | Sign/verify JWT (same alg/secret). |
| `utils` | `utils.format`, `utils.substitute` | formatContent, substituteVariables. |
| `otel` | `observability.otel` or OpenTelemetry FastAPI middleware | |

---

## 4. Protocol Surfaces (MCP & A2A)

### 4.1 MCP (`lib/mcp-server.ts`)

- **Methods:** `initialize`, `resources/list`, `resources/read`, `tools/list`, `tools/call`, `prompts/list`, `prompts/get` (JSON-RPC 2.0).
- **Uses:** `prompts`, `contexts`, `utils`; types `MCPResource`, `MCPTool`, `MCPPrompt`, `MCPPromptMessage`.
- **Migration:** FastAPI router with JSON-RPC 2.0 handler (single POST); delegate to Python equivalents of `listResources`, `readResource`, `listTools`, `callTool`, `listMCPPrompts`, `getMCPPrompt`.

### 4.2 A2A (`lib/a2a-server.ts`)

- **GET:** Agent Card (discovery).
- **POST:** JSON-RPC 2.0: `message/send`, `tasks/get`, `tasks/create`, `tasks/execute`, `skills/list`, `skills/execute`, `agent/info`.
- **Uses:** `prompts`, `contexts`, `agents`, `revisions`, `audit`, `policy`, `mcp-client`, `utils`; types `AgentCard`, `AgentSkill`, `A2ATask`, `A2AMessage`, etc.
- **Migration:** FastAPI router; GET returns Agent Card; POST dispatches to Python implementations of `createTask`, `executeTask`, `getTask`, `executeSkill`, `processMessage`, etc. Keep A2A skill definitions (e.g. `get_prompt`, `validate_context`) in sync with types.

---

## 5. Migration Order (Suggested)

1. **Foundation**  
   - FastAPI app skeleton; Pydantic schemas from `types/index.ts` (start with Agents, Organizations, Contexts, Prompts).  
   - DB: reuse existing Postgres; add SQLAlchemy + Alembic or raw driver + shared schema.

2. **Auth**  
   - `POST /auth/token` (service account → JWT); FastAPI dependency for JWT validation on protected routes.

3. **CRUD + governance workflows**  
   - Agents, organizations, contexts, revisions, prompts, versions, templates, settings (mirror current API surface).

4. **Inject & policy**  
   - `GET/POST /inject`; `policy` + `contexts` + `audit` in Python.

5. **Dashboard & audit**  
   - `GET /dashboard`, `GET /lineage`, governance endpoints (`scan`, `blocked-injections`, `intersection`, `unauthenticated-agents`), `agent-pulse/log`.

6. **MCP**  
   - Single JSON-RPC endpoint; implement all MCP methods in Python.

7. **A2A**  
   - Agent Card + JSON-RPC handler; implement all A2A skills and task lifecycle in Python.

8. **Next.js frontend**  
   - Replace `fetch('/api/...')` with `fetch(process.env.NEXT_PUBLIC_API_URL + '/...')`; use env for FastAPI base URL. Remove `app/api/**` as routes are migrated.

---

## 6. Summary

| Asset | Location (current) | Migration target |
|-------|--------------------|------------------|
| **Data models** | `types/index.ts` | FastAPI Pydantic schemas (+ optional OpenAPI → TS for frontend) |
| **API surface** | `app/api/**/*.ts` (~35 route files) | FastAPI routers (same paths/verbs) |
| **Business logic** | `lib/*.ts` (excluding *-pg) | Python services/routers |
| **Data access** | `lib/*-pg.ts`, `lib/pg.ts` | Python DB layer (SQLAlchemy or raw) |
| **Protocols** | `lib/a2a-server.ts`, `lib/mcp-server.ts`, `lib/mcp-client.ts` | FastAPI A2A/MCP routers + Python MCP client |
| **Auth** | `lib/auth/jwt.ts`, `lib/service-accounts-pg` | FastAPI auth module + same DB table |
| **Frontend** | `app/**` (pages, components), `components/**` | Unchanged; point to FastAPI base URL |

This document is the single source of truth for the hybrid refactor: **Next.js (frontend) + FastAPI (backend)** with types, API routes, and business logic moved to Python as described above.
