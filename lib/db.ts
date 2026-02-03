import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = process.env.DATABASE_PATH || './data/sandarb.db';

// Ensure data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database connection
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize schema
const initSchema = () => {
  db.exec(`
    -- ========================================================================
    -- PROMPTS
    -- ========================================================================

    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      current_version_id TEXT,
      project_id TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prompt_versions (
      id TEXT PRIMARY KEY,
      prompt_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      variables TEXT NOT NULL DEFAULT '[]',
      model TEXT,
      temperature REAL,
      max_tokens INTEGER,
      system_prompt TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      commit_message TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      -- Governance fields (parity with context_revisions)
      status TEXT NOT NULL DEFAULT 'proposed',
      approved_by TEXT,
      approved_at TEXT,
      parent_version_id TEXT,
      sha256_hash TEXT,
      FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_version_id) REFERENCES prompt_versions(id) ON DELETE SET NULL,
      UNIQUE(prompt_id, version)
    );

    -- ========================================================================
    -- CONTEXTS
    -- ========================================================================

    CREATE TABLE IF NOT EXISTS contexts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      content TEXT NOT NULL DEFAULT '{}',
      template_id TEXT,
      environment TEXT NOT NULL DEFAULT 'development',
      tags TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT,
      line_of_business TEXT,
      data_classification TEXT,
      regulatory_hooks TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
    );

    -- Context revisions (git-like): propose edit -> approve/reject
    CREATE TABLE IF NOT EXISTS context_revisions (
      id TEXT PRIMARY KEY,
      context_id TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '{}',
      commit_message TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'proposed',
      approved_by TEXT,
      approved_at TEXT,
      parent_revision_id TEXT,
      FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_revision_id) REFERENCES context_revisions(id) ON DELETE SET NULL
    );

    -- ========================================================================
    -- TEMPLATES
    -- ========================================================================

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      schema TEXT NOT NULL DEFAULT '{"type":"object","properties":{}}',
      default_values TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ========================================================================
    -- EXPERIMENTS (A/B Testing)
    -- ========================================================================

    CREATE TABLE IF NOT EXISTS experiments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      prompt_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      variants TEXT NOT NULL DEFAULT '[]',
      traffic_allocation TEXT NOT NULL DEFAULT '{}',
      started_at TEXT,
      ended_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS experiment_results (
      id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL,
      variant_id TEXT NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      avg_latency REAL NOT NULL DEFAULT 0,
      success_rate REAL NOT NULL DEFAULT 0,
      user_rating REAL,
      custom_metrics TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
      UNIQUE(experiment_id, variant_id)
    );

    -- ========================================================================
    -- OBSERVABILITY
    -- ========================================================================

    CREATE TABLE IF NOT EXISTS request_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      prompt_id TEXT,
      context_id TEXT,
      experiment_id TEXT,
      variant_id TEXT,
      variables TEXT,
      latency_ms INTEGER NOT NULL,
      status_code INTEGER NOT NULL,
      user_agent TEXT,
      ip_address TEXT,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      resource_type TEXT NOT NULL DEFAULT 'context',
      resource_id TEXT,
      resource_name TEXT NOT NULL,
      details TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ========================================================================
    -- ORGANIZATIONS (root + sub-orgs hierarchy)
    -- ========================================================================

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      parent_id TEXT,
      is_root INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (parent_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS org_members (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
      UNIQUE(org_id, user_id)
    );

    -- ========================================================================
    -- REGISTERED AGENTS (A2A-compatible agent registry)
    -- ========================================================================

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      agent_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      a2a_url TEXT NOT NULL,
      agent_card TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      approval_status TEXT NOT NULL DEFAULT 'draft',
      approved_by TEXT,
      approved_at TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      owner_team TEXT,
      tools_used TEXT NOT NULL DEFAULT '[]',
      allowed_data_scopes TEXT NOT NULL DEFAULT '[]',
      pii_handling INTEGER NOT NULL DEFAULT 0,
      regulatory_scope TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
      UNIQUE(org_id, agent_id)
    );

    -- ========================================================================
    -- SETTINGS
    -- ========================================================================

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- ========================================================================
    -- INDEXES
    -- ========================================================================

    CREATE INDEX IF NOT EXISTS idx_prompts_name ON prompts(name);
    CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_id ON prompt_versions(prompt_id);
    CREATE INDEX IF NOT EXISTS idx_contexts_name ON contexts(name);
    CREATE INDEX IF NOT EXISTS idx_contexts_environment ON contexts(environment);
    CREATE INDEX IF NOT EXISTS idx_contexts_is_active ON contexts(is_active);
    CREATE INDEX IF NOT EXISTS idx_templates_name ON templates(name);
    CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
    CREATE INDEX IF NOT EXISTS idx_experiments_prompt_id ON experiments(prompt_id);
    CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_request_logs_prompt_id ON request_logs(prompt_id);
    CREATE INDEX IF NOT EXISTS idx_request_logs_context_id ON request_logs(context_id);
    CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_organizations_parent_id ON organizations(parent_id);
    CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
    CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON org_members(org_id);
    CREATE INDEX IF NOT EXISTS idx_agents_org_id ON agents(org_id);
    CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
    CREATE INDEX IF NOT EXISTS idx_context_revisions_context_id ON context_revisions(context_id);
    CREATE INDEX IF NOT EXISTS idx_context_revisions_status ON context_revisions(status);
  `);
  migrateSchema();
  seedRootOrganization();
};

