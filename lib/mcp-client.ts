/**
 * MCP (Model Context Protocol) Client – Sandarb as Supervisor/Governor Agent
 *
 * Sandarb acts as an MCP Client to "see" into other agents that implement
 * an MCP Server. Pull-based monitoring: Sandarb queries agents for their
 * current state, tools, resources (e.g. last prompts, active tool calls)
 * without agents having to push logs. Lightweight for the agents.
 *
 * @see https://modelcontextprotocol.io/
 */

const MCP_TIMEOUT_MS = 15000;

export interface McpPollResult {
  tools: Array<{ name: string; description?: string }>;
  resources: Array<{ uri: string; name?: string; description?: string }>;
  state?: Record<string, unknown>;
  lastPrompts?: unknown[];
  error?: string;
}

/**
 * Derive MCP server URL from agent A2A URL (e.g. https://agent.example.com -> https://agent.example.com/mcp).
 * If agent has explicit mcpUrl, use that instead.
 */
export function deriveMcpUrl(a2aUrl: string, explicitMcpUrl?: string | null): string {
  if (explicitMcpUrl) return explicitMcpUrl.replace(/\/$/, '');
  try {
    const u = new URL(a2aUrl);
    return `${u.origin}${u.pathname.replace(/\/$/, '')}/mcp`;
  } catch {
    return `${a2aUrl.replace(/\/$/, '')}/mcp`;
  }
}

/**
 * Poll an agent's MCP server: list tools and resources (pull-based monitoring).
 * Agents that implement an MCP Server can be queried by Sandarb for current state,
 * last prompts, or active tool calls. This is lightweight for agents (no push logging).
 *
 * Uses fetch to call MCP-compatible HTTP endpoints. Many MCP servers expose
 * Streamable HTTP or a POST endpoint accepting JSON-RPC-style requests.
 * Convention: try POST with envelope for tools/list and resources/list.
 */
export async function pollAgentMcp(
  mcpServerUrl: string,
  options?: { timeoutMs?: number }
): Promise<McpPollResult> {
  const timeout = options?.timeoutMs ?? MCP_TIMEOUT_MS;
  const result: McpPollResult = { tools: [], resources: [] };
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    // Try Streamable HTTP POST (single message endpoint). MCP Streamable HTTP often uses
    // POST with Content-Type application/json and a JSON-RPC-like body.
    const baseUrl = mcpServerUrl.replace(/\/$/, '');
    const endpoints = [`${baseUrl}`, `${baseUrl}/mcp`, `${baseUrl}/sse`];

    for (const endpoint of endpoints) {
      try {
        // Request tools/list
        const toolsRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/list',
            params: {},
          }),
          signal: controller.signal,
        });

        if (toolsRes.ok) {
          const toolsData = await toolsRes.json();
          const toolsList = toolsData?.result?.tools ?? toolsData?.tools ?? [];
          result.tools = Array.isArray(toolsList)
            ? toolsList.map((t: { name?: string; description?: string }) => ({
                name: t.name ?? 'unknown',
                description: t.description,
              }))
            : [];
        }

        // Request resources/list
        const resourcesRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'resources/list',
            params: {},
          }),
          signal: controller.signal,
        });

        if (resourcesRes.ok) {
          const resourcesData = await resourcesRes.json();
          const resourcesList = resourcesData?.result?.resources ?? resourcesData?.resources ?? [];
          result.resources = Array.isArray(resourcesList)
            ? resourcesList.map((r: { uri?: string; name?: string; description?: string }) => ({
                uri: r.uri ?? '',
                name: r.name,
                description: r.description,
              }))
            : [];
        }

        if (result.tools.length > 0 || result.resources.length > 0) {
          clearTimeout(id);
          return result;
        }
      } catch {
        continue;
      }
    }

    // If no endpoint responded with tools/resources, try convention tool "get_state" on first endpoint
    try {
      const callRes = await fetch(endpoints[0], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'get_state', arguments: {} },
        }),
        signal: controller.signal,
      });
      if (callRes.ok) {
        const callData = await callRes.json();
        const content = callData?.result?.content ?? callData?.content;
        if (content) result.state = typeof content === 'object' ? content : { raw: content };
      }
    } catch {
      // Optional: get_state not required
    }

    clearTimeout(id);
    return result;
  } catch (err) {
    clearTimeout(id);
    result.error = err instanceof Error ? err.message : 'MCP poll failed';
    return result;
  }
}
