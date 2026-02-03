import { NextRequest, NextResponse } from 'next/server';
import { getGovernanceIntersectionLog } from '@/lib/audit';
import { withSpan, logger } from '@/lib/otel';

/**
 * GET /api/governance/intersection
 * 
 * Governance Intersection API: Query the audit log to reconstruct incidents.
 * Answers questions like: "On Feb 1st at 2:00 PM, Agent X used Prompt v4.2 and accessed Context Chunk #992"
 * 
 * Query params:
 *   - agentId: Filter by agent ID
 *   - traceId: Filter by trace ID (for specific inference sessions)
 *   - startDate: ISO date string (e.g., "2024-02-01T00:00:00Z")
 *   - endDate: ISO date string (e.g., "2024-02-01T23:59:59Z")
 *   - limit: Max results (default 100)
 */
export async function GET(request: NextRequest) {
  return withSpan('GET /api/governance/intersection', async () => {
    try {
      const { searchParams } = new URL(request.url);
      const agentId = searchParams.get('agentId') || undefined;
      const traceId = searchParams.get('traceId') || undefined;
      const startDate = searchParams.get('startDate') || undefined;
      const endDate = searchParams.get('endDate') || undefined;
      const limit = parseInt(searchParams.get('limit') || '100', 10);

      const entries = await getGovernanceIntersectionLog(limit, {
        agentId,
        traceId,
        startDate,
        endDate,
      });

      return NextResponse.json({
        success: true,
        data: entries,
        meta: {
          count: entries.length,
          filters: { agentId, traceId, startDate, endDate, limit },
          description: 'Governance intersection log: prompts + contexts used together by agents',
          usage: 'Use this API to reconstruct incidents by querying what prompts and contexts an agent used at a specific time.',
        },
      });
    } catch (error) {
      logger.error('Failed to fetch governance intersection log', { route: 'GET /api/governance/intersection', error: String(error) });
      return NextResponse.json(
        { success: false, error: 'Failed to fetch governance intersection log' },
        { status: 500 }
      );
    }
  });
}
