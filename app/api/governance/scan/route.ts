import { NextResponse } from 'next/server';
import { runDiscoveryScan } from '@/lib/governance';
import { withSpan, logger } from '@/lib/otel';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST /api/governance/scan - Trigger shadow AI discovery scan. */
export async function POST() {
  return withSpan('POST /api/governance/scan', async () => {
    try {
      const result = await runDiscoveryScan();
      return NextResponse.json({
        success: true,
        scanned: result.scanned,
        detected: result.detected,
      });
    } catch (error) {
      logger.error('Discovery scan failed', { route: 'POST /api/governance/scan', error: String(error) });
      return NextResponse.json(
        { success: false, error: 'Discovery scan failed' },
        { status: 500 }
      );
    }
  });
}
