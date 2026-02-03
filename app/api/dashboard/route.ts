import { NextResponse } from 'next/server';
import { getContextCount, getRecentActivity } from '@/lib/contexts';
import { getTemplateCount } from '@/lib/templates';
import { withSpan, logger } from '@/lib/otel';

// GET /api/dashboard - Stats and recent activity for the dashboard
export async function GET() {
  return withSpan('GET /api/dashboard', async () => {
    try {
      const contextStats = await getContextCount();
      const templateCount = await getTemplateCount();
      const recentActivity = (await getRecentActivity(5)) as Record<string, unknown>[];
      return NextResponse.json({
        success: true,
        data: {
          contextCount: contextStats,
          templateCount,
          recentActivity: recentActivity.map((a) => ({
            id: a.id,
            type: a.type,
            resource_name: a.resource_name ?? a.context_name,
            resource_id: a.resource_id ?? a.context_id,
            created_at: a.created_at,
          })),
        },
      });
    } catch (error) {
      logger.error('Dashboard API error', { route: 'GET /api/dashboard', error: String(error) });
      return NextResponse.json(
        { success: false, error: 'Failed to load dashboard' },
        { status: 500 }
      );
    }
  });
}
