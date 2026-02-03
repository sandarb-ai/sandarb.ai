#!/usr/bin/env node
/**
 * Sandarb.ai Team Driver Script
 * 
 * Coordinates an 8-agent OpenClaw team for the Sandarb.ai project.
 * 
 * Team Composition:
 * - 2 UI Agents: Luna (Lead), Nova (Components)
 * - 4 Backend Agents: Atlas (API), Petra (DB), Axel (Services), Cyrus (Infra)
 * - 2 AI Agents: Sage (Prompts), Oracle (Governance)
 * 
 * Usage:
 *   node scripts/sandarb-team.js status          # Show team status
 *   node scripts/sandarb-team.js assign <task>   # Route task to appropriate agent
 *   node scripts/sandarb-team.js chat <agent>    # Start chat with specific agent
 *   node scripts/sandarb-team.js standup         # Run daily standup
 *   node scripts/sandarb-team.js review <file>   # Request code review
 */

const { execSync, spawn } = require('child_process');
const readline = require('readline');

// Team Configuration
const TEAM = {
  // UI Team
  'ui-lead': {
    name: 'Luna',
    emoji: '🎨',
    role: 'UI Lead',
    domains: ['app/', 'app/layout.tsx', 'app/page.tsx', 'components/app-shell.tsx', 'components/sidebar.tsx', 'components/header.tsx'],
    keywords: ['layout', 'page', 'navigation', 'ux', 'design', 'frontend architecture']
  },
  'ui-components': {
    name: 'Nova',
    emoji: '✨',
    role: 'UI Components',
    domains: ['components/ui/', 'components/context-card.tsx', 'components/stats-card.tsx', 'components/empty-state.tsx'],
    keywords: ['component', 'button', 'card', 'dialog', 'input', 'badge', 'tailwind', 'radix', 'accessibility']
  },
  
  // Backend Team
  'backend-api': {
    name: 'Atlas',
    emoji: '🔌',
    role: 'Backend API',
    domains: ['app/api/'],
    keywords: ['api', 'route', 'endpoint', 'rest', 'request', 'response', 'validation']
  },
  'backend-db': {
    name: 'Petra',
    emoji: '🗄️',
    role: 'Database',
    domains: ['lib/db.ts', 'lib/pg.ts', 'lib/*-pg.ts', 'scripts/init-postgres.js', 'scripts/seed-postgres.js'],
    keywords: ['database', 'sql', 'postgres', 'sqlite', 'schema', 'migration', 'query']
  },
  'backend-services': {
    name: 'Axel',
    emoji: '⚙️',
    role: 'Services',
    domains: ['lib/agents.ts', 'lib/contexts.ts', 'lib/prompts.ts', 'lib/organizations.ts', 'lib/utils.ts', 'types/'],
    keywords: ['service', 'logic', 'utility', 'type', 'interface', 'function']
  },
  'backend-infra': {
    name: 'Cyrus',
    emoji: '🏗️',
    role: 'Infrastructure',
    domains: ['Dockerfile', 'docker-compose.yml', 'scripts/deploy-gcp.sh', 'next.config.js', '.dockerignore'],
    keywords: ['docker', 'deploy', 'gcp', 'cloud', 'ci', 'cd', 'script', 'infrastructure']
  },
  
  // AI Team
  'ai-prompts': {
    name: 'Sage',
    emoji: '🧠',
    role: 'AI Prompts',
    domains: ['lib/prompts.ts', 'lib/contexts.ts', 'lib/templates.ts', 'app/prompts/', 'app/contexts/', 'app/templates/'],
    keywords: ['prompt', 'context', 'template', 'version', 'variable', 'interpolation']
  },
  'ai-governance': {
    name: 'Oracle',
    emoji: '⚖️',
    role: 'AI Governance',
    domains: ['lib/a2a-server.ts', 'lib/mcp-server.ts', 'lib/mcp-client.ts', 'lib/audit.ts', 'lib/governance.ts', 'lib/policy.ts', 'app/api/a2a/', 'app/api/governance/'],
    keywords: ['a2a', 'mcp', 'audit', 'governance', 'compliance', 'policy', 'lineage', 'protocol']
  }
};

