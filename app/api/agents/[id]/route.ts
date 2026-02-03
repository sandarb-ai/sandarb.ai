import { NextRequest, NextResponse } from 'next/server';
import { getAgentById, updateAgent, deleteAgent } from '@/lib/agents';
import type { RegisteredAgentUpdateInput } from '@/types';
import { withSpan, logger } from '@/lib/otel';

// GET /api/agents/:id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSpan('GET /api/agents/[id]', async () => {
    try {
      const { id } = await params;
      const agent = await getAgentById(id);
      if (!agent) {
        return NextResponse.json(
          { success: false, error: 'Agent not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: agent });
    } catch (error) {
      logger.error('Failed to fetch agent', { route: 'GET /api/agents/[id]', error: String(error) });
      return NextResponse.json(
        { success: false, error: 'Failed to fetch agent' },
        { status: 500 }
      );
    }
  });
}

// PUT /api/agents/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSpan('PUT /api/agents/[id]', async () => {
    try {
      const { id } = await params;
      const body = await request.json() as RegisteredAgentUpdateInput;
      const agent = await updateAgent(id, body);
      if (!agent) {
        return NextResponse.json(
          { success: false, error: 'Agent not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: agent });
    } catch (error) {
      logger.error('Failed to update agent', { route: 'PUT /api/agents/[id]', error: String(error) });
      return NextResponse.json(
        { success: false, error: 'Failed to update agent' },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/agents/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSpan('DELETE /api/agents/[id]', async () => {
    try {
      const { id } = await params;
      const deleted = await deleteAgent(id);
      if (!deleted) {
        return NextResponse.json(
          { success: false, error: 'Agent not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete agent', { route: 'DELETE /api/agents/[id]', error: String(error) });
      return NextResponse.json(
        { success: false, error: 'Failed to delete agent' },
        { status: 500 }
      );
    }
  });
}
