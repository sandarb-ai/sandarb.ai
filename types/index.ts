// Core types for OpenInt Sandarb
// An open-source prompt & context management platform for AI agents

// ============================================================================
// PROMPT MANAGEMENT
// ============================================================================

export interface Prompt {
  id: string;
  name: string;                          // Unique identifier (slug)
  description: string | null;
  currentVersionId: string | null;       // Active version
  projectId: string | null;              // Group prompts by project
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PromptVersion {
  id: string;
  promptId: string;
  version: number;                       // Semantic version number
  content: string;                       // The actual prompt text
  variables: PromptVariable[];           // Variables for interpolation
  model: string | null;                  // Recommended model
  temperature: number | null;
  maxTokens: number | null;
  systemPrompt: string | null;
  metadata: Record<string, unknown>;     // Custom metadata
  commitMessage: string | null;          // Version description
  createdBy: string | null;
  createdAt: string;
}

export interface PromptVariable {
  name: string;                          // Variable name (e.g., "user_name")
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  required: boolean;
  default?: unknown;
}

// ============================================================================
// CONTEXT MANAGEMENT
// ============================================================================

/** System-enforced: Line of Business for compliance search. */
export type LineOfBusiness = 'retail' | 'investment_banking' | 'wealth_management';

/** System-enforced: Data classification for MNPI and access control. */
export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted';

/** System-enforced: Regulatory frameworks that require logging/audit for this context. */
export type RegulatoryHook = 'FINRA' | 'SEC' | 'GDPR';

export const LINE_OF_BUSINESS_OPTIONS: LineOfBusiness[] = ['retail', 'investment_banking', 'wealth_management'];
export const DATA_CLASSIFICATION_OPTIONS: DataClassification[] = ['public', 'internal', 'confidential', 'restricted'];
export const REGULATORY_HOOK_OPTIONS: RegulatoryHook[] = ['FINRA', 'SEC', 'GDPR'];

export interface Context {
  id: string;
  name: string;
  description: string | null;
  content: Record<string, unknown>;
  templateId: string | null;
  environment: 'development' | 'staging' | 'production';
  tags: string[];
  isActive: boolean;
  priority: number;                      // For context composition order
  expiresAt: string | null;              // Optional TTL
  createdAt: string;
  updatedAt: string;
  /** Compliance: Line of Business (Retail, Investment Banking, Wealth Management). */
  lineOfBusiness: LineOfBusiness | null;
  /** Compliance: Data classification (Public, Internal, Confidential, Restricted). */
  dataClassification: DataClassification | null;
  /** Compliance: Subject to FINRA, SEC, or GDPR logging requirements. */
  regulatoryHooks: RegulatoryHook[];
}

export interface ContextCreateInput {
  name: string;
  description?: string;
  content: Record<string, unknown>;
  templateId?: string;
  environment?: 'development' | 'staging' | 'production';
  tags?: string[];
  priority?: number;
  expiresAt?: string;
  lineOfBusiness?: LineOfBusiness | null;
  dataClassification?: DataClassification | null;
  regulatoryHooks?: RegulatoryHook[] | null;
}

export interface ContextUpdateInput {
  name?: string;
  description?: string;
  content?: Record<string, unknown>;
  templateId?: string;
  environment?: 'development' | 'staging' | 'production';
  tags?: string[];
  isActive?: boolean;
  priority?: number;
  expiresAt?: string;
  lineOfBusiness?: LineOfBusiness | null;
  dataClassification?: DataClassification | null;
  regulatoryHooks?: RegulatoryHook[] | null;
}

// Context revisions (git-like): propose -> approve/reject
export type RevisionStatus = 'proposed' | 'approved' | 'rejected';

export interface ContextRevision {
  id: string;
  contextId: string;
  content: Record<string, unknown>;
  commitMessage: string | null;
  createdBy: string | null;
  createdAt: string;
  status: RevisionStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  parentRevisionId: string | null;
}

export interface ContextRevisionCreateInput {
  contextId: string;
  content: Record<string, unknown>;
  commitMessage?: string;
  createdBy?: string;
}

// ============================================================================
// EXPERIMENTS & A/B TESTING
// ============================================================================

export interface Experiment {
  id: string;
  name: string;
  description: string | null;
  promptId: string;                      // Base prompt being tested
  status: 'draft' | 'running' | 'paused' | 'completed';
  variants: ExperimentVariant[];
  trafficAllocation: Record<string, number>;  // variant_id -> percentage
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentVariant {
  id: string;
  name: string;                          // e.g., "control", "variant_a"
  promptVersionId: string;               // Which version to use
  weight: number;                        // Traffic weight (0-100)
}

export interface ExperimentResult {
  experimentId: string;
  variantId: string;
  requestCount: number;
  avgLatency: number;
  successRate: number;
  userRating: number | null;
  customMetrics: Record<string, number>;
}

// ============================================================================
// TEMPLATES
// ============================================================================

export interface Template {
  id: string;
  name: string;
  description: string | null;
  schema: TemplateSchema;
  defaultValues: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateSchema {
  type: 'object';
  properties: Record<string, TemplateField>;
  required?: string[];
}

export interface TemplateField {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  default?: unknown;
  enum?: string[];
}

export interface TemplateCreateInput {
  name: string;
  description?: string;
  schema: TemplateSchema;
  defaultValues?: Record<string, unknown>;
}

export interface TemplateUpdateInput {
  name?: string;
  description?: string;
  schema?: TemplateSchema;
  defaultValues?: Record<string, unknown>;
}

// ============================================================================
// API TYPES
// ============================================================================

export type InjectionFormat = 'json' | 'yaml' | 'text' | 'xml';

export interface InjectionParams {
  name?: string;
  id?: string;
  format?: InjectionFormat;
  environment?: 'development' | 'staging' | 'production';
  variables?: Record<string, unknown>;   // Variable substitution
  compose?: string[];                    // Compose multiple contexts
  experimentId?: string;                 // Track experiment variant
}

export interface InjectionResponse {
  content: string;
  name: string;
  format: InjectionFormat;
  version?: number;
  variantId?: string;                    // If part of experiment
  timestamp: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// MCP (Model Context Protocol) TYPES
// ============================================================================

export interface MCPResource {
  uri: string;                           // e.g., "sandarb://prompts/my-prompt"
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPPromptMessage {
  role: 'user' | 'assistant';
  content: {
    type: 'text';
    text: string;
  };
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

// ============================================================================
// A2A (Agent-to-Agent Protocol) TYPES
// ============================================================================

export interface AgentCard {
  name: string;
  description: string;
  url: string;                           // Agent endpoint URL
  version: string;
  capabilities: AgentCapability[];
  authentication?: {
    type: 'bearer' | 'api_key' | 'oauth2';
    schemes?: string[];
  };
  skills: AgentSkill[];
}

// ============================================================================
// SANDARB AGENT CARD / MANIFEST (sandarb.json)
// Protocol-based registration: agents ship a manifest and ping Sandarb on startup.
// If an agent isn't registered with Sandarb, it shouldn't be granted access to company data.
// ============================================================================

export interface SandarbManifest {
  /** Identity: stable id for this agent (e.g. repo name, service id). Used for upsert. */
  agent_id: string;
  /** Semantic version of the agent. */
  version: string;
  /** Owner team or org slug for placement in Sandarb (e.g. "platform", "fraud"). */
  owner_team: string;
  /** Human-readable name (optional; can be derived from agent_id). */
  name?: string;
  /** Short description (optional). */
  description?: string;
  /** Agent A2A endpoint URL (required for validation and discovery). */
  url: string;
  /** Capabilities: tools this agent uses (e.g. "llm", "db", "api"). */
  tools_used?: string[];
  /** Capabilities: data scopes this agent is allowed to access (e.g. "customers", "transactions"). */
  allowed_data_scopes?: string[];
  /** Compliance: whether this agent handles PII. */
  pii_handling?: boolean;
  /** Compliance: regulatory scope tags (e.g. "GDPR", "SOX", "GDPR/SOX"). */
  regulatory_scope?: string | string[];
  /** Optional full A2A Agent Card (skills, capabilities). Sandarb may fetch from url if missing. */
  agent_card?: AgentCard;
}

export interface AgentCapability {
  name: string;
  description: string;
  streaming?: boolean;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  examples?: Array<{
    input: unknown;
    output: unknown;
  }>;
}

export interface A2ATask {
  id: string;
  agentId: string;
  skill: string;
  input: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: unknown;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface A2AMessage {
  role: 'user' | 'agent';
  parts: A2AMessagePart[];
  metadata?: Record<string, unknown>;
}

export type A2AMessagePart =
  | { type: 'text'; text: string }
  | { type: 'data'; mimeType: string; data: string }
  | { type: 'file'; uri: string; mimeType?: string };

// ============================================================================
// OBSERVABILITY
// ============================================================================

export interface RequestLog {
  id: string;
  timestamp: string;
  endpoint: string;
  method: string;
  promptId?: string;
  contextId?: string;
  experimentId?: string;
  variantId?: string;
  variables?: Record<string, unknown>;
  latencyMs: number;
  statusCode: number;
  userAgent?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

export interface UsageMetrics {
  period: 'hour' | 'day' | 'week' | 'month';
  startDate: string;
  endDate: string;
  totalRequests: number;
  uniquePrompts: number;
  uniqueContexts: number;
  avgLatencyMs: number;
  errorRate: number;
  topPrompts: Array<{ id: string; name: string; count: number }>;
  topContexts: Array<{ id: string; name: string; count: number }>;
  requestsByHour: Array<{ hour: string; count: number }>;
}

// ============================================================================
// SETTINGS
// ============================================================================

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  defaultFormat: InjectionFormat;
  defaultEnvironment: 'development' | 'staging' | 'production';
  apiKeyEnabled: boolean;
  apiKey: string | null;
  mcpEnabled: boolean;
  a2aEnabled: boolean;
  corsOrigins: string[];
  rateLimitPerMinute: number;
}

// ============================================================================
// ORGANIZATIONS & AGENTS REGISTRY
// ============================================================================

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  isRoot: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationCreateInput {
  name: string;
  slug?: string;
  description?: string;
  parentId?: string | null;
}

export interface OrganizationUpdateInput {
  name?: string;
  slug?: string;
  description?: string;
  parentId?: string | null;
}

export interface OrgMember {
  id: string;
  orgId: string;
  userId: string;
  role: OrgRole;
  createdAt: string;
}

export type AgentStatus = 'active' | 'inactive' | 'pending' | 'error';

export type AgentApprovalStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';

export interface RegisteredAgent {
  id: string;
  orgId: string;
  /** Stable identity from manifest (agent_id). Unique per org; used for upsert on ping. */
  agentId: string | null;
  name: string;
  description: string | null;
  a2aUrl: string;
  agentCard: AgentCard | null;
  status: AgentStatus;
  approvalStatus: AgentApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** Owner team from manifest (e.g. "platform", "fraud"). */
  ownerTeam: string | null;
  /** Tools this agent uses (from manifest). */
  toolsUsed: string[];
  /** Data scopes this agent is allowed to access (from manifest). */
  allowedDataScopes: string[];
  /** Whether this agent handles PII (from manifest). */
  piiHandling: boolean;
  /** Regulatory scope tags (e.g. "GDPR", "SOX") (from manifest). */
  regulatoryScope: string[];
}

export interface RegisteredAgentCreateInput {
  orgId: string;
  agentId?: string | null;
  name: string;
  description?: string;
  a2aUrl: string;
  agentCard?: AgentCard | null;
  ownerTeam?: string | null;
  toolsUsed?: string[];
  allowedDataScopes?: string[];
  piiHandling?: boolean;
  regulatoryScope?: string[];
}

export interface RegisteredAgentUpdateInput {
  name?: string;
  description?: string;
  a2aUrl?: string;
  agentCard?: AgentCard | null;
  status?: AgentStatus;
  approvalStatus?: AgentApprovalStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  ownerTeam?: string | null;
  toolsUsed?: string[];
  allowedDataScopes?: string[];
  piiHandling?: boolean;
  regulatoryScope?: string[];
}

// ============================================================================
// DASHBOARD & ACTIVITY
// ============================================================================

export interface DashboardStats {
  totalPrompts: number;
  totalContexts: number;
  totalTemplates: number;
  activeExperiments: number;
  requestsToday: number;
  avgLatencyMs: number;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: 'create' | 'update' | 'delete' | 'inject' | 'experiment_start' | 'experiment_end';
  resourceType: 'prompt' | 'context' | 'template' | 'experiment';
  resourceName: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
