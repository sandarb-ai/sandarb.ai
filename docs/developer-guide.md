# Sandarb developer guide

Developer integration and usage guide for anyone in the firm. For the full interactive guide, open **/docs** in the running Sandarb app (e.g. https://your-sandarb.example.com/docs).

## Overview

Sandarb is AI governance for your AI agents: a single place for approved prompts and context, audit trail, lineage, and a living agent registry. Integrate via:

- **REST API** – CRUD for organizations, agents, contexts, templates; inject context by name
- **A2A protocol** – Discovery (Agent Card) and skills: `get_context`, `validate_context`, `get_lineage`, `register`
- **Inject API** – `GET /api/inject?name=my-context` returns approved context (JSON/YAML/text) for your agent

## Quick start

```bash
git clone https://github.com/openint-ai/sandarb.ai.git
cd sandarb.ai
npm install
export DATABASE_URL=postgresql://postgres:sandarb@localhost:5432/sandarb-dev  # optional
./scripts/start-sandarb.sh
```

Open the UI at http://localhost:4000. Sign in to see the dashboard. Demo data is seeded on start when `DATABASE_URL` is set.

## REST API (core)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| GET | /api/inject?name=... | Inject context by name |
| GET | /api/contexts | List contexts |
| GET | /api/contexts/:id | Get context |
| POST | /api/contexts | Create context |
| GET | /api/agents | List agents |
| POST | /api/agents/register | Register agent |
| POST | /api/agents/:id/approve | Approve agent |
| GET | /api/organizations | List organizations |
| POST | /api/organizations | Create organization |
| GET | /api/a2a | A2A Agent Card (discovery) |
| POST | /api/a2a | A2A skill execution |
| GET | /api/lineage | Recent context deliveries |

## Inject API

Your agent fetches approved context by name. Sandarb logs the request for lineage.

```bash
GET /api/inject?name=ib-trading-limits
GET /api/inject?name=my-context&format=json
GET /api/inject?name=my-context&vars={"user_id":"123"}
```

Optional headers: `X-Sandarb-Agent-ID`, `X-Sandarb-Trace-ID`, `X-Sandarb-Variables` (JSON).

## A2A protocol

- **Discovery:** `GET /api/a2a` returns the Agent Card (name, description, url, version, capabilities, skills).
- **Skills:** `POST /api/a2a` with body `{ "skill": "get_context", "input": { "name": "my-context" } }`.
  - `get_context` – Retrieve context by name (lineage logged)
  - `validate_context` – Validate context content
  - `get_lineage` – Recent context deliveries
  - `register` – Register an agent (manifest with agent_id, version, owner_team, url)

Spec: [a2a.dev](https://a2a.dev), [a2a-protocol.org](https://a2a-protocol.org).

## Audit headers

- `X-Sandarb-Agent-ID` – Calling agent identifier
- `X-Sandarb-Trace-ID` – Request/correlation ID

## Environment variables

| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL URL (optional; default SQLite) |
| NEXT_PUBLIC_API_URL | API base URL when UI and API run on different ports |
| PORT | Server port (default 3000) |
| NODE_ENV | production / development |

## Deployment

- **Docker:** `docker compose up -d` (Postgres + app). Demo data seeded on start when `DATABASE_URL` is set.
- **GCP Cloud Run:** `./scripts/deploy-gcp.sh PROJECT_ID`. See [deploy-gcp.md](./deploy-gcp.md) for permissions and Cloud SQL.

## More

- In-app docs: open **/docs** in the running Sandarb instance
- Repository: [github.com/openint-ai/sandarb.ai](https://github.com/openint-ai/sandarb.ai)
