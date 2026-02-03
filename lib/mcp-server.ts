/**
 * MCP (Model Context Protocol) Server Implementation
 *
 * Exposes OpenInt's prompts and contexts as MCP resources and tools
 * that can be used by Claude, ChatGPT, and other LLM clients.
 *
 * @see https://modelcontextprotocol.io/
 */

import { getAllPrompts, getPromptByName, getCurrentPromptVersion, interpolatePrompt } from './prompts';
import { getAllContexts, getContextByName } from './contexts';
import { formatContent } from './utils';
import type { MCPResource, MCPTool, MCPPrompt, MCPPromptMessage } from '@/types';

// ============================================================================
// MCP RESOURCES
// ============================================================================

/**
 * List all available resources (prompts and contexts)
 */
export const listResources = async (): Promise<MCPResource[]> => {
  const resources: MCPResource[] = [];

  // Add prompts as resources
  const prompts = await getAllPrompts();
  for (const prompt of prompts) {
    resources.push({
      uri: `openint://prompts/${prompt.name}`,
      name: prompt.name,
      description: prompt.description || `Prompt: ${prompt.name}`,
      mimeType: 'text/plain',
    });
  }

  // Add contexts as resources
  const contexts = await getAllContexts();
  for (const context of contexts) {
    resources.push({
      uri: `openint://contexts/${context.name}`,
      name: context.name,
      description: context.description || `Context: ${context.name}`,
      mimeType: 'application/json',
    });
  }

  return resources;
};

/**
 * Read a specific resource by URI
 */
