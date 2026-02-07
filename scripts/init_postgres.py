#!/usr/bin/env python3
"""
Initialize Postgres for Sandarb: create sandarb DB if missing, then create all tables.
Loads .env from project root; defaults DATABASE_URL to local docker-compose URL.
"""
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _env import load_dotenv, get_database_url

load_dotenv()

SCHEMA = """
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
  version INTEGER NOT NULL,
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
  UNIQUE(context_id, version)
);

CREATE INDEX IF NOT EXISTS idx_context_versions_context_id ON context_versions(context_id);
CREATE INDEX IF NOT EXISTS idx_context_versions_status ON context_versions(status);

-- Immutable Audit Log
CREATE TABLE IF NOT EXISTS sandarb_access_logs (
  log_id BIGSERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  version_id UUID REFERENCES context_versions(id),
  context_id UUID REFERENCES contexts(id),
  prompt_id UUID,
  prompt_version_id UUID,
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

-- Agent–Context links (references agents and contexts)
CREATE TABLE IF NOT EXISTS agent_contexts (
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  context_id UUID NOT NULL REFERENCES contexts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (agent_id, context_id)
);
CREATE INDEX IF NOT EXISTS idx_agent_contexts_agent_id ON agent_contexts(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_contexts_context_id ON agent_contexts(context_id);

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

-- Service accounts for A2A token auth (client_id + bcrypt-hashed secret)
CREATE TABLE IF NOT EXISTS service_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_accounts_client_id ON service_accounts(client_id);

-- Prompts (the "Employee Handbook" for AI agents)
CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  tags TEXT DEFAULT '[]',
  current_version_id UUID,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT
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
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE,
  updated_by TEXT,
  UNIQUE(prompt_id, version)
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_id ON prompt_versions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_status ON prompt_versions(status);

-- Agent–Prompt links (references agents and prompts)
CREATE TABLE IF NOT EXISTS agent_prompts (
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (agent_id, prompt_id)
);
CREATE INDEX IF NOT EXISTS idx_agent_prompts_agent_id ON agent_prompts(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_prompts_prompt_id ON agent_prompts(prompt_id);

-- Add foreign key for current_version_id after prompt_versions exists
ALTER TABLE prompts DROP CONSTRAINT IF EXISTS fk_prompts_current_version;
DO $$ BEGIN
  ALTER TABLE prompts ADD CONSTRAINT fk_prompts_current_version 
    FOREIGN KEY (current_version_id) REFERENCES prompt_versions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
"""

