import { NextRequest, NextResponse } from 'next/server';
import { approveRevision } from '@/lib/revisions';

// POST /api/contexts/:id/revisions/:revId/approve
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; revId: string }> }
) {
  try {
    const { revId } = await params;
    const body = await request.json().catch(() => ({}));
    const approvedBy = (body as { approvedBy?: string }).approvedBy;
    const revision = await approveRevision(revId, approvedBy);
    if (!revision) {
      return NextResponse.json(
        { success: false, error: 'Revision not found or not proposed' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: revision });
  } catch (error) {
    console.error('Failed to approve revision:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve revision' },
      { status: 500 }
    );
  }
}
