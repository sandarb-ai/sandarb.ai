#!/usr/bin/env node
/**
 * 🪷 Sandarb.ai Development Orchestrator
 *
 * Runs the Sandarb.ai team: OpenClaw agents (Apsaras) developing the control plane.
 * Apsaras = generic name for all OpenClaw agents in this team. Assigns features
 * per agent and starts development. Based on README.md requirements.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT = path.resolve(__dirname, '..');
const LOG_DIR = path.join(PROJECT, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'features.log');
const TEAM_CHAT_LOG = path.join(LOG_DIR, 'team-chat.log');
const LEARNING_FILE = path.join(PROJECT, 'LEARNING.md');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

// The core problem we're solving
const CORE_PROBLEM = `
═══════════════════════════════════════════════════════════════════════════
SANDARB.AI - AI Governance for your AI Agents
═══════════════════════════════════════════════════════════════════════════

Manage and govern your AI Agents prompts and context in a protocol first 
approach workflows (think A2A, API and Git-like). Every request logged; 
lineage and audit built in.

WHAT SANDARB.AI IS:
- Open source project any company can install on their control plane
- Provides both API (HTTP endpoints) AND an AI Agent (supports A2A protocol)

GOALS:
1. Governance that doesn't slow shipping AI Agents to production
2. Protocol-first (A2A, MCP, HTTP)
3. Version management & traceability for prompts and context
4. Living AI Agents registry

WHAT WE SOLVE:
1. Single source of truth - approved prompts and context; agents pull via API or A2A
2. Audit trail - who requested what, when
3. Manifest-based registration - git-like versioning
4. Sandarb runs as an AI Agent - communicates via A2A

UNDERSTANDING PROMPTS vs CONTEXT:
- THE PROMPT: The specific request ("What should I do?")
  → Like a sticky note: "Go buy coffee."
  
- THE CONTEXT: The sandbox the agent operates within
  → Everything else needed to succeed: Who is the coffee for? Do they have cash?
    Where is the nearest shop? Is the office on fire?

THE SECURITY PROBLEM (from OpenClaw):
"Prompt injection is an industry-wide unsolved problem. System prompt guardrails 
are soft guidance only; hard enforcement comes from tool policy, exec approvals, 
sandboxing, and channel allowlists."

SANDARB'S APPROACH: Mitigate prompt injection at the GOVERNANCE level:
1. Every prompt is versioned and auditable
2. Every context access is logged with lineage  
3. Every agent is registered with a manifest
4. No unapproved content reaches production

═══════════════════════════════════════════════════════════════════════════
YOUR MANDATE:
1. Read ${PROJECT}/README.md first to understand the full vision
2. Study the existing codebase - a lot of work has already been done!
3. Implement your assigned features
4. Log your learnings to ${LEARNING_FILE} under your section
═══════════════════════════════════════════════════════════════════════════
`;

// Enterprise Feature Assignments based on README
const APSARA_MISSIONS = {
  'ai-governance': {
    name: 'Punjikasthala',
    emoji: '⚖️',
    title: 'A2A Protocol & Compliance Lead',
    enterprise_features: [
      'A2A Protocol Implementation - Sandarb as Gatekeeper Agent',
      'Governance Intersection Tracking - "Agent X used Prompt v4.2 with Context #992"',
      'MCP Server Integration for LLM clients',
      'Policy Enforcement (LOB-based access control)'
    ],
    files: [
      'lib/a2a-server.ts',
      'lib/governance.ts', 
      'lib/mcp-server.ts',
      'lib/policy.ts',
      'app/api/a2a/route.ts'
    ],
    task: `You are Punjikasthala, the Divine Mother and AI Governance Lead for Sandarb.ai.
${CORE_PROBLEM}
PROJECT: ${PROJECT}

FIRST: Read ${PROJECT}/README.md to understand the full vision.

ENTERPRISE MISSION: Implement A2A Protocol & Compliance Layer

Sandarb.ai is "The Governance & Control Plane for Agentic AI". From the README:
- "Sandarb runs as an A2A agent itself, so other agents can call it for validation"
- "Gatekeeper Agent - verifying permissions before releasing sensitive data"
- "Audit Trail & Lineage - complete tracking of who requested what and when"

YOUR TASKS:
1. Read ${PROJECT}/README.md - understand the full project vision
2. Read ${PROJECT}/lib/a2a-server.ts - review A2A skills implementation
3. Ensure these skills work: get_context, validate_context, get_lineage, register
4. Implement governance intersection: Track "Agent X used Prompt v4.2 with Context #992"
5. Read ${PROJECT}/lib/policy.ts - enhance LOB-based access control

LOG YOUR LEARNINGS: Add your insights to ${LEARNING_FILE} under "### ⚖️ Punjikasthala"
Log your work to ${PROJECT}/logs/punjikasthala.log`
  },

  'ai-prompts': {
    name: 'Mishrakeshi',
    emoji: '🎭',
    title: 'Prompt Versioning & Git-like Workflows',
    enterprise_features: [
      'Git-like Versioning - branch, fork, rollback prompts',
      'SHA256 Content Hashing for integrity',
      'Variable Interpolation {{variable}} system',
      'Prompt approval workflow: Draft → Proposed → Approved'
    ],
    files: [
      'lib/prompts.ts',
      'lib/contexts.ts',
      'lib/revisions.ts',
      'types/index.ts'
    ],
    task: `You are Mishrakeshi, the Artistic Muse and Prompt Engineering Lead for Sandarb.ai.
${CORE_PROBLEM}
PROJECT: ${PROJECT}

FIRST: Read ${PROJECT}/README.md to understand the full vision.

ENTERPRISE MISSION: Git-like Versioning for Prompts & Context

From the README:
- "Git-Like Versioning: Roll back instantly. Fork prompts for A/B testing"
- "Prompts and context chunks are treated like code—versioned, branched, and diffable"
- "Approval Workflows: Draft → Pending Review → Approved"

YOUR TASKS:
1. Read ${PROJECT}/README.md - understand the full project vision
2. Read ${PROJECT}/lib/prompts.ts - enhance versioning with parent-child relationships
3. Implement SHA256 content hashing for version integrity
4. Add variable extraction: Extract {{variable}} from prompt content
5. Ensure approval status transitions are enforced

LOG YOUR LEARNINGS: Add your insights to ${LEARNING_FILE} under "### 🎭 Mishrakeshi"
Log your work to ${PROJECT}/logs/mishrakeshi.log`
  },

  'backend-api': {
    name: 'Rambha',
    emoji: '🔱',
    title: 'Agent Registry & API Lead',
    enterprise_features: [
      'Manifest-Based Agent Registration',
      'Agent approval workflow with Agent Cards',
      'Context Injection API with audit headers',
      'Lineage query API'
    ],
    files: [
      'app/api/agents/register/route.ts',
      'app/api/agents/route.ts',
      'app/api/inject/route.ts',
      'app/api/lineage/route.ts'
    ],
    task: `You are Rambha, Chief of Apsaras and API Lead for Sandarb.ai.
${CORE_PROBLEM}
PROJECT: ${PROJECT}

FIRST: Read ${PROJECT}/README.md to understand the full vision.

ENTERPRISE MISSION: Living Agent Registry with Manifest-Based Registration

From the README:
- "Manifest-Based Registration: Agents register via strict manifests (using MCP standards)"
- "Every bot in your network is known, authorized, and versioned"
- "Standard HTTP endpoints for traditional integration"

YOUR TASKS:
1. Read ${PROJECT}/README.md - understand the full project vision
2. Read ${PROJECT}/app/api/agents/register/route.ts - enhance manifest registration
3. Ensure Agent Cards are stored and served for A2A discovery
4. Read ${PROJECT}/app/api/inject/route.ts - add audit header logging (X-Sandarb-Agent-ID, X-Sandarb-Trace-ID)
5. Implement /api/lineage endpoint for governance queries

LOG YOUR LEARNINGS: Add your insights to ${LEARNING_FILE} under "### 🔱 Rambha"
Log your work to ${PROJECT}/logs/rambha.log`
  },

  'backend-db': {
    name: 'Tilottama',
    emoji: '💎',
    title: 'Audit Schema & Data Layer',
    enterprise_features: [
      'Audit logs table with immutable append-only design',
      'Governance intersection table',
      'Prompt version lineage (parent-child)',
      'PostgreSQL + SQLite dual support'
    ],
    files: [
      'lib/pg.ts',
      'lib/audit-pg.ts',
      'lib/contexts-pg.ts',
      'scripts/init-postgres.js'
    ],
    task: `You are Tilottama, The Finest Creation and Database Lead for Sandarb.ai.
${CORE_PROBLEM}
PROJECT: ${PROJECT}

FIRST: Read ${PROJECT}/README.md to understand the full vision.

ENTERPRISE MISSION: Audit Trail & Compliance Database Schema

From the README:
- "Audit Trail & Lineage: Complete tracking of who requested what and when"
- "Incident Resolution: Check the Audit Trail to pinpoint exactly which prompt version and context source were active"

YOUR TASKS:
1. Read ${PROJECT}/README.md - understand the full project vision
2. Read ${PROJECT}/lib/audit-pg.ts - enhance audit logging schema
3. Ensure governance_intersection table tracks: agent_id, prompt_version, context_id, timestamp, trace_id
4. Read ${PROJECT}/scripts/init-postgres.js - verify schema supports enterprise audit
5. Add indexes for fast lineage queries

LOG YOUR LEARNINGS: Add your insights to ${LEARNING_FILE} under "### 💎 Tilottama"
Log your work to ${PROJECT}/logs/tilottama.log`
  },

  'backend-services': {
    name: 'Ghritachi',
    emoji: '⚙️',
    title: 'Approval Workflows & Business Logic',
    enterprise_features: [
      'Approval workflow: Draft → Pending Review → Approved → Rejected',
      'Reviewer/Approver tracking',
      'Template system for context schemas',
      'Compliance metadata enforcement'
    ],
    files: [
      'lib/prompts.ts',
      'lib/contexts.ts',
      'lib/templates.ts',
      'lib/revisions.ts'
    ],
    task: `You are Ghritachi, The Graceful One and Services Lead for Sandarb.ai.
${CORE_PROBLEM}
PROJECT: ${PROJECT}

FIRST: Read ${PROJECT}/README.md to understand the full vision.

ENTERPRISE MISSION: Approval Workflows & Compliance Enforcement

From the README:
- "Approval Workflows: Prompts are not deployed until they pass through Draft → Pending Review → Approved"
- "Context Validation: Sandarb ensures context is compliance approved for that specific agent intent"

YOUR TASKS:
1. Read ${PROJECT}/README.md - understand the full project vision
2. Read ${PROJECT}/lib/prompts.ts - implement strict status transitions
3. Add reviewer/approver tracking to versions
4. Read ${PROJECT}/lib/contexts.ts - enforce compliance metadata (LOB, data classification)
5. Ensure only approved content is served via API

LOG YOUR LEARNINGS: Add your insights to ${LEARNING_FILE} under "### ⚙️ Ghritachi"
Log your work to ${PROJECT}/logs/ghritachi.log`
  },

  'backend-infra': {
    name: 'Alambusha',
    emoji: '🏛️',
    title: 'Production Deployment & Enterprise Infrastructure',
    enterprise_features: [
      'Docker multi-stage production build',
      'GCP Cloud Run deployment',
      'Health check endpoints',
      'Environment-based configuration'
    ],
    files: [
      'Dockerfile',
      'docker-compose.yml',
      'scripts/deploy-gcp.sh',
      'app/api/health/route.ts'
    ],
    task: `You are Alambusha, The Divine Dancer and Infrastructure Lead for Sandarb.ai.
${CORE_PROBLEM}
PROJECT: ${PROJECT}

FIRST: Read ${PROJECT}/README.md to understand the full vision.

ENTERPRISE MISSION: Production-Ready Deployment

From the README:
- "GCP Native deployment support"
- "Designed to be installed within your infrastructure"

YOUR TASKS:
1. Read ${PROJECT}/README.md - understand the full project vision
2. Read ${PROJECT}/Dockerfile - ensure production-ready multi-stage build
3. Read ${PROJECT}/docker-compose.yml - verify PostgreSQL setup for enterprise
4. Enhance ${PROJECT}/app/api/health/route.ts - add comprehensive health checks
5. Review ${PROJECT}/scripts/deploy-gcp.sh - ensure secure deployment

LOG YOUR LEARNINGS: Add your insights to ${LEARNING_FILE} under "### 🏛️ Alambusha"
Log your work to ${PROJECT}/logs/alambusha.log`
  },

  'ui-lead': {
    name: 'Urvashi',
    emoji: '🪷',
    title: 'Compliance Dashboard & UX Lead',
    enterprise_features: [
      'Pending Review Dashboard for Compliance Officers',
      'Approval workflow UI (Draft → Pending → Approved)',
      'Agent registry management interface',
      'Audit trail visualization'
    ],
    files: [
      'app/dashboard/page.tsx',
      'app/prompts/page.tsx',
      'app/agents/agents-client.tsx',
      'app/contexts/contexts-list-client.tsx'
    ],
    task: `You are Urvashi, The Celebrated One and UI Lead for Sandarb.ai.
${CORE_PROBLEM}
PROJECT: ${PROJECT}

FIRST: Read ${PROJECT}/README.md to understand the full vision.

ENTERPRISE MISSION: Compliance Officer Dashboard

From the README:
- "Pending-Review Visibility: A clear dashboard for Compliance Officers or Engineering Leads"
- "See every prompt change awaiting sign-off"

YOUR TASKS:
1. Read ${PROJECT}/README.md - understand the full project vision
2. Read ${PROJECT}/app/dashboard/page.tsx - add Pending Review section
3. Create a clear approval queue showing items awaiting sign-off
4. Add filters: by status (pending, approved, rejected), by author, by date
5. Ensure the UI supports the compliance workflow

LOG YOUR LEARNINGS: Add your insights to ${LEARNING_FILE} under "### 🪷 Urvashi"
Log your work to ${PROJECT}/logs/urvashi.log`
  },

  'ui-components': {
    name: 'Menaka',
    emoji: '✨',
    title: 'Governance UI Components',
    enterprise_features: [
      'Status badges (draft, pending, approved, rejected)',
      'Diff viewer for prompt versions',
      'Approval action buttons',
      'Audit timeline component'
    ],
    files: [
      'components/ui/badge.tsx',
      'components/content-diff-view.tsx',
      'components/context-card.tsx',
      'components/stats-card.tsx'
    ],
    task: `You are Menaka, The Enchantress and UI Components Lead for Sandarb.ai.
${CORE_PROBLEM}
PROJECT: ${PROJECT}

FIRST: Read ${PROJECT}/README.md to understand the full vision.

ENTERPRISE MISSION: Governance Status & Audit UI Components

YOUR TASKS:
1. Read ${PROJECT}/README.md - understand the full project vision
2. components/ui/badge.tsx ALREADY HAS governance status variants (draft, pending_review, approved, rejected). Do NOT add them again or report "Added governance status variants". Skip to the next item.
3. Read ${PROJECT}/components/content-diff-view.tsx - enhance for prompt versioning
4. Create approval action buttons (Approve/Reject with confirmation)
5. Add audit timeline component for lineage visualization

LOG YOUR LEARNINGS: Add your insights to ${LEARNING_FILE} under "### ✨ Menaka"
Log your work to ${PROJECT}/logs/menaka.log — log only NEW work (do not repeat that Badge variants are done).`
  }
};

function log(msg) {
  ensureLogDir();
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, entry);
  console.log(msg);
}

/** Get last N lines from team chat for context (so agents can see what others said). */
function getRecentTeamChat(maxLines = 30) {
  if (!fs.existsSync(TEAM_CHAT_LOG)) return '';
  const content = fs.readFileSync(TEAM_CHAT_LOG, 'utf8');
  const lines = content.trim().split('\n').filter(Boolean);
  return lines.slice(-maxLines).join('\n');
}

