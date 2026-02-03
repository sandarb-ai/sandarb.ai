import { NextRequest, NextResponse } from 'next/server';
import { getAgentById } from '@/lib/agents';
import { pollAgentMcp, deriveMcpUrl } from '@/lib/mcp-client';
import { withSpan, logger } from '@/lib/otel';

/**
 * GET /api/agents/:id/mcp-poll
 * Pull-based monitoring: Sandarb (MCP Client) queries this agent's MCP server
 * for tools, resources, and optional state. Lightweight for agents.
 * Query: ?timeoutMs=15000
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withSpan('GET /api/agents/[id]/mcp-poll', async () => {
    try {
      const agent = await getAgentById(params.id);
      if (!agent) {
        return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
      }
      const { searchParams } = new URL(request.url);
      const timeoutMs = searchParams.get('timeoutMs')
        ? parseInt(searchParams.get('timeoutMs')!, 10)
        : 15000;
      const mcpUrl = deriveMcpUrl(agent.a2aUrl);
      const result = await pollAgentMcp(mcpUrl, { timeoutMs });
      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      logger.error('MCP poll failed', { route: 'GET /api/agents/[id]/mcp-poll', error: String(error) });
      const message = error instanceof Error ? error.message : 'MCP poll failed';
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  });
}