// Helper: Run OpenClaw command
function runOpenClaw(args, options = {}) {
  try {
    const result = execSync(`openclaw ${args}`, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    return result;
  } catch (error) {
    if (!options.silent) {
      console.error(`OpenClaw command failed: ${error.message}`);
    }
    return null;
  }
}

// Helper: Determine best agent for a task/file
function routeTask(input) {
  const inputLower = input.toLowerCase();
  
  // Check file paths first
  for (const [agentId, agent] of Object.entries(TEAM)) {
    for (const domain of agent.domains) {
      if (input.includes(domain) || input.startsWith(domain.replace('*', ''))) {
        return { agentId, agent, reason: `matches domain: ${domain}` };
      }
    }
  }
  
  // Check keywords
  for (const [agentId, agent] of Object.entries(TEAM)) {
    for (const keyword of agent.keywords) {
      if (inputLower.includes(keyword)) {
        return { agentId, agent, reason: `matches keyword: ${keyword}` };
      }
    }
  }
  
  // Default to Atlas (API) as the team lead for backend
  return { agentId: 'backend-api', agent: TEAM['backend-api'], reason: 'default routing' };
}

// Command: Show team status
function showStatus() {
  console.log('\n🦞 Sandarb.ai Team Status\n');
  console.log('═'.repeat(60));
  
  // Get gateway status
  const gatewayStatus = runOpenClaw('gateway status', { silent: true });
  console.log('\n📡 Gateway:', gatewayStatus?.includes('running') ? '✅ Running' : '❌ Not Running');
  
  console.log('\n👥 Team Members:\n');
  
  // UI Team
  console.log('  🎨 UI TEAM');
  console.log(`     ${TEAM['ui-lead'].emoji} ${TEAM['ui-lead'].name} (${TEAM['ui-lead'].role}) - ui-lead`);
  console.log(`     ${TEAM['ui-components'].emoji} ${TEAM['ui-components'].name} (${TEAM['ui-components'].role}) - ui-components`);
  
  // Backend Team
  console.log('\n  🔧 BACKEND TEAM');
  console.log(`     ${TEAM['backend-api'].emoji} ${TEAM['backend-api'].name} (${TEAM['backend-api'].role}) - backend-api`);
  console.log(`     ${TEAM['backend-db'].emoji} ${TEAM['backend-db'].name} (${TEAM['backend-db'].role}) - backend-db`);
  console.log(`     ${TEAM['backend-services'].emoji} ${TEAM['backend-services'].name} (${TEAM['backend-services'].role}) - backend-services`);
  console.log(`     ${TEAM['backend-infra'].emoji} ${TEAM['backend-infra'].name} (${TEAM['backend-infra'].role}) - backend-infra`);
  
  // AI Team
  console.log('\n  🤖 AI TEAM');
  console.log(`     ${TEAM['ai-prompts'].emoji} ${TEAM['ai-prompts'].name} (${TEAM['ai-prompts'].role}) - ai-prompts`);
  console.log(`     ${TEAM['ai-governance'].emoji} ${TEAM['ai-governance'].name} (${TEAM['ai-governance'].role}) - ai-governance`);
  
  console.log('\n' + '═'.repeat(60));
  console.log('\nUsage:');
  console.log('  node scripts/sandarb-team.js chat <agent-id>   # Chat with agent');
  console.log('  node scripts/sandarb-team.js assign "<task>"   # Auto-route task');
  console.log('  node scripts/sandarb-team.js standup           # Daily standup');
  console.log('');
}

// Command: Route task to agent
function assignTask(task) {
  console.log('\n🎯 Task Assignment\n');
  console.log(`Task: "${task}"\n`);
  
  const { agentId, agent, reason } = routeTask(task);
  
  console.log(`📋 Assigned to: ${agent.emoji} ${agent.name} (${agent.role})`);
  console.log(`   Reason: ${reason}\n`);
  console.log(`To start working with ${agent.name}, run:`);
  console.log(`   openclaw agent --agent ${agentId} --message "${task}"\n`);
  
  return { agentId, agent };
}

// Command: Start chat with agent
function startChat(agentId) {
  if (!TEAM[agentId]) {
    console.error(`\n❌ Unknown agent: ${agentId}`);
    console.log('\nAvailable agents:');
    Object.entries(TEAM).forEach(([id, agent]) => {
      console.log(`  ${agent.emoji} ${id} - ${agent.name} (${agent.role})`);
    });
    process.exit(1);
  }
  
  const agent = TEAM[agentId];
  console.log(`\n${agent.emoji} Starting chat with ${agent.name} (${agent.role})...`);
  console.log(`   Workspace: ~/.openclaw/workspace-${agentId}\n`);
  
  // Open dashboard with agent context
  runOpenClaw('dashboard');
  console.log(`\nOpened Control UI. Select agent "${agentId}" from the agent picker.`);
}

// Command: Run standup
function runStandup() {
  console.log('\n☀️ Sandarb.ai Daily Standup\n');
  console.log('═'.repeat(60));
  
  const questions = [
    "What did you work on yesterday?",
    "What are you working on today?",
    "Any blockers?"
  ];
  
  console.log('\nStandup Questions:');
  questions.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
  
  console.log('\n📝 To run standup with each agent:\n');
  
  Object.entries(TEAM).forEach(([agentId, agent]) => {
    console.log(`  ${agent.emoji} ${agent.name}:`);
    console.log(`     openclaw agent --agent ${agentId} --message "Standup: What's your status on Sandarb.ai?"`);
  });
  
  console.log('\n' + '═'.repeat(60));
}

// Command: Request code review
function requestReview(file) {
  console.log(`\n🔍 Code Review Request: ${file}\n`);
  
  const { agentId, agent, reason } = routeTask(file);
  
  console.log(`Primary Reviewer: ${agent.emoji} ${agent.name} (${reason})`);
  console.log(`\nTo request review, run:`);
  console.log(`   openclaw agent --agent ${agentId} --message "Please review ${file} for code quality, patterns, and potential issues."\n`);
}

// Main CLI
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'status':
      showStatus();
      break;
      
    case 'assign':
      if (!args[1]) {
        console.error('Usage: sandarb-team.js assign "<task description>"');
        process.exit(1);
      }
      assignTask(args.slice(1).join(' '));
      break;
      
    case 'chat':
      if (!args[1]) {
        console.error('Usage: sandarb-team.js chat <agent-id>');
        process.exit(1);
      }
      startChat(args[1]);
      break;
      
    case 'standup':
      runStandup();
      break;
      
    case 'review':
      if (!args[1]) {
        console.error('Usage: sandarb-team.js review <file-path>');
        process.exit(1);
      }
      requestReview(args[1]);
      break;
      
    default:
      showStatus();
  }
}

main();