/** Append a message to team-chat.log (visible in Sandarb.AI Team Chat UI). Format: [ts] emoji Name: message */
function appendTeamChat(emoji, name, message) {
  ensureLogDir();
  const timestamp = new Date().toISOString();
  const safe = (message || '').replace(/\n/g, ' ').trim().substring(0, 500);
  const entry = `[${timestamp}] ${emoji} ${name}: ${safe}\n`;
  fs.appendFileSync(TEAM_CHAT_LOG, entry);
  console.log(`   💬 ${name} → team: ${safe.substring(0, 80)}${safe.length > 80 ? '...' : ''}`);
}

/** Append full agent response to per-agent log so work is visible. */
function appendAgentLog(missionName, roundLabel, response) {
  ensureLogDir();
  const logName = missionName.toLowerCase().replace(/\s+/g, '') + '.log';
  const agentLogPath = path.join(LOG_DIR, logName);
  const timestamp = new Date().toISOString();
  const header = `\n--- [${timestamp}] ${roundLabel} ---\n`;
  const body = (response && typeof response === 'string') ? response.trim() : String(response);
  fs.appendFileSync(agentLogPath, header + body + '\n');
}

/** Extract first paragraph or first ~300 chars for team chat from agent response. */
function extractTeamMessage(response) {
  if (!response || typeof response !== 'string') return 'Working on it.';
  const trimmed = response.trim();
  const firstPara = trimmed.split(/\n\n+/)[0];
  const text = (firstPara || trimmed).replace(/\n/g, ' ').trim();
  return text.substring(0, 400) || 'Working on it.';
}

