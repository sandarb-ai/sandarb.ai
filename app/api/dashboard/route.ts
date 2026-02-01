import { NextResponse } from 'next/server';
import { getContextCount, getRecentActivity } from '@/lib/contexts';
import { getTemplateCount } from '@/lib/templates';

// GET /api/dashboard - Stats and recent activity for the dashboard
export async function GET() {
  try {
    const contextStats = await getContextCount();
    const templateCount = getTemplateCount();
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
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load dashboard' },
      { status: 500 }
    );
  }
}
