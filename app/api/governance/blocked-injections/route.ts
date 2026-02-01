import { NextRequest, NextResponse } from 'next/server';
import { getBlockedInjections } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** GET /api/governance/blocked-injections - List policy-blocked context injections for Agent Pulse. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);
    const items = await getBlockedInjections(limit);
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Failed to list blocked injections:', error);
    return NextResponse.json(
      { error: 'Failed to list blocked injections' },
      { status: 500 }
    );
  }
}