export const readResource = async (uri: string): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> => {
  const match = uri.match(/^sandarb:\/\/(prompts|contexts)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid resource URI: ${uri}`);
  }

  const [, type, name] = match;

  if (type === 'prompts') {
    const prompt = await getPromptByName(name);
    if (!prompt) throw new Error(`Prompt not found: ${name}`);

    const version = await getCurrentPromptVersion(prompt.id);
    const content = version?.content || '';

    return {
      contents: [{
        uri,
        mimeType: 'text/plain',
        text: content,
      }],
    };
  }

  if (type === 'contexts') {
    const context = await getContextByName(name);
    if (!context) throw new Error(`Context not found: ${name}`);

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(context.content, null, 2),
      }],
    };
  }

  throw new Error(`Unknown resource type: ${type}`);
};

// ============================================================================
// MCP TOOLS
// ============================================================================

/**
 * List all available tools
 */
export const listTools = (): MCPTool[] => [
  {
    name: 'get_prompt',
    description: 'Get a prompt by name with optional variable interpolation',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The prompt name (slug)',
        },
        variables: {
          type: 'object',
          description: 'Variables to interpolate into the prompt',
          additionalProperties: true,
        },
        version: {
          type: 'number',
          description: 'Specific version number (defaults to current)',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_context',
    description: 'Get a context configuration by name',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The context name',
        },
        environment: {
          type: 'string',
          enum: ['development', 'staging', 'production'],
          description: 'Environment filter',
        },
        format: {
          type: 'string',
          enum: ['json', 'yaml', 'text'],
          description: 'Output format',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_prompts',
    description: 'List all available prompts',
    inputSchema: {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags',
        },
      },
    },
  },
  {
    name: 'list_contexts',
    description: 'List all available contexts',
    inputSchema: {
      type: 'object',
      properties: {
        environment: {
          type: 'string',
          enum: ['development', 'staging', 'production'],
        },
        activeOnly: {
          type: 'boolean',
          default: true,
        },
      },
    },
  },
  {
    name: 'compose_context',
    description: 'Compose multiple contexts together',
    inputSchema: {
      type: 'object',
      properties: {
        names: {
          type: 'array',
          items: { type: 'string' },
          description: 'Context names to compose (in order)',
        },
        format: {
          type: 'string',
          enum: ['json', 'yaml', 'text'],
        },
      },
      required: ['names'],
    },
  },
];

/**
 * Call a tool with the given arguments
 */
export const callTool = async (
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
  switch (name) {
    case 'get_prompt': {
      const prompt = await getPromptByName(args.name as string);
      if (!prompt) {
        return { content: [{ type: 'text', text: `Prompt not found: ${args.name}` }] };
      }

      const version = await getCurrentPromptVersion(prompt.id);
      if (!version) {
        return { content: [{ type: 'text', text: `No versions found for prompt: ${args.name}` }] };
      }

      let content = version.content;
      if (args.variables) {
        content = interpolatePrompt(content, args.variables as Record<string, unknown>);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            name: prompt.name,
            version: version.version,
            content,
            model: version.model,
            systemPrompt: version.systemPrompt,
          }, null, 2),
        }],
      };
    }

    case 'get_context': {
      const context = await getContextByName(args.name as string);
      if (!context) {
        return { content: [{ type: 'text', text: `Context not found: ${args.name}` }] };
      }

      const format = (args.format as string) || 'json';
      const formatted = formatContent(context.content, format as 'json' | 'yaml' | 'text');

      return { content: [{ type: 'text', text: formatted }] };
    }

    case 'list_prompts': {
      const prompts = await getAllPrompts();
      const filtered = args.tags
        ? prompts.filter(p => (args.tags as string[]).some(t => p.tags.includes(t)))
        : prompts;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(
            filtered.map(p => ({ name: p.name, description: p.description, tags: p.tags })),
            null, 2
          ),
        }],
      };
    }

    case 'list_contexts': {
      let contexts = await getAllContexts();

      if (args.environment) {
        contexts = contexts.filter(c => c.environment === args.environment);
      }
      if (args.activeOnly !== false) {
        contexts = contexts.filter(c => c.isActive);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(
            contexts.map(c => ({ name: c.name, description: c.description, environment: c.environment })),
            null, 2
          ),
        }],
      };
    }

    case 'compose_context': {
      const names = args.names as string[];
      const composed: Record<string, unknown> = {};

      for (const name of names) {
        const context = await getContextByName(name);
        if (context) {
          Object.assign(composed, context.content);
        }
      }

      const format = (args.format as string) || 'json';
      const formatted = formatContent(composed, format as 'json' | 'yaml' | 'text');

      return { content: [{ type: 'text', text: formatted }] };
    }

    default:
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
  }
};

// ============================================================================
// MCP PROMPTS (Prompt Templates)
// ============================================================================

/**
 * List available MCP prompt templates
 */
export const listMCPPrompts = async (): Promise<MCPPrompt[]> => {
  const prompts = await getAllPrompts();

  const results: MCPPrompt[] = [];
  for (const prompt of prompts) {
    const version = await getCurrentPromptVersion(prompt.id);
    const variables = version?.variables || [];

    results.push({
      name: prompt.name,
      description: prompt.description || undefined,
      arguments: variables.map(v => ({
        name: v.name,
        description: v.description,
        required: v.required,
      })),
    });
  }
  return results;
};

/**
 * Get a prompt with messages
 */
export const getMCPPrompt = async (
  name: string,
  args: Record<string, unknown>
): Promise<{ messages: MCPPromptMessage[] }> => {
  const prompt = await getPromptByName(name);
  if (!prompt) {
    throw new Error(`Prompt not found: ${name}`);
  }

  const version = await getCurrentPromptVersion(prompt.id);
  if (!version) {
    throw new Error(`No versions found for prompt: ${name}`);
  }

  let content = version.content;
  if (Object.keys(args).length > 0) {
    content = interpolatePrompt(content, args);
  }

  const messages: MCPPromptMessage[] = [];

  // Add system prompt if present
  if (version.systemPrompt) {
    messages.push({
      role: 'user',
      content: { type: 'text', text: `[System]: ${version.systemPrompt}` },
    });
  }

  // Add main prompt
  messages.push({
    role: 'user',
    content: { type: 'text', text: content },
  });

  return { messages };
};

// ============================================================================
// MCP SERVER INFO
// ============================================================================

export const getServerInfo = () => ({
  name: 'openint-sandarb',
  version: '0.2.0',
  protocolVersion: '2024-11-05',
  capabilities: {
    resources: { subscribe: false, listChanged: true },
    tools: {},
    prompts: { listChanged: true },
  },
});
