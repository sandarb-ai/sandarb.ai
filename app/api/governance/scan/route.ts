import { NextResponse } from 'next/server';
import { runDiscoveryScan } from '@/lib/governance';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST /api/governance/scan - Trigger shadow AI discovery scan. */
export async function POST() {
  try {
    const result = await runDiscoveryScan();
    return NextResponse.json({
      success: true,
      scanned: result.scanned,
      detected: result.detected,
    });
  } catch (error) {
    console.error('Discovery scan failed:', error);
    return NextResponse.json(
      { success: false, error: 'Discovery scan failed' },
      { status: 500 }
    );
  }
}
