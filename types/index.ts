// Core types for Sandarb
// An open-source prompt & context management platform for AI agents

// ============================================================================
// PROMPT MANAGEMENT
// ============================================================================

/** Governance status for prompt versions (mirrors context revision workflow). */
export type PromptVersionStatus = 'draft' | 'proposed' | 'approved' | 'rejected' | 'archived';

export const PROMPT_VERSION_STATUS_OPTIONS: PromptVersionStatus[] = ['draft', 'proposed', 'approved', 'rejected', 'archived'];

/** Agent linked to a prompt or context (for display: which agent it belongs to). */
export interface LinkedAgent {
  id: string;
  name: string;
  agentId: string;
}

export interface Prompt {
  id: string;
  name: string;                          // Unique identifier (slug)
  description: string | null;
  currentVersionId: string | null;       // Active (approved) version
  projectId: string | null;              // Group prompts by project
  orgId?: string | null;                 // Owning organization (so organization is never empty)
  tags: string[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  /** Agents this prompt is linked to (from agent_prompts). Shown as "Used by: …". */
  agents?: LinkedAgent[];
  /** Organizations for this prompt (from agent links or owning org). Never empty when orgId is set. */
  organizations?: { id: string; name: string; slug: string }[];
  /** Active version number for list display. */
  currentVersion?: { version: number } | null;
  /** Who approved the active version (from prompt_versions). */
  approvedBy?: string | null;
  /** When the active version was approved. */
  approvedAt?: string | null;
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
  submittedBy: string | null;            // Who submitted for approval
  updatedAt: string | null;              // Last modified (e.g. on approve/reject)
  updatedBy: string | null;               // Who last modified
  // Governance fields (parity with context revisions)
  status: PromptVersionStatus;           // Approval workflow status
  approvedBy: string | null;             // Who approved this version
  approvedAt: string | null;             // When it was approved
  parentVersionId: string | null;        // Lineage: which version this was based on
  sha256Hash: string | null;             // Content integrity hash
}

export interface PromptVariable {
  name: string;                          // Variable name (e.g., "user_name")
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  required: boolean;
  default?: unknown;
}

export interface PromptVersionCreateInput {
  promptId: string;
  content: string;
  variables?: PromptVariable[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  metadata?: Record<string, unknown>;
  commitMessage?: string;
  createdBy?: string;
  /** If true, version is immediately approved (for backward compatibility). Default: false (proposed). */
  autoApprove?: boolean;
}

// ============================================================================
// CONTEXT MANAGEMENT
// ============================================================================

/** System-enforced: Data classification for MNPI and access control. */
export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted';

/** System-enforced: Regulatory frameworks that require logging/audit for this context. */
export type RegulatoryHook = 'FINRA' | 'SEC' | 'GDPR';

export const DATA_CLASSIFICATION_OPTIONS: DataClassification[] = ['public', 'internal', 'confidential', 'restricted'];
export const REGULATORY_HOOK_OPTIONS: RegulatoryHook[] = ['FINRA', 'SEC', 'GDPR'];

/** Context content can be a JSON object (structured policy) or a string (Jinja2 template). */
export type ContextContent = Record<string, unknown> | string;

export interface Context {
  id: string;
  name: string;
  description: string | null;
  content: ContextContent;
  templateId: string | null;
  environment: 'development' | 'staging' | 'production';
  tags: string[];
  isActive: boolean;
  priority: number;                      // For context composition order
  expiresAt: string | null;              // Optional TTL
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  /** Organization this context belongs to (for filtering and display). */
  orgId: string | null;
  /** Organization details (from organizations table). */
  organization?: { id: string; name: string; slug: string } | null;
  /** Compliance: Data classification (Public, Internal, Confidential, Restricted). */
  dataClassification: DataClassification | null;
  /** Compliance: Subject to FINRA, SEC, or GDPR logging requirements. */
  regulatoryHooks: RegulatoryHook[];
  /** Agents this context is linked to (from agent_contexts). Shown as "Used by: …". */
  agents?: LinkedAgent[];
  /** Active (approved) version id; present when context has an active revision. */
  currentVersionId?: string | null;
  /** Active version number for list display. */
  currentVersion?: { version: number } | null;
  /** Who approved the active version (from context_versions). */
  approvedBy?: string | null;
  /** When the active version was approved. */
  approvedAt?: string | null;
}

export interface ContextCreateInput {
  name: string;
  description?: string;
  content: ContextContent;
  templateId?: string;
  environment?: 'development' | 'staging' | 'production';
  tags?: string[];
  priority?: number;
  expiresAt?: string;
  orgId?: string | null;
  dataClassification?: DataClassification | null;
  regulatoryHooks?: RegulatoryHook[] | null;
}

export interface ContextUpdateInput {
  name?: string;
  description?: string;
  content?: ContextContent;
  templateId?: string;
  environment?: 'development' | 'staging' | 'production';
  tags?: string[];
  isActive?: boolean;
  priority?: number;
  expiresAt?: string;
  updatedBy?: string | null;
  orgId?: string | null;
  dataClassification?: DataClassification | null;
  regulatoryHooks?: RegulatoryHook[] | null;
}

// Context revisions (git-like): propose -> approve/reject
export type RevisionStatus = 'proposed' | 'approved' | 'rejected';

export interface ContextRevision {
  id: string;
  contextId: string;
  /** Semantic version number (from context_versions.version). */
  version?: number;
  content: ContextContent;
  commitMessage: string | null;
  createdBy: string | null;
  createdAt: string;
  submittedBy: string | null;            // Who submitted for approval
  status: RevisionStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  parentRevisionId: string | null;
  /** Natural language instructions used to generate this template (AI Generate feature). */
  aiInstructions: string | null;
}

export interface ContextRevisionCreateInput {
  contextId: string;
  content: ContextContent;
  commitMessage?: string;
  createdBy?: string;
  /** Natural language instructions for AI template generation. */
  aiInstructions?: string;
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
// Aligned with Google A2A spec: https://google.github.io/A2A/specification/
// ============================================================================

/** A2A spec: optional protocol features (streaming, push, state history). */
export interface AgentCapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  stateTransitionHistory?: boolean;
}

/** A2A spec Agent Card: identity, url, capabilities object, default MIME modes, skills. */
export interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  provider?: { organization: string; url: string };
  documentationUrl?: string;
  capabilities: AgentCapabilities;
  securitySchemes?: Record<string, unknown>;
  security?: Record<string, string[]>[];
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: AgentSkill[];
  supportsAuthenticatedExtendedCard?: boolean;
  /** @deprecated Use securitySchemes/security. Kept for backward compat. */
  authentication?: {
    type: 'bearer' | 'api_key' | 'oauth2';
    schemes?: string[];
  };
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

/** @deprecated A2A spec uses AgentCapabilities object; kept for reference. */
export interface AgentCapability {
  name: string;
  description: string;
  streaming?: boolean;
}

/** A2A spec AgentSkill: id, name, description, tags, optional examples (strings), input/output MIME modes. */
export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
  /** Sandarb extension: JSON Schema for skill input (optional). */
  inputSchema?: Record<string, unknown>;
  /** Sandarb extension: JSON Schema for skill output (optional). */
  outputSchema?: Record<string, unknown>;
}

/** A2A spec TaskState lifecycle. */
export type TaskState =
  | 'submitted'
  | 'working'
  | 'input-required'
  | 'completed'
  | 'canceled'
  | 'failed'
  | 'rejected'
  | 'auth-required'
  | 'unknown';

/** A2A spec TaskStatus: state + optional message and timestamp. */
export interface TaskStatus {
  state: TaskState;
  message?: A2AMessage;
  timestamp?: string;
}

/** A2A spec Task: id, contextId, status, optional artifacts/history/metadata. */
export interface A2ATaskSpec {
  id: string;
  contextId: string;
  status: TaskStatus;
  artifacts?: A2AArtifact[];
  history?: A2AMessage[];
  metadata?: Record<string, unknown>;
}

/** Internal task record used by Sandarb (skill, input, output); maps to A2ATaskSpec for API. */
export interface A2ATask {
  id: string;
  contextId: string;
  agentId: string;
  skill: string;
  input: Record<string, unknown>;
  status: TaskStatus;
  output?: unknown;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

/** A2A spec Artifact: artifactId, optional name/description, parts, metadata. */
export interface A2AArtifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: A2AMessagePart[];
  metadata?: Record<string, unknown> | null;
}

/** A2A spec Message: role, parts, messageId, kind; optional metadata, taskId, contextId, referenceTaskIds. */
export interface A2AMessage {
  role: 'user' | 'agent';
  parts: A2AMessagePart[];
  messageId: string;
  kind: 'message';
  metadata?: Record<string, unknown>;
  referenceTaskIds?: string[];
  taskId?: string;
  contextId?: string;
}

/** A2A spec Part: discriminator is "kind". */
export type A2AMessagePart =
  | { kind: 'text'; text: string; metadata?: Record<string, unknown> }
  | { kind: 'data'; data: Record<string, unknown>; metadata?: Record<string, unknown> }
  | { kind: 'file'; file: { name?: string; mimeType?: string; bytes?: string; uri?: string }; metadata?: Record<string, unknown> };

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
  /** Globally unique SRN (Sandarb Resource Name, inspired by URN) identifier (e.g. agent.retail-banking-kyc-verification-bot). NOT NULL, UNIQUE. */
  agentId: string;
  name: string;
  description: string | null;
  a2aUrl: string;
  agentCard: AgentCard | null;
  status: AgentStatus;
  approvalStatus: AgentApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  submittedBy: string | null;            // Who submitted for approval
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
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
  /** Organization this agent belongs to (included in GET /agents/:id for display). */
  organization?: { id: string; name: string; slug: string } | null;
  /** Contexts linked to this agent (from agent_contexts). */
  linkedContexts?: { id: string; name: string }[];
  /** Prompts linked to this agent (from agent_prompts). */
  linkedPrompts?: { id: string; name: string }[];
  /** Last time this agent communicated with Sandarb AI Governance Agent (from sandarb_access_logs). */
  lastAccessedAt?: string | null;
}

