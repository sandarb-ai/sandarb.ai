#!/usr/bin/env node
/**
 * Sandarb.ai Team Startup Driver
 * 
 * This script:
 * 1. Starts the OpenClaw gateway (if not running)
 * 2. Initializes all 8 agents with project context
 * 3. Assigns development tasks based on README goals
 * 4. Orchestrates parallel development work
 * 
 * Usage:
 *   node scripts/start-team.js              # Full startup
 *   node scripts/start-team.js --tasks      # Show task assignments only
 *   node scripts/start-team.js --parallel   # Start all agents in parallel
 *   node scripts/start-team.js --agent <id> # Start specific agent with its task
 */

const { execSync, spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Project root
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Team members with their assigned tasks based on README
const TEAM_TASKS = {
  'ui-lead': {
    name: 'Luna',
    emoji: '🎨',
    role: 'UI Lead',
    priority: 1,
    tasks: [
      'Review and improve the main dashboard layout in app/dashboard/page.tsx',
      'Ensure the approval workflow UI is intuitive for Compliance Officers',
      'Design the "Pending Review" visibility dashboard mentioned in README',
      'Coordinate with Nova on component consistency across all pages'
    ],
    focus: `
You are working on Sandarb.ai - an AI Governance Control Plane.

Key UI Requirements from README:
- "Pending-Review Visibility: A clear dashboard for Compliance Officers"
- "Approval Workflows: Draft → Pending Review → Approved"
- "Git-Like Versioning UI for prompts and contexts"

Your immediate task: Review the current dashboard (app/dashboard/page.tsx) and 
improve the UX for compliance officers who need to see pending approvals at a glance.

Project path: ${PROJECT_ROOT}
    `.trim()
  },

  'ui-components': {
    name: 'Nova',
    emoji: '✨',
    role: 'UI Components',
    priority: 2,
    tasks: [
      'Build/improve diff visualization for prompt versioning (content-diff-view.tsx)',
      'Create status badge components for approval states (draft, pending, approved)',
      'Improve context-card.tsx to show compliance metadata clearly',
      'Ensure all components support dark/light mode properly'
    ],
    focus: `
You are working on Sandarb.ai - an AI Governance Control Plane.

Key Component Needs from README:
- "Git-like Versioning" requires diff visualization components
- "Approval Workflows" need clear status indicators
- "Compliance Metadata" display (LOB, data classification, regulatory hooks)

Your immediate task: Improve components/content-diff-view.tsx to show clear 
version differences, and ensure status badges in components/ui/badge.tsx 
support all approval states.

Project path: ${PROJECT_ROOT}
    `.trim()
  },

  'backend-api': {
    name: 'Atlas',
    emoji: '🔌',
    role: 'Backend API',
    priority: 1,
    tasks: [
      'Review API routes match the developer guide specifications',
      'Ensure /api/inject endpoint properly handles audit headers',
      'Implement or verify /api/lineage endpoint for governance intersection',
      'Validate all API error responses are consistent'
    ],
    focus: `
You are working on Sandarb.ai - an AI Governance Control Plane.

Key API Requirements from README/Developer Guide:
- GET /api/inject?name=... - Context injection with lineage logging
- GET /api/lineage - Recent context deliveries for audit
- Headers: X-Sandarb-Agent-ID, X-Sandarb-Trace-ID for audit
- All APIs must support compliance/governance use cases

Your immediate task: Review app/api/inject/route.ts and ensure it properly 
logs requests for lineage tracking. Verify the governance intersection logging 
works correctly.

Project path: ${PROJECT_ROOT}
    `.trim()
  },

  'backend-db': {
    name: 'Petra',
    emoji: '🗄️',
    role: 'Database',
    priority: 2,
    tasks: [
      'Review database schema supports audit_logs properly',
      'Ensure prompt versioning schema supports parent-child relationships',
      'Verify governance_intersection table captures prompt+context usage',
      'Optimize queries for lineage/audit retrieval'
    ],
    focus: `
You are working on Sandarb.ai - an AI Governance Control Plane.

Key Database Requirements from README:
- "Audit Trail & Lineage" - Complete tracking of who requested what and when
- "Git-like Versioning" - Prompts/contexts versioned with parent references
- "Governance Intersection" - Track when Agent X used Prompt v4.2 with Context #992

Your immediate task: Review lib/audit-pg.ts and lib/pg.ts to ensure the 
governance intersection logging properly tracks the relationship between 
prompts, contexts, and agent requests.

Project path: ${PROJECT_ROOT}
    `.trim()
  },

  'backend-services': {
    name: 'Axel',
    emoji: '⚙️',
    role: 'Services',
    priority: 2,
    tasks: [
      'Review lib/prompts.ts for proper version workflow implementation',
      'Ensure lib/contexts.ts handles compliance metadata correctly',
      'Implement or verify template system in lib/templates.ts',
      'Review types/index.ts for completeness of governance types'
    ],
    focus: `
You are working on Sandarb.ai - an AI Governance Control Plane.

Key Service Requirements from README:
- Prompts: Draft → Proposed → Approved workflow
- Context: Compliance metadata (LOB, data classification, regulatory hooks)
- Templates: Reusable schemas for context structure
- Variable interpolation: {{variable}} syntax support

Your immediate task: Review lib/prompts.ts and ensure the approval workflow 
(draft → proposed → approved → rejected) is properly implemented with 
SHA256 hashing for content integrity.

Project path: ${PROJECT_ROOT}
    `.trim()
  },

  'backend-infra': {
    name: 'Cyrus',
    emoji: '🏗️',
    role: 'Infrastructure',
    priority: 3,
    tasks: [
      'Review Dockerfile for production readiness',
      'Verify docker-compose.yml includes proper PostgreSQL setup',
      'Update deploy-gcp.sh script if needed',
      'Ensure environment variables are documented'
    ],
    focus: `
You are working on Sandarb.ai - an AI Governance Control Plane.

Key Infrastructure Requirements from README:
- Docker deployment with PostgreSQL
- GCP Cloud Run deployment support
- Demo data seeding when DATABASE_URL is set
- Health checks at /api/health

Your immediate task: Review the Dockerfile and docker-compose.yml to ensure 
they properly support both SQLite (dev) and PostgreSQL (prod) modes, and 
verify the seed data script runs correctly.

Project path: ${PROJECT_ROOT}
    `.trim()
  },

  'ai-prompts': {
    name: 'Sage',
    emoji: '🧠',
    role: 'AI Prompts',
    priority: 1,
    tasks: [
      'Design the prompt versioning system to support Git-like workflows',
      'Implement variable interpolation ({{variable}}) in prompts',
      'Ensure prompt approval workflow matches README requirements',
      'Create sample prompts for the "Operating Manifest" pattern from README'
    ],
    focus: `
You are working on Sandarb.ai - an AI Governance Control Plane.

Key Prompt Engineering Requirements from README:
- "Git-Like Versioning: Roll back instantly. Fork prompts for A/B testing"
- "Approval Workflows: Draft → Pending Review → Approved"
- "Immutable Testing: Prompts tested against Golden Datasets"
- Variable interpolation: {{variable}} support

The README shows a critical pattern - agents pull their "Operating Manifest" 
which includes approved System Prompt + Validated Context.

Your immediate task: Review lib/prompts.ts and ensure the versioning system 
supports the Git-like workflow described in the README. Verify variable 
extraction and interpolation works correctly.

Project path: ${PROJECT_ROOT}
    `.trim()
  },

  'ai-governance': {
    name: 'Oracle',
    emoji: '⚖️',
    role: 'AI Governance',
    priority: 1,
    tasks: [
      'Review A2A protocol implementation matches spec (a2a.dev)',
      'Ensure governance intersection logging works correctly',
      'Implement blocked injection logging for denied access',
      'Verify MCP server exposes prompts/contexts correctly'
    ],
    focus: `
You are working on Sandarb.ai - an AI Governance Control Plane.

Key Governance Requirements from README:
- "Sandarb runs as an A2A agent" - other agents call it for validation
- "Gatekeeper Agent" - verifies permissions before releasing data
- "Audit Trail" - complete tracking for compliance
- Skills: get_context, validate_context, get_lineage, register

The README states: "When an incident occurs, AI Governance requires you to 
reconstruct the exact state - Agent X used Prompt v4.2 and accessed 
Context Chunk #992 to generate this response."

Your immediate task: Review lib/a2a-server.ts and ensure all A2A skills 
are implemented correctly. Verify lib/governance.ts properly tracks the 
governance intersection.

Project path: ${PROJECT_ROOT}
    `.trim()
  }
};

// Colors for terminal output
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function logHeader(title) {
  console.log('');
  log('═'.repeat(70), 'cyan');
  log(`  ${title}`, 'bright');
  log('═'.repeat(70), 'cyan');
  console.log('');
}

// Check if gateway is running
function isGatewayRunning() {
  try {
    const result = execSync('openclaw gateway status 2>&1', { encoding: 'utf8' });
    return result.includes('running');
  } catch (e) {
    return false;
  }
}

// Start gateway if not running
function startGateway() {
  if (isGatewayRunning()) {
    log('✅ OpenClaw gateway already running', 'green');
    return true;
  }

  log('🚀 Starting OpenClaw gateway...', 'yellow');
  try {
    // Start in background
    const child = spawn('openclaw', ['gateway', '--port', '18789'], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    
    // Wait for startup
    execSync('sleep 3');
    
    if (isGatewayRunning()) {
      log('✅ Gateway started successfully', 'green');
      return true;
    }
  } catch (e) {
    log(`❌ Failed to start gateway: ${e.message}`, 'red');
  }
  return false;
}

// Send task to agent via OpenClaw (spawnSync avoids shell quoting and ARG_MAX with long messages)
function sendTaskToAgent(agentId, message) {
  try {
    log(`📤 Sending task to ${TEAM_TASKS[agentId].emoji} ${TEAM_TASKS[agentId].name}...`, 'cyan');
    const result = spawnSync('openclaw', ['agent', '--agent', agentId, '--message', message], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      shell: false,
    });
    if (result.error) {
      if (result.error.code === 'ENOENT') {
        log(`⚠️ openclaw not found in PATH`, 'yellow');
        return null;
      }
      throw result.error;
    }
    const out = (result.stdout || '').trim();
    const err = (result.stderr || '').trim();
    if (result.status !== 0) {
      log(`⚠️ Error sending to ${agentId}: ${err || `exit code ${result.status}`}`, 'yellow');
      return null;
    }
    log(`✅ ${TEAM_TASKS[agentId].name} acknowledged`, 'green');
    return out || null;
  } catch (e) {
    log(`⚠️ Error sending to ${agentId}: ${e.message}`, 'yellow');
    return null;
  }
}

// Show task assignments
function showTasks() {
  logHeader('🎯 Sandarb.ai Team Task Assignments');
  
  // Group by priority
  const byPriority = { 1: [], 2: [], 3: [] };
  for (const [id, agent] of Object.entries(TEAM_TASKS)) {
    byPriority[agent.priority].push({ id, ...agent });
  }

  log('Priority 1 - Critical Path:', 'bright');
  for (const agent of byPriority[1]) {
    console.log(`  ${agent.emoji} ${agent.name} (${agent.role})`);
    agent.tasks.forEach(t => console.log(`     • ${t}`));
    console.log('');
  }

  log('Priority 2 - Core Features:', 'bright');
  for (const agent of byPriority[2]) {
    console.log(`  ${agent.emoji} ${agent.name} (${agent.role})`);
    agent.tasks.forEach(t => console.log(`     • ${t}`));
    console.log('');
  }

  log('Priority 3 - Infrastructure:', 'bright');
  for (const agent of byPriority[3]) {
    console.log(`  ${agent.emoji} ${agent.name} (${agent.role})`);
    agent.tasks.forEach(t => console.log(`     • ${t}`));
    console.log('');
  }
}

// Initialize a single agent with its task
async function initializeAgent(agentId) {
  const agent = TEAM_TASKS[agentId];
  if (!agent) {
    log(`❌ Unknown agent: ${agentId}`, 'red');
    return false;
  }

  logHeader(`${agent.emoji} Initializing ${agent.name} (${agent.role})`);
  
  const initMessage = `
# Welcome to Sandarb.ai Development

${agent.focus}

## Your Assigned Tasks:
${agent.tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Please start by exploring the codebase and then work on your first task.
Report back with your findings and proposed changes.
  `.trim();

  const result = sendTaskToAgent(agentId, initMessage);
  return result !== null;
}

// Start all agents with their tasks
async function startAllAgents(parallel = false) {
  logHeader('🚀 Starting Sandarb.ai Development Team');

  // Sort by priority
  const sortedAgents = Object.entries(TEAM_TASKS)
    .sort((a, b) => a[1].priority - b[1].priority);

  if (parallel) {
    log('Starting all agents in parallel...', 'yellow');
    const promises = sortedAgents.map(([id]) => initializeAgent(id));
    await Promise.all(promises);
  } else {
    log('Starting agents sequentially by priority...', 'yellow');
    for (const [agentId] of sortedAgents) {
      await initializeAgent(agentId);
      // Small delay between agents
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  logHeader('✅ Team Initialization Complete');
  log('All 8 agents have received their tasks based on the README.', 'green');
  log('\nTo interact with agents:', 'cyan');
  log('  openclaw dashboard                    # Open web UI', 'dim');
  log('  ./scripts/sandarb-team.sh ui          # Chat with Luna', 'dim');
  log('  ./scripts/sandarb-team.sh api         # Chat with Atlas', 'dim');
  log('  ./scripts/sandarb-team.sh prompts     # Chat with Sage', 'dim');
  log('  ./scripts/sandarb-team.sh gov         # Chat with Oracle', 'dim');
}

// Main function
async function main() {
  const args = process.argv.slice(2);

  logHeader('🦞 Sandarb.ai Team Driver');
  log(`Project: ${PROJECT_ROOT}`, 'dim');
  log(`Time: ${new Date().toISOString()}`, 'dim');

  // Parse arguments
  if (args.includes('--tasks')) {
    showTasks();
    return;
  }

  // Check gateway
  log('\n📡 Checking OpenClaw gateway...', 'cyan');
  if (!startGateway()) {
    log('❌ Could not start gateway. Please run: openclaw gateway --port 18789', 'red');
    process.exit(1);
  }

  // Verify agents are configured
  log('\n👥 Verifying team configuration...', 'cyan');
  try {
    const agentList = execSync('openclaw agents list 2>&1', { encoding: 'utf8' });
    const configuredAgents = Object.keys(TEAM_TASKS).filter(id => agentList.includes(id));
    log(`✅ ${configuredAgents.length}/8 agents configured`, 'green');
    
    if (configuredAgents.length < 8) {
      log('⚠️ Some agents may not be configured. Run the setup first.', 'yellow');
    }
  } catch (e) {
    log('⚠️ Could not verify agents', 'yellow');
  }

  // Handle specific agent
  const agentIdx = args.indexOf('--agent');
  if (agentIdx !== -1 && args[agentIdx + 1]) {
    const agentId = args[agentIdx + 1];
    await initializeAgent(agentId);
    return;
  }

  // Start all agents
  const parallel = args.includes('--parallel');
  await startAllAgents(parallel);
}

main().catch(e => {
  log(`❌ Error: ${e.message}`, 'red');
  process.exit(1);
});
