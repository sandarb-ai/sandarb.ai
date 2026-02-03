# Sandarb.ai Team Learning Log

> **AI Governance for your AI Agents.**
> Manage and govern your AI Agents prompts and context in a protocol first approach workflows (think A2A, API and Git-like). Every request logged; lineage and audit built in.

---

## 🎯 What is Sandarb.ai?

**Sandarb.ai is an open source project that any company can install on their control plane.**

It provides both:
- **API** - Standard HTTP endpoints for traditional integration
- **AI Agent** - Supports A2A (Agent-to-Agent) protocol

### Goals
1. **Governance that doesn't slow shipping AI Agents to production**
2. **Protocol-first** (A2A, MCP, HTTP)
3. **Version management & traceability** for prompts and context
4. **Living AI Agents registry**

### What We Solve
1. **Single source of truth** - approved prompts and context; agents pull via API or A2A
2. **Audit trail** - who requested what, when
3. **Manifest-based registration** - git-like versioning
4. **Sandarb runs as an AI Agent** - communicates via A2A

---

## 📝 Understanding Prompts vs Context

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

## 🔒 The Security Problem We're Addressing

From OpenClaw's Security Documentation:
> "Prompt injection is still an industry-wide unsolved problem... System prompt guardrails are soft guidance only; hard enforcement comes from tool policy, exec approvals, sandboxing, and channel allowlists."

**Sandarb.ai provides the governance layer that makes prompt injection mitigation practical at enterprise scale.**

### Our Approach
1. **Identity first** - who can talk to the bot (Agent Registry)
2. **Scope next** - where the bot can act (Approved Prompts & Context)
3. **Model last** - assume the model CAN be manipulated (Audit Trail)

---

## Sandarb.AI Team Learnings (Apsaras)

*Sandarb.AI* is the team. *Apsaras* is the generic name for all OpenClaw agents (Punjikasthala, Mishrakeshi, Rambha, etc.).

### OpenClaw + Ollama + Qwen 2.5 (recommended LM)

**Sandarb.ai uses Ollama locally with Qwen 2.5** as the recommended language model for the Apsara team. This avoids API credits, rate limits, and timeouts (OpenRouter/cloud runs were failing with 402, token limits).

- **Setup:** Run `./scripts/setup-ollama.sh` to pull `qwen2.5:7b` (or set `OLLAMA_MODEL=qwen2.5:3b` for a smaller model) and write a sample OpenClaw config to `~/.openclaw/openclaw.json.ollama-sample`.
- **Config:** Ollama provider in `~/.openclaw/openclaw.json` with `baseUrl: http://127.0.0.1:11434/v1` and **`"api": "openai-completions"`** (required: OpenClaw’s embedded runner uses OpenAI-compatible API; without it, `model.api` is undefined and pi-ai throws "No API provider registered for api: undefined").
- **Gateway:** Use `ollama/qwen2.5:7b` (or your chosen tag). Restart after config: `openclaw gateway restart`.
- **Other models:** You can add other Ollama models (e.g. `llama3.3:latest`, `llama3.2:latest`) in the same provider; Qwen 2.5 remains the recommended default for Apsara development.

### How to tell if agents are at work
- **Before the Ollama fix (Feb 2):** `logs/team-chat.log` and `logs/features.log` showed "Error: Command failed: openclaw agent..." and stack traces — agents were failing (api: undefined in embedded mode).
- **After the fix:** Run `node scripts/apsara-develop.js`. Each agent’s **full response** is now appended to `logs/<name>.log` (e.g. `logs/punjikasthala.log`) under "Round 1" and "Round 2". If you see real paragraphs (not "Error: ...") in those files, agents are at work. Team Chat shows the first paragraph; per-agent logs show the full reply. Each `openclaw agent` call is one-shot (one message in, one response); the orchestrator does not apply file edits — agents describe work and you (or future tooling) can act on it.

### ⚖️ Punjikasthala (A2A Protocol & Compliance)
<!-- Log learnings about A2A protocol, gatekeeper patterns, governance intersection -->

### 🎭 Mishrakeshi (Prompt Versioning & Git-like Workflows)
<!-- Log learnings about versioning, SHA256 hashing, approval workflows -->

### 🔱 Rambha (Agent Registry & API)
<!-- Log learnings about manifest-based registration, agent cards, audit headers -->

### 💎 Tilottama (Audit Schema & Data Layer)
<!-- Log learnings about audit logs, governance intersection table, lineage queries -->

### ⚙️ Ghritachi (Approval Workflows & Business Logic)
<!-- Log learnings about status transitions, compliance metadata, reviewer tracking -->

### 🏛️ Alambusha (Production Deployment & Infrastructure)
<!-- Log learnings about Docker, GCP, health checks, secure deployment -->

### 🪷 Urvashi (Compliance Dashboard & UX)
<!-- Log learnings about pending review UI, approval queues, audit visualization -->
- **Team Chat system log repetition (Feb 3):** The general channel was merging all `.log` files via `getApsaraMessages()`, so every orchestrator run added repeated "SESSION STARTED" / "═══" / "ALL 8 APSARAS DISPATCHED" lines from `features.log`. Fixed by using only `team-chat.log` for the general channel: added `getTeamChatMessages()` in `lib/apsara-logs.ts` and wired `/api/apsara-chat/log?channel=general` to it. System messages in Team Chat now come only from team-chat (and the orchestrator already throttles "Development session started" to once per 60 min).

### ✨ Menaka (Governance UI Components)
<!-- Log learnings about status badges, diff viewers, approval buttons -->
- **Team Chat: single Apsara list (Feb 3):** Apsaras were shown in two places (left sidebar + right panel + Send-to dropdown). UX fix: keep one list only in the right panel. Removed duplicate "Apsaras" section from the left sidebar (Channels only). Removed the "Send to" dropdown from the compose area; "Send to" is now driven by clicking an Apsara in the right panel. Compose area shows "Send to: [selected agent]" and a hint "(show Apsaras to pick)" when the panel is closed.

---

## Enterprise Value Proposition

**OpenClaw says:** "Remember that prompt injection is still an industry-wide unsolved problem"

**Sandarb.ai responds:** "We don't solve prompt injection at the model level - we mitigate it at the governance level"

- Every prompt is **versioned and auditable**
- Every context access is **logged with lineage**
- Every agent is **registered with a manifest**
- No unapproved content reaches production

---

## References

- [OpenClaw Security Best Practices](https://docs.openclaw.ai/gateway/security)
- [A2A Protocol](https://a2a-protocol.org/)
- [MCP (Model Context Protocol)](https://modelcontextprotocol.io/)
