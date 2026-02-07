-- Sandarb Enterprise Schema Extensions
-- SSO Identity, Users, and Role-Based Access Control
-- Run after sandarb.sql: psql $DATABASE_URL -f schema/enterprise.sql

-- =============================================================================
-- USERS TABLE (Identity from SSO or local)
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identity provider info
  provider TEXT NOT NULL DEFAULT 'local',  -- 'local', 'oidc', 'saml', 'google', 'microsoft', 'okta', etc.
  provider_user_id TEXT,                    -- User ID from the identity provider
  -- Profile (populated from SSO claims or manual entry)
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  given_name TEXT,
  family_name TEXT,
  picture_url TEXT,
  -- Account status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
  email_verified BOOLEAN DEFAULT false,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE,
  -- SSO metadata (provider-specific claims, groups, etc.)
  sso_metadata JSONB DEFAULT '{}',
  -- Constraint for provider uniqueness
  UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- =============================================================================
-- SSO CONFIGURATIONS (Multi-tenant SSO support)
-- =============================================================================
CREATE TABLE IF NOT EXISTS sso_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SSO provider identification
  name TEXT NOT NULL UNIQUE,                -- Friendly name: "Acme Corp Okta"
  provider_type TEXT NOT NULL CHECK (provider_type IN ('oidc', 'saml', 'google', 'microsoft', 'okta', 'auth0', 'keycloak')),
  -- Status
  is_enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,         -- Default provider for login page
  -- OIDC Configuration
  oidc_issuer_url TEXT,                     -- https://accounts.google.com, https://login.microsoftonline.com/{tenant}/v2.0
  oidc_client_id TEXT,
  oidc_client_secret_encrypted TEXT,        -- Encrypted at rest
  oidc_scopes TEXT DEFAULT 'openid profile email',
  oidc_redirect_uri TEXT,                   -- https://ui.sandarb.ai/api/auth/callback/oidc
  -- SAML Configuration (if needed)
  saml_idp_metadata_url TEXT,
  saml_idp_sso_url TEXT,
  saml_idp_certificate TEXT,
  saml_sp_entity_id TEXT,
  saml_sp_acs_url TEXT,
  -- Domain mapping (for JIT provisioning)
  email_domains JSONB DEFAULT '[]',         -- ["acme.com", "acme.org"] - auto-assign users from these domains
  -- Role mapping (from SSO groups/claims to Sandarb roles)
  role_mapping JSONB DEFAULT '{}',          -- {"admins": "admin", "developers": "editor", "default": "viewer"}
  default_role TEXT DEFAULT 'viewer',
  -- Organization mapping
  default_org_id UUID REFERENCES organizations(id),
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sso_configurations_provider_type ON sso_configurations(provider_type);
CREATE INDEX IF NOT EXISTS idx_sso_configurations_is_enabled ON sso_configurations(is_enabled);

-- =============================================================================
-- USER SESSIONS (Track active sessions for security)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Session info
  session_token_hash TEXT NOT NULL,         -- Hashed session token
  refresh_token_hash TEXT,                  -- Hashed refresh token (for token rotation)
  -- SSO provider session
  sso_config_id UUID REFERENCES sso_configurations(id),
  sso_session_id TEXT,                      -- Session ID from provider (for logout)
  -- Device/client info
  user_agent TEXT,
  ip_address TEXT,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE       -- Null if active, set when revoked
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token_hash ON user_sessions(session_token_hash);

-- =============================================================================
-- ROLES TABLE (Define available roles)
-- =============================================================================
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,                -- 'admin', 'editor', 'viewer', 'approver'
  display_name TEXT NOT NULL,
  description TEXT,
  -- Permissions (JSONB for flexibility)
  permissions JSONB DEFAULT '[]',           -- ["read:contexts", "write:contexts", "approve:prompts"]
  -- Hierarchy
  level INTEGER DEFAULT 0,                  -- Higher = more permissions (for comparison)
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (name, display_name, description, permissions, level) VALUES
  ('super_admin', 'Super Administrator', 'Full platform access including SSO configuration', '["*"]', 100),
  ('admin', 'Administrator', 'Organization admin with full org access', '["read:*", "write:*", "approve:*", "manage:users", "manage:agents"]', 80),
  ('approver', 'Approver', 'Can approve prompts and contexts', '["read:*", "write:prompts", "write:contexts", "approve:prompts", "approve:contexts"]', 60),
  ('editor', 'Editor', 'Can create and edit prompts and contexts', '["read:*", "write:prompts", "write:contexts", "write:agents"]', 40),
  ('viewer', 'Viewer', 'Read-only access to dashboards and reports', '["read:*"]', 20)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- USER ORGANIZATION ROLES (RBAC per organization)