function sendToApsara(agentId, message) {
  try {
    const env = { ...process.env };
    if (!env.OPENCLAW_GATEWAY_TOKEN) env.OPENCLAW_GATEWAY_TOKEN = 'sandarb';
    // Use spawnSync with array args so the message is passed as one argument (no shell).
    // Avoids "Command failed" from shell quoting, newlines, and ARG_MAX limits.
    const result = spawnSync('openclaw', ['agent', '--agent', agentId, '--message', message], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120000,
      env,
      shell: false,
    });
    if (result.error) {
      if (result.error.code === 'ENOENT') {
        return `Error: openclaw CLI not found. Install OpenClaw and add it to PATH.`;
      }
      const msg = result.error.message || '';
      if (msg.includes('ETIMEDOUT')) {
        return `Error: OpenClaw gateway timed out. Start the gateway with: openclaw gateway --port 18789 (see scripts/start-apsara-team.sh).`;
      }
      return `Error: ${msg}`;
    }
    const out = (result.stdout || '').trim();
    const err = (result.stderr || '').trim();
    if (result.status !== 0 && err) return `Error: ${err}`;
    if (result.status !== 0) return `Error: Command exited with code ${result.status}`;
    return out || 'OK';
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`
🪷 ═══════════════════════════════════════════════════════════════════════
   SANDARB.AI DEVELOPMENT ORCHESTRATOR
   Apsaras (OpenClaw agents) · Enterprise AI Governance Control Plane
🪷 ═══════════════════════════════════════════════════════════════════════
`);

  if (DRY_RUN) {
    const agentId = 'ai-governance';
    const mission = APSARA_MISSIONS[agentId];
    const dryRunMessage = `You are ${mission.name}, ${mission.title} for Sandarb.ai. Reply in one short sentence: what is your role? Then say DONE.`;
    console.log('🔧 DRY RUN: one agent, short prompt (use without --dry-run for full session)\n');
    console.log(`${mission.emoji} ${mission.name} – ${mission.title}`);
    console.log(`   Message: "${dryRunMessage.substring(0, 60)}..."\n`);
    ensureLogDir();
    const response = sendToApsara(agentId, dryRunMessage);
    appendAgentLog(mission.name, 'Dry run', response);
    const ok = !response.startsWith('Error:');
    console.log(ok ? '   ✅ Agent replied (agents are at work).' : '   ❌ Agent failed.');
    console.log('\n   Response preview:\n');
    const preview = (response || '').trim().split('\n').slice(0, 8).join('\n');
    console.log(preview || response);
    console.log('\n   Full response written to:', path.join(LOG_DIR, mission.name.toLowerCase().replace(/\s+/g, '') + '.log'));
    console.log('\n   Run without --dry-run to dispatch all 8 Apsaras for 2 rounds.\n');
    return;
  }

  log('═══════════════════════════════════════════════════════════════');
  log('🪷 ENTERPRISE DEVELOPMENT SESSION STARTED');
  log('Mission: Governance that doesn\'t slow shipping AI Agents');
  log('═══════════════════════════════════════════════════════════════');

  const TEAM_CHAT_INSTRUCTION_ROUND1 = `

--- TEAM CHAT (Sandarb.AI Team - read what others said) ---
{RECENT_CHAT}
--- END TEAM CHAT ---

YOUR TURN: Post a brief message to the team (1–2 sentences): say what you're starting, or ask a teammate a question (e.g. "Mishrakeshi, I'll need get_prompt in the skills list"). Your first paragraph will be posted to the Team Chat so everyone sees it. Then do your development work.`;

  const TEAM_CHAT_INSTRUCTION_ROUND2 = `

--- TEAM CHAT (read your teammates' updates) ---
{RECENT_CHAT}
--- END TEAM CHAT ---

YOUR TURN: Post a short progress update or reply to a teammate (1–2 sentences). Your first paragraph will be posted to the Team Chat. Then continue your development work.`;

  const TEAM_CHAT_INSTRUCTION_ROUND3PLUS = `

--- TEAM CHAT (read your teammates' updates) ---
{RECENT_CHAT}
--- END TEAM CHAT ---

YOUR TURN: Continuously evaluate what features still need to be built for the mission and problem we're solving. Post a short update (1–2 sentences): what you're doing next or what you suggest. Your first paragraph will be posted to the Team Chat. Then implement or refine. If your scope is complete, say "SCOPE_COMPLETE" in your first line; otherwise keep building.`;

  const MAX_ROUNDS = Math.min(parseInt(process.env.APSARA_MAX_ROUNDS || '10', 10) || 10, 20);

  ensureLogDir();
  const sessionLine = `[${new Date().toISOString()}] 🪷 Sandarb.AI team: Development session started. Apsaras will chat here and build features (up to ${MAX_ROUNDS} rounds).\n`;
  fs.appendFileSync(TEAM_CHAT_LOG, sessionLine);

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const isRound1 = round === 1;
    const isRound2 = round === 2;
    const chatLines = isRound1 ? 25 : 35;
    const teamInstruction = isRound1
      ? TEAM_CHAT_INSTRUCTION_ROUND1.replace('{RECENT_CHAT}', getRecentTeamChat(chatLines) || '(No messages yet.)')
      : isRound2
        ? TEAM_CHAT_INSTRUCTION_ROUND2.replace('{RECENT_CHAT}', getRecentTeamChat(chatLines) || '(No messages yet.)')
        : TEAM_CHAT_INSTRUCTION_ROUND3PLUS.replace('{RECENT_CHAT}', getRecentTeamChat(chatLines) || '(No messages yet.)');

    const roundLabel = isRound1 ? 'Team intro + start work' : isRound2 ? 'Progress / reply + continue work' : `Round ${round}: Evaluate & build more features`;
    console.log(`\n📢 Round ${round}/${MAX_ROUNDS}: ${roundLabel}\n`);

    for (const [agentId, mission] of Object.entries(APSARA_MISSIONS)) {
      console.log(`${mission.emoji} ${mission.name} – ${isRound1 ? mission.title : round === 2 ? 'progress/reply' : `round ${round}`}`);
      const taskWithChat = mission.task + teamInstruction;

      if (isRound1) {
        log(`${mission.emoji} ${mission.name}: Starting work on ${mission.title}`);
        log(`   Features: ${mission.enterprise_features.join(', ')}`);
      }

      const response = sendToApsara(agentId, taskWithChat);
      const teamMessage = extractTeamMessage(response);
      appendTeamChat(mission.emoji, mission.name, teamMessage);
      appendAgentLog(mission.name, `Round ${round}`, response);

      const summary = response.split('\n').slice(-3).join(' ').substring(0, 200);
      if (isRound1) log(`   Response: ${summary}...`);
      console.log(`   ✅ ${mission.name} posted to Team Chat\n`);
      await new Promise(r => setTimeout(r, 2000));
    }

    const teamChatLine = `[${new Date().toISOString()}] 🪷 Sandarb.AI team: Round ${round} complete. Check Team Chat and logs for updates.\n`;
    fs.appendFileSync(TEAM_CHAT_LOG, teamChatLine);
  }

  log('═══════════════════════════════════════════════════════════════');
  log('✅ ALL 8 APSARAS DISPATCHED FOR ENTERPRISE DEVELOPMENT (continuous rounds complete)');
  log('═══════════════════════════════════════════════════════════════');

  console.log(`
🪷 ═══════════════════════════════════════════════════════════════════════
   ✅ APSARAS CHATTED IN TEAM CHAT + DEVELOPING FEATURES
🪷 ═══════════════════════════════════════════════════════════════════════

Team Chat (see agents talk):  Open /apsara-chat in the app
Team Chat log:                ${TEAM_CHAT_LOG}
Master log:                   ${LOG_FILE}

Per-agent logs:
  ⚖️  Punjikasthala  → logs/punjikasthala.log
  🎭 Mishrakeshi    → logs/mishrakeshi.log
  🔱 Rambha         → logs/rambha.log
  💎 Tilottama      → logs/tilottama.log
  ⚙️  Ghritachi      → logs/ghritachi.log
  🏛️  Alambusha      → logs/alambusha.log
  🪷 Urvashi        → logs/urvashi.log
  ✨ Menaka         → logs/menaka.log
`);
}

main().catch(console.error);
