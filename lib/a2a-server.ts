/**
 * A2A (Agent-to-Agent Protocol) Implementation
 *
 * The Sandarb AI Governance Agent participates in A2A, which is fast becoming
 * the industry standard for AI agents to discover, communicate, and collaborate.
 * Sandarb acts as an A2A server so other agents can call it for governance
 * (validation, approved context, lineage, registry), and Sandarb can communicate
 * with other agents via A2A as a first-class participant.
 *
 * @see https://github.com/a2aproject/A2A
 * @see https://a2a-protocol.org/
 */

import { v4 as uuidv4 } from 'uuid';
import { getAllPrompts, getPromptByName, getCurrentPromptVersion, interpolatePrompt } from './prompts';
import { getAllContexts, getContextByName } from './contexts';
import { formatContent } from './utils';
import { getAgentById, getAllAgents, getAgentByIdentifier, registerByManifest } from './agents';
import { getProposedRevisions, getAllProposedRevisions } from './revisions';
import { logAuditEvent, logContextDelivery, logPromptUsage, getLineage } from './audit';
import { checkInjectPolicy } from './policy';
import { pollAgentMcp, deriveMcpUrl } from './mcp-client';
import type {
  AgentCard,
  AgentSkill,
  A2ATask,
  A2ATaskSpec,
  A2AMessage,
  A2AMessagePart,
  A2AArtifact,
  TaskStatus,
} from '@/types';

// ============================================================================
// AGENT CARD (A2A spec: capabilities object, defaultInputModes, defaultOutputModes, skills with tags)
// ============================================================================

/**
 * Generate the Agent Card that describes the Sandarb AI Governance Agent.
 * A2A is fast becoming the industry standard for agent-to-agent communication;
 * Sandarb participates as an AI agent that other agents call for governance
 * and can communicate with other agents via A2A.
 * Aligned with Google A2A spec: https://google.github.io/A2A/specification/
 */
