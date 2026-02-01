import { NextRequest, NextResponse } from 'next/server';
import { rejectAgent } from '@/lib/agents';

// POST /api/agents/:id/reject
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const rejectedBy = (body as { rejectedBy?: string }).rejectedBy;
    const agent = await rejectAgent(id, rejectedBy);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found or not pending approval' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: agent });
  } catch (error) {
    console.error('Failed to reject agent:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reject agent' },
      { status: 500 }
    );
  }
}
