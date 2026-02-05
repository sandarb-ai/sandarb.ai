# Sandarb Python Client SDK

A small client for Worker Agents to talk to the **Sandarb AI Governance Agent**: check-in (register), audit, get prompts and context, and call A2A skills.

## Install

```bash
pip install -r requirements.txt
# or: pip install requests
```

Copy `sandarb_client.py` into your project, or add this repo as a dependency.

## Quick start

```python
import os
from sandarb_client import SandarbClient

# Base URL: https://api.sandarb.ai (GCP) or http://localhost:8000 (local)
sandarb = SandarbClient(
    os.environ.get("SANDARB_URL", "https://api.sandarb.ai"),
    token=os.environ.get("SANDARB_TOKEN"),
    agent_id="my-agent-id",  # from your sandarb.json manifest
)

# 1. Check-in on startup (register with Sandarb)
manifest = {
    "agent_id": "my-agent-id",
    "version": "1.0.0",
    "owner_team": "platform",
    "url": "https://my-agent.example.com/a2a",
    "name": "My Agent",
}
sandarb.check_in(manifest)

# 2. Get prompt (with optional variable interpolation)
prompt = sandarb.get_prompt("my-agent-v1", variables={"user_tier": "gold"})
system_message = prompt["content"]

# 3. Validate or get context before use
ctx = sandarb.validate_context("trading-limits", source_agent="my-agent-id", intent="pre-trade")
if not ctx.get("approved"):
    raise ValueError("Context not approved")

# Or get context (requires source_agent for policy)
context = sandarb.get_context("ib-trading-limits", intent="pre-trade")

# 4. Run your agent (Sandarb is NOT in the path)...
# response = your_llm_call(system_message, context["content"], ...)

# 5. Audit push (log event for compliance)
sandarb.audit("inference", details={"response_length": 120})
```

## API

- **`check_in(manifest, org_id=None)`** – Register with Sandarb via `POST /api/agents/ping`. Manifest must include `agent_id`, `version`, `owner_team`, `url`. No Bearer token required.

- **`audit(event_type, resource_type=None, resource_id=None, resource_name=None, source_agent=None, details=None)`** – Log an event (A2A `audit_log` skill). Requires Bearer token.

- **`get_prompt(name, variables=None, intent=None)`** – Get current approved prompt by name (A2A `get_prompt`). Optional `variables` for `{{placeholder}}` interpolation.

- **`validate_context(name, source_agent=None, intent=None, environment=None)`** – Check context exists and return approved content (A2A `validate_context`).

- **`get_context(name, source_agent=None, intent=None, format=None)`** – Get approved context (A2A `get_context`). Requires `source_agent` (or set `agent_id` on the client) for policy.

- **`inject(name, format='json', agent_id=None, trace_id=None, variables=None)`** – Get context via REST `GET /api/inject`. Requires `X-Sandarb-Agent-ID` and `X-Sandarb-Trace-ID`; use `agent_id` or set `agent_id` on the client.

- **`call(skill_id, input_data)`** – Call any A2A skill (generic `skills/execute`).

- **`get_agent_card()`** – Fetch Sandarb Agent Card (`GET /api/a2a`). No auth required.

- **`list_prompts(tags=None)`** – List available prompts (A2A `list_prompts`).

- **`list_contexts(environment=None, active_only=True)`** – List available contexts (A2A `list_contexts`).

## Auth

- **Check-in** (`check_in`) and **Inject** (`inject`) do not require a Bearer token (but inject requires Agent-ID and Trace-ID for audit).
- **A2A calls** (`get_prompt`, `get_context`, `validate_context`, `audit`, `call`, `list_prompts`, `list_contexts`) require `Authorization: Bearer <token>`. Set `token` when creating the client or via `SANDARB_TOKEN`.

## Errors

`SandarbClientError` is raised on API or A2A failures; it has `status_code` and `body` when available.
