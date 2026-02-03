import { NextRequest, NextResponse } from 'next/server';
import { getLineage } from '@/lib/audit';
import { withSpan, logger } from '@/lib/otel';

/**
 * GET /api/lineage
 * Lineage reporting: who requested which context and when.
 * Single source of truth for "This decision was made using context from Document X, retrieved by Agent Y".
 * Query: ?limit=50 (default 50, max 200)
 */
export async function GET(request: NextRequest) {
  return withSpan('GET /api/lineage', async () => {
    try {
      const { searchParams } = new URL(request.url);
      const limitParam = searchParams.get('limit');
      const limit = limitParam
        ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200)
        : 50;
      const entries = await getLineage(limit);
      return NextResponse.json({ success: true, data: { entries } });
    } catch (error) {
      logger.error('Failed to fetch lineage', { route: 'GET /api/lineage', error: String(error) });
      return NextResponse.json(
        { success: false, error: 'Failed to fetch lineage' },
        { status: 500 }
      );
    }
  });
}
