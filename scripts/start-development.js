#!/usr/bin/env node
/**
 * Sandarb.ai Collaborative Development Driver
 * 
 * Starts all 8 agents to collaboratively develop AI Governance features.
 * Logs all progress to logs/features.log
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = '/Users/sudhir/openint-sandarb';
const LOG_FILE = path.join(__dirname, '../logs/features.log');

// Feature areas and agent assignments
const FEATURES = {
  'protocol-first': {
    lead: 'ai-governance',
    support: ['backend-api'],
    description: 'A2A, MCP, HTTP protocol implementation',
    tasks: [
      'Implement A2A Agent Card discovery at GET /api/a2a',
      'Implement A2A skills: get_context, validate_context, get_lineage, register',
      'Expose MCP server for prompts and contexts',
      'Ensure HTTP API follows REST conventions'
    ]
  },
  'version-management': {
    lead: 'ai-prompts',
    support: ['backend-db', 'backend-services'],
    description: 'Git-like versioning for prompts and context',
    tasks: [
      'Implement prompt versioning with parent-child relationships',
      'Add SHA256 content hashing for integrity',
      'Support branching/forking prompts for A/B testing',
      'Enable rollback to previous versions'
    ]
  },
  'agent-registry': {
    lead: 'backend-api',
    support: ['backend-db', 'ai-governance'],
    description: 'Living AI Agents registry with manifest-based registration',
    tasks: [
      'Implement agent registration via POST /api/agents/register',
      'Support manifest-based registration (sandarb.json)',
      'Agent approval workflow: draft → pending → approved',
      'Store Agent Card for A2A discovery'
    ]
  },
  'audit-trail': {
    lead: 'ai-governance',
    support: ['backend-db', 'backend-services'],
    description: 'Complete audit trail - who requested what, when',
    tasks: [
      'Log every context/prompt access with agent ID and trace ID',
      'Implement governance intersection tracking',
      'Track lineage: Agent X used Prompt v4.2 with Context #992',
      'Support compliance queries via /api/lineage'
    ]
  },
  'approval-workflows': {
    lead: 'backend-services',
    support: ['ui-lead', 'backend-api'],
    description: 'Approval workflows: Draft → Pending Review → Approved',
    tasks: [
      'Implement status transitions for prompts and contexts',
      'Add reviewer/approver tracking',
      'Create pending review visibility dashboard',
      'Prevent unapproved content from being served'
    ]
  },
  'governance-ui': {
    lead: 'ui-lead',
    support: ['ui-components'],
    description: 'UI for Compliance Officers and Engineering Leads',
    tasks: [
      'Build Pending Review dashboard showing items awaiting approval',
      'Create diff visualization for prompt/context versions',
      'Design intuitive approval workflow interface',
      'Implement agent registry management UI'
    ]
  }
};

// Agent configurations with their collaborative focus
const AGENTS = {
  'ui-lead': {
    name: 'Luna', emoji: '🎨',
    focus: 'governance-ui',
    message: `
# 🎨 Luna - UI Development for AI Governance

You are developing the Sandarb.ai UI - the governance control plane for AI Agents.

## Your Mission
Build UI that enables "Governance that doesn't slow shipping AI Agents to production"

## Key Features to Implement
1. **Pending Review Dashboard** - Compliance Officers need clear visibility
2. **Approval Workflow UI** - Draft → Pending → Approved flow
3. **Version History View** - Git-like versioning for prompts/contexts
4. **Agent Registry UI** - View and manage registered agents

## Collaboration
- Work with Nova on reusable components
- Coordinate with Atlas on API contracts
- Support Oracle's governance requirements

## Project Location
${PROJECT_ROOT}

## Log Progress
Log all features you develop to: ${LOG_FILE}

Start by reviewing app/dashboard/page.tsx and designing the Pending Review dashboard.
    `.trim()
  },

  'ui-components': {
    name: 'Nova', emoji: '✨',
    focus: 'governance-ui',
    message: `
# ✨ Nova - Component Library for AI Governance

You are building reusable UI components for Sandarb.ai governance features.

## Key Components Needed
1. **Status Badges** - draft, pending_review, approved, rejected states
2. **Diff Viewer** - Show version differences (content-diff-view.tsx)
3. **Approval Actions** - Approve/Reject buttons with confirmation
4. **Audit Trail Display** - Timeline of governance events
5. **Agent Card Display** - Show registered agent details

## Design Principles
- Accessible by default (WCAG 2.1 AA)
- Dark/light mode support
- Consistent with Tailwind + Radix patterns

## Project Location
${PROJECT_ROOT}/components/

## Log Progress
Log all features you develop to: ${LOG_FILE}

components/ui/badge.tsx already has governance status variants (draft, pending_review, approved, rejected). Do not add or report them again. Start with the next component (content-diff-view, approval buttons, or audit timeline).
    `.trim()
  },

  'backend-api': {
    name: 'Atlas', emoji: '🔌',
    focus: 'agent-registry',
    message: `
# 🔌 Atlas - API Implementation for AI Governance

You are implementing the HTTP API layer for Sandarb.ai.

## Protocol-First APIs to Implement
1. **Agent Registry**
   - POST /api/agents/register - Manifest-based registration
   - GET /api/agents - List registered agents
   - POST /api/agents/:id/approve - Approve agent

2. **Context Injection**
   - GET /api/inject?name=... - Fetch approved context with audit logging
   - Headers: X-Sandarb-Agent-ID, X-Sandarb-Trace-ID

3. **Lineage & Audit**
   - GET /api/lineage - Query governance intersection

4. **A2A Support**
   - GET /api/a2a - Agent Card discovery
   - POST /api/a2a - Skill execution (JSON-RPC 2.0)

## Key Requirement
Every request must be logged for audit trail!

## Project Location
${PROJECT_ROOT}/app/api/

## Log Progress
Log all features you develop to: ${LOG_FILE}

Start by reviewing app/api/inject/route.ts and ensuring audit headers are logged.
    `.trim()
  },

  'backend-db': {
    name: 'Petra', emoji: '🗄️',
    focus: 'audit-trail',
    message: `
# 🗄️ Petra - Database Schema for AI Governance

You are designing and implementing the database layer for governance features.

## Key Tables for Governance
1. **prompts / prompt_versions** - Git-like versioning with parent references
2. **contexts / context_revisions** - Versioned context with compliance metadata
3. **agents** - Registry with manifest, Agent Card, approval status
4. **audit_logs** - Every context/prompt access logged
5. **governance_intersection** - Track: Agent X used Prompt v4.2 + Context #992

## Schema Requirements
- Support both SQLite (dev) and PostgreSQL (prod)
- Immutable audit logs (append-only)
- Parent-child versioning for lineage
- SHA256 content hashes for integrity

## Project Location
${PROJECT_ROOT}/lib/*-pg.ts and scripts/init-postgres.js

## Log Progress
Log all features you develop to: ${LOG_FILE}

Start by reviewing lib/audit-pg.ts and ensuring governance intersection is tracked.
    `.trim()
  },

  'backend-services': {
    name: 'Axel', emoji: '⚙️',
    focus: 'approval-workflows',
    message: `
# ⚙️ Axel - Business Logic for AI Governance

You are implementing the core governance workflows for Sandarb.ai.

## Approval Workflow Implementation
1. **Prompt Workflow**: draft → proposed → approved/rejected
2. **Context Workflow**: draft → pending_review → approved/rejected
3. **Agent Workflow**: draft → pending_approval → approved/rejected

## Key Business Rules
- Only approved prompts/contexts can be served via API
- Every status change must be audited
- SHA256 hash for content integrity verification
- Variable interpolation: {{variable}} support

## Service Modules to Review
- lib/prompts.ts - Prompt versioning and approval
- lib/contexts.ts - Context management with compliance metadata
- lib/policy.ts - LOB enforcement

## Project Location
${PROJECT_ROOT}/lib/

## Log Progress
Log all features you develop to: ${LOG_FILE}

Start by reviewing lib/prompts.ts and implementing the full approval workflow.
    `.trim()
  },

  'backend-infra': {
    name: 'Cyrus', emoji: '🏗️',
    focus: 'deployment',
    message: `
# 🏗️ Cyrus - Infrastructure for AI Governance

You are ensuring Sandarb.ai runs reliably in production.

## Infrastructure Requirements
1. **Docker** - Multi-stage build, PostgreSQL support
2. **Database** - Auto-detect SQLite (dev) vs PostgreSQL (prod)
3. **Seed Data** - Demo data for governance features
4. **Health Checks** - /api/health endpoint

## Deployment Targets
- Docker Compose for local development
- GCP Cloud Run for production
- Environment variable configuration

## Key Files
- Dockerfile
- docker-compose.yml
- scripts/deploy-gcp.sh
- scripts/init-postgres.js

## Project Location
${PROJECT_ROOT}

## Log Progress
Log all features you develop to: ${LOG_FILE}

Start by reviewing the Dockerfile and ensuring it supports the governance features.
    `.trim()
  },

  'ai-prompts': {
    name: 'Sage', emoji: '🧠',
    focus: 'version-management',
    message: `
# 🧠 Sage - Prompt Engineering & Versioning

You are the expert on prompt management and Git-like versioning for Sandarb.ai.

## Version Management Features
1. **Git-like Versioning**
   - Parent-child version relationships
   - SHA256 content hashing
   - Branch/fork for A/B testing
   - Instant rollback capability

2. **Variable System**
   - Extract variables: {{variable}} from content
   - Interpolation at runtime
   - Variable validation

3. **Approval Workflow**
   - Draft → Proposed → Approved
   - Reviewer tracking
   - Immutable version history

## The "Operating Manifest" Pattern
Agents pull their approved System Prompt + Validated Context from Sandarb.
This is the core value proposition!

## Project Location
${PROJECT_ROOT}/lib/prompts.ts and app/prompts/

## Log Progress
Log all features you develop to: ${LOG_FILE}

Start by implementing Git-like versioning in lib/prompts.ts with parent references.
    `.trim()
  },

  'ai-governance': {
    name: 'Oracle', emoji: '⚖️',
    focus: 'protocol-first',
    message: `
# ⚖️ Oracle - A2A Protocol & Compliance

You are the governance expert ensuring Sandarb.ai meets compliance requirements.

## A2A Protocol Implementation
Sandarb runs as an A2A Agent! Other agents communicate via:
- GET /api/a2a - Agent Card discovery
- POST /api/a2a - JSON-RPC 2.0 skills execution

## A2A Skills to Implement
1. **get_context** - Retrieve approved context (with audit logging)
2. **validate_context** - Validate context against schema
3. **get_lineage** - Query who requested what, when
4. **register** - Register new agent via manifest

## Governance Intersection
Track: "On Feb 1st, Agent X used Prompt v4.2 and Context #992"
This is critical for incident resolution!

## MCP Integration
Expose prompts/contexts as MCP resources for LLM clients.

## Project Location
${PROJECT_ROOT}/lib/a2a-server.ts and lib/governance.ts

## Log Progress
Log all features you develop to: ${LOG_FILE}

Start by reviewing lib/a2a-server.ts and implementing all governance skills.
    `.trim()
  }
};

// Log to feature file
function logFeature(agent, message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${agent}: ${message}\n`;
  fs.appendFileSync(LOG_FILE, logEntry);
  console.log(`📝 Logged: ${agent} - ${message}`);
}

// Send message to agent
async function sendToAgent(agentId, message) {
  const agent = AGENTS[agentId];
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  ${agent.emoji} Starting ${agent.name} (${agentId})`);
  console.log(`${'═'.repeat(70)}\n`);
  
  logFeature(agent.name, `Started working on ${agent.focus}`);
  
  try {
    // Use spawn for non-blocking execution
    const child = spawn('openclaw', [
      'agent',
      '--agent', agentId,
      '--message', message
    ], {
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' }
    });
    
    return new Promise((resolve) => {
      child.on('close', (code) => {
        if (code === 0) {
          logFeature(agent.name, `Completed initial task analysis`);
        }
        resolve(code);
      });
      
      // Timeout after 60 seconds
      setTimeout(() => {
        child.kill();
        resolve(0);
      }, 60000);
    });
  } catch (e) {
    console.error(`Error with ${agentId}: ${e.message}`);
    return 1;
  }
}

// Main execution
async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║  🦞 Sandarb.ai Collaborative Development                              ║
║  AI Governance Control Plane - 8 Agent Team                          ║
╚══════════════════════════════════════════════════════════════════════╝

Mission: Governance that doesn't slow shipping AI Agents to production

Features Being Developed:
  • Protocol-first (A2A, MCP, HTTP)
  • Version management & traceability
  • Living AI Agents registry
  • Audit trail: who requested what, when
  • Manifest-based registration
  • Sandarb as an A2A Agent

Log file: ${LOG_FILE}
`);

  logFeature('SYSTEM', 'Collaborative development session started');
  logFeature('SYSTEM', 'Features: A2A Protocol, Version Management, Agent Registry, Audit Trail');

  // Check gateway
  console.log('📡 Checking OpenClaw gateway...');
  try {
    execSync('openclaw health', { stdio: 'pipe' });
    console.log('✅ Gateway is running\n');
  } catch (e) {
    console.log('🚀 Starting gateway...');
    spawn('openclaw', ['gateway', '--port', '18789'], { detached: true, stdio: 'ignore' }).unref();
    await new Promise(r => setTimeout(r, 3000));
  }

  // Priority order for starting agents
  const startOrder = [
    'ai-governance',   // Lead: Protocol-first
    'ai-prompts',      // Lead: Version management
    'backend-api',     // Lead: Agent registry
    'backend-db',      // Support: Audit trail schema
    'backend-services',// Lead: Approval workflows
    'ui-lead',         // Lead: Governance UI
    'ui-components',   // Support: Components
    'backend-infra'    // Support: Infrastructure
  ];

  console.log('🚀 Starting all agents for collaborative development...\n');
  
  // Start all agents
  for (const agentId of startOrder) {
    await sendToAgent(agentId, AGENTS[agentId].message);
    // Small delay between agents
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║  ✅ All Agents Started                                                ║
╚══════════════════════════════════════════════════════════════════════╝

Feature log: ${LOG_FILE}

To chat with agents:
  openclaw dashboard
  
Or use shortcuts:
  ./scripts/sandarb-team.sh gov       # Oracle (A2A Protocol)
  ./scripts/sandarb-team.sh prompts   # Sage (Versioning)
  ./scripts/sandarb-team.sh api       # Atlas (API)
  ./scripts/sandarb-team.sh ui        # Luna (UI)
`);

  logFeature('SYSTEM', 'All 8 agents initialized and working on features');
}

main().catch(console.error);
