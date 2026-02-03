# Sandarb.ai - Agent Instructions

> **AI Governance for your AI Agents.**
> Manage and govern your AI Agents prompts and context in a protocol first approach workflows (think A2A, API and Git-like). Every request logged; lineage and audit built in.

---

## What is Sandarb.ai?

**Sandarb.ai is an open source project that any company can install on their control plane.**

It provides both:
- **API** - Standard HTTP endpoints for traditional integration  
- **AI Agent** - Supports A2A (Agent-to-Agent) protocol

---

## Goals

1. **Governance that doesn't slow shipping AI Agents to production**
2. **Protocol-first** (A2A, MCP, HTTP)
3. **Version management & traceability** for prompts and context
4. **Living AI Agents registry**

---

## What We Solve

1. **Single source of truth** - approved prompts and context; agents pull via API or A2A
2. **Audit trail** - who requested what, when
3. **Manifest-based registration** - git-like versioning
4. **Sandarb runs as an AI Agent** - communicates via A2A

---

## Understanding Prompts vs Context

### The Prompt
The specific request from a client, advisor, or internal system. ("What should I do?")

> **Analogy:** The Prompt is the sticky note you hand them: "Go buy coffee."

### The Context
The "Compliance Sandbox," "Client Portfolio," "Market Data," and "Security Clearance" the agent must operate within.

> **Analogy:** The Context is everything else they need to know to succeed:
> - Who is the coffee for?
> - Do they have cash?
> - Where is the nearest shop?
> - Is the office on fire?

---

## The Security Problem We Address

From OpenClaw's Security Documentation:
> "Prompt injection is still an industry-wide unsolved problem... System prompt guardrails are soft guidance only; hard enforcement comes from tool policy, exec approvals, sandboxing, and channel allowlists."

**Sandarb.ai provides the governance layer that makes prompt injection mitigation practical at enterprise scale.**

### Our Approach
1. **Identity first** - who can talk to the bot → Agent Registry
2. **Scope next** - where the bot can act → Approved Prompts & Context
3. **Model last** - assume manipulation possible → Audit Trail & Lineage

---

## Key Files to Study

```
/Users/sudhir/openint-sandarb/
├── README.md                    # Full project vision
├── LEARNING.md                  # Team learnings (log yours here!)
├── lib/
│   ├── a2a-server.ts           # A2A protocol implementation
│   ├── mcp-server.ts           # MCP protocol implementation
│   ├── prompts.ts              # Prompt versioning & management
│   ├── contexts.ts             # Context management
│   ├── governance.ts           # Governance intersection tracking
│   ├── audit-pg.ts             # Audit trail database
│   └── policy.ts               # Policy enforcement
├── app/
│   ├── api/                    # REST API endpoints
│   │   ├── a2a/route.ts       # A2A endpoint
│   │   ├── agents/            # Agent registry
│   │   ├── prompts/           # Prompt management
│   │   └── contexts/          # Context management
│   └── dashboard/             # Compliance dashboard UI
└── types/index.ts              # TypeScript definitions
```

---

## Core Features to Implement

### 1. A2A Protocol (Sandarb as Gatekeeper)
- Skills: `get_context`, `validate_context`, `get_lineage`, `register`
- Sandarb validates requesting agent's permissions before releasing data

### 2. Prompt & Context Versioning
- Git-like: branch, fork, rollback
- SHA256 content hashing for integrity
- Approval workflow: Draft → Pending Review → Approved

### 3. Audit Trail & Lineage
- Track: "Agent X used Prompt v4.2 with Context #992"
- Governance intersection table
- Fast lineage queries for incident resolution

### 4. Agent Registry
- Manifest-based registration (MCP standards)
- Agent Cards for A2A discovery
- Every agent known, authorized, versioned

---

## Sandarb.AI Team (Apsaras)

*Apsaras* is the generic name for all OpenClaw agents on the Sandarb.AI team.

| Apsara | Role | Focus Area |
|-------|------|------------|
| ⚖️ Punjikasthala | A2A Protocol & Compliance | `lib/a2a-server.ts`, `lib/governance.ts` |
| 🎭 Mishrakeshi | Prompt Versioning | `lib/prompts.ts`, `lib/revisions.ts` |
| 🔱 Rambha | Agent Registry & API | `app/api/agents/`, `app/api/inject/` |
| 💎 Tilottama | Audit Schema | `lib/audit-pg.ts`, `scripts/init-postgres.js` |
| ⚙️ Ghritachi | Approval Workflows | `lib/prompts.ts`, `lib/contexts.ts` |
| 🏛️ Alambusha | Infrastructure | `Dockerfile`, `docker-compose.yml` |
| 🪷 Urvashi | Compliance Dashboard | `app/dashboard/`, `app/prompts/` |
| ✨ Menaka | UI Components | `components/ui/`, `components/` |

---

## Two driver scripts

| Script | Purpose |
|--------|--------|
| **`./scripts/start-sandarb.sh`** | **Bring up Sandarb** — platform only (UI, API, Postgres if set). No agents. |
| **`./scripts/start-apsara-team.sh`** | **Start Sandarb.ai team of Apsaras** — OpenClaw agents with missions from this repo to build AI prompt & context features. |

### Run the Sandarb.AI team (Apsaras chat + develop)

1. **Bring up the platform**: `./scripts/start-sandarb.sh` → UI at http://localhost:4000
2. **Start the Apsara team**: `./scripts/start-apsara-team.sh`
   - **Dry run** (one agent, ~1 min): `./scripts/start-apsara-team.sh --dry-run` → response in `logs/punjikasthala.log`
   - **Full run**: Round 1: each Apsara posts to Team Chat and starts work; Round 2: progress/reply and continues.
3. **Watch Team Chat** at `/apsara-chat` — messages in `logs/team-chat.log`

Requires **OpenClaw** installed (and gateway running; the team script can start it). For local LLM without API keys, use **Ollama + Qwen 2.5**: run `./scripts/setup-ollama.sh` and point OpenClaw at the generated config (see [LEARNING.md](LEARNING.md) and [Local Development with Ollama](docs/developer-guide.md#local-development-with-ollama--qwen-25)).

---

## Log Your Work

1. **Individual logs**: `logs/{your-name}.log`
2. **Team chat**: `logs/team-chat.log` (Apsara-to-Apsara messages; visible in Team Chat UI)
3. **Learnings**: Add insights to `LEARNING.md` under your section
4. **Master log**: `logs/features.log`

---

## References

- [OpenClaw Security Best Practices](https://docs.openclaw.ai/gateway/security)
- [A2A Protocol](https://a2a-protocol.org/)
- [MCP (Model Context Protocol)](https://modelcontextprotocol.io/)