MIGRATIONS = [
    "DO $$ BEGIN ALTER TABLE agents ADD COLUMN submitted_by TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$",
    "DO $$ BEGIN ALTER TABLE agents ADD COLUMN updated_by TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$",
    "DO $$ BEGIN ALTER TABLE prompts ADD COLUMN created_by TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$",
    "DO $$ BEGIN ALTER TABLE prompts ADD COLUMN updated_by TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$",
    "DO $$ BEGIN ALTER TABLE prompt_versions ADD COLUMN submitted_by TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$",
    "DO $$ BEGIN ALTER TABLE prompt_versions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$",
    "DO $$ BEGIN ALTER TABLE prompt_versions ADD COLUMN updated_by TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$",
    "DO $$ BEGIN ALTER TABLE contexts ADD COLUMN created_by TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$",
    "DO $$ BEGIN ALTER TABLE contexts ADD COLUMN updated_by TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$",
    "DO $$ BEGIN ALTER TABLE context_versions ADD COLUMN submitted_by TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$",
    "DO $$ BEGIN ALTER TABLE context_versions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$",
    "DO $$ BEGIN ALTER TABLE context_versions ADD COLUMN updated_by TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$",
    "CREATE TABLE IF NOT EXISTS service_accounts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), client_id TEXT NOT NULL UNIQUE, secret_hash TEXT NOT NULL, agent_id TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_service_accounts_client_id ON service_accounts(client_id)",
    # Agent links tables
    "CREATE TABLE IF NOT EXISTS agent_contexts (agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE, context_id UUID NOT NULL REFERENCES contexts(id) ON DELETE CASCADE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), PRIMARY KEY (agent_id, context_id))",
    "CREATE INDEX IF NOT EXISTS idx_agent_contexts_agent_id ON agent_contexts(agent_id)",
    "CREATE INDEX IF NOT EXISTS idx_agent_contexts_context_id ON agent_contexts(context_id)",
    "CREATE TABLE IF NOT EXISTS agent_prompts (agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE, prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), PRIMARY KEY (agent_id, prompt_id))",
    "CREATE INDEX IF NOT EXISTS idx_agent_prompts_agent_id ON agent_prompts(agent_id)",
    "CREATE INDEX IF NOT EXISTS idx_agent_prompts_prompt_id ON agent_prompts(prompt_id)",
    # sandarb_access_logs columns for prompts
    "DO $$ BEGIN ALTER TABLE sandarb_access_logs ADD COLUMN prompt_id UUID; EXCEPTION WHEN duplicate_column THEN NULL; END $$",
    "DO $$ BEGIN ALTER TABLE sandarb_access_logs ADD COLUMN prompt_version_id UUID; EXCEPTION WHEN duplicate_column THEN NULL; END $$",
    # Migrate context_versions.version_label (TEXT) to version (INTEGER)
    "DO $$ BEGIN ALTER TABLE context_versions RENAME COLUMN version_label TO version; EXCEPTION WHEN undefined_column THEN NULL; END $$",
    """DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'context_versions' AND column_name = 'version' AND data_type = 'text') THEN
        ALTER TABLE context_versions ADD COLUMN IF NOT EXISTS version_new INTEGER;
        UPDATE context_versions SET version_new = sub.ord FROM (SELECT id, (ROW_NUMBER() OVER (PARTITION BY context_id ORDER BY created_at))::integer AS ord FROM context_versions) sub WHERE context_versions.id = sub.id;
        ALTER TABLE context_versions DROP COLUMN version;
        ALTER TABLE context_versions RENAME COLUMN version_new TO version;
        ALTER TABLE context_versions ALTER COLUMN version SET NOT NULL;
        ALTER TABLE context_versions DROP CONSTRAINT IF EXISTS context_versions_context_id_version_label_key;
        ALTER TABLE context_versions ADD CONSTRAINT context_versions_context_id_version_key UNIQUE (context_id, version);
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END $$""",
    # Prompt versions: approved_by required when status = 'Approved'; backfill any row that is approved or is current version
    "UPDATE prompt_versions SET approved_by = COALESCE(NULLIF(trim(approved_by), ''), 'system'), approved_at = COALESCE(approved_at, created_at) WHERE (approved_by IS NULL OR trim(approved_by) = '') AND (LOWER(COALESCE(status, '')) = 'approved' OR id IN (SELECT current_version_id FROM prompts WHERE current_version_id IS NOT NULL))",
    "ALTER TABLE prompt_versions DROP CONSTRAINT IF EXISTS chk_prompt_versions_approved_by",
    "ALTER TABLE prompt_versions ADD CONSTRAINT chk_prompt_versions_approved_by CHECK (LOWER(COALESCE(status, '')) <> 'approved' OR (approved_by IS NOT NULL AND trim(approved_by) <> ''))",
    # Drop LOB (lob_tag) and add org_id to contexts (backfill with random non-root org, not Sandarb HQ)
    "DO $$ BEGIN ALTER TABLE contexts ADD COLUMN org_id UUID REFERENCES organizations(id); EXCEPTION WHEN duplicate_column THEN NULL; END $$",
    "UPDATE contexts SET org_id = (SELECT id FROM organizations WHERE is_root = false ORDER BY random() LIMIT 1) WHERE org_id IS NULL AND EXISTS (SELECT 1 FROM organizations WHERE is_root = false)",
    "ALTER TABLE contexts DROP COLUMN IF EXISTS lob_tag",
    # Prompts: add org_id and backfill so every prompt has an organization (from first linked agent, else first org)
    "DO $$ BEGIN ALTER TABLE prompts ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$",
    "UPDATE prompts p SET org_id = (SELECT a.org_id FROM agents a INNER JOIN agent_prompts ap ON ap.agent_id = a.id WHERE ap.prompt_id = p.id LIMIT 1) WHERE p.org_id IS NULL AND EXISTS (SELECT 1 FROM agent_prompts ap2 INNER JOIN agents a2 ON a2.id = ap2.agent_id WHERE ap2.prompt_id = p.id)",
    "UPDATE prompts SET org_id = (SELECT id FROM organizations ORDER BY name LIMIT 1) WHERE org_id IS NULL AND EXISTS (SELECT 1 FROM organizations LIMIT 1)",
    "CREATE INDEX IF NOT EXISTS idx_prompts_org_id ON prompts(org_id)",
    # Data Platform config tables
    "CREATE TABLE IF NOT EXISTS config_kafka (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), bootstrap_servers TEXT NOT NULL DEFAULT 'localhost:9092', enabled BOOLEAN NOT NULL DEFAULT TRUE, compression_type TEXT NOT NULL DEFAULT 'lz4', acks TEXT NOT NULL DEFAULT '1', updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_by TEXT)",
    "CREATE TABLE IF NOT EXISTS config_clickhouse (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), url TEXT NOT NULL DEFAULT 'http://localhost:8123', database_name TEXT NOT NULL DEFAULT 'sandarb', username TEXT NOT NULL DEFAULT 'default', password TEXT NOT NULL DEFAULT '', updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_by TEXT)",
    "CREATE TABLE IF NOT EXISTS config_superset (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), url TEXT NOT NULL DEFAULT 'http://localhost:8088', username TEXT NOT NULL DEFAULT 'admin', password TEXT NOT NULL DEFAULT '', updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_by TEXT)",
    "CREATE TABLE IF NOT EXISTS config_gen_ai (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), provider TEXT NOT NULL DEFAULT 'anthropic', model TEXT NOT NULL DEFAULT 'claude-sonnet-4-5-20250929', api_key TEXT NOT NULL DEFAULT '', base_url TEXT NOT NULL DEFAULT '', temperature REAL NOT NULL DEFAULT 0.3, max_tokens INTEGER NOT NULL DEFAULT 4096, system_prompt TEXT NOT NULL DEFAULT '', updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_by TEXT)",
]


