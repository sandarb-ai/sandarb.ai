import { NextRequest, NextResponse } from 'next/server';
import { registerAgentByUrl } from '@/lib/agents';

// POST /api/agents/register - Register agent by A2A URL (fetches Agent Card)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, a2aUrl, name, description } = body as {
      orgId: string;
      a2aUrl: string;
      name?: string;
      description?: string;
    };

    if (!orgId || !a2aUrl) {
      return NextResponse.json(
        { success: false, error: 'orgId and a2aUrl are required' },
        { status: 400 }
      );
    }

    const agent = await registerAgentByUrl(orgId, a2aUrl, { name, description });
    return NextResponse.json({ success: true, data: agent }, { status: 201 });
  } catch (error) {
    console.error('Failed to register agent:', error);
    const message = error instanceof Error ? error.message : 'Failed to register agent';
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
