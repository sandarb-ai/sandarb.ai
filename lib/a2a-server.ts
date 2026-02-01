/**
 * A2A (Agent-to-Agent Protocol) Server Implementation
 *
 * Sandarb runs as an A2A agent so other agents can talk to it via A2A.
 * Value add: regulatory, controls, risk management, and governance while
 * teams focus on building AI agents.
 *
 * @see https://github.com/a2aproject/A2A
 * @see https://a2a-protocol.org/
 */

import { v4 as uuidv4 } from 'uuid';
import { getAllPrompts, getPromptByName, getCurrentPromptVersion, interpolatePrompt } from './prompts';
import { getAllContexts, getContextByName } from './contexts';
import { formatContent } from './utils';
import { getAgentById, getAllAgents, registerByManifest } from './agents';
import { getProposedRevisions, getAllProposedRevisions } from './revisions';
import { logAuditEvent, logContextDelivery, getLineage } from './audit';
import { pollAgentMcp, deriveMcpUrl } from './mcp-client';
import type { AgentCard, AgentSkill, A2ATask, A2AMessage, A2AMessagePart } from '@/types';

// ============================================================================
// AGENT CARD
// ============================================================================

/**
 * Generate the Agent Card that describes Sandarb as a governance A2A agent.
 * Other agents discover and call Sandarb for validation, audit, and compliance.
 */
export const getAgentCard = (baseUrl: string): AgentCard => ({
  name: 'Sandarb',
  description: 'Governance agent for AI agents: regulatory, controls, risk management, and compliance. While your teams build agents, Sandarb provides validation, approved context/prompts, audit logging, and pending-review visibility. Talk to Sandarb via A2A for compliance checks and audit trail.',
  url: baseUrl,
  version: '0.3.0',
  capabilities: [
    {
      name: 'governance',
      description: 'Validation, approval checks, and audit logging for regulatory and risk management',
      streaming: false,
    },
    {
      name: 'prompt_management',
      description: 'Versioned prompts with variable interpolation',
      streaming: false,
    },
    {
      name: 'context_management',
      description: 'Approved context configurations and composition',
      streaming: false,
    },
    {
      name: 'context_composition',
      description: 'Compose multiple contexts with priority ordering',
      streaming: false,
    },
  ],
  authentication: {
    type: 'bearer',
    schemes: ['Bearer'],
  },
  skills: getAgentSkills(),
});

/**
 * Get all skills this agent supports
 */
