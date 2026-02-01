import { NextResponse } from 'next/server';
import { getContextCount } from '@/lib/contexts';
import { getTemplateCount } from '@/lib/templates';

// GET /api/health - Health check endpoint
export async function GET() {
  try {
    // Try to access the database
    const contextStats = await getContextCount();
    const templateCount = getTemplateCount();

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
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Database connection failed',
      },
      { status: 503 }
    );
  }
}
