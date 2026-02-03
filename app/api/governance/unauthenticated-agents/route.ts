import { NextRequest, NextResponse } from 'next/server';
import { getUnauthenticatedDetections } from '@/lib/governance';
import { withSpan, logger } from '@/lib/otel';

export const dynamic = 'force-dynamic';

/** GET /api/governance/unauthenticated-agents - List detected unauthenticated (shadow) agents for Agent Pulse. */
export async function GET(request: NextRequest) {
  return withSpan('GET /api/governance/unauthenticated-agents', async () => {
    try {
      const { searchParams } = new URL(request.url);
      const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);
      const items = await getUnauthenticatedDetections(limit);
      return NextResponse.json({ items });
    } catch (error) {
      logger.error('Failed to list unauthenticated agents', { route: 'GET /api/governance/unauthenticated-agents', error: String(error) });
      return NextResponse.json(
        { error: 'Failed to list unauthenticated agents' },
        { status: 500 }
      );
    }
  });
}
