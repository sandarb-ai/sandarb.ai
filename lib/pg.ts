/**
 * Postgres client for Sandarb. Requires DATABASE_URL. Ensures DB and tables exist on first use.
 */

import { Pool, PoolClient } from 'pg';
import { logger } from './otel';

const DATABASE_URL = process.env.DATABASE_URL;
let pool: Pool | null = null;
let schemaEnsured = false;

function getCreateDbUrl(url: string): string {
  try {
    const u = new URL(url);
    u.pathname = '/postgres';
    return u.toString();
  } catch {
    return 'postgresql://localhost:5432/postgres';
  }
}

function getDbName(url: string): string {
  try {
    const u = new URL(url);
    const name = u.pathname.slice(1);
    return name || 'sandarb-dev';
  } catch {
    return 'sandarb-dev';
  }
}

async function createDbIfNotExists(): Promise<void> {
  if (!DATABASE_URL) return;
  const createDbUrl = getCreateDbUrl(DATABASE_URL);
  const dbName = getDbName(DATABASE_URL);
  const { Client } = await import('pg');
  const client = new Client({ connectionString: createDbUrl });
  try {
    await client.connect();
    const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (res.rows.length === 0) {
      await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    }
  } finally {
    await client.end();
  }
}

const SCHEMA_SQL = `
-- Core Context Definition
CREATE TABLE IF NOT EXISTS contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  lob_tag TEXT NOT NULL CHECK (lob_tag IN ('Wealth-Management', 'Investment-Banking', 'Retail-Banking', 'Legal-Compliance')),
  data_classification TEXT DEFAULT 'Internal' CHECK (data_classification IN ('Public', 'Internal', 'Confidential', 'Restricted', 'MNPI')),
  owner_team TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT,
  tags TEXT DEFAULT '[]',
  regulatory_hooks TEXT DEFAULT '[]'
);

-- Versioning & Regulatory Approval
CREATE TABLE IF NOT EXISTS context_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id UUID NOT NULL REFERENCES contexts(id) ON DELETE CASCADE,
  version_label TEXT NOT NULL,
  content JSONB NOT NULL,
  sha256_hash TEXT NOT NULL,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Draft', 'Pending', 'Approved', 'Archived')),
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  updated_by TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  commit_message TEXT,
  UNIQUE(context_id, version_label)
);

CREATE INDEX IF NOT EXISTS idx_context_versions_context_id ON context_versions(context_id);
CREATE INDEX IF NOT EXISTS idx_context_versions_status ON context_versions(status);

-- Prompts (Employee Handbook / Behavior Instructions)
CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  current_version_id UUID,
  project_id TEXT,
  tags JSONB DEFAULT '[]',
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT
);

-- Prompt Versioning & Regulatory Approval (parity with context_versions)
CREATE TABLE IF NOT EXISTS prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  model TEXT,
  temperature REAL,
  max_tokens INTEGER,
  system_prompt TEXT,
  metadata JSONB DEFAULT '{}',
  commit_message TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE,
  updated_by TEXT,
  -- Governance fields (parity with context_versions)
  status TEXT DEFAULT 'Proposed' CHECK (status IN ('Draft', 'Proposed', 'Approved', 'Rejected', 'Archived')),
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  parent_version_id UUID REFERENCES prompt_versions(id),
  sha256_hash TEXT NOT NULL,
  UNIQUE(prompt_id, version)
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_id ON prompt_versions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_status ON prompt_versions(status);

-- Immutable Audit Log (Governance Intersection: tracks both prompts and contexts)
CREATE TABLE IF NOT EXISTS sandarb_access_logs (
  log_id BIGSERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  -- Context tracking
  context_id UUID REFERENCES contexts(id),
  version_id UUID REFERENCES context_versions(id),
  -- Prompt tracking (enables "Agent X used Prompt v4.2 and Context Chunk #992")
  prompt_id UUID REFERENCES prompts(id),
  prompt_version_id UUID REFERENCES prompt_versions(id),
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  request_ip TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_sandarb_access_logs_accessed_at ON sandarb_access_logs(accessed_at);
CREATE INDEX IF NOT EXISTS idx_sandarb_access_logs_agent_id ON sandarb_access_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_sandarb_access_logs_trace_id ON sandarb_access_logs(trace_id);

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  resource_type TEXT DEFAULT 'context',
  resource_id TEXT,
  resource_name TEXT NOT NULL,
  details TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES organizations(id),
  is_root BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  a2a_url TEXT NOT NULL,
  agent_card JSONB,
  status TEXT DEFAULT 'active',
  approval_status TEXT DEFAULT 'draft',
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  submitted_by TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT,
  owner_team TEXT,
  tools_used JSONB DEFAULT '[]',
  allowed_data_scopes JSONB DEFAULT '[]',
  pii_handling BOOLEAN DEFAULT false,
  regulatory_scope JSONB DEFAULT '[]',
  UNIQUE(org_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agents_org_id ON agents(org_id);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS scan_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS unauthenticated_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  detected_agent_id TEXT,
  details JSONB DEFAULT '{}',
  scan_run_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unauthenticated_detections_scan_run_at ON unauthenticated_detections(scan_run_at);

CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  schema JSONB DEFAULT '{"type":"object","properties":{}}',
  default_values JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

const MIGRATIONS_SQL = [
  `DO $$ BEGIN ALTER TABLE agents ADD COLUMN submitted_by TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE agents ADD COLUMN updated_by TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE prompts ADD COLUMN created_by TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE prompts ADD COLUMN updated_by TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE prompt_versions ADD COLUMN submitted_by TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE prompt_versions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE prompt_versions ADD COLUMN updated_by TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE contexts ADD COLUMN created_by TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE contexts ADD COLUMN updated_by TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE context_versions ADD COLUMN submitted_by TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE context_versions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE context_versions ADD COLUMN updated_by TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
];

async function runSchema(p: Pool): Promise<void> {
  await p.query(SCHEMA_SQL);
  for (const sql of MIGRATIONS_SQL) {
    await p.query(sql);
  }
  const r = await p.query(
    "SELECT id FROM organizations WHERE is_root = true OR slug = 'root' LIMIT 1"
  );
  if (r.rows.length === 0) {
    const { v4: uuidv4 } = await import('uuid');
    await p.query(
      `INSERT INTO organizations (id, name, slug, description, is_root)
       VALUES ($1, 'Root Organization', 'root', 'Company root.', true)
       ON CONFLICT (slug) DO NOTHING`,
      [uuidv4()]
    );
  }
}

export async function ensureDb(): Promise<void> {
  if (!DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (schemaEnsured) return;
  await createDbIfNotExists();
  const p = new Pool({ connectionString: DATABASE_URL });
  try {
    await runSchema(p);
  } finally {
    await p.end();
  }
  schemaEnsured = true;
}

export async function getPool(): Promise<Pool> {
  if (!DATABASE_URL) {
    logger.error('DATABASE_URL is required', { component: 'pg' });
    throw new Error('DATABASE_URL is required');
  }
  if (!pool) {
    await ensureDb();
    pool = new Pool({ connectionString: DATABASE_URL });
  }
  return pool;
}

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const p = await getPool();
  const res = await p.query(text, params);
  return (res.rows as T[]) || [];
}

export async function queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
