import { NextRequest, NextResponse } from 'next/server';
import { approveRevision } from '@/lib/revisions';
import { withSpan, logger } from '@/lib/otel';

// POST /api/contexts/:id/revisions/:revId/approve
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; revId: string }> }
) {
  return withSpan('POST /api/contexts/[id]/revisions/[revId]/approve', async () => {
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
      logger.error('Failed to approve revision', { route: 'POST /api/contexts/[id]/revisions/[revId]/approve', error: String(error) });
      return NextResponse.json(
        { success: false, error: 'Failed to approve revision' },
        { status: 500 }
      );
    }
  });
}
