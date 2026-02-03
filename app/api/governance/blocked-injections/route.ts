import { NextRequest, NextResponse } from 'next/server';
import { getBlockedInjections } from '@/lib/audit';
import { withSpan, logger } from '@/lib/otel';

export const dynamic = 'force-dynamic';

/** GET /api/governance/blocked-injections - List policy-blocked context injections for Agent Pulse. */
export async function GET(request: NextRequest) {
  return withSpan('GET /api/governance/blocked-injections', async () => {
    try {
      const { searchParams } = new URL(request.url);
      const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);
      const items = await getBlockedInjections(limit);
      return NextResponse.json({ items });
    } catch (error) {
      logger.error('Failed to list blocked injections', { route: 'GET /api/governance/blocked-injections', error: String(error) });
      return NextResponse.json(
        { error: 'Failed to list blocked injections' },
        { status: 500 }
      );
    }
  });
}