const getAgentSkills = (): AgentSkill[] => [
  {
    id: 'get_prompt',
    name: 'Get Prompt',
    description: 'Retrieve a prompt by name with optional variable interpolation. Returns the prompt content along with metadata like model recommendations and system prompt.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Prompt name/slug' },
        variables: { type: 'object', description: 'Variables to interpolate' },
      },
      required: ['name'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        version: { type: 'number' },
        model: { type: 'string' },
        systemPrompt: { type: 'string' },
      },
    },
    examples: [
      {
        input: { name: 'customer-support', variables: { customer_name: 'John' } },
        output: { content: 'Hello John, how can I help you today?', version: 3 },
      },
    ],
  },
  {
    id: 'get_context',
    name: 'Get Context',
    description: 'Retrieve a context configuration by name. Sandarb logs who asked and why (lineage). Contexts contain structured data that can be injected into AI agent workflows.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Context name' },
        environment: { type: 'string', enum: ['development', 'staging', 'production'] },
        format: { type: 'string', enum: ['json', 'yaml', 'text'] },
        sourceAgent: { type: 'string', description: 'Calling agent identifier (for audit/lineage)' },
        intent: { type: 'string', description: 'Why this context is needed (for lineage)' },
      },
      required: ['name'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        content: { type: 'object' },
        format: { type: 'string' },
      },
    },
  },
  {
    id: 'list_prompts',
    name: 'List Prompts',
    description: 'List all available prompts, optionally filtered by tags.',
    inputSchema: {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' } },
      },
    },
    outputSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
  {
    id: 'list_contexts',
    name: 'List Contexts',
    description: 'List all available contexts, optionally filtered by environment.',
    inputSchema: {
      type: 'object',
      properties: {
        environment: { type: 'string', enum: ['development', 'staging', 'production'] },
        activeOnly: { type: 'boolean', default: true },
      },
    },
    outputSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          environment: { type: 'string' },
        },
      },
    },
  },
  {
    id: 'compose_contexts',
    name: 'Compose Contexts',
    description: 'Compose multiple contexts together in order. Sandarb logs who asked (lineage). Later contexts override earlier ones.',
    inputSchema: {
      type: 'object',
      properties: {
        names: { type: 'array', items: { type: 'string' }, description: 'Context names in order' },
        format: { type: 'string', enum: ['json', 'yaml', 'text'] },
        sourceAgent: { type: 'string', description: 'Calling agent identifier (for audit/lineage)' },
        intent: { type: 'string', description: 'Why this composition is needed (for lineage)' },
      },
      required: ['names'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        content: { type: 'object' },
        format: { type: 'string' },
      },
    },
  },
  {
    id: 'set_context',
    name: 'Set Context',
    description: 'Create or update a context configuration.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        content: { type: 'object' },
        description: { type: 'string' },
        environment: { type: 'string', enum: ['development', 'staging', 'production'] },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['name', 'content'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        success: { type: 'boolean' },
      },
    },
  },
  // -------------------------------------------------------------------------
  // Governance, controls, risk (Sandarb as governance agent)
  // -------------------------------------------------------------------------
  {
    id: 'validate_context',
    name: 'Validate Context',
    description: 'Check that a context exists and return the current approved content. Sandarb logs who asked (lineage). Use before using context in production for compliance.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Context name' },
        environment: { type: 'string', enum: ['development', 'staging', 'production'] },
        sourceAgent: { type: 'string', description: 'Calling agent identifier (for audit/lineage)' },
        intent: { type: 'string', description: 'Why this context is needed (for lineage)' },
      },
      required: ['name'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        approved: { type: 'boolean' },
        name: { type: 'string' },
        content: { type: 'object' },
        hasPendingRevisions: { type: 'boolean' },
      },
    },
  },
  {
    id: 'get_approved_context',
    name: 'Get Approved Context',
    description: 'Get the current approved context content by name. Sandarb logs who asked and why (lineage). For compliance: only returns the approved snapshot.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        format: { type: 'string', enum: ['json', 'yaml', 'text'] },
        sourceAgent: { type: 'string', description: 'Calling agent identifier (for audit/lineage)' },
        intent: { type: 'string', description: 'Why this context is needed (for lineage)' },
      },
      required: ['name'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        content: { type: 'object' },
        format: { type: 'string' },
      },
    },
  },
  {
    id: 'validate_agent',
    name: 'Validate Agent',
    description: 'Check if an agent is registered and approved. Use before delegating to another agent for controls.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Agent ID' },
        a2aUrl: { type: 'string', description: 'Agent A2A URL (alternative to agentId)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        registered: { type: 'boolean' },
        approved: { type: 'boolean' },
        agent: { type: 'object' },
      },
    },
  },
  {
    id: 'audit_log',
    name: 'Audit Log',
    description: 'Log an event for compliance and audit trail. Other agents call this to record actions (e.g. prompt used, context used, agent invoked).',
    inputSchema: {
      type: 'object',
      properties: {
        eventType: { type: 'string', description: 'e.g. prompt_used, context_used, agent_invoked' },
        resourceType: { type: 'string' },
        resourceId: { type: 'string' },
        resourceName: { type: 'string' },
        sourceAgent: { type: 'string', description: 'Calling agent identifier' },
        details: { type: 'object' },
      },
      required: ['eventType'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        logged: { type: 'boolean' },
        eventType: { type: 'string' },
      },
    },
  },
  {
    id: 'list_pending_reviews',
    name: 'List Pending Reviews',
    description: 'List all pending context revisions and agent registrations awaiting approval. For governance and risk oversight.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: {
      type: 'object',
      properties: {
        contextRevisions: { type: 'array' },
        agents: { type: 'array' },
      },
    },
  },
  {
    id: 'report_incident',
    name: 'Report Incident',
    description: 'Log a risk or incident event. Other agents call this for risk management and regulatory reporting.',
    inputSchema: {
      type: 'object',
      properties: {
        eventType: { type: 'string', description: 'e.g. incident, risk, violation' },
        resourceType: { type: 'string' },
        resourceId: { type: 'string' },
        resourceName: { type: 'string' },
        sourceAgent: { type: 'string' },
        details: { type: 'object' },
      },
      required: ['eventType'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        logged: { type: 'boolean' },
        eventType: { type: 'string' },
      },
    },
  },
  {
    id: 'register',
    name: 'Register (Ping)',
    description: 'Protocol-based registration: send your Sandarb manifest (Agent Card / sandarb.json). When an agent starts up, it pings Sandarb with its manifest via this skill or the /api/agents/ping API. Creates a living registry; unregistered agents should not be granted access to company data.',
    inputSchema: {
      type: 'object',
      properties: {
        manifest: {
          type: 'object',
          description: 'Sandarb manifest: agent_id, version, owner_team, url; optional: name, description, tools_used, allowed_data_scopes, pii_handling, regulatory_scope',
          properties: {
            agent_id: { type: 'string' },
            version: { type: 'string' },
            owner_team: { type: 'string' },
            url: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            tools_used: { type: 'array', items: { type: 'string' } },
            allowed_data_scopes: { type: 'array', items: { type: 'string' } },
            pii_handling: { type: 'boolean' },
            regulatory_scope: { type: 'string' },
          },
          required: ['agent_id', 'version', 'owner_team', 'url'],
        },
        orgId: { type: 'string', description: 'Optional; else org resolved from owner_team or root.' },
      },
      required: ['manifest'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        agentId: { type: 'string' },
        name: { type: 'string' },
        approvalStatus: { type: 'string' },
      },
    },
  },
  {
    id: 'get_lineage',
    name: 'Get Lineage',
    description: 'Lineage reporting: who requested which context and when. Single source of truth for "This decision was made using context from Document X, retrieved by Agent Y".',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max entries to return (default 50)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        entries: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              resourceName: { type: 'string' },
              sourceAgent: { type: 'string' },
              details: { type: 'object' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
  },
  {
    id: 'mcp_poll_agent',
    name: 'MCP Poll Agent',
    description: 'Pull-based monitoring: Sandarb (MCP Client) queries an agent (MCP Server) for its tools, resources, and optional state (e.g. last prompts, active tool calls). Lightweight for agents—no push logging required.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Registered agent ID (Sandarb derives MCP URL from agent A2A URL)' },
        mcpUrl: { type: 'string', description: 'Direct MCP server URL (alternative to agentId)' },
        timeoutMs: { type: 'number', description: 'Timeout in ms (default 15000)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        tools: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } } },
        resources: { type: 'array', items: { type: 'object', properties: { uri: { type: 'string' }, name: { type: 'string' } } } },
        state: { type: 'object' },
        error: { type: 'string' },
      },
    },
  },
];

