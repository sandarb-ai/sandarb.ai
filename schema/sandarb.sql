-- Sandarb Postgres schema
-- Run against an empty database (e.g. after creating the DB).
-- Source: lib/pg.ts (SCHEMA_SQL)
-- Usage: psql $DATABASE_URL -f schema/sandarb.sql

-- Organizations (must exist before contexts and agents)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
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

-- Core Context Definition
CREATE TABLE IF NOT EXISTS contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  org_id UUID REFERENCES organizations(id),
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
  version INTEGER NOT NULL,
  content JSONB NOT NULL,
  sha256_hash TEXT NOT NULL,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Draft', 'Pending', 'Approved', 'Rejected', 'Archived')),
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  updated_by TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  commit_message TEXT,
  UNIQUE(context_id, version)
);

CREATE INDEX IF NOT EXISTS idx_context_versions_context_id ON context_versions(context_id);
CREATE INDEX IF NOT EXISTS idx_context_versions_status ON context_versions(status);

-- Prompts (Employee Handbook / Behavior Instructions)
CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_prompts_org_id ON prompts(org_id);

-- Prompt Versioning & Regulatory Approval
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
  status TEXT DEFAULT 'Proposed' CHECK (status IN ('Draft', 'Proposed', 'Approved', 'Rejected', 'Archived')),
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  parent_version_id UUID REFERENCES prompt_versions(id),
  sha256_hash TEXT NOT NULL,
  UNIQUE(prompt_id, version)
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_id ON prompt_versions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_status ON prompt_versions(status);

-- Immutable Audit Log (Governance Intersection)
CREATE TABLE IF NOT EXISTS sandarb_access_logs (
  log_id BIGSERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  context_id UUID REFERENCES contexts(id),
  version_id UUID REFERENCES context_versions(id),
  prompt_id UUID REFERENCES prompts(id),
  prompt_version_id UUID REFERENCES prompt_versions(id),
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  request_ip TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_sandarb_access_logs_accessed_at ON sandarb_access_logs(accessed_at);
CREATE INDEX IF NOT EXISTS idx_sandarb_access_logs_agent_id ON sandarb_access_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_sandarb_access_logs_trace_id ON sandarb_access_logs(trace_id);

-- Activity log
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

-- Agents (registry)
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

-- Agent–Context links: which contexts each registered agent is allowed to pull (Governance serves by linking).
CREATE TABLE IF NOT EXISTS agent_contexts (
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  context_id UUID NOT NULL REFERENCES contexts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (agent_id, context_id)
);
CREATE INDEX IF NOT EXISTS idx_agent_contexts_agent_id ON agent_contexts(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_contexts_context_id ON agent_contexts(context_id);

-- Agent–Prompt links: which prompts each registered agent is allowed to pull (Governance serves by linking).
CREATE TABLE IF NOT EXISTS agent_prompts (
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (agent_id, prompt_id)
);
CREATE INDEX IF NOT EXISTS idx_agent_prompts_agent_id ON agent_prompts(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_prompts_prompt_id ON agent_prompts(prompt_id);

-- Settings (key-value)
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

-- Scan targets (governance discovery)
CREATE TABLE IF NOT EXISTS scan_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unauthenticated detections
CREATE TABLE IF NOT EXISTS unauthenticated_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  detected_agent_id TEXT,
  details JSONB DEFAULT '{}',
  scan_run_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unauthenticated_detections_scan_run_at ON unauthenticated_detections(scan_run_at);

-- Templates for context
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  schema JSONB DEFAULT '{"type":"object","properties":{}}',
  default_values JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Service accounts (A2A token auth)
CREATE TABLE IF NOT EXISTS service_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_accounts_client_id ON service_accounts(client_id);
