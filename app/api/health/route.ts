import { NextResponse } from 'next/server';
import { getContextCount } from '@/lib/contexts';
import { getTemplateCount } from '@/lib/templates';
import { withSpan, logger } from '@/lib/otel';

// GET /api/health - Health check endpoint
export async function GET() {
  return withSpan('GET /api/health', async () => {
    try {
      const contextStats = await getContextCount();
      const templateCount = await getTemplateCount();

      return NextResponse.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        database: {
          status: 'connected',
          contexts: contextStats.total,
          templates: templateCount,
        },
      });
    } catch (error) {
      logger.error('Health check failed', { route: 'GET /api/health', error: String(error) });
      return NextResponse.json(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Database connection failed',
        },
        { status: 503 }
      );
    }
  });
}