const migrateSchema = () => {
  const run = (sql: string) => {
    try {
      db.exec(sql);
    } catch {
      // Column or table may already exist
    }
  };
  run('ALTER TABLE agents ADD COLUMN approval_status TEXT NOT NULL DEFAULT \'draft\'');
  run('ALTER TABLE agents ADD COLUMN approved_by TEXT');
  run('ALTER TABLE agents ADD COLUMN approved_at TEXT');
  run('ALTER TABLE agents ADD COLUMN created_by TEXT');
  run('ALTER TABLE contexts ADD COLUMN created_by TEXT');
  run('ALTER TABLE activity_log ADD COLUMN created_by TEXT');
  run('ALTER TABLE agents ADD COLUMN agent_id TEXT');
  run('ALTER TABLE agents ADD COLUMN owner_team TEXT');
  run('ALTER TABLE agents ADD COLUMN tools_used TEXT NOT NULL DEFAULT \'[]\'');
  run('ALTER TABLE agents ADD COLUMN allowed_data_scopes TEXT NOT NULL DEFAULT \'[]\'');
  run('ALTER TABLE agents ADD COLUMN pii_handling INTEGER NOT NULL DEFAULT 0');
  run('ALTER TABLE agents ADD COLUMN regulatory_scope TEXT NOT NULL DEFAULT \'[]\'');
  run('ALTER TABLE contexts ADD COLUMN line_of_business TEXT');
  run('ALTER TABLE contexts ADD COLUMN data_classification TEXT');
  run('ALTER TABLE contexts ADD COLUMN regulatory_hooks TEXT NOT NULL DEFAULT \'[]\'');
  // Prompt governance: approval workflow parity with context_revisions
  run('ALTER TABLE prompt_versions ADD COLUMN status TEXT NOT NULL DEFAULT \'proposed\'');
  run('ALTER TABLE prompt_versions ADD COLUMN approved_by TEXT');
  run('ALTER TABLE prompt_versions ADD COLUMN approved_at TEXT');
  run('ALTER TABLE prompt_versions ADD COLUMN parent_version_id TEXT');
  run('ALTER TABLE prompt_versions ADD COLUMN sha256_hash TEXT');
  // Mark existing prompt versions as approved (backward compatibility)
  run('UPDATE prompt_versions SET status = \'approved\' WHERE status = \'proposed\'');
  try {
    // Partial unique index: one (org_id, agent_id) per non-null agent_id (allows multiple null agent_id).
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_org_agent_id ON agents(org_id, agent_id) WHERE agent_id IS NOT NULL');
  } catch {
    // Index may already exist or SQLite < 3.8; skip (upsert by agent_id still works, just no DB-level uniqueness).
  }
  // Shadow AI discovery: scan targets (URLs to probe) and unauthenticated agent detections
  run(`
    CREATE TABLE IF NOT EXISTS scan_targets (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  run(`
    CREATE TABLE IF NOT EXISTS unauthenticated_detections (
      id TEXT PRIMARY KEY,
      source_url TEXT NOT NULL,
      detected_agent_id TEXT,
      details TEXT,
      scan_run_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_unauthenticated_detections_scan_run_at ON unauthenticated_detections(scan_run_at)');
  } catch {}
};

const seedRootOrganization = () => {
  const root = db.prepare('SELECT id FROM organizations WHERE is_root = 1 OR slug = ? LIMIT 1').get('root');
  if (!root) {
    db.prepare(`
      INSERT OR IGNORE INTO organizations (id, name, slug, description, is_root)
      VALUES (?, 'Root Organization', 'root', 'Company root. Create sub-orgs under this.', 1)
    `).run(uuidv4());
  }
};

// Initialize on first load
initSchema();

const parseJsonArray = (v: unknown): string[] => {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v as string[];
  try {
    const a = JSON.parse(v as string);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
};

/** Safe parse for JSON object (context content, etc.). Returns {} on invalid/empty. */
const parseJsonObject = (v: unknown): Record<string, unknown> => {
  if (v == null || v === '') return {};
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) return v as Record<string, unknown>;
  try {
    const parsed = JSON.parse(v as string);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

/** Safe parse for tags (array). Returns [] on invalid. */
const parseJsonTags = (v: unknown): string[] => {
  if (v == null || v === '') return [];
  try {
    const a = JSON.parse(v as string);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
};

// Helper to convert row to Context
export const rowToContext = (row: Record<string, unknown>) => ({
  id: row.id as string,
  name: row.name as string,
  description: row.description as string | null,
  content: parseJsonObject(row.content),
  templateId: row.template_id as string | null,
  environment: ((row.environment as string) || 'development') as 'development' | 'staging' | 'production',
  tags: parseJsonTags(row.tags),
  isActive: Boolean(row.is_active),
  priority: (row.priority as number) || 0,
  expiresAt: row.expires_at as string | null,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
  lineOfBusiness: (row.line_of_business as import('@/types').LineOfBusiness) || null,
  dataClassification: (row.data_classification as import('@/types').DataClassification) || null,
  regulatoryHooks: (parseJsonArray(row.regulatory_hooks) as import('@/types').RegulatoryHook[]) || [],
});

// Helper to convert row to Template
export const rowToTemplate = (row: Record<string, unknown>) => ({
  id: row.id as string,
  name: row.name as string,
  description: row.description as string | null,
  schema: JSON.parse(row.schema as string),
  defaultValues: JSON.parse(row.default_values as string),
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

// Helper to convert row to Organization
export const rowToOrganization = (row: Record<string, unknown>) => ({
  id: row.id as string,
  name: row.name as string,
  slug: row.slug as string,
  description: row.description as string | null,
  parentId: row.parent_id as string | null,
  isRoot: Boolean(row.is_root),
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

// Helper to convert row to ContextRevision
export const rowToContextRevision = (row: Record<string, unknown>) => ({
  id: row.id as string,
  contextId: row.context_id as string,
  content: parseJsonObject(row.content),
  commitMessage: row.commit_message as string | null,
  createdBy: row.created_by as string | null,
  createdAt: row.created_at as string,
  status: row.status as 'proposed' | 'approved' | 'rejected',
  approvedBy: row.approved_by as string | null,
  approvedAt: row.approved_at as string | null,
  parentRevisionId: row.parent_revision_id as string | null,
});

// Helper to convert row to RegisteredAgent
export const rowToAgent = (row: Record<string, unknown>) => ({
  id: row.id as string,
  orgId: row.org_id as string,
  agentId: (row.agent_id as string) || null,
  name: row.name as string,
  description: row.description as string | null,
  a2aUrl: row.a2a_url as string,
  agentCard: row.agent_card ? (JSON.parse(row.agent_card as string) as import('@/types').AgentCard) : null,
  status: row.status as import('@/types').AgentStatus,
  approvalStatus: ((row.approval_status as string) || 'draft') as import('@/types').AgentApprovalStatus,
  approvedBy: row.approved_by as string | null,
  approvedAt: row.approved_at as string | null,
  createdBy: row.created_by as string | null,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
  ownerTeam: (row.owner_team as string) || null,
  toolsUsed: parseJsonArray(row.tools_used),
  allowedDataScopes: parseJsonArray(row.allowed_data_scopes),
  piiHandling: Boolean(row.pii_handling),
  regulatoryScope: parseJsonArray(row.regulatory_scope),
});

export default db;