export interface RegisteredAgentCreateInput {
  orgId: string;
  agentId: string;
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
  submittedBy?: string | null;
  updatedBy?: string | null;
  ownerTeam?: string | null;
  toolsUsed?: string[];
  allowedDataScopes?: string[];
  piiHandling?: boolean;
  regulatoryScope?: string[];
}

/** Agent list stats (counts by status). */
export interface AgentStats {
  total: number;
  active: number;
  draft: number;
  pending_approval: number;
  approved: number;
  rejected: number;
}

/** Unified A2A log entry for agent ↔ Sandarb communication (Agent Pulse UI). */
export interface A2ALogEntry {
  id: string;
  agentId: string;
  traceId: string;
  accessedAt: string;
  actionType: 'INJECT_SUCCESS' | 'INJECT_DENIED' | 'PROMPT_USED' | 'INFERENCE_EVENT' | 'A2A_CALL';
  contextName: string;
  contextId: string | null;
  contextVersionId: string | null;
  promptName?: string;
  promptId?: string | null;
  promptVersionId?: string | null;
  reason?: string;
  intent?: string | null;
  method?: string;
  inputSummary?: string | null;
  resultSummary?: string | null;
  error?: string | null;
}

/** Governance: scan target for shadow AI discovery. */
export interface ScanTarget {
  id: string;
  url: string;
  description: string | null;
  createdAt: string;
}

