/**
 * Sandarb.AI Team Constants - Client-safe definitions
 * Agent definitions and channel info (no server-side imports)
 */

// Apsaras = OpenClaw agents on the Sandarb.AI team (Punjikasthala, Mishrakeshi, etc.)
export const APSARA_AGENTS = {
  punjikasthala: {
    id: 'punjikasthala',
    name: 'Punjikasthala',
    emoji: '⚖️',
    role: 'A2A Protocol & Compliance Lead',
    focus: ['lib/a2a-server.ts', 'lib/governance.ts'],
    color: '#7c3aed', // violet
  },
  mishrakeshi: {
    id: 'mishrakeshi',
    name: 'Mishrakeshi',
    emoji: '🎭',
    role: 'Prompt Versioning & Git-like Workflows',
    focus: ['lib/prompts.ts', 'lib/revisions.ts'],
    color: '#ec4899', // pink
  },
  rambha: {
    id: 'rambha',
    name: 'Rambha',
    emoji: '🔱',
    role: 'Agent Registry & API Lead',
    focus: ['app/api/agents/', 'app/api/inject/'],
    color: '#f97316', // orange
  },
  tilottama: {
    id: 'tilottama',
    name: 'Tilottama',
    emoji: '💎',
    role: 'Audit Schema & Data Layer',
    focus: ['lib/audit-pg.ts', 'scripts/init-postgres.js'],
    color: '#06b6d4', // cyan
  },
  ghritachi: {
    id: 'ghritachi',
    name: 'Ghritachi',
    emoji: '⚙️',
    role: 'Approval Workflows & Business Logic',
    focus: ['lib/prompts.ts', 'lib/contexts.ts'],
    color: '#84cc16', // lime
  },
  alambusha: {
    id: 'alambusha',
    name: 'Alambusha',
    emoji: '🏛️',
    role: 'Production Deployment & Infrastructure',
    focus: ['Dockerfile', 'docker-compose.yml'],
    color: '#64748b', // slate
  },
  urvashi: {
    id: 'urvashi',
    name: 'Urvashi',
    emoji: '🪷',
    role: 'Compliance Dashboard & UX Lead',
    focus: ['app/dashboard/', 'app/prompts/'],
    color: '#a855f7', // purple
  },
  menaka: {
    id: 'menaka',
    name: 'Menaka',
    emoji: '✨',
    role: 'Governance UI Components',
    focus: ['components/ui/', 'components/'],
    color: '#eab308', // yellow
  },
  sandarb: {
    id: 'sandarb',
    name: 'Sandarb',
    emoji: '🧠',
    role: 'AI Governance System',
    focus: [],
    color: '#10b981', // emerald
  },
} as const;

export type ApsaraAgentId = keyof typeof APSARA_AGENTS;

/** OpenClaw agent IDs for openclaw agent --agent <id> (orchestrator / relay). null = not an OpenClaw agent. */
export const OPENCLAW_AGENT_IDS: Record<ApsaraAgentId, string | null> = {
  punjikasthala: 'ai-governance',
  mishrakeshi: 'ai-prompts',
  rambha: 'backend-api',
  tilottama: 'backend-db',
  ghritachi: 'backend-services',
  alambusha: 'backend-infra',
  urvashi: 'ui-lead',
  menaka: 'ui-components',
  sandarb: null,
};

export interface ApsaraMessage {
  id: string;
  timestamp: string;
  agentId: ApsaraAgentId | 'system';
  type: 'message' | 'task_start' | 'task_complete' | 'error' | 'session_start' | 'session_end' | 'feature';
  content: string;
  channel: string;
  metadata?: {
    features?: string[];
    file?: string;
    error?: string;
    traceId?: string;
  };
}

export interface ApsaraChannel {
  id: string;
  name: string;
  description: string;
  icon: string;
  unreadCount?: number;
}

export const APSARA_CHANNELS: ApsaraChannel[] = [
  { id: 'general', name: 'general', description: 'All team activity', icon: '#' },
  { id: 'features', name: 'features', description: 'Feature development log', icon: '🚀' },
  { id: 'a2a-protocol', name: 'a2a-protocol', description: 'A2A & governance work', icon: '⚖️' },
  { id: 'prompts', name: 'prompts', description: 'Prompt versioning work', icon: '🎭' },
  { id: 'agents', name: 'agents', description: 'Agent registry work', icon: '🔱' },
  { id: 'audit', name: 'audit', description: 'Audit schema work', icon: '💎' },
  { id: 'workflows', name: 'workflows', description: 'Approval workflows', icon: '⚙️' },
  { id: 'infra', name: 'infra', description: 'Infrastructure & deployment', icon: '🏛️' },
  { id: 'dashboard', name: 'dashboard', description: 'Dashboard & UX', icon: '🪷' },
  { id: 'ui', name: 'ui', description: 'UI components', icon: '✨' },
  { id: 'errors', name: 'errors', description: 'Errors & issues', icon: '🚨' },
];