def get_create_db_url(url: str) -> str:
    try:
        p = urlparse(url)
        return f"{p.scheme}://{p.netloc}/postgres" if p.netloc else "postgresql://localhost:5432/postgres"
    except Exception:
        return "postgresql://localhost:5432/postgres"


def get_db_name(url: str) -> str:
    try:
        p = urlparse(url)
        path = (p.path or "").strip("/")
        return path or "sandarb"
    except Exception:
        return "sandarb"


def create_db_if_not_exists(url: str) -> None:
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

    create_url = get_create_db_url(url)
    db_name = get_db_name(url)
    conn = psycopg2.connect(create_url)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    try:
        cur.execute("SELECT current_user")
        owner = (cur.fetchone() or ("postgres",))[0]
        safe_db = db_name.replace('"', '""')
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
        if cur.rowcount == 0:
            cur.execute(f'CREATE DATABASE "{safe_db}" OWNER "{owner}"')
        else:
            # Ensure DB owner is current user (fixes PG15 when DB was created by someone else)
            try:
                cur.execute(f'ALTER DATABASE "{safe_db}" OWNER TO "{owner}"')
            except Exception:
                pass
    finally:
        cur.close()
        conn.close()


def grant_public_schema(conn) -> None:
    """Ensure current user can use schema public (PostgreSQL 15+). Tries OWNER then GRANT."""
    cur = conn.cursor()
    user = "postgres"
    try:
        cur.execute("SELECT current_user")
        user = (cur.fetchone() or ("postgres",))[0]
        # 1) If we're superuser, make ourselves schema owner (most reliable for PG15+)
        try:
            cur.execute("ALTER SCHEMA public OWNER TO CURRENT_USER")
            conn.commit()
            return
        except Exception:
            conn.rollback()
        # 2) Otherwise grant USAGE/CREATE/ALL on schema public to current user
        cur.execute("GRANT USAGE ON SCHEMA public TO CURRENT_USER")
        cur.execute("GRANT CREATE ON SCHEMA public TO CURRENT_USER")
        cur.execute("GRANT ALL ON SCHEMA public TO CURRENT_USER")
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise RuntimeError(
            f"Could not get schema public access for {user}. As superuser in the **sandarb** DB run:\n"
            f"  ALTER SCHEMA public OWNER TO {user};\n"
            f"  -- or: GRANT USAGE, CREATE ON SCHEMA public TO {user};"
        )
    finally:
        cur.close()


def run_schema(conn) -> None:
    import uuid
    cur = conn.cursor()
    try:
        cur.execute(SCHEMA)
        for sql in MIGRATIONS:
            cur.execute(sql)
        cur.execute("SELECT id FROM organizations WHERE is_root = true OR slug = 'root' LIMIT 1")
        rows = cur.fetchall()
        if not rows:
            root_id = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO organizations (id, name, slug, description, is_root) VALUES (%s, 'Sandarb HQ', 'root', 'Corporate headquarters and group-level governance.', true) ON CONFLICT (slug) DO NOTHING",
                (root_id,),
            )
        conn.commit()
    finally:
        cur.close()


def main() -> None:
    try:
        import psycopg2
    except ImportError:
        print("psycopg2 not installed. pip install psycopg2-binary", file=sys.stderr)
        sys.exit(1)
    url = get_database_url()
    try:
        create_db_if_not_exists(url)
        conn = psycopg2.connect(url)
        try:
            grant_public_schema(conn)
            run_schema(conn)
        finally:
            conn.close()
    except Exception as e:
        print(f"init-postgres failed: {e}", file=sys.stderr)
        if "permission denied for schema public" in str(e) and "GRANT" not in str(e):
            try:
                conn2 = psycopg2.connect(url)
                cur2 = conn2.cursor()
                cur2.execute("SELECT current_user")
                user = cur2.fetchone()[0] if cur2.rowcount else "your_username"
                cur2.close()
                conn2.close()
            except Exception:
                user = "your_username"
            print("Grant your DB user access. In psql connect to the **sandarb** database, then run:", file=sys.stderr)
            print(f"  \\c sandarb", file=sys.stderr)
            print(f"  ALTER SCHEMA public OWNER TO {user};", file=sys.stderr)
            print(f"  -- or: GRANT USAGE, CREATE ON SCHEMA public TO {user};", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
