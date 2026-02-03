import { NextRequest, NextResponse } from 'next/server';
import { registerByManifest } from '@/lib/agents';
import type { SandarbManifest } from '@/types';
import { withSpan, logger } from '@/lib/otel';

/**
 * POST /api/agents/ping
 *
 * Manifest-based registration (protocol-based). Agents include a sandarb.json
 * (Agent Card) in their repo or expose it at an endpoint, and ping Sandarb on
 * startup with their manifest. Creates a living registry without manual entry.
 * Body: SandarbManifest. Optional query: orgId (else org resolved from owner_team or root).
 */
export async function POST(request: NextRequest) {
  return withSpan('POST /api/agents/ping', async () => {
    try {
      const body = await request.json();
      const manifest = body as SandarbManifest;

      if (!manifest.agent_id || !manifest.version || !manifest.owner_team || !manifest.url) {
        return NextResponse.json(
          {
            success: false,
            error: 'Manifest must include agent_id, version, owner_team, and url.',
          },
          { status: 400 }
        );
      }

      const { searchParams } = new URL(request.url);
      const orgId = searchParams.get('orgId') || undefined;

      const agent = await registerByManifest(manifest, { orgId });
      return NextResponse.json({ success: true, data: agent }, { status: 201 });
    } catch (error) {
      logger.error('Agent ping failed', { route: 'POST /api/agents/ping', error: String(error) });
      const message = error instanceof Error ? error.message : 'Agent ping failed';
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
  });
}
