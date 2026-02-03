import { NextRequest, NextResponse } from 'next/server';
import { getA2ALog } from '@/lib/audit';

/**
 * GET /api/agent-pulse/log
 * Unified A2A log: all agent ↔ Sandarb communication (INJECT_SUCCESS + INJECT_DENIED) for Slack-like chat.
 * Query: ?limit=200 (default 200, max 500)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam
      ? Math.min(Math.max(parseInt(limitParam, 10) || 200, 1), 500)
      : 200;
    const entries = await getA2ALog(limit);
    return NextResponse.json({ success: true, data: { entries } });
  } catch (error) {
    console.error('Failed to fetch A2A log (DB may be unavailable):', error);
    // Return 200 with empty entries so Agent Pulse UI still loads (e.g. when DB not set up or Postgres down)
    return NextResponse.json({ success: true, data: { entries: [] } });
  }
}
