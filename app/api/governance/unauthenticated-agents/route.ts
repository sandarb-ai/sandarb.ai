import { NextRequest, NextResponse } from 'next/server';
import { getUnauthenticatedDetections } from '@/lib/governance';

export const dynamic = 'force-dynamic';

/** GET /api/governance/unauthenticated-agents - List detected unauthenticated (shadow) agents for Agent Pulse. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);
    const items = getUnauthenticatedDetections(limit);
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Failed to list unauthenticated agents:', error);
    return NextResponse.json(
      { error: 'Failed to list unauthenticated agents' },
      { status: 500 }
    );
  }
}