-- =============================================================================
-- Replaces the simple org_members table with proper RBAC
CREATE TABLE IF NOT EXISTS user_org_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id),
  -- Assignment metadata
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,      -- Optional role expiration
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_user_org_roles_user_id ON user_org_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_org_roles_org_id ON user_org_roles(org_id);
CREATE INDEX IF NOT EXISTS idx_user_org_roles_role_id ON user_org_roles(role_id);

-- =============================================================================
-- API KEYS (Enhanced service accounts with user ownership)
-- =============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Ownership
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- User who created the key
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  -- Key identification
  name TEXT NOT NULL,                       -- Friendly name: "Production Agent Key"
  key_prefix TEXT NOT NULL,                 -- First 8 chars for identification: "sk_prod_"
  key_hash TEXT NOT NULL,                   -- bcrypt hash of full key
  -- Scope and permissions
  scopes JSONB DEFAULT '["read:contexts", "read:prompts"]',  -- Allowed operations
  agent_id TEXT,                            -- If bound to specific agent
  -- Timestamps and lifecycle
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,      -- Optional expiration
  last_used_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,      -- Null if active
  -- Rate limiting
  rate_limit TEXT DEFAULT '1000/hour'       -- Per-key rate limit override
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);

-- =============================================================================
-- AUDIT LOG (Enhanced for SSO and RBAC)
-- =============================================================================
CREATE TABLE IF NOT EXISTS auth_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Actor
  user_id UUID REFERENCES users(id),
  user_email TEXT,
  -- Event
  event_type TEXT NOT NULL,                 -- 'login', 'logout', 'login_failed', 'password_reset', 'role_change', 'api_key_created'
  event_status TEXT DEFAULT 'success',      -- 'success', 'failure'
  -- Context
  sso_config_id UUID REFERENCES sso_configurations(id),
  org_id UUID REFERENCES organizations(id),
  target_user_id UUID REFERENCES users(id), -- For admin actions on other users
  -- Details
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',              -- Additional event-specific data
  error_message TEXT,
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_id ON auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_event_type ON auth_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_created_at ON auth_audit_log(created_at);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to check if user has permission in organization
CREATE OR REPLACE FUNCTION user_has_permission(
  p_user_id UUID,
  p_org_id UUID,
  p_permission TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  user_permissions JSONB;
BEGIN
  SELECT r.permissions INTO user_permissions
  FROM user_org_roles uor
  JOIN roles r ON r.id = uor.role_id
  WHERE uor.user_id = p_user_id
    AND uor.org_id = p_org_id
    AND (uor.expires_at IS NULL OR uor.expires_at > NOW());

  IF user_permissions IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check for wildcard permission
  IF user_permissions ? '*' THEN
    RETURN TRUE;
  END IF;

  -- Check for specific permission
  RETURN user_permissions ? p_permission;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's role in organization
CREATE OR REPLACE FUNCTION get_user_org_role(
  p_user_id UUID,
  p_org_id UUID
) RETURNS TEXT AS $$
DECLARE
  role_name TEXT;
BEGIN
  SELECT r.name INTO role_name
  FROM user_org_roles uor
  JOIN roles r ON r.id = uor.role_id
  WHERE uor.user_id = p_user_id
    AND uor.org_id = p_org_id
    AND (uor.expires_at IS NULL OR uor.expires_at > NOW());

  RETURN COALESCE(role_name, 'none');
END;
$$ LANGUAGE plpgsql;
