import { NextRequest, NextResponse } from 'next/server';
import { getAllAgents, createAgent } from '@/lib/agents';
import type { RegisteredAgentCreateInput } from '@/types';

// GET /api/agents - List agents, optionally by org
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId') || undefined;
    const agents = await getAllAgents(orgId);
    return NextResponse.json({ success: true, data: agents });
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

// POST /api/agents - Create/register agent (manual or with agentCard)
export async function POST(request: NextRequest) {
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
    console.error('Failed to create agent:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}
