import { NextRequest, NextResponse } from 'next/server';
import { getAllAgents, createAgent } from '@/lib/agents';
import { getRootOrganization } from '@/lib/organizations';
import type { RegisteredAgentCreateInput } from '@/types';
import { withSpan, logger } from '@/lib/otel';

// GET /api/agents - List agents, optionally by org. Excludes agents in root org when listing all.
export async function GET(request: NextRequest) {
  return withSpan('GET /api/agents', async () => {
    try {
      const { searchParams } = new URL(request.url);
      const orgId = searchParams.get('orgId') || undefined;
      const approvalStatus = searchParams.get('approvalStatus') || undefined;
      let agents = await getAllAgents(orgId, approvalStatus);
      if (!orgId) {
        const root = await getRootOrganization();
        if (root) agents = agents.filter((a) => a.orgId !== root.id);
      }
      return NextResponse.json({ success: true, data: agents });
    } catch (error) {
      logger.error('Failed to fetch agents', { route: 'GET /api/agents', error: String(error) });
      return NextResponse.json(
        { success: false, error: 'Failed to fetch agents' },
        { status: 500 }
      );
    }
  });
}

// POST /api/agents - Create/register agent (manual or with agentCard)
export async function POST(request: NextRequest) {
  return withSpan('POST /api/agents', async () => {
    try {
      const body = await request.json();
      const { orgId, name, description, a2aUrl, agentCard } = body as RegisteredAgentCreateInput;

      if (!orgId || !name || !a2aUrl) {
        return NextResponse.json(
          { success: false, error: 'orgId, name, and a2aUrl are required' },
          { status: 400 }
        );
      }

      const agent = await createAgent({
        orgId,
        name,
        description,
        a2aUrl,
        agentCard: agentCard ?? null,
      });

      return NextResponse.json({ success: true, data: agent }, { status: 201 });
    } catch (error) {
      logger.error('Failed to create agent', { route: 'POST /api/agents', error: String(error) });
      return NextResponse.json(
        { success: false, error: 'Failed to create agent' },
        { status: 500 }
      );
    }
  });
}