// ============================================================================
// TASK EXECUTION
// ============================================================================

// In-memory task storage (in production, use database)
const tasks = new Map<string, A2ATask>();

/**
 * Create a new task
 */
export const createTask = (skill: string, input: Record<string, unknown>): A2ATask => {
  const task: A2ATask = {
    id: uuidv4(),
    agentId: 'sandarb',
    skill,
    input,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  tasks.set(task.id, task);
  return task;
};

/**
 * Execute a task
 */
export const executeTask = async (taskId: string): Promise<A2ATask> => {
  const task = tasks.get(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);

  task.status = 'running';

  try {
    const result = await executeSkill(task.skill, task.input);
    task.output = result;
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
  } catch (error) {
    task.error = error instanceof Error ? error.message : 'Unknown error';
    task.status = 'failed';
    task.completedAt = new Date().toISOString();
  }

  return task;
};

/**
 * Get task status
 */
export const getTask = (taskId: string): A2ATask | undefined => {
  return tasks.get(taskId);
};

/**
 * Execute a skill directly
 */
export const executeSkill = async (
  skillId: string,
  input: Record<string, unknown>
): Promise<unknown> => {
  switch (skillId) {
    case 'get_prompt': {
      const prompt = getPromptByName(input.name as string);
      if (!prompt) throw new Error(`Prompt not found: ${input.name}`);

      const version = getCurrentPromptVersion(prompt.id);
      if (!version) throw new Error(`No versions found for prompt: ${input.name}`);

      let content = version.content;
      if (input.variables) {
        content = interpolatePrompt(content, input.variables as Record<string, unknown>);
      }

      return {
        name: prompt.name,
        content,
        version: version.version,
        model: version.model,
        systemPrompt: version.systemPrompt,
        temperature: version.temperature,
        maxTokens: version.maxTokens,
      };
    }

    case 'get_context': {
      const context = await getContextByName(input.name as string);
      if (!context) throw new Error(`Context not found: ${input.name}`);

      await logContextDelivery({
        sourceAgent: (input.sourceAgent as string) ?? null,
        contextId: context.id,
        contextName: context.name,
        intent: input.intent as string | undefined,
      });

      const format = (input.format as string) || 'json';
      return {
        name: context.name,
        content: context.content,
        formatted: formatContent(context.content, format as 'json' | 'yaml' | 'text'),
        format,
        environment: context.environment,
      };
    }

    case 'list_prompts': {
      let prompts = getAllPrompts();
      if (input.tags && Array.isArray(input.tags)) {
        prompts = prompts.filter(p =>
          (input.tags as string[]).some(t => p.tags.includes(t))
        );
      }
      return prompts.map(p => ({
        name: p.name,
        description: p.description,
        tags: p.tags,
      }));
    }

    case 'list_contexts': {
      let contexts = await getAllContexts();
      if (input.environment) {
        contexts = contexts.filter(c => c.environment === input.environment);
      }
      if (input.activeOnly !== false) {
        contexts = contexts.filter(c => c.isActive);
      }
      return contexts.map(c => ({
        name: c.name,
        description: c.description,
        environment: c.environment,
        tags: c.tags,
      }));
    }

    case 'compose_contexts': {
      const names = input.names as string[];
      const composed: Record<string, unknown> = {};

      for (const name of names) {
        const context = await getContextByName(name);
        if (context) {
          Object.assign(composed, context.content);
          await logContextDelivery({
            sourceAgent: (input.sourceAgent as string) ?? null,
            contextId: context.id,
            contextName: context.name,
            intent: (input.intent as string) ? `compose: ${input.intent}` : 'compose',
          });
        }
      }

      const format = (input.format as string) || 'json';
      return {
        content: composed,
        formatted: formatContent(composed, format as 'json' | 'yaml' | 'text'),
        format,
        sourcesContexts: names,
      };
    }

    case 'validate_context': {
      const name = input.name as string;
      const context = await getContextByName(name);
      if (!context) {
        return { approved: false, name, content: null, hasPendingRevisions: false };
      }
      await logContextDelivery({
        sourceAgent: (input.sourceAgent as string) ?? null,
        contextId: context.id,
        contextName: context.name,
        intent: input.intent as string | undefined,
      });
      const pending = await getProposedRevisions(context.id);
      return {
        approved: true,
        name: context.name,
        content: context.content,
        hasPendingRevisions: pending.length > 0,
      };
    }

    case 'get_approved_context': {
      const context = await getContextByName(input.name as string);
      if (!context) throw new Error(`Context not found: ${input.name}`);
      await logContextDelivery({
        sourceAgent: (input.sourceAgent as string) ?? null,
        contextId: context.id,
        contextName: context.name,
        intent: input.intent as string | undefined,
      });
      const format = (input.format as string) || 'json';
      return {
        name: context.name,
        content: context.content,
        formatted: formatContent(context.content, format as 'json' | 'yaml' | 'text'),
        format,
      };
    }

    case 'validate_agent': {
      const agentId = input.agentId as string | undefined;
      const a2aUrl = input.a2aUrl as string | undefined;
      let agent = agentId ? await getAgentById(agentId) : null;
      if (!agent && a2aUrl) {
        const all = await getAllAgents();
        agent = all.find((a) => a.a2aUrl === a2aUrl) ?? null;
      }
      if (!agent) {
        return { registered: false, approved: false, agent: null };
      }
      return {
        registered: true,
        approved: (agent.approvalStatus ?? 'draft') === 'approved',
        agent: {
          id: agent.id,
          name: agent.name,
          a2aUrl: agent.a2aUrl,
          approvalStatus: agent.approvalStatus ?? 'draft',
        },
      };
    }

    case 'audit_log': {
      logAuditEvent({
        eventType: input.eventType as string,
        resourceType: input.resourceType as string | undefined,
        resourceId: input.resourceId as string | undefined,
        resourceName: input.resourceName as string | undefined,
        sourceAgent: input.sourceAgent as string | undefined,
        details: input.details as Record<string, unknown> | undefined,
      });
      return { logged: true, eventType: input.eventType };
    }

    case 'list_pending_reviews': {
      const contextRevisions = await getAllProposedRevisions();
      const allAgents = await getAllAgents();
      const agents = allAgents.filter((a) => (a.approvalStatus ?? 'draft') === 'pending_approval');
      return {
        contextRevisions: contextRevisions.map((r) => ({
          id: r.id,
          contextId: r.contextId,
          commitMessage: r.commitMessage,
          createdBy: r.createdBy,
          createdAt: r.createdAt,
        })),
        agents: agents.map((a) => ({
          id: a.id,
          name: a.name,
          a2aUrl: a.a2aUrl,
          approvalStatus: a.approvalStatus ?? 'draft',
        })),
      };
    }

    case 'report_incident': {
      logAuditEvent({
        eventType: (input.eventType as string) || 'incident',
        resourceType: (input.resourceType as string) || 'incident',
        resourceId: input.resourceId as string | undefined,
        resourceName: input.resourceName as string | undefined,
        sourceAgent: input.sourceAgent as string | undefined,
        details: { ...(input.details as Record<string, unknown> | undefined), reportedAs: 'incident' },
      });
      return { logged: true, eventType: (input.eventType as string) || 'incident' };
    }

    case 'register': {
      const manifest = input.manifest as Record<string, unknown>;
      if (!manifest || typeof manifest.agent_id !== 'string' || typeof manifest.version !== 'string' || typeof manifest.owner_team !== 'string' || typeof manifest.url !== 'string') {
        throw new Error('register requires manifest with agent_id, version, owner_team, and url.');
      }
      const orgId = (input.orgId as string) || undefined;
      const agent = await registerByManifest(manifest as unknown as import('@/types').SandarbManifest, { orgId });
      return {
        id: agent.id,
        agentId: agent.agentId ?? agent.id,
        name: agent.name,
        approvalStatus: agent.approvalStatus,
      };
    }

    case 'get_lineage': {
      const limit = Math.min(Math.max((input.limit as number) || 50, 1), 200);
      const entries = await getLineage(limit);
      return { entries };
    }

    case 'mcp_poll_agent': {
      const mcpUrlParam = input.mcpUrl as string | undefined;
      const agentIdParam = input.agentId as string | undefined;
      let mcpUrl: string;
      if (mcpUrlParam) {
        mcpUrl = mcpUrlParam;
      } else if (agentIdParam) {
        const agent = await getAgentById(agentIdParam);
        if (!agent) throw new Error(`Agent not found: ${agentIdParam}`);
        mcpUrl = deriveMcpUrl(agent.a2aUrl);
      } else {
        throw new Error('mcp_poll_agent requires agentId or mcpUrl.');
      }
      const timeoutMs = (input.timeoutMs as number) || 15000;
      const pollResult = await pollAgentMcp(mcpUrl, { timeoutMs });
      return {
        tools: pollResult.tools,
        resources: pollResult.resources,
        state: pollResult.state,
        error: pollResult.error,
      };
    }

    default:
      throw new Error(`Unknown skill: ${skillId}`);
  }
};

// ============================================================================
// MESSAGE HANDLING (Streaming)
// ============================================================================

/**
 * Process an A2A message and generate a response
 */
export const processMessage = async (
  message: A2AMessage
): Promise<A2AMessage> => {
  // Extract text content from the message
  const textParts = message.parts.filter(p => p.type === 'text') as Array<{ type: 'text'; text: string }>;
  const userText = textParts.map(p => p.text).join('\n');

  // Parse the request (simplified - in production use more robust parsing)
  const responseText = await handleUserRequest(userText);

  return {
    role: 'agent',
    parts: [{ type: 'text', text: responseText }],
    metadata: { timestamp: new Date().toISOString() },
  };
};

/**
 * Handle a natural language request
 */
const handleUserRequest = async (text: string): Promise<string> => {
  const lower = text.toLowerCase();

  // Simple intent detection
  if (lower.includes('list') && lower.includes('prompt')) {
    const prompts = getAllPrompts();
    return `Available prompts:\n${prompts.map(p => `- ${p.name}: ${p.description || 'No description'}`).join('\n')}`;
  }

  if (lower.includes('list') && lower.includes('context')) {
    const contexts = await getAllContexts();
    return `Available contexts:\n${contexts.map(c => `- ${c.name} (${c.environment}): ${c.description || 'No description'}`).join('\n')}`;
  }

  if (lower.includes('get prompt')) {
    const match = text.match(/get prompt[:\s]+(\S+)/i);
    if (match) {
      const prompt = getPromptByName(match[1]);
      if (prompt) {
        const version = getCurrentPromptVersion(prompt.id);
        return `Prompt "${prompt.name}" (v${version?.version || 1}):\n${version?.content || 'No content'}`;
      }
      return `Prompt "${match[1]}" not found.`;
    }
  }

  if (lower.includes('get context')) {
    const match = text.match(/get context[:\s]+(\S+)/i);
    if (match) {
      const context = await getContextByName(match[1]);
      if (context) {
        return `Context "${context.name}":\n${JSON.stringify(context.content, null, 2)}`;
      }
      return `Context "${match[1]}" not found.`;
    }
  }

  return `I can help you with:
- list prompts - Show all available prompts
- list contexts - Show all available contexts
- get prompt <name> - Get a specific prompt
- get context <name> - Get a specific context

You can also use the JSON-RPC API for programmatic access.`;
};
