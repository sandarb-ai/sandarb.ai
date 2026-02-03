#!/usr/bin/env node
/**
 * Initialize Postgres for Sandarb: create sandarb-dev DB if missing, then create all tables.
 * Run when DATABASE_URL is set (e.g. postgresql://user:pass@localhost:5432/sandarb-dev).
 * If the DB doesn't exist, connects to default "postgres" DB first to create sandarb-dev.
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/sandarb-dev';

function getCreateDbUrl(url) {
  try {
    const u = new URL(url);
    u.pathname = '/postgres';
    return u.toString();
  } catch {
    return 'postgresql://localhost:5432/postgres';
  }
}

async function createDbIfNotExists() {
  const createDbUrl = getCreateDbUrl(DATABASE_URL);
  const dbName = (() => {
    try {
      const u = new URL(DATABASE_URL);
      return u.pathname.slice(1) || 'sandarb-dev';
    } catch {
      return 'sandarb-dev';
    }
  })();

  const client = new Client({ connectionString: createDbUrl });
  try {
    await client.connect();
    const res = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );
    if (res.rows.length === 0) {
      await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
      console.log(`Created database: ${dbName}`);
    }
  } finally {
    await client.end();
  }
}

const SCHEMA = `
-- Core Context Definition
CREATE TABLE IF NOT EXISTS contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  lob_tag TEXT NOT NULL CHECK (lob_tag IN ('Wealth-Management', 'Investment-Banking', 'Retail-Banking', 'Legal-Compliance')),
  data_classification TEXT DEFAULT 'Internal' CHECK (data_classification IN ('Public', 'Internal', 'Confidential', 'Restricted', 'MNPI')),
  owner_team TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
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
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT FALSE,
  commit_message TEXT,
  UNIQUE(context_id, version_label)
);

CREATE INDEX IF NOT EXISTS idx_context_versions_context_id ON context_versions(context_id);
CREATE INDEX IF NOT EXISTS idx_context_versions_status ON context_versions(status);

-- Immutable Audit Log
CREATE TABLE IF NOT EXISTS sandarb_access_logs (
  log_id BIGSERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  version_id UUID REFERENCES context_versions(id),
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  request_ip TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_sandarb_access_logs_accessed_at ON sandarb_access_logs(accessed_at);

-- Activity log (revisions, create/update/delete context)
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

-- Organizations (for agents and app)
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

-- Agents (A2A registry)
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
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  owner_team TEXT,
  tools_used JSONB DEFAULT '[]',
  allowed_data_scopes JSONB DEFAULT '[]',
  pii_handling BOOLEAN DEFAULT false,
  regulatory_scope JSONB DEFAULT '[]',
  UNIQUE(org_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agents_org_id ON agents(org_id);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Governance: scan targets and unauthenticated detections
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

-- Templates (minimal for app)
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  schema JSONB DEFAULT '{"type":"object","properties":{}}',
  default_values JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prompts (the "Employee Handbook" for AI agents)
CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  tags TEXT DEFAULT '[]',
  current_version_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prompt Versions (versioned history with approval workflow)
CREATE TABLE IF NOT EXISTS prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  system_prompt TEXT,
  model TEXT DEFAULT 'gpt-4',
  status TEXT DEFAULT 'proposed' CHECK (status IN ('draft', 'proposed', 'approved', 'rejected', 'archived')),
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  parent_version_id UUID REFERENCES prompt_versions(id),
  sha256_hash TEXT NOT NULL,
  commit_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(prompt_id, version)
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_id ON prompt_versions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_status ON prompt_versions(status);

-- Add foreign key for current_version_id after prompt_versions exists
ALTER TABLE prompts DROP CONSTRAINT IF EXISTS fk_prompts_current_version;
DO $$ BEGIN
  ALTER TABLE prompts ADD CONSTRAINT fk_prompts_current_version 
    FOREIGN KEY (current_version_id) REFERENCES prompt_versions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`;

async function runSchema(client) {
  await client.query(SCHEMA);
  // Seed root org if missing
  const r = await client.query(
    "SELECT id FROM organizations WHERE is_root = true OR slug = 'root' LIMIT 1"
  );
  if (r.rows.length === 0) {
    const { v4: uuidv4 } = require('uuid');
    await client.query(
      `INSERT INTO organizations (id, name, slug, description, is_root)
       VALUES ($1, 'Root Organization', 'root', 'Company root.', true)
       ON CONFLICT (slug) DO NOTHING`,
      [uuidv4()]
    );
    console.log('Seeded root organization');
  }
}

async function main() {
  try {
    await createDbIfNotExists();
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    await runSchema(client);
    await client.end();
    console.log('Postgres schema ready.');
  } catch (err) {
    console.error('Init Postgres failed:', err.message);
    process.exit(1);
  }
}

main();