export const getAgentCard = (baseUrl: string): AgentCard => {
  const a2aUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/api/a2a` : '';
  return {
    name: 'Sandarb',
    description:
      'Sandarb AI Governance Agent: regulatory, controls, risk management, and compliance for AI agents. Participates in A2A (industry standard for agent-to-agent communication). Other agents call Sandarb for validation, approved context/prompts, audit logging, and pending-review visibility; Sandarb can also communicate with other agents via A2A.',
    url: a2aUrl,
    version: '0.3.0',
    provider: { organization: 'OpenInt', url: 'https://github.com/openint-ai/sandarb' },
    documentationUrl: baseUrl ? `${baseUrl}/docs` : undefined,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    securitySchemes: {
      bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'token' },
    },
    security: [{ bearer: [] }],
    defaultInputModes: ['application/json', 'text/plain'],
    defaultOutputModes: ['application/json', 'text/plain'],
    skills: getAgentSkills(),
    authentication: { type: 'bearer', schemes: ['Bearer'] },
  };
};

/** A2A spec AgentSkill requires tags; optional examples as string[]. */
function skill(
  s: Omit<AgentSkill, 'tags'> & { tags?: string[]; examples?: string[] },
): AgentSkill {
  return {
    ...s,
    tags: s.tags ?? ['governance'],
    examples: s.examples,
  };
}

/**
 * Get all skills this agent supports (A2A spec: id, name, description, tags, optional examples/inputModes/outputModes).
 * Exported for docs and tooling.
 */
export const getAgentSkills = (): AgentSkill[] => [
  skill({
    id: 'get_prompt',
    name: 'Get Prompt',
    description:
      'Retrieve a prompt by name with optional variable interpolation. Returns the prompt content along with metadata like model recommendations and system prompt.',
    tags: ['prompts', 'governance'],
    examples: ['Get prompt by name: customer-support', 'Retrieve prompt with variables for interpolation'],
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
    inputModes: ['application/json'],
    outputModes: ['application/json'],
  }),
  skill({
    id: 'get_context',
    name: 'Get Context',
    description:
      'Retrieve a context configuration by name. Sandarb logs who asked and why (lineage). Contexts contain structured data that can be injected into AI agent workflows.',
    tags: ['context', 'governance', 'lineage'],
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Context name' },
        environment: { type: 'string', enum: ['development', 'staging', 'production'] },
        format: { type: 'string', enum: ['json', 'yaml', 'text'] },
        sourceAgent: { type: 'string', description: 'Calling agent identifier (for audit/lineage)' },
        intent: { type: 'string', description: 'Why this context is needed (for lineage)' },
      },
      required: ['name', 'sourceAgent'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        content: { type: 'object' },
        format: { type: 'string' },
      },
    },
    inputModes: ['application/json'],
    outputModes: ['application/json'],
  }),
  skill({
    id: 'list_prompts',
    name: 'List Prompts',
    description: 'List all available prompts, optionally filtered by tags.',
    tags: ['prompts', 'discovery'],
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
    inputModes: ['application/json'],
    outputModes: ['application/json'],
  }),
  skill({
    id: 'list_contexts',
    name: 'List Contexts',
    description: 'List all available contexts, optionally filtered by environment.',
    tags: ['context', 'discovery'],
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
    inputModes: ['application/json'],
    outputModes: ['application/json'],
  }),
  skill({
    id: 'compose_contexts',
    name: 'Compose Contexts',
    description:
      'Compose multiple contexts together in order. Sandarb logs who asked (lineage). Later contexts override earlier ones.',
    tags: ['context', 'composition', 'lineage'],
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
    inputModes: ['application/json'],
    outputModes: ['application/json'],
  }),
  skill({
    id: 'set_context',
    name: 'Set Context',
    description: 'Create or update a context configuration.',
    tags: ['context', 'governance'],
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
    inputModes: ['application/json'],
    outputModes: ['application/json'],
  }),
  skill({
    id: 'validate_context',
    name: 'Validate Context',
    description:
      'Check that a context exists and return the current approved content. Sandarb logs who asked (lineage). Use before using context in production for compliance.',
    tags: ['context', 'governance', 'compliance', 'lineage'],
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
    inputModes: ['application/json'],
    outputModes: ['application/json'],
  }),
  skill({
    id: 'get_approved_context',
    name: 'Get Approved Context',
    description:
      'Get the current approved context content by name. Sandarb logs who asked and why (lineage). For compliance: only returns the approved snapshot.',
    tags: ['context', 'governance', 'compliance', 'lineage'],
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
    inputModes: ['application/json'],
    outputModes: ['application/json'],
  }),
  skill({
    id: 'validate_agent',
    name: 'Validate Agent',
    description: 'Check if an agent is registered and approved. Use before delegating to another agent for controls.',
    tags: ['agents', 'governance', 'registry'],
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
    inputModes: ['application/json'],
    outputModes: ['application/json'],
  }),
  skill({
    id: 'audit_log',
    name: 'Audit Log',
    description:
      'Log an event for compliance and audit trail. Other agents call this to record actions (e.g. prompt used, context used, agent invoked).',
    tags: ['audit', 'compliance', 'governance'],
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
    inputModes: ['application/json'],
    outputModes: ['application/json'],
  }),
  skill({
    id: 'list_pending_reviews',
    name: 'List Pending Reviews',
    description: 'List all pending context revisions and agent registrations awaiting approval. For governance and risk oversight.',
    tags: ['governance', 'reviews', 'compliance'],
    inputSchema: { type: 'object', properties: {} },
    outputSchema: {
      type: 'object',
      properties: {
        contextRevisions: { type: 'array' },
        agents: { type: 'array' },
      },
    },
    inputModes: ['application/json'],
    outputModes: ['application/json'],
  }),
  skill({
    id: 'report_incident',
    name: 'Report Incident',
    description: 'Log a risk or incident event. Other agents call this for risk management and regulatory reporting.',
    tags: ['incident', 'risk', 'compliance'],
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
    inputModes: ['application/json'],
    outputModes: ['application/json'],
  }),
  skill({
    id: 'register',
    name: 'Register (Ping)',
    description:
      'Protocol-based registration: send your Sandarb manifest (Agent Card / sandarb.json). When an agent starts up, it pings Sandarb with its manifest via this skill or the /api/agents/ping API. Creates a living registry; unregistered agents should not be granted access to company data.',
    tags: ['registry', 'governance', 'registration'],
    inputSchema: {
      type: 'object',
      properties: {
        manifest: {
          type: 'object',
          description:
            'Sandarb manifest: agent_id, version, owner_team, url; optional: name, description, tools_used, allowed_data_scopes, pii_handling, regulatory_scope',
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
    inputModes: ['application/json'],
    outputModes: ['application/json'],
  }),
  skill({
    id: 'get_lineage',
    name: 'Get Lineage',
    description:
      'Lineage reporting: who requested which context and when. Single source of truth for "This decision was made using context from Document X, retrieved by Agent Y".',
    tags: ['lineage', 'audit', 'compliance'],
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
    inputModes: ['application/json'],
    outputModes: ['application/json'],
  }),
  skill({
    id: 'mcp_poll_agent',
    name: 'MCP Poll Agent',
    description:
      'Pull-based monitoring: Sandarb (MCP Client) queries an agent (MCP Server) for its tools, resources, and optional state (e.g. last prompts, active tool calls). Lightweight for agents—no push logging required.',
    tags: ['mcp', 'monitoring', 'governance'],
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'Registered agent ID (Sandarb derives MCP URL from agent A2A URL)',
        },
        mcpUrl: { type: 'string', description: 'Direct MCP server URL (alternative to agentId)' },
        timeoutMs: { type: 'number', description: 'Timeout in ms (default 15000)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        tools: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
        },
        resources: {
          type: 'array',
          items: { type: 'object', properties: { uri: { type: 'string' }, name: { type: 'string' } } },
        },
        state: { type: 'object' },
        error: { type: 'string' },
      },
    },
    inputModes: ['application/json'],
    outputModes: ['application/json'],
  }),
];

// ============================================================================
// TASK EXECUTION (A2A spec: Task with contextId, status: { state, message?, timestamp })
// ============================================================================

// In-memory task storage (in production, use database)
const tasks = new Map<string, A2ATask>();
const contextIds = new Map<string, string>();

function now(): string {
  return new Date().toISOString();
}

/**
 * Create a new task (A2A spec: id, contextId, status with state/timestamp).
 */
export const createTask = (skill: string, input: Record<string, unknown>): A2ATask => {
  const id = uuidv4();
  const contextId = uuidv4();
  contextIds.set(id, contextId);
  const task: A2ATask = {
    id,
    contextId,
    agentId: 'sandarb',
    skill,
    input,
    status: { state: 'submitted', timestamp: now() },
    createdAt: now(),
  };

  tasks.set(task.id, task);
  return task;
};

/**
 * Execute a task; updates status to working then completed/failed (A2A spec TaskState).
 */
export const executeTask = async (taskId: string): Promise<A2ATask> => {
  const task = tasks.get(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);

  task.status = { state: 'working', timestamp: now() };

  try {
    const result = await executeSkill(task.skill, task.input);
    task.output = result;
    task.status = { state: 'completed', timestamp: now() };
    task.completedAt = now();
  } catch (error) {
    task.error = error instanceof Error ? error.message : 'Unknown error';
    task.status = { state: 'failed', message: messageFromText(task.error), timestamp: now() };
    task.completedAt = now();
  }

  return task;
};

function messageFromText(text: string): A2AMessage {
  return {
    role: 'agent',
    parts: [{ kind: 'text', text }],
    messageId: uuidv4(),
    kind: 'message',
    metadata: { timestamp: now() },
  };
}

/**
 * Get task by ID (internal A2ATask).
 */
export const getTask = (taskId: string): A2ATask | undefined => {
  return tasks.get(taskId);
};

/**
 * Convert internal A2ATask to A2A spec Task (id, contextId, status, artifacts, metadata).
 */
export const taskToSpec = (task: A2ATask): A2ATaskSpec => {
  const artifacts: A2AArtifact[] = [];
  if (task.output !== undefined) {
    artifacts.push({
      artifactId: uuidv4(),
      name: `${task.skill}_result`,
      description: `Result of skill ${task.skill}`,
      parts: [{ kind: 'data', data: typeof task.output === 'object' && task.output !== null ? (task.output as Record<string, unknown>) : { value: task.output } }],
      metadata: { skill: task.skill, completedAt: task.completedAt },
    });
  }
  if (task.error) {
    artifacts.push({
      artifactId: uuidv4(),
      name: 'error',
      description: 'Error details',
      parts: [{ kind: 'data', data: { error: task.error } }],
    });
  }
  return {
    id: task.id,
    contextId: task.contextId,
    status: task.status,
    artifacts: artifacts.length > 0 ? artifacts : undefined,
    metadata: { agentId: task.agentId, skill: task.skill, createdAt: task.createdAt, completedAt: task.completedAt },
  };
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
      const prompt = await getPromptByName(input.name as string);
      if (!prompt) throw new Error(`Prompt not found: ${input.name}`);

      const version = await getCurrentPromptVersion(prompt.id);
      if (!version) throw new Error(`No versions found for prompt: ${input.name}`);

      let content = version.content;
      if (input.variables) {
        content = interpolatePrompt(content, input.variables as Record<string, unknown>);
      }

      const agentId = (input.agentId as string) ?? 'anonymous';
      const traceId = (input.traceId as string) ?? `a2a-${Date.now()}`;
      await logPromptUsage({
        agentId,
        traceId,
        promptId: prompt.id,
        promptVersionId: version.id,
        promptName: prompt.name,
        intent: input.intent as string | undefined,
      });

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
      const sourceAgent = (input.sourceAgent as string)?.trim();
      if (!sourceAgent) {
        throw new Error('get_context requires sourceAgent (calling agent identifier). Only registered agents may pull context.');
      }

      const context = await getContextByName(input.name as string);
      if (!context) throw new Error(`Context not found: ${input.name}`);

      const agent = await getAgentByIdentifier(sourceAgent);
      if (!agent) {
        throw new Error('Agent not registered with Sandarb. Only registered agents may pull context.');
      }

      const policy = checkInjectPolicy(agent, context);
      if (!policy.allowed) {
        throw new Error(policy.reason ?? 'Policy violation: cross-LOB access not allowed.');
      }

      await logContextDelivery({
        sourceAgent,
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
      let prompts = await getAllPrompts();
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
      await logAuditEvent({
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
      await logAuditEvent({
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
// MESSAGE HANDLING (A2A spec: message/send returns Task | Message)
// ============================================================================

/** Normalize part: A2A spec uses "kind"; accept legacy "type" for backward compat. */
function partKind(p: A2AMessagePart | { kind?: string; type?: string }): 'text' | 'data' | 'file' {
  const k = (p as { kind?: string; type?: string }).kind ?? (p as { type?: string }).type;
  if (k === 'data' || k === 'file') return k;
  return 'text';
}

/** Extract text from parts (supports kind or type). */
function textFromParts(parts: (A2AMessagePart & { type?: string })[]): string {
  return parts
    .filter(p => partKind(p) === 'text')
    .map(p => ('text' in p ? p.text : ''))
    .join('\n');
}

/** Extract first DataPart payload (supports kind or type; spec uses kind: "data" with data object). */
function dataFromParts(parts: (A2AMessagePart | { kind?: string; type?: string; data?: unknown })[]): Record<string, unknown> | null {
  const dataPart = parts.find(p => partKind(p) === 'data');
  if (!dataPart) return null;
  const d = (dataPart as { data?: unknown }).data;
  if (typeof d === 'object' && d !== null) return d as Record<string, unknown>;
  if (d !== undefined) return { raw: d };
  return null;
}

/**
 * Process an A2A message/send: returns Task (if skill invoked via DataPart) or Message (conversational).
 * A2A spec: result is Task | Message.
 */
export const processMessage = async (
  params: { message: A2AMessage & { messageId?: string; kind?: string }; configuration?: { blocking?: boolean } },
): Promise<A2ATaskSpec | A2AMessage> => {
  const raw = params.message;
  const messageId = raw.messageId ?? uuidv4();
  const parts = raw.parts ?? [];
  const data = dataFromParts(parts);

  // Skill invocation via DataPart: { skillId, input } -> execute and return Task
  if (data && typeof data.skillId === 'string' && data.input !== undefined) {
    const skillId = data.skillId as string;
    const input = (typeof data.input === 'object' && data.input !== null ? data.input : {}) as Record<string, unknown>;
    const task = createTask(skillId, input);
    const completed = await executeTask(task.id);
    return taskToSpec(completed);
  }

  // Conversational: text (and optional legacy) -> reply as Message
  const userText = textFromParts(parts) || (data ? JSON.stringify(data) : '');
  const responseText = await handleUserRequest(userText);

  const responseMessage: A2AMessage = {
    role: 'agent',
    parts: [{ kind: 'text', text: responseText }],
    messageId: uuidv4(),
    kind: 'message',
    metadata: { timestamp: now() },
  };
  return responseMessage;
};

/**
 * Handle a natural language request
 */
const handleUserRequest = async (text: string): Promise<string> => {
  const lower = text.toLowerCase();

  // Simple intent detection
  if (lower.includes('list') && lower.includes('prompt')) {
    const prompts = await getAllPrompts();
    return `Available prompts:\n${prompts.map(p => `- ${p.name}: ${p.description || 'No description'}`).join('\n')}`;
  }

  if (lower.includes('list') && lower.includes('context')) {
    const contexts = await getAllContexts();
    return `Available contexts:\n${contexts.map(c => `- ${c.name} (${c.environment}): ${c.description || 'No description'}`).join('\n')}`;
  }

  if (lower.includes('get prompt')) {
    const match = text.match(/get prompt[:\s]+(\S+)/i);
    if (match) {
      const prompt = await getPromptByName(match[1]);
      if (prompt) {
        const version = await getCurrentPromptVersion(prompt.id);
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
