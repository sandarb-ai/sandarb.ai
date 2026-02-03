import { NextRequest, NextResponse } from 'next/server';
import { rejectRevision } from '@/lib/revisions';
import { withSpan, logger } from '@/lib/otel';

// POST /api/contexts/:id/revisions/:revId/reject
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; revId: string }> }
) {
  return withSpan('POST /api/contexts/[id]/revisions/[revId]/reject', async () => {
    try {
      const { revId } = await params;
      const body = await request.json().catch(() => ({}));
      const rejectedBy = (body as { rejectedBy?: string }).rejectedBy;
      const revision = await rejectRevision(revId, rejectedBy);
      if (!revision) {
        return NextResponse.json(
          { success: false, error: 'Revision not found or not proposed' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: revision });
    } catch (error) {
      logger.error('Failed to reject revision', { route: 'POST /api/contexts/[id]/revisions/[revId]/reject', error: String(error) });
      return NextResponse.json(
        { success: false, error: 'Failed to reject revision' },
        { status: 500 }
      );
    }
  });
}
