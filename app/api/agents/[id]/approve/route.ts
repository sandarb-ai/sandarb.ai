import { NextRequest, NextResponse } from 'next/server';
import { approveAgent } from '@/lib/agents';
import { withSpan, logger } from '@/lib/otel';

// POST /api/agents/:id/approve
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSpan('POST /api/agents/[id]/approve', async () => {
    try {
      const { id } = await params;
      const body = await request.json().catch(() => ({}));
      const approvedBy = (body as { approvedBy?: string }).approvedBy;
      const agent = await approveAgent(id, approvedBy);
      if (!agent) {
        return NextResponse.json(
          { success: false, error: 'Agent not found or not pending approval' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: agent });
    } catch (error) {
      logger.error('Failed to approve agent', { route: 'POST /api/agents/[id]/approve', error: String(error) });
      return NextResponse.json(
        { success: false, error: 'Failed to approve agent' },
        { status: 500 }
      );
    }
  });
}