/** Governance: unauthenticated agent detection record. */
export interface UnauthenticatedDetection {
  id: string;
  sourceUrl: string;
  detectedAgentId: string | null;
  details: Record<string, unknown>;
  scanRunAt: string;
  createdAt: string;
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

// ============================================================================
// REPORTS (AI Governance & Insights)
// ============================================================================

export interface ReportsOverview {
  registeredAgentsCount: number;
  unregisteredAgentsCount: number;
  blockedInjectionsCount: number;
  approvedContextsCount: number;
  approvedPromptsCount: number;
  accessTimeSeries: { date: string; success: number; denied: number }[];
  agentStatusBreakdown: Record<string, number>;
}

export interface ReportsRegulatory {
  contextVersionsByStatus: Record<string, number>;
  promptVersionsByStatus: Record<string, number>;
  dataClassificationCounts: Record<string, number>;
  /** Agents count by regulatory scope tag (e.g. GDPR, FINRA). */
  agentsByRegulatoryScope?: Record<string, number>;
  /** Distinct agents linked to contexts by data classification. */
  agentsByDataClassification?: Record<string, number>;
}

export interface ReportsCompliance {
  totalAccessEvents: number;
  successCount: number;
  deniedCount: number;
  promptUsedCount: number;
  complianceTimeSeries: { date: string; total: number }[];
  /** Agents count by PII handling (keys: "true" | "false"). */
  agentsByPiiHandling?: Record<string, number>;
}

export interface ReportsContext {
  totalContexts: number;
  approvedVersions: number;
  totalInjects: number;
  totalDenied: number;
  renderedCount: number;
  orphanedContexts: number;
  injectTimeSeries: { date: string; success: number; denied: number }[];
  topContexts: { name: string; count: number }[];
  blockedReasons: { name: string; count: number }[];
  classificationAccess: { name: string; count: number }[];
  renderingBreakdown: { name: string; count: number }[];
  coverage: {
    agentsWithContexts: number;
    agentsWithoutContexts: number;
    linkedContexts: number;
    orphanedContexts: number;
  };
  staleness: {
    name: string;
    version: number;
    approvedAt: string;
    daysSince: number;
  }[];
  approvalVelocity: {
    avgDays: number;
    minDays: number;
    maxDays: number;
  };
  contextsByOrg: { name: string; count: number }[];
}

export interface ReportsPayload {
  overview: ReportsOverview;
  unregisteredAgents: UnauthenticatedDetection[];
  regulatory: ReportsRegulatory;
  compliance: ReportsCompliance;
}
